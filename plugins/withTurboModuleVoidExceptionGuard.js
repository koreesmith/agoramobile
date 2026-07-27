/**
 * Expo config plugin: withTurboModuleVoidExceptionGuard  (AMOBILE-148)
 *
 * Problem
 * -------
 * React Native handles an NSException thrown by a *void* TurboModule method like
 * this (ReactCommon/.../RCTTurboModule.mm, inside performVoidMethodInvocation):
 *
 *     @catch (NSException *exception) {
 *       throw convertNSExceptionToJSError(runtime, exception, ...);
 *     }
 *
 * convertNSExceptionToJSError builds jsi::Objects and calls runtime.global() —
 * but this block runs on the *module's dispatch queue*, not the JS thread. That
 * mutates the Hermes heap concurrently with whatever the JS thread is doing and
 * corrupts it. The process then dies with SIGSEGV somewhere inside Hermes, with
 * no JS stack and nothing symbolicated to the app binary.
 *
 * TestFlight builds 109, 110 and 111 all crashed this way. In every one of the
 * three logs the converting thread is stuck in backtrace_symbols (symbolicating
 * exception.callStackSymbols) while the JS thread dies in drainJobs().
 *
 * What this does
 * --------------
 * Replaces the @catch body for the *void* path only, so it records the module
 * name, method name and exception instead of touching `runtime`. Void methods
 * return nothing to JS, so there is no result to deliver and nothing to lose by
 * not rethrowing — and the current code is guaranteed to either corrupt the heap
 * or reach std::terminate anyway.
 *
 * The sync/promise path (performMethodInvocation) is deliberately left alone: it
 * runs on the JS thread, where the conversion is legitimate.
 *
 * The exception is written to Documents/turbomodule_exceptions.log, which the app
 * surfaces on next launch (see utils/nativeExceptionLog.ts), and NSLog'd.
 *
 * Why patch node_modules
 * ----------------------
 * The React-Core / ReactCommon pods compile straight from
 * ../node_modules/react-native/ReactCommon (see ios/Podfile.lock), so editing the
 * source at prebuild lands in the build. EAS runs install -> prebuild -> pod
 * install, so this reapplies on every CI build.
 *
 * This is pinned to the exact upstream text of react-native 0.83.4. If an RN
 * upgrade changes it, the plugin throws rather than silently no-opping — a silent
 * no-op would quietly reintroduce the crash.
 */

const { withDangerousMod } = require('@expo/config-plugins')
const path = require('path')
const fs = require('fs')

const MARKER = '[withTurboModuleVoidExceptionGuard]'

const SOURCE_REL_PATH =
  'node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm'

// Exact upstream text (react-native 0.83.4). Anchored on the `void` overload's
// @catch — note performMethodInvocation has a byte-identical @catch, so we match
// with the surrounding @finally that only the void path has.
const ORIGINAL_CATCH = `    @try {
      [inv invokeWithTarget:strongModule];
    } @catch (NSException *exception) {
      throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);
    } @finally {
      [retainedObjectsForInvocation removeAllObjects];
    }`

const PATCHED_CATCH = `    @try {
      [inv invokeWithTarget:strongModule];
    } @catch (NSException *exception) {
      // ${MARKER} AMOBILE-148 — do NOT touch \`runtime\` here. This block runs on
      // the module's dispatch queue, so building jsi values races the Hermes heap
      // against the JS thread and segfaults. Void methods return nothing to JS.
      RCTLogTurboModuleVoidException(moduleName, methodNameStr.c_str(), exception);
    } @finally {
      [retainedObjectsForInvocation removeAllObjects];
    }`

const HELPER_ANCHOR = `void ObjCTurboModule::performVoidMethodInvocation(`

const HELPER = `// ${MARKER} AMOBILE-148
// Records an NSException raised by a void TurboModule method without touching the
// JS runtime. Safe to call from any thread: it only uses Foundation.
static void RCTLogTurboModuleVoidException(const char *moduleName, const char *methodName, NSException *exception)
{
  @autoreleasepool {
    NSString *entry = [NSString stringWithFormat:
      @"[turbomodule-void-exception] %@\\n"
       "  Module : %s\\n"
       "  Method : %s\\n"
       "  Name   : %@\\n"
       "  Reason : %@\\n"
       "  Stack  :\\n%@\\n\\n",
      [NSDate date],
      moduleName ?: "(null)",
      methodName ?: "(null)",
      exception.name ?: @"(nil)",
      exception.reason ?: @"(nil)",
      [exception.callStackSymbols componentsJoinedByString:@"\\n"] ?: @"(none)"];

    NSLog(@"%@", entry);

    NSURL *docs = [[[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory
                                                          inDomains:NSUserDomainMask] firstObject];
    if (docs == nil) {
      return;
    }
    NSURL *url = [docs URLByAppendingPathComponent:@"turbomodule_exceptions.log"];
    NSData *data = [entry dataUsingEncoding:NSUTF8StringEncoding];

    NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:url.path];
    if (handle != nil) {
      @try {
        [handle seekToEndOfFile];
        [handle writeData:data];
      } @catch (NSException *ignored) {
        // Never let the logger itself take the process down.
      } @finally {
        [handle closeFile];
      }
    } else {
      [data writeToURL:url atomically:YES];
    }
  }
}

`

module.exports = function withTurboModuleVoidExceptionGuard(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const projectRoot = config.modRequest.projectRoot
      const file = path.join(projectRoot, SOURCE_REL_PATH)

      if (!fs.existsSync(file)) {
        throw new Error(
          `[withTurboModuleVoidExceptionGuard] Expected React Native source at ${SOURCE_REL_PATH}, but it does not exist. ` +
            `The React Native layout changed — re-point this plugin (AMOBILE-148) before building, ` +
            `or the group-screen crash will silently return.`
        )
      }

      let contents = fs.readFileSync(file, 'utf8')

      if (contents.includes(MARKER)) {
        return config
      }

      if (!contents.includes(ORIGINAL_CATCH)) {
        throw new Error(
          `[withTurboModuleVoidExceptionGuard] Could not find the expected @catch block in ${SOURCE_REL_PATH}. ` +
            `This plugin is pinned to react-native 0.83.4; the upstream source has changed. ` +
            `Re-derive the patch (AMOBILE-148) — failing the build is deliberate, because a silent ` +
            `no-op would reintroduce a SIGSEGV with no JS stack.`
        )
      }

      if (!contents.includes(HELPER_ANCHOR)) {
        throw new Error(
          `[withTurboModuleVoidExceptionGuard] Could not find performVoidMethodInvocation in ${SOURCE_REL_PATH}.`
        )
      }

      contents = contents.replace(ORIGINAL_CATCH, PATCHED_CATCH)
      contents = contents.replace(HELPER_ANCHOR, HELPER + HELPER_ANCHOR)

      fs.writeFileSync(file, contents, 'utf8')
      console.log('[withTurboModuleVoidExceptionGuard] Patched RCTTurboModule.mm (AMOBILE-148)')

      return config
    },
  ])
}
