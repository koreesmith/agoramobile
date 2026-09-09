import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

export interface User {
  id: string
  username: string
  email: string
  display_name: string
  pronouns: string
  bio: string
  avatar_url: string
  cover_url: string
  location: string
  website: string
  role: 'user' | 'moderator' | 'admin'
  profile_private: boolean
}

export interface Account {
  id: string
  user: User
  token: string
  instanceUrl: string
}

// AMOBILE-189: most people will never want more than a couple of accounts;
// the cap keeps the per-account polling and push-token juggling bounded.
export const MAX_ACCOUNTS = 5

export type AddAccountResult =
  | { status: 'added'; id: string }
  | { status: 'exists'; id: string }
  | { status: 'limit' }

// Keychain keys accept only [A-Za-z0-9._-], so the natural identity
// `instanceUrl + user.id` (which carries "://") can't be one directly.
// Slugify the host and keep the real URL inside the stored blob. The `__`
// separator plus a slugged user id keeps two different servers from
// colliding on the same key.
export function accountId(instanceUrl: string, userId: string): string {
  const host = instanceUrl
    .replace(/^https?:\/\//, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const uid = String(userId).replace(/[^A-Za-z0-9]+/g, '-')
  return `${host}__${uid}`
}

const IDS_KEY = 'agora_account_ids'
const ACTIVE_KEY = 'agora_active_account'
const ACCT_PREFIX = 'agora_acct_'

// Pre-multi-account keys. AMOBILE-190 folds these into accounts[0] on the
// first launch of the build that ships multi-account, then deletes them.
const LEGACY_TOKEN = 'agora_token'
const LEGACY_USER = 'agora_user'
const LEGACY_INSTANCE = 'agora_instance'

interface AuthState {
  // Active-account mirror. Everything that read the single identity before
  // (the axios interceptor, every screen calling useAuthStore()) keeps
  // reading these, kept in sync with the active account on every mutation.
  user: User | null
  token: string | null
  instanceUrl: string | null
  isAuthenticated: boolean

  // Multi-account (AMOBILE-189).
  accounts: Account[]
  activeAccountId: string | null

  // True while the (auth) stack is being used to add another account, so
  // its "already signed in, bounce to tabs" redirect stays out of the way
  // (AMOBILE-191).
  addingAccount: boolean

  setAuth: (user: User, token: string, instanceUrl: string) => Promise<void>
  addAccount: (user: User, token: string, instanceUrl: string) => Promise<AddAccountResult>
  setActiveAccount: (id: string) => void
  removeAccount: (id: string) => void
  signOutActive: () => void
  updateUser: (updates: Partial<User>) => void
  logout: () => void
  setAddingAccount: (v: boolean) => void
  loadFromStorage: () => void
}

function persist(accounts: Account[], activeAccountId: string | null) {
  try {
    SecureStore.setItem(IDS_KEY, JSON.stringify(accounts.map((a) => a.id)))
    for (const a of accounts) {
      SecureStore.setItem(
        ACCT_PREFIX + a.id,
        JSON.stringify({ user: a.user, token: a.token, instanceUrl: a.instanceUrl }),
      )
    }
    if (activeAccountId) SecureStore.setItem(ACTIVE_KEY, activeAccountId)
    else SecureStore.deleteItemAsync(ACTIVE_KEY).catch(() => {})
  } catch {}
}

function persistActive(id: string) {
  try {
    SecureStore.setItem(ACTIVE_KEY, id)
  } catch {}
}

function forget(id: string) {
  SecureStore.deleteItemAsync(ACCT_PREFIX + id).catch(() => {})
}

function clearIndex() {
  SecureStore.deleteItemAsync(IDS_KEY).catch(() => {})
  SecureStore.deleteItemAsync(ACTIVE_KEY).catch(() => {})
}

// Recompute the active-account mirror. Returned as a partial so zustand
// merges it over the actions and `addingAccount`.
function mirror(accounts: Account[], activeAccountId: string | null): Partial<AuthState> {
  const active = accounts.find((a) => a.id === activeAccountId) || null
  return {
    accounts,
    activeAccountId: active ? active.id : null,
    user: active?.user ?? null,
    token: active?.token ?? null,
    instanceUrl: active?.instanceUrl ?? null,
    isAuthenticated: !!active,
  }
}

// AMOBILE-190: one-time migration off the three single-account keys. Gated
// on the account index being absent, so lingering legacy keys can never
// trigger a second migration.
function migrateLegacy() {
  try {
    if (SecureStore.getItem(IDS_KEY)) return
    const token = SecureStore.getItem(LEGACY_TOKEN)
    const userStr = SecureStore.getItem(LEGACY_USER)
    const instanceUrl = SecureStore.getItem(LEGACY_INSTANCE)
    if (!token || !userStr || !instanceUrl) return
    const user: User = JSON.parse(userStr)
    const id = accountId(instanceUrl, user.id)
    persist([{ id, user, token, instanceUrl }], id)
    SecureStore.deleteItemAsync(LEGACY_TOKEN).catch(() => {})
    SecureStore.deleteItemAsync(LEGACY_USER).catch(() => {})
    SecureStore.deleteItemAsync(LEGACY_INSTANCE).catch(() => {})
  } catch {}
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  instanceUrl: null,
  isAuthenticated: false,
  accounts: [],
  activeAccountId: null,
  addingAccount: false,

  // Kept for the existing login screen call site; first sign-in is just the
  // first account.
  setAuth: async (user, token, instanceUrl) => {
    await get().addAccount(user, token, instanceUrl)
  },

  addAccount: async (user, token, instanceUrl) => {
    const id = accountId(instanceUrl, user.id)
    const existing = get().accounts.find((a) => a.id === id)
    if (existing) {
      const accounts = get().accounts.map((a) =>
        a.id === id ? { ...a, user, token, instanceUrl } : a,
      )
      persist(accounts, id)
      set(mirror(accounts, id))
      return { status: 'exists', id }
    }
    if (get().accounts.length >= MAX_ACCOUNTS) return { status: 'limit' }
    const accounts = [...get().accounts, { id, user, token, instanceUrl }]
    persist(accounts, id)
    set(mirror(accounts, id))
    return { status: 'added', id }
  },

  setActiveAccount: (id) => {
    if (id === get().activeAccountId) return
    if (!get().accounts.some((a) => a.id === id)) return
    persistActive(id)
    set(mirror(get().accounts, id))
  },

  removeAccount: (id) => {
    const remaining = get().accounts.filter((a) => a.id !== id)
    let active = get().activeAccountId
    if (active === id) active = remaining[0]?.id ?? null
    forget(id)
    if (remaining.length === 0) clearIndex()
    else persist(remaining, active)
    set(mirror(remaining, active))
  },

  signOutActive: () => {
    const id = get().activeAccountId
    if (id) get().removeAccount(id)
  },

  updateUser: (updates) => {
    const id = get().activeAccountId
    if (!id) return
    const accounts = get().accounts.map((a) =>
      a.id === id ? { ...a, user: { ...a.user, ...updates } } : a,
    )
    persist(accounts, id)
    set(mirror(accounts, id))
  },

  logout: () => {
    for (const a of get().accounts) forget(a.id)
    clearIndex()
    // In case a migration this session left the legacy keys behind.
    SecureStore.deleteItemAsync(LEGACY_TOKEN).catch(() => {})
    SecureStore.deleteItemAsync(LEGACY_USER).catch(() => {})
    SecureStore.deleteItemAsync(LEGACY_INSTANCE).catch(() => {})
    set(mirror([], null))
  },

  setAddingAccount: (v) => set({ addingAccount: v }),

  loadFromStorage: () => {
    // Synchronous reads — avoids async generator execution in Hermes at
    // startup which triggered a HadesGC write barrier crash on iOS 26.3.1.
    try {
      migrateLegacy()
      const idsRaw = SecureStore.getItem(IDS_KEY)
      if (!idsRaw) return
      const ids: string[] = JSON.parse(idsRaw)
      const accounts: Account[] = []
      for (const id of ids) {
        const raw = SecureStore.getItem(ACCT_PREFIX + id)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if (parsed?.user && parsed?.token && parsed?.instanceUrl) {
          accounts.push({ id, user: parsed.user, token: parsed.token, instanceUrl: parsed.instanceUrl })
        }
      }
      if (accounts.length === 0) return
      const storedActive = SecureStore.getItem(ACTIVE_KEY)
      const active = accounts.some((a) => a.id === storedActive) ? storedActive : accounts[0].id
      set(mirror(accounts, active))
    } catch {}
  },
}))
