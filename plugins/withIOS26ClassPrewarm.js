/**
 * Expo config plugin: withIOS26ClassPrewarm
 *
 * On iOS 26.x, Apple changed how lazy ObjC class stubs are registered. When an
 * ObjC class is first messaged on a background GCD thread, the runtime calls
 * _dyld_objc_class_count() to realize all pending lazy stubs. This call races
 * with Hermes VM initialization on the JS thread, corrupting a JSI function
 * pointer and crashing the app at launch (EXC_BAD_ACCESS / null PC in
 * hermes::vm::Runtime::drainJobs).
 *
 * The fix: call objc_copyClassList() on the main thread in
 * application:didFinishLaunchingWithOptions: before the React Native bridge
 * starts. This forces every lazy class stub to be realized upfront so that
 * background threads never need to trigger _dyld_objc_class_count themselves.
 */

const { withAppDelegate } = require('@expo/config-plugins')

const PREWARM_MARKER = '// [withIOS26ClassPrewarm]'

const PREWARM_CODE = `    ${PREWARM_MARKER}
    // Pre-realize all lazy ObjC class stubs on the main thread before the React
    // Native bridge starts. On iOS 26.x, the first ObjC message sent to any
    // unrealized class from a background thread triggers _dyld_objc_class_count,
    // which races with Hermes VM initialization and corrupts a JSI function
    // pointer, causing a null-PC crash in hermes::vm::Runtime::drainJobs.
    var _rnPrewarmCount: UInt32 = 0
    _ = objc_copyClassList(&_rnPrewarmCount)
`

module.exports = function withIOS26ClassPrewarm(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      // Objective-C AppDelegate (rare for Expo 55+) — skip
      return config
    }

    let contents = config.modResults.contents

    // Idempotency guard
    if (contents.includes(PREWARM_MARKER)) {
      return config
    }

    // Ensure ObjectiveC is imported so objc_copyClassList is available
    if (!contents.includes('import ObjectiveC')) {
      // Insert after the first import line
      contents = contents.replace(/^(import .+)$/m, '$1\nimport ObjectiveC')
    }

    // Insert the pre-warm block as the very first statement inside
    // application(_:didFinishLaunchingWithOptions:).
    // Match the opening brace of the method regardless of exact signature
    // formatting differences across Expo/RN template versions.
    const methodPattern = /(func application\b[^{]*didFinishLaunchingWithOptions[^{]*\{[ \t]*\n)/
    if (methodPattern.test(contents)) {
      contents = contents.replace(methodPattern, `$1${PREWARM_CODE}`)
    } else {
      console.warn(
        '[withIOS26ClassPrewarm] Could not find didFinishLaunchingWithOptions in AppDelegate — skipping patch.'
      )
    }

    config.modResults.contents = contents
    return config
  })
}
