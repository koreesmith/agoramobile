import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

const STORAGE_KEY = 'agora_diagnostics'

/**
 * Whether to surface crash diagnostics on screen (AMOBILE-148).
 *
 * Off by default. This only controls *visibility* — the protective half of the
 * diagnostics always runs:
 *
 *   - the global JS error handler is always installed, so an uncaught JS error
 *     never reaches React Native's native fatal path (see utils/crashDiagnostics)
 *   - the patched RCTTurboModule.mm always records native void-method exceptions
 *
 * With this on, those errors are shown in an alert and the previous run's native
 * exception log is reported at startup. With it off they are still written to
 * console and to Documents, just not put in front of the user.
 */
interface DiagnosticsState {
  enabled: boolean
  setEnabled: (enabled: boolean) => Promise<void>
  loadPreference: () => void
}

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  enabled: false,

  setEnabled: async (enabled) => {
    // Set state first so the toggle responds even if the write fails.
    set({ enabled })
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, enabled ? '1' : '0')
    } catch {}
  },

  loadPreference: () => {
    try {
      set({ enabled: SecureStore.getItem(STORAGE_KEY) === '1' })
    } catch {}
  },
}))

/**
 * Readable from non-React code (the global error handler runs outside the tree).
 */
export function diagnosticsEnabled(): boolean {
  return useDiagnosticsStore.getState().enabled
}
