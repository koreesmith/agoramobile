import { create } from 'zustand'

interface ToastState {
  message: string | null
  type: 'success' | 'error'
  show: (message: string, type?: 'success' | 'error') => void
  hide: () => void
}

let hideTimer: ReturnType<typeof setTimeout> | null = null

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'success',

  show: (message, type = 'success') => {
    if (hideTimer) clearTimeout(hideTimer)
    set({ message, type })
    hideTimer = setTimeout(() => set({ message: null }), 2200)
  },

  hide: () => {
    if (hideTimer) clearTimeout(hideTimer)
    set({ message: null })
  },
}))
