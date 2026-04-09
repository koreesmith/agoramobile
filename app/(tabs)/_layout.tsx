import { useEffect, useRef } from 'react'
import { Tabs, router } from 'expo-router'
import { Platform, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '../../store/auth'
import { notificationsApi } from '../../api'
import { light, dark } from '../../constants/colors'
import { useThemeStore } from '../../store/theme'

export default function TabsLayout() {
  const { isAuthenticated } = useAuthStore()
  const systemScheme = useColorScheme()
  const { preference } = useThemeStore()
  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark')
  const c = isDark ? dark : light
  const notificationsReady = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) router.replace('/(auth)')
  }, [isAuthenticated])

  // Mirror the 1500ms deferral from _layout.tsx — calling any Notifications
  // native method before this window closes crashes on iOS 26.3.1.
  useEffect(() => {
    const t = setTimeout(() => { notificationsReady.current = true }, 1500)
    return () => clearTimeout(t)
  }, [])

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount().then(r => r.data),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  })
  const unread: number = unreadData?.count ?? 0

  useEffect(() => {
    if (unread === 0 && !unreadData) return
    if (!notificationsReady.current) return
    Notifications.setBadgeCountAsync(unread).catch(() => {})
  }, [unread, unreadData])

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: c.card,
        borderTopColor: c.border,
        paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        paddingTop: 8,
        height: Platform.OS === 'ios' ? 84 : 64,
      },
      tabBarActiveTintColor: c.primary,
      tabBarInactiveTintColor: c.textLight,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />, tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: ({ color, size }) => <Ionicons name="person-add-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  )
}

