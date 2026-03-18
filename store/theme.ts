import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeState {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => Promise<void>
  loadPreference: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',

  setPreference: async (preference) => {
    await SecureStore.setItemAsync('agora_theme', preference)
    set({ preference })
  },

  loadPreference: async () => {
    try {
      const stored = await SecureStore.getItemAsync('agora_theme')
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ preference: stored })
      }
    } catch {}
  },
}))
