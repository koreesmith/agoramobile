import { useEffect, useState } from 'react'
import { Tabs, router } from 'expo-router'
import { Platform, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '../../store/auth'
import { notificationsApi, dmApi } from '../../api'
import { light, dark } from '../../constants/colors'
import { useThemeStore } from '../../store/theme'

export default function TabsLayout() {
  const { isAuthenticated } = useAuthStore()
  const systemScheme = useColorScheme()
  const { preference } = useThemeStore()
  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark')
  const c = isDark ? dark : light
  const [notificationsReady, setNotificationsReady] = useState(false)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!isAuthenticated) router.replace('/(auth)')
  }, [isAuthenticated])

  useEffect(() => {
    const t = setTimeout(() => setNotificationsReady(true), 1500)
    return () => clearTimeout(t)
  }, [])

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount().then(r => r.data),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  })
  const unread: number = unreadData?.count ?? 0

  const { data: convsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => dmApi.listConversations().then(r => r.data),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  })
  const unreadMessages: number = (convsData?.conversations ?? []).reduce((sum: number, c: any) => sum + (c.unread_count ?? 0), 0)

  useEffect(() => {
    if (!notificationsReady || (unread === 0 && !unreadData)) return
    Notifications.setBadgeCountAsync(unread).catch(() => {})
  }, [unread, unreadData, notificationsReady])

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: c.card,
        borderTopColor: c.border,
        paddingBottom: Platform.OS === 'ios' ? 20 : insets.bottom + 8,
        paddingTop: 8,
        height: Platform.OS === 'ios' ? 84 : 64 + insets.bottom,
      },
      tabBarActiveTintColor: c.primary,
      tabBarInactiveTintColor: c.textLight,
      tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />, tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="connections" options={{ title: 'Connections', tabBarIcon: ({ color, size }) => <Ionicons name="person-add-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />, tabBarBadge: unreadMessages > 0 ? (unreadMessages > 9 ? '9+' : unreadMessages) : undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  )
}

