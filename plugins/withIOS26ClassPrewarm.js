/**
 * Expo config plugin: withIOS26NativePrewarm
 *
 * On iOS 26.x, certain system singletons (URLSession, UNUserNotificationCenter)
 * throw NSException when first accessed from a background GCD thread. React
 * Native's TurboModule dispatcher runs native module calls on background serial
 * queues, so the first call to any module that lazily initializes one of these
 * singletons crashes the app.
 *
 * In release/TestFlight builds React Native rethrows ALL ObjC exceptions as
 * fatal (instead of showing a red screen), so the crash is silent and immediate.
 *
 * Fix: force the relevant singletons to be initialized on the main thread in
 * application:didFinishLaunchingWithOptions: before the bridge starts. Subsequent
 * reads from background threads hit an already-initialized singleton and don't
 * throw.
 *
 * Previous attempt (objc_copyClassList) was wrong — it only slowed startup by
 * ~880ms (the time to enumerate all ObjC classes) without addressing the actual
 * singleton-initialization race.
 */

const { withAppDelegate } = require('@expo/config-plugins')

const PREWARM_MARKER = '// [withIOS26NativePrewarm]'

const PREWARM_CODE = `    ${PREWARM_MARKER}
    // Pre-initialize system singletons on the main thread before the React Native
    // bridge starts. On iOS 26.x, first access from a background GCD thread
    // throws NSException; React Native rethrows these as fatal in release builds.
    _ = URLSession.shared
    _ = UNUserNotificationCenter.current()
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

    // Add UserNotifications import if not present
    if (!contents.includes('import UserNotifications')) {
      contents = contents.replace(/^(import .+)$/m, '$1\nimport UserNotifications')
    }

    // Remove the old ObjectiveC import and objc_copyClassList block if present
    // (previous incorrect fix — it added ~880ms startup delay for no benefit)
    contents = contents.replace(/\n?import ObjectiveC\n?/g, '\n')
    contents = contents.replace(/[ \t]*\/\/ \[withIOS26ClassPrewarm\][^\n]*\n([ \t][^\n]*\n)*/g, '')

    // Insert the pre-warm block as the very first statement inside
    // application(_:didFinishLaunchingWithOptions:)
    const methodPattern = /(func application\b[^{]*didFinishLaunchingWithOptions[^{]*\{[ \t]*\n)/
    if (methodPattern.test(contents)) {
      contents = contents.replace(methodPattern, `$1${PREWARM_CODE}`)
    } else {
      console.warn(
        '[withIOS26NativePrewarm] Could not find didFinishLaunchingWithOptions in AppDelegate — skipping patch.'
      )
    }

    config.modResults.contents = contents
    return config
  })
}
