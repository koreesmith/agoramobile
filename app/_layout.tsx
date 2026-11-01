import { useEffect, useState, useRef } from 'react'
import { Stack, router, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, AppState, AppStateStatus } from 'react-native'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../store/auth'
import { registerActivePush, clearPushForAccount, devicePushTokenChanged } from '../utils/push'
import { ColorProvider, useIsDark } from '../constants/ColorContext'
import { useThemeStore } from '../store/theme'
import { useBlockStore } from '../store/blocks'
import { useDiagnosticsStore } from '../store/diagnostics'
import SplashScreen from '../components/SplashScreen'
import Toast from '../components/Toast'
import { installJSErrorHandler, reportNativeExceptionLog } from '../utils/crashDiagnostics'

// AMOBILE-148: take over the global JS error handler before any screen mounts, so
// an uncaught JS error is shown rather than routed into RN's native fatal path.
installJSErrorHandler()

// Map notification type to the route to navigate to
function getRouteForNotification(data: Record<string, string>): string | null {
  const { type, post_id, actor_username } = data
  switch (type) {
    case 'post_like':
    case 'post_reaction':
    case 'post_comment':
    case 'comment_reply':
    case 'post_mention':
    case 'post_repost':
    case 'wall_post':
    case 'wall_post_pending':
    case 'fediverse_post':
    case 'atproto_post':
    // AGORA-420: types the server now pushes that are about a post. The
    // server sends the post a comment is on, so these open the thread.
    case 'comment_like':
    case 'comment_reaction':
    case 'user_post':
    case 'page_post':
    case 'group_tag':
    case 'wall_post_approved':
      return post_id ? `/post/${post_id}` : null
    case 'friend_request':
    case 'friend_accepted':
    case 'fediverse_follow':
    case 'atproto_follow':
      return actor_username ? `/profile/${actor_username}` : '/(tabs)/connections'
    case 'group_join_request':
    case 'group_join_approved':
      return '/(tabs)/notifications'
    case 'new_message':
      // AGORA-425: the server names the conversation, so open it.
      return data.conversation_id ? `/conversation/${data.conversation_id}` : '/(tabs)/messages'
    case 'waitlist_signup':
    // AGORA-420: what the server actually calls it.
    case 'waitlist_join':
      return '/admin?tab=waitlist'
    // AMOBILE-161: a custom-domain status change is about the claim, so it
    // opens the screen that shows the claim's status and what to fix.
    case 'custom_domain_live':
    case 'custom_domain_verified':
    case 'custom_domain_failed':
    case 'custom_domain_lost':
    case 'custom_domain_rejected':
      return '/custom-domain'
    default:
      return '/(tabs)/notifications'
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

AppState.addEventListener('change', (status: AppStateStatus) => {
  focusManager.setFocused(status === 'active')
})

function AppContent() {
  const { isAuthenticated, loadFromStorage } = useAuthStore()
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const { loadPreference } = useThemeStore()
  const { loadBlocked } = useBlockStore()
  const { loadPreference: loadDiagnosticsPreference } = useDiagnosticsStore()
  // AMOBILE-209: the in-app Theme, not the phone's appearance, or the status
  // bar is drawn dark on dark (or light on light) whenever the two differ.
  const isDark = useIsDark()
  const notifListener = useRef<any>(null)
  const responseListener = useRef<any>(null)
  const tokenListener = useRef<any>(null)
  const lastSeenAccountRef = useRef<string | null>(null)
  // AGORA-425: read by the notification handler, which is installed once and
  // so can't use the hook itself.
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    // Synchronous reads — avoids async generator execution in Hermes at startup
    // which triggered a HadesGC write barrier crash on iOS 26.3.1
    loadFromStorage()
    loadPreference()
    loadBlocked()
    // Read before the deferred report below fires, so it sees the real setting.
    loadDiagnosticsPreference()
  }, [])

  // AMOBILE-148: surface any native void-TurboModule exception recorded by the
  // previous run. Deferred so it lands after the splash screen finishes.
  useEffect(() => {
    const t = setTimeout(reportNativeExceptionLog, 2500)
    return () => clearTimeout(t)
  }, [])

  // AMOBILE-194: the Expo push token follows the active account. Whenever the
  // active account settles, register it and best-effort clear the token from
  // every other account, so only one server ever pushes to this device (and
  // rapid switching can't strand a token on the wrong account). Still
  // deferred past the startup HadesGC crash window on iOS 26.3.1 — calling
  // getExpoPushTokenAsync() immediately at startup generates a native ObjC
  // exception that React Native cannot catch on the bridge queue.
  useEffect(() => {
    if (!isAuthenticated) return
    const t = setTimeout(() => {
      const { accounts, activeAccountId: aid } = useAuthStore.getState()
      for (const a of accounts) {
        if (a.id !== aid) clearPushForAccount(a)
      }
      registerActivePush(aid)
    }, 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated, activeAccountId])

  // AMOBILE-195: a switch changes identity for every account-scoped query,
  // so drop the cache rather than let the previous account's data linger.
  // Only a genuine A -> B switch clears; login (null -> A) and logout
  // (A -> null) do not.
  useEffect(() => {
    const prev = lastSeenAccountRef.current
    lastSeenAccountRef.current = activeAccountId
    if (prev && activeAccountId && prev !== activeAccountId) {
      queryClient.clear()
    }
  }, [activeAccountId])

  // AMOBILE-182: resume a group-invite redemption that had to pause for
  // login. 'agora_pending_invite' must match app/invite/[token].tsx's key.
  useEffect(() => {
    if (!isAuthenticated) return
    const pending = SecureStore.getItem('agora_pending_invite')
    if (!pending) return
    SecureStore.deleteItemAsync('agora_pending_invite')
    setTimeout(() => router.push(`/invite/${pending}` as any), 300)
  }, [isAuthenticated])

  // Defer all notification native module setup past the HadesGC-sensitive
  // startup window on iOS 26.3.1. setNotificationHandler was previously called
  // at module level (during bundle execution), and the listener/lastResponse
  // calls ran immediately on mount — any of these async native calls could
  // trip the Hermes GC write barrier and crash before the app finishes loading.
  useEffect(() => {
    const t = setTimeout(() => {
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const data = notification.request.content.data as Record<string, string>
          // AGORA-420: the server sends a badge-only push when notifications are
          // read elsewhere, to bring the icon's count down. It has nothing to show.
          if (data?.type === 'badge_sync') {
            return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: true }
          }
          // AGORA-425: a message in the conversation already on screen arrives
          // in it over the socket; a banner on top would only repeat it.
          if (data?.type === 'new_message' && data.conversation_id
              && pathnameRef.current === `/conversation/${data.conversation_id}`) {
            return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: true }
          }
          // Suppress the raw push for types where the backend sends placeholder text;
          // a properly-labelled local notification is fired by notifListener instead.
          const suppressRaw = data?.type === 'waitlist_signup'
          // shouldShowAlert is deprecated; banner and list together are what it
          // used to mean.
          return {
            shouldShowBanner: !suppressRaw,
            shouldShowList: !suppressRaw,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }
        },
      })

      // Re-fire certain push notifications as local ones with correct actor labels.
      notifListener.current = Notifications.addNotificationReceivedListener(notification => {
        const data = notification.request.content.data as Record<string, string>
        // AGORA-420: a push that arrives while the app is open means the unread
        // count, and so the tab badge and the icon badge set from it, is stale
        // now rather than at the next 30-second poll.
        queryClient.invalidateQueries({ queryKey: ['unread-count'] })
        if (data?.type === 'new_message') queryClient.invalidateQueries({ queryKey: ['conversations'] })
        else if (data?.type !== 'badge_sync') queryClient.invalidateQueries({ queryKey: ['notifications'] })
        if (data?.type === 'waitlist_signup') {
          const actor = data.actor_display_name || data.actor_username || 'Someone'
          Notifications.scheduleNotificationAsync({
            content: {
              title: `${actor} joined the waitlist`,
              body: 'Tap to review',
              data,
            },
            trigger: null,
          })
        }
      })

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data as Record<string, string>
        const route = getRouteForNotification(data)
        if (route) {
          setTimeout(() => router.push(route as any), 300)
        }
      })

      Notifications.getLastNotificationResponseAsync().then(response => {
        if (!response) return
        const data = response.notification.request.content.data as Record<string, string>
        const route = getRouteForNotification(data)
        if (route) {
          setTimeout(() => router.push(route as any), 500)
        }
      })

      // AGORA-420: APNs and FCM can rotate a device's token (a restore, a
      // reinstall, an OS update). Until now the server only heard about it at
      // the next cold start, and every push in between went to a dead token.
      // Our own registrations fire this too, so it only acts on a new token.
      tokenListener.current = Notifications.addPushTokenListener(({ data }) => {
        if (useAuthStore.getState().isAuthenticated) devicePushTokenChanged(String(data), useAuthStore.getState().activeAccountId)
      })
    }, 1500)

    return () => {
      clearTimeout(t)
      if (notifListener.current) notifListener.current.remove()
      if (responseListener.current) responseListener.current.remove()
      if (tokenListener.current) tokenListener.current.remove()
    }
  }, [])

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        {/* AMOBILE-202: no swipe back out of the getting started wizard.
            Leaving it is "Skip setup", or Android's back button on the first
            step. */}
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <GestureHandlerRootView style={styles.root}>
      <ColorProvider>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
        <Toast />
        {showSplash && (
          <View style={StyleSheet.absoluteFill}>
            <SplashScreen onFinish={() => setShowSplash(false)} />
          </View>
        )}
      </ColorProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
