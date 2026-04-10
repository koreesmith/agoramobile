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
 * symbolication, but not which specific module/method yet.
 *
 * NSSetUncaughtExceptionHandler does NOT fire here — React Native catches the
 * ObjC exception and rethrows it via __cxa_rethrow inside a C++ context, which
 * calls std::terminate → demangling_terminate_handler → abort. The ObjC uncaught
 * handler is bypassed entirely.
 *
 * This plugin does three things:
 *
 *  1. Pre-initializes the most likely singleton culprits on the main thread so
 *     background-thread first-access no longer throws.
 *
 *  2. Injects IOS26TerminateLogger.mm — an ObjC++ file that installs a
 *     std::set_terminate handler via __attribute__((constructor)). Inside the
 *     terminate handler we std::rethrow_exception → catch (NSException*) to
 *     capture the exception name, reason, and call stack, then write them to
 *     Documents/ios26_crash.log before aborting. This survives the React Native
 *     C++ rethrow path that kills NSSetUncaughtExceptionHandler.
 *
 *  3. Registers that .mm file with the Xcode project so it is compiled in.
 */

const { withAppDelegate, withXcodeProject } = require('@expo/config-plugins')
const path = require('path')
const fs = require('fs')

// ─── AppDelegate patch ────────────────────────────────────────────────────────

const PREWARM_MARKER = '// [withIOS26NativePrewarm]'

const PREWARM_CODE = `    ${PREWARM_MARKER}
    // ── Singleton pre-warm ────────────────────────────────────────────────────
    // Force-initialize system singletons on the main thread. On iOS 26.x, their
    // first access from a background GCD thread (React Native's TurboModule queue)
    // throws NSException, which React Native rethrows as a fatal crash.
    _ = URLSession.shared
    _ = UNUserNotificationCenter.current()
`

// ─── IOS26TerminateLogger.mm ──────────────────────────────────────────────────
// Installed via std::set_terminate (NOT NSSetUncaughtExceptionHandler) so it
// fires even when React Native rethrows the ObjC exception through C++.

const TERMINATE_LOGGER_MM = `/**
 * IOS26TerminateLogger.mm
 *
 * Installs a std::set_terminate handler that captures the in-flight ObjC
 * exception (name, reason, call stack) and writes it to Documents/ios26_crash.log
 * before aborting. Runs before any other code via __attribute__((constructor)).
 *
 * This is necessary because NSSetUncaughtExceptionHandler is NOT called when
 * React Native catches an ObjC exception and rethrows it via __cxa_rethrow —
 * that path goes straight to std::terminate, bypassing the ObjC handler.
 */

#import <Foundation/Foundation.h>
#include <exception>
#include <cstdlib>

static void ios26TerminateHandler() {
  @autoreleasepool {
    NSMutableString *msg = [NSMutableString string];
    [msg appendString:@"[ios26] std::terminate called\\n"];

    auto eptr = std::current_exception();
    if (eptr) {
      try {
        std::rethrow_exception(eptr);
      } catch (NSException *e) {
        [msg appendFormat:
          @"[ios26] Caught NSException:\\n"
           "  Name   : %@\\n"
           "  Reason : %@\\n"
           "  UserInfo: %@\\n"
           "  Stack  :\\n%@\\n",
          e.name,
          e.reason ?: @"(nil)",
          e.userInfo ?: @{},
          [e.callStackSymbols componentsJoinedByString:@"\\n"]];
      } catch (std::exception const &e) {
        [msg appendFormat:@"[ios26] Caught std::exception: %s\\n", e.what()];
      } catch (...) {
        [msg appendString:@"[ios26] Caught unknown exception\\n"];
      }
    } else {
      [msg appendString:@"[ios26] No current_exception (terminate called without active exception)\\n"];
    }

    NSLog(@"%@", msg);

    NSURL *docs = [[[NSFileManager defaultManager]
      URLsForDirectory:NSDocumentDirectory
             inDomains:NSUserDomainMask] firstObject];
    if (docs) {
      NSURL *url = [docs URLByAppendingPathComponent:@"ios26_crash.log"];
      [msg writeToURL:url atomically:YES encoding:NSUTF8StringEncoding error:nil];
    }
  }
  // Abort manually — don't call the previous terminate handler; it may re-enter.
  abort();
}

__attribute__((constructor))
static void installIOS26TerminateHandler() {
  std::set_terminate(ios26TerminateHandler);
}
`

// ─── Plugin ───────────────────────────────────────────────────────────────────

module.exports = function withIOS26NativePrewarm(config) {
  // Step 1: patch AppDelegate.swift
  config = withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      return config
    }

    let contents = config.modResults.contents

    if (contents.includes(PREWARM_MARKER)) {
      return config
    }

    if (!contents.includes('import UserNotifications')) {
      contents = contents.replace(/^(import .+)$/m, '$1\nimport UserNotifications')
    }

    // Remove artefacts from previous plugin iterations
    contents = contents.replace(/\n?import ObjectiveC\n?/g, '\n')
    contents = contents.replace(/[ \t]*\/\/ \[withIOS26ClassPrewarm\][^\n]*\n([ \t][^\n]*\n)*/g, '')
    // Remove the old NSSetUncaughtExceptionHandler block if present
    contents = contents.replace(
      /[ \t]*\/\/ ── Exception logger[^\n]*\n[\s\S]*?NSSetUncaughtExceptionHandler[\s\S]*?\}\n/,
      ''
    )

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

  // Step 2: write the .mm file and register it in the Xcode project
  config = withXcodeProject(config, (config) => {
    const platformProjectRoot = config.modRequest.platformProjectRoot // .../ios
    const projectName = config.modRequest.projectName               // e.g. "Agora"
    const mmFileName = 'IOS26TerminateLogger.mm'
    // Write to ios/ root — this is where the Xcode project resolves the path from
    const mmFilePath = path.join(platformProjectRoot, mmFileName)

    // Write the .mm file (always overwrite to keep it up to date)
    fs.writeFileSync(mmFilePath, TERMINATE_LOGGER_MM, 'utf8')

    // Register with Xcode project if not already there
    const proj = config.modResults
    const hasFile = Object.values(proj.pbxFileReferenceSection() || {}).some(
      (ref) => ref && ref.path === `"${mmFileName}"`
    )

    if (!hasFile) {
      // Find the UUID key for the main app group (addSourceFile needs the key, not the object)
      const pbxGroups = proj.hash.project.objects['PBXGroup'] || {}
      let groupKey = null
      for (const key of Object.keys(pbxGroups)) {
        if (key.endsWith('_comment')) continue
        const g = pbxGroups[key]
        if (g.name === projectName || g.name === `"${projectName}"`) {
          groupKey = key
          break
        }
      }
      const targetKey = proj.findTargetKey(`"${projectName}"`)
      proj.addSourceFile(mmFileName, { target: targetKey }, groupKey)
    }

    return config
  })

  return config
}
