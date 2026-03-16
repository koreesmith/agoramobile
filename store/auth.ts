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

interface AuthState {
  user: User | null
  token: string | null
  instanceUrl: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string, instanceUrl: string) => void
  updateUser: (updates: Partial<User>) => void
  logout: () => void
  loadFromStorage: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  instanceUrl: null,
  isAuthenticated: false,

  setAuth: async (user, token, instanceUrl) => {
    await SecureStore.setItemAsync('agora_token', token)
    await SecureStore.setItemAsync('agora_user', JSON.stringify(user))
    await SecureStore.setItemAsync('agora_instance', instanceUrl)
    set({ user, token, instanceUrl, isAuthenticated: true })
  },

  updateUser: (updates) => set((state) => {
    if (!state.user) return state
    const updated = { ...state.user, ...updates }
    SecureStore.setItemAsync('agora_user', JSON.stringify(updated))
    return { user: updated }
  }),

  logout: async () => {
    await SecureStore.deleteItemAsync('agora_token')
    await SecureStore.deleteItemAsync('agora_user')
    await SecureStore.deleteItemAsync('agora_instance')
    set({ user: null, token: null, instanceUrl: null, isAuthenticated: false })
  },

  loadFromStorage: async () => {
    try {
      const [token, userStr, instanceUrl] = await Promise.all([
        SecureStore.getItemAsync('agora_token'),
        SecureStore.getItemAsync('agora_user'),
        SecureStore.getItemAsync('agora_instance'),
      ])
      if (token && userStr && instanceUrl) {
        set({ token, user: JSON.parse(userStr), instanceUrl, isAuthenticated: true })
      }
    } catch {}
  },
}))
