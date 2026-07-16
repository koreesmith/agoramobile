import { create } from 'zustand'

// Lets Settings trigger the What's New modal (which lives on the feed
// screen) immediately, instead of requiring the user to relaunch the app.
interface WhatsNewState {
  forceShow: boolean
  trigger: () => void
  consume: () => void
}

export const useWhatsNewStore = create<WhatsNewState>((set) => ({
  forceShow: false,
  trigger: () => set({ forceShow: true }),
  consume: () => set({ forceShow: false }),
}))
