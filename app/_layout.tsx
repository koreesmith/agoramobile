import { useEffect, useState, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { useAuthStore } from '../store/auth'
import { usersApi } from '../api'
import { ColorProvider } from '../constants/ColorContext'
import { useThemeStore } from '../store/theme'
import { useBlockStore } from '../store/blocks'
import SplashScreen from '../components/SplashScreen'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

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
      return post_id ? `/post/${post_id}` : null
    case 'friend_request':
    case 'friend_accepted':
      return actor_username ? `/profile/${actor_username}` : '/(tabs)/friends'
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

function AppContent() {
  const { isAuthenticated, loadFromStorage } = useAuthStore()
  const { loadPreference } = useThemeStore()
  const { loadBlocked } = useBlockStore()
  const scheme = useColorScheme()
  const notifListener = useRef<any>()
  const responseListener = useRef<any>()

  useEffect(() => {
    loadFromStorage()
    loadPreference()
    loadBlocked()
  }, [])

  useEffect(() => {
    if (isAuthenticated) registerForPushNotifications()
  }, [isAuthenticated])

  // Handle notification taps — deep link to the relevant screen
  useEffect(() => {
    // Handle tap when app is already open
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string>
      const route = getRouteForNotification(data)
      if (route) {
        // Small delay to ensure navigation is ready
        setTimeout(() => router.push(route as any), 300)
      }
    })

    // Handle tap when app was closed/backgrounded (last response)
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return
      const data = response.notification.request.content.data as Record<string, string>
      const route = getRouteForNotification(data)
      if (route) {
        setTimeout(() => router.push(route as any), 500)
      }
    })

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current)
      }
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

  if (showSplash) {
    return (
      <ColorProvider>
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </ColorProvider>
    )
  }

  return (
    <ColorProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ColorProvider>
  )
}

async function registerForPushNotifications() {
  if (!Device.isDevice) return
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data
    await usersApi.updateProfile({ expo_push_token: token })
  } catch {}
}
