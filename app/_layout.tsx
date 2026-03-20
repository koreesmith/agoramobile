import { useEffect, useState } from 'react'
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
import SplashScreen from '../components/SplashScreen'

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
  const { isAuthenticated, loadFromStorage } = useAuthStore()
  const { loadPreference } = useThemeStore()
  const scheme = useColorScheme()

  useEffect(() => {
    loadFromStorage()
    loadPreference()
  }, [])

  useEffect(() => {
    if (isAuthenticated) registerForPushNotifications()
  }, [isAuthenticated])

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
