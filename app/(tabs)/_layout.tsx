import { useEffect, useState } from 'react'
import { Tabs, router, useSegments } from 'expo-router'
import { Platform, Text, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '../../store/auth'
import { light, dark } from '../../constants/colors'
import { useThemeStore } from '../../store/theme'
import { useWelcomeStore } from '../../store/welcome'
import AccountSwitcherModal from '../../components/AccountSwitcherModal'
import CustomizeTabBarModal from '../../components/CustomizeTabBarModal'
import TabBarButton from '../../components/TabBarButton'
import { TAB_DESTINATIONS, destinationById } from '../../constants/tabDestinations'
import { useDestinations } from '../../utils/useDestinations'
import { useUnreadCounts } from '../../utils/useUnreadCounts'
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
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const { destinations, bar } = useDestinations()
  const segments = useSegments() as string[]
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

  const { unread, unreadMessages, unreadData } = useUnreadCounts()

  // AGORA-425: unread messages count toward the icon too, matching the badge
  // the server now puts on pushes, so the two don't fight each other.
  useEffect(() => {
    if (!notificationsReady || (unread === 0 && !unreadData)) return
    Notifications.setBadgeCountAsync(unread + unreadMessages).catch(() => {})
  }, [unread, unreadData, unreadMessages, notificationsReady])

  const badgeFor = (badge?: 'alerts' | 'messages') => {
    const n = badge === 'alerts' ? unread : badge === 'messages' ? unreadMessages : 0
    return n > 0 ? (n > 9 ? '9+' : n) : undefined
  }
  // Unread counts for destinations that aren't in the bar show on More instead.
  const hiddenUnread = destinations
    .filter((d) => !bar.includes(d.id))
    .reduce((sum, d) => sum + (d.badge === 'alerts' ? unread : d.badge === 'messages' ? unreadMessages : 0), 0)
  // One of the destinations in More is open: light More so the bar still
  // shows where you are.
  const hiddenOpen = segments[0] === '(tabs)' && !!segments[1] && !!destinationById(segments[1]) && !bar.includes(segments[1])

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
        // AGORA-446: long-press customizes (Profile overrides this with the
        // account switcher), and screen readers get the same as an action.
        tabBarButton: (props) => <TabBarButton {...props} onCustomize={() => setCustomizeOpen(true)} />,
      }}>
        {/* AGORA-446: the bar is Feed, Profile and the destinations the user
            keeps (store/tabBar.ts), then More. A destination that isn't in the
            bar is hidden with href: null but stays a real route, so links to it
            and opening it from More keep working. Order here is the order in
            the bar. */}
        <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} listeners={{ tabLongPress: () => setCustomizeOpen(true) }} />
        {TAB_DESTINATIONS.map((d) => (
          <Tabs.Screen
            key={d.id}
            name={d.id}
            options={{
              title: d.title,
              // Hidden from the bar when moved to More, or (Reels only) when
              // the server doesn't have it.
              ...(bar.includes(d.id) ? {} : { href: null }),
              tabBarIcon: ({ color, size }) => <Ionicons name={d.icon} size={size} color={color} />,
              tabBarBadge: badgeFor(d.badge),
            }}
            listeners={{ tabLongPress: () => setCustomizeOpen(true) }}
          />
        ))}
        {/* AMOBILE-192: press and hold Profile to switch accounts. A normal
            tap still just opens the Profile tab. AMOBILE-212: its icon is
            the active account's photo, so who's active is always in view. */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused, color, size }) => <ProfileTabIcon focused={focused} color={color} size={size} />,
            tabBarAccessibilityLabel: handle ? `Profile, signed in as ${handle}` : 'Profile',
            tabBarButton: (props) => <TabBarButton {...props} />,
          }}
          listeners={{ tabLongPress: () => setSwitcherOpen(true) }}
        />
        {/* More carries the unread counts of anything moved into it, and is
            lit while one of those destinations is open. */}
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name="ellipsis-horizontal" size={size} color={focused || hiddenOpen ? c.primary : color} />
            ),
            tabBarLabel: ({ focused, color }) => (
              <Text style={{ fontSize: 12, fontWeight: '500', color: focused || hiddenOpen ? c.primary : color }}>More</Text>
            ),
            tabBarBadge: hiddenUnread > 0 ? hiddenUnread : undefined,
          }}
          listeners={{ tabLongPress: () => setCustomizeOpen(true) }}
        />
      </Tabs>
      <CustomizeTabBarModal visible={customizeOpen} onClose={() => setCustomizeOpen(false)} />
      <AccountSwitcherModal visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </>
  )
}

