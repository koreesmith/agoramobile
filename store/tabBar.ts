import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { DEFAULT_BAR, FLEX_SLOTS, TAB_DESTINATIONS, TabDestinationId } from '../constants/tabDestinations'

// AGORA-446: which destinations the user keeps in the bottom bar. Saved on
// the device and shared by every account on it. Until the user changes
// something nothing is saved, so a destination added in a later release (like
// Reels) shows up in the default bar instead of being stuck in More.
const STORAGE_KEY = 'agora_tab_bar'

// Turns whatever was saved into a valid bar: only destinations that still
// exist, no repeats, no more than the slots allow, in canonical order. Returns
// null (use the default) when there is nothing usable, so a corrupt or stale
// value can never leave the bar broken.
export function normalizeBar(raw: unknown): TabDestinationId[] | null {
  if (!Array.isArray(raw)) return null
  const wanted = new Set(raw.filter((x): x is string => typeof x === 'string'))
  return TAB_DESTINATIONS.filter((d) => wanted.has(d.id)).slice(0, FLEX_SLOTS).map((d) => d.id)
}

interface TabBarState {
  // null means "never customized": use DEFAULT_BAR.
  saved: TabDestinationId[] | null
  load: () => void
  isInBar: (id: TabDestinationId) => boolean
  toggle: (id: TabDestinationId) => void
  reset: () => void
}

const barOf = (saved: TabDestinationId[] | null) => saved ?? DEFAULT_BAR

const persist = (saved: TabDestinationId[] | null) => {
  if (saved === null) SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {})
  else SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(saved)).catch(() => {})
}

export const useTabBarStore = create<TabBarState>((set, get) => ({
  saved: null,

  load: () => {
    try {
      const stored = SecureStore.getItem(STORAGE_KEY)
      if (stored) set({ saved: normalizeBar(JSON.parse(stored)) })
    } catch {}
  },

  isInBar: (id) => barOf(get().saved).includes(id),

  toggle: (id) => {
    const current = barOf(get().saved)
    let next: TabDestinationId[]
    if (current.includes(id)) {
      next = current.filter((x) => x !== id)
    } else {
      // Checking a box with every slot taken does nothing: the dialog
      // disables those boxes, and this keeps the store honest on its own.
      if (current.length >= FLEX_SLOTS) return
      next = [...current, id]
    }
    const saved = normalizeBar(next)
    set({ saved })
    persist(saved)
  },

  reset: () => {
    set({ saved: null })
    persist(null)
  },
}))

// The bar as the layout renders it.
export const useBar = () => barOf(useTabBarStore((s) => s.saved))
