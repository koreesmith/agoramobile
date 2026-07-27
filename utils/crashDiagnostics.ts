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

// Written by the patched RCTTurboModule.mm (withTurboModuleVoidExceptionGuard).
const LOG_FILENAME = 'turbomodule_exceptions.log'

// Written by IOS26TerminateLogger.mm (withIOS26ClassPrewarm) when an exception
// reaches std::terminate. In build 112 this handler ran and aborted, so it holds
// the name and reason of the exception that is actually killing the app.
const TERMINATE_LOG_FILENAME = 'ios26_crash.log'

// Keep alerts readable — the native log includes a full symbolicated stack.
const MAX_ALERT_CHARS = 1200

function logFile(name: string = LOG_FILENAME): File {
  return new File(Paths.document, name)
}

function readLog(name: string): string | null {
  try {
    const file = logFile(name)
    if (!file.exists) return null
    const text = file.textSync()
    return text.trim().length > 0 ? text : null
  } catch {
    return null
  }
}

/**
 * Contents of the native void-TurboModule exception log, or null if nothing has
 * been recorded. Never throws — diagnostics must not become a failure mode.
 */
export function readNativeExceptionLog(): string | null {
  return readLog(LOG_FILENAME)
}

export function readTerminateLog(): string | null {
  return readLog(TERMINATE_LOG_FILENAME)
}

export function clearNativeExceptionLog(): void {
  for (const name of [LOG_FILENAME, TERMINATE_LOG_FILENAME]) {
    try {
      const file = logFile(name)
      if (file.exists) file.delete()
    } catch {
      // Nothing useful to do — the logs are best-effort.
    }
  }
}

/**
 * Shows anything the native handlers recorded since the last launch.
 *
 * Both logs also live in the app's Documents folder, which is exposed to the
 * Files app (UIFileSharingEnabled) — that is the reliable way to retrieve them,
 * since an alert disappears with the process if the app dies again.
 */
export function reportNativeExceptionLog(): void {
  const terminate = readTerminateLog()
  const voidException = readNativeExceptionLog()
  if (!terminate && !voidException) return

  const parts: string[] = []
  if (terminate) parts.push(`— std::terminate —\n${latestEntry(terminate, '[ios26]')}`)
  if (voidException) {
    parts.push(`— void TurboModule —\n${latestEntry(voidException, '[turbomodule-void-exception]')}`)
  }

  Alert.alert(
    'Native exception recorded',
    truncate(parts.join('\n\n')),
    [
      { text: 'Keep (also in Files app)', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearNativeExceptionLog },
    ],
  )
}

/** Logs are appended across launches — show the most recent entry. */
function latestEntry(log: string, delimiter: string): string {
  const entries = log.split(delimiter).filter(e => e.trim())
  return (entries[entries.length - 1] ?? log).trim()
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
