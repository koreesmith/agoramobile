import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { useAuthStore } from '../store/auth'
import { usersApi } from '../api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function AppContent() {
  const { isAuthenticated, loadFromStorage, token } = useAuthStore()

  useEffect(() => {
    loadFromStorage()
  }, [])

  // Register for push notifications after login
  useEffect(() => {
    if (!isAuthenticated) return
    registerForPushNotifications()
  }, [isAuthenticated])

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
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

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
