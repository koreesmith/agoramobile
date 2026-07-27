/**
 * Crash diagnostics for AMOBILE-148.
 *
 * Two halves of the same investigation:
 *
 *  1. `installJSErrorHandler` replaces React Native's global JS error handler.
 *     RN's default routes uncaught JS errors into
 *     NativeExceptionsManager.reportFatalException — a *void* TurboModule method
 *     whose NSException, until the native patch landed, corrupted the Hermes heap
 *     and killed the process with no JS stack. Taking over the handler means an
 *     uncaught JS error is shown, not fatal.
 *
 *  2. `readNativeExceptionLog` reads the file written by the patched
 *     RCTTurboModule.mm (see plugins/withTurboModuleVoidExceptionGuard.js), which
 *     names the module and method that actually raised the NSException.
 *
 * Together these separate the two hypotheses for the group-screen crash: if a JS
 * error is reported, it was ours; if only a native exception is logged, it came
 * from a module method with no JS error involved.
 */

import { Alert } from 'react-native'
import { File, Paths } from 'expo-file-system'

const LOG_FILENAME = 'turbomodule_exceptions.log'

// Keep alerts readable — the native log includes a full symbolicated stack.
const MAX_ALERT_CHARS = 1200

function logFile(): File {
  return new File(Paths.document, LOG_FILENAME)
}

/**
 * Contents of the native void-TurboModule exception log, or null if nothing has
 * been recorded. Never throws — diagnostics must not become a failure mode.
 */
export function readNativeExceptionLog(): string | null {
  try {
    const file = logFile()
    if (!file.exists) return null
    const text = file.textSync()
    return text.trim().length > 0 ? text : null
  } catch {
    return null
  }
}

export function clearNativeExceptionLog(): void {
  try {
    const file = logFile()
    if (file.exists) file.delete()
  } catch {
    // Nothing useful to do — the log is best-effort.
  }
}

/**
 * Shows any native exception recorded since the last launch, then clears it so
 * the same one isn't reported twice.
 */
export function reportNativeExceptionLog(): void {
  const log = readNativeExceptionLog()
  if (!log) return

  // Most recent entry first — the file is appended to across launches.
  const entries = log.split('[turbomodule-void-exception]').filter(e => e.trim())
  const latest = entries[entries.length - 1] ?? log

  Alert.alert(
    'Native exception recorded',
    truncate(latest.trim()),
    [
      { text: 'Keep log', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearNativeExceptionLog },
    ],
  )
}

/**
 * Takes over RN's global JS error handler so an uncaught JS error surfaces as an
 * alert instead of reaching the native fatal path.
 */
export function installJSErrorHandler(): void {
  const globalAny = global as any
  const errorUtils = globalAny.ErrorUtils
  if (!errorUtils?.setGlobalHandler) return

  const previous = errorUtils.getGlobalHandler?.()

  errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    const name = error?.name ?? 'Error'
    const message = error?.message ?? String(error)
    const stack = error?.stack ?? '(no stack)'

    console.error(`[js-error] fatal=${!!isFatal} ${name}: ${message}\n${stack}`)

    Alert.alert(
      isFatal ? 'Unhandled JS error (fatal)' : 'Unhandled JS error',
      truncate(`${name}: ${message}\n\n${stack}`),
    )

    // Deliberately not delegating to `previous` for fatals: RN's handler is the
    // path that reaches reportFatalException. Non-fatals are safe to pass along.
    if (!isFatal && typeof previous === 'function') {
      previous(error, isFatal)
    }
  })
}

function truncate(text: string): string {
  return text.length > MAX_ALERT_CHARS ? `${text.slice(0, MAX_ALERT_CHARS)}\n…(truncated)` : text
}
