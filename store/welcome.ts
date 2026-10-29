import { create } from 'zustand'

// AMOBILE-202: getting started wizard state that has to outlive the wizard
// screen itself. Not persisted: "once per launch" is the point.
interface WelcomeState {
  // Accounts the wizard has opened for since the app launched. Leaving it
  // without finishing brings it back on the next launch, not every time the
  // tabs remount.
  shownFor: string[]
  markShown: (accountId: string) => void
  // AMOBILE-205: "Write a post" on the last step. The feed opens its
  // composer once it's back on screen, the same hand-off Settings uses to
  // open What's New there.
  composeRequested: boolean
  requestCompose: () => void
  consumeCompose: () => void
}

export const useWelcomeStore = create<WelcomeState>((set, get) => ({
  shownFor: [],
  markShown: (accountId) => {
    if (!get().shownFor.includes(accountId)) set({ shownFor: [...get().shownFor, accountId] })
  },
  composeRequested: false,
  requestCompose: () => set({ composeRequested: true }),
  consumeCompose: () => set({ composeRequested: false }),
}))
