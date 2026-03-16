import { useEffect } from 'react'
import { Tabs, router } from 'expo-router'
import { useColorScheme, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth'
import { notificationsApi } from '../../api'

export default function TabsLayout() {
  const { isAuthenticated } = useAuthStore()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  useEffect(() => {
    if (!isAuthenticated) router.replace('/(auth)')
  }, [isAuthenticated])

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount().then(r => r.data),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  })
  const unread: number = unreadData?.count ?? 0

  const tabBar = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
  }

  const active   = '#6366f1'
  const inactive = isDark ? '#64748b' : '#94a3b8'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...tabBar,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: 'Feed',
        tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="notifications" options={{
        title: 'Notifications',
        tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
        tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
      }} />
      <Tabs.Screen name="groups" options={{
        title: 'Groups',
        tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="friends" options={{
        title: 'Friends',
        tabBarIcon: ({ color, size }) => <Ionicons name="person-add-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="messages" options={{
        title: 'Messages',
        tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
      }} />
    </Tabs>
  )
}
