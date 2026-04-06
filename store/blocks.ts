import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

const STORAGE_KEY = 'agora_blocked_ids'

interface BlockState {
  blockedIds: string[]
  loadBlocked: () => void
  addBlock: (id: string) => void
  removeBlock: (id: string) => void
  isBlocked: (id: string) => boolean
}

export const useBlockStore = create<BlockState>((set, get) => ({
  blockedIds: [],

  loadBlocked: () => {
    try {
      const stored = SecureStore.getItem(STORAGE_KEY)
      if (stored) set({ blockedIds: JSON.parse(stored) })
    } catch {}
  },

  addBlock: (id: string) => {
    const next = [...new Set([...get().blockedIds, id])]
    set({ blockedIds: next })
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next))
  },

  removeBlock: (id: string) => {
    const next = get().blockedIds.filter(bid => bid !== id)
    set({ blockedIds: next })
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next))
  },

  isBlocked: (id: string) => get().blockedIds.includes(id),
}))
