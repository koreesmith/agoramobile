import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeState {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => Promise<void>
  loadPreference: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',

  setPreference: async (preference) => {
    await SecureStore.setItemAsync('agora_theme', preference)
    set({ preference })
  },

  loadPreference: () => {
    try {
      const stored = SecureStore.getItem('agora_theme')
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ preference: stored })
      }
    } catch {}
  },
}))
