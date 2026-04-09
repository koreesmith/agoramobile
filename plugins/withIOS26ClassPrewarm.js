/**
 * Expo config plugin: withIOS26NativePrewarm
 *
 * Crash: ObjCTurboModule::performVoidMethodInvocation throws an NSException on
 * a background GCD thread ~400ms into bridge startup on iOS 26.x.
 *
 * Root cause: a void TurboModule native method calls a UIKit or system API that
 * iOS 26 now enforces must run on the main thread. React Native's release-mode
 * error handler rethrows ALL ObjC exceptions from native modules as fatal
 * (debug builds show a red screen instead), so the crash is silent in TestFlight.
 *
 * We know the crash site (ObjCTurboModule::performVoidMethodInvocation) from
 * symbolication, but not which specific module/method yet — the exception message
 * that would reveal it is captured just before the abort and not surfaced in the
 * standard crash log.
 *
 * This plugin does two things:
 *
 *  1. Pre-initializes the most likely singleton culprits on the main thread so
 *     background-thread first-access no longer throws.
 *
 *  2. Installs an NSUncaughtExceptionHandler that writes the full exception reason
 *     (including module name and method name from React Native's error message) to
 *     a file in the app's Documents directory. If the crash persists, open the
 *     file with the Xcode device file browser or Files app to read the exact
 *     module/method that threw — then we can write a targeted fix.
 */

const { withAppDelegate } = require('@expo/config-plugins')

const PREWARM_MARKER = '// [withIOS26NativePrewarm]'

const PREWARM_CODE = `    ${PREWARM_MARKER}
    // ── Singleton pre-warm ────────────────────────────────────────────────────
    // Force-initialize system singletons on the main thread. On iOS 26.x, their
    // first access from a background GCD thread (React Native's TurboModule queue)
    // throws NSException, which React Native rethrows as a fatal crash.
    _ = URLSession.shared
    _ = UNUserNotificationCenter.current()

    // ── Exception logger ──────────────────────────────────────────────────────
    // Capture the full exception reason (contains module name + method name from
    // React Native's ObjCTurboModule::performVoidMethodInvocation error message)
    // and persist it so we can read it after the crash.
    NSSetUncaughtExceptionHandler { exception in
      let msg = "\\n[withIOS26NativePrewarm] Uncaught exception: \\(exception.name.rawValue)\\n" +
                "Reason: \\(exception.reason ?? "nil")\\n" +
                "UserInfo: \\(exception.userInfo ?? [:])\\n" +
                "Stack:\\n\\(exception.callStackSymbols.joined(separator: "\\n"))\\n"
      if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
        let url = dir.appendingPathComponent("ios26_crash.log")
        try? msg.write(to: url, atomically: true, encoding: .utf8)
      }
    }
`

module.exports = function withIOS26NativePrewarm(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      return config
    }

    let contents = config.modResults.contents

    // Idempotency guard
    if (contents.includes(PREWARM_MARKER)) {
      return config
    }

    // Ensure UserNotifications is imported for UNUserNotificationCenter
    if (!contents.includes('import UserNotifications')) {
      contents = contents.replace(/^(import .+)$/m, '$1\nimport UserNotifications')
    }

    // Remove artefacts from the previous (wrong) objc_copyClassList attempt
    contents = contents.replace(/\n?import ObjectiveC\n?/g, '\n')
    contents = contents.replace(/[ \t]*\/\/ \[withIOS26ClassPrewarm\][^\n]*\n([ \t][^\n]*\n)*/g, '')

    // Insert the pre-warm + logger block as the very first statement inside
    // application(_:didFinishLaunchingWithOptions:)
    const methodPattern = /(func application\b[^{]*didFinishLaunchingWithOptions[^{]*\{[ \t]*\n)/
    if (methodPattern.test(contents)) {
      contents = contents.replace(methodPattern, `$1${PREWARM_CODE}`)
    } else {
      console.warn(
        '[withIOS26NativePrewarm] Could not find didFinishLaunchingWithOptions — skipping patch.'
      )
    }

    config.modResults.contents = contents
    return config
  })
}
