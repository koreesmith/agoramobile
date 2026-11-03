import { create } from 'zustand'

// AGORA-442: whether Reels plays with the sound off. Sound is on to begin with,
// like any video the person chose to open, and turning it off sticks for the
// rest of the session so it isn't asked again on every clip. Not persisted
// across launches: a fresh start is a fresh start.
interface ReelsState {
  muted: boolean
  setMuted: (m: boolean) => void
}

export const useReelsStore = create<ReelsState>((set) => ({
  muted: false,
  setMuted: (muted) => set({ muted }),
}))
