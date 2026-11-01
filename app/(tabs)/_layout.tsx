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
import { useWelcomeStore } from '../../store/welcome'
import AccountSwitcherModal from '../../components/AccountSwitcherModal'
import { ProfileTabIcon, useActiveAccount } from '../../components/ActiveAccount'
import { useMe } from '../../components/welcome/useMe'

export default function TabsLayout() {
  const { isAuthenticated } = useAuthStore()
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const systemScheme = useColorScheme()
  const { preference } = useThemeStore()
  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark')
  const c = isDark ? dark : light
  const [notificationsReady, setNotificationsReady] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const { handle } = useActiveAccount()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!isAuthenticated) router.replace('/(auth)')
  }, [isAuthenticated])

  // AMOBILE-191: landing back on the tabs means any add-account trip through
  // the (auth) stack is over, whether it completed or was backed out of.
  useEffect(() => {
    if (isAuthenticated) useAuthStore.getState().setAddingAccount(false)
  }, [isAuthenticated])

  useEffect(() => {
    const t = setTimeout(() => setNotificationsReady(true), 1500)
    return () => clearTimeout(t)
  }, [])

  const { data: me } = useMe()

  // AMOBILE-202: the stored account is whatever /auth/me said at sign-in.
  // Fold the fresh copy back in so Settings shows what's actually saved
  // (including changes made on web or in the wizard), but only while it
  // still belongs to the active account: a switch can land between the
  // request and its response.
  useEffect(() => {
    if (!me) return
    const { user, updateUser } = useAuthStore.getState()
    if (!user || user.id !== me.id) return
    const changed = Object.keys(me).some(k => JSON.stringify((user as any)[k]) !== JSON.stringify(me[k]))
    if (changed) updateUser(me)
  }, [me])

  // AMOBILE-202: an account that hasn't finished or skipped the getting
  // started wizard goes through it, once per launch. Only an explicit false
  // counts: an older server doesn't send the field, and its accounts never
  // see the wizard.
  useEffect(() => {
    if (!me || !activeAccountId || me.onboarding_completed !== false) return
    if (useAuthStore.getState().user?.id !== me.id) return
    if (useWelcomeStore.getState().shownFor.includes(activeAccountId)) return
    useWelcomeStore.getState().markShown(activeAccountId)
    router.push('/welcome')
  }, [me, activeAccountId])

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

  // AGORA-425: unread messages count toward the icon too, matching the badge
  // the server now puts on pushes, so the two don't fight each other.
  useEffect(() => {
    if (!notificationsReady || (unread === 0 && !unreadData)) return
    Notifications.setBadgeCountAsync(unread + unreadMessages).catch(() => {})
  }, [unread, unreadData, unreadMessages, notificationsReady])

  return (
    <>
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
        {/* AMOBILE-192: press and hold Profile to switch accounts. A normal
            tap still just opens the Profile tab. AMOBILE-212: its icon is
            the active account's photo, so who's active is always in view. */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused, color, size }) => <ProfileTabIcon focused={focused} color={color} size={size} />,
            tabBarAccessibilityLabel: handle ? `Profile, signed in as ${handle}` : 'Profile',
          }}
          listeners={{ tabLongPress: () => setSwitcherOpen(true) }}
        />
      </Tabs>
      <AccountSwitcherModal visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </>
  )
}

