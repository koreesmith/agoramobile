import { useEffect, useState, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme, StyleSheet, View, AppState, AppStateStatus } from 'react-native'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../store/auth'
import { usersApi } from '../api'
import { ColorProvider } from '../constants/ColorContext'
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
      return post_id ? `/post/${post_id}` : null
    case 'friend_request':
    case 'friend_accepted':
      return actor_username ? `/profile/${actor_username}` : '/(tabs)/connections'
    case 'group_join_request':
    case 'group_join_approved':
      return '/(tabs)/notifications'
    case 'new_message':
      return '/(tabs)/messages'
    case 'waitlist_signup':
      return '/admin?tab=waitlist'
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
  const { loadPreference } = useThemeStore()
  const { loadBlocked } = useBlockStore()
  const { loadPreference: loadDiagnosticsPreference } = useDiagnosticsStore()
  const scheme = useColorScheme()
  const notifListener = useRef<any>()
  const responseListener = useRef<any>()

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

  useEffect(() => {
    if (!isAuthenticated) return
    // Defer past the startup HadesGC crash window on iOS 26.3.1 — calling
    // getExpoPushTokenAsync() immediately at startup generates a native ObjC
    // exception that React Native cannot catch on the bridge queue.
    const t = setTimeout(registerForPushNotifications, 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

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
          // Suppress the raw push for types where the backend sends placeholder text;
          // a properly-labelled local notification is fired by notifListener instead.
          const suppressRaw = data?.type === 'waitlist_signup'
          return {
            shouldShowAlert: !suppressRaw,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }
        },
      })

      // Re-fire certain push notifications as local ones with correct actor labels.
      notifListener.current = Notifications.addNotificationReceivedListener(notification => {
        const data = notification.request.content.data as Record<string, string>
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
    }, 1500)

    return () => {
      clearTimeout(t)
      if (notifListener.current) notifListener.current.remove()
      if (responseListener.current) responseListener.current.remove()
    }
  }, [])

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
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

async function registerForPushNotifications() {
  if (!Device.isDevice) return
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    })
    finalStatus = status
  }
  if (finalStatus !== 'granted') return
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data
    await usersApi.updateProfile({ expo_push_token: token })
  } catch {}
}
