import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Avatar } from './ui'
import { imgUrl } from '../api'
import { useAuthStore } from '../store/auth'
import { useC } from '../constants/ColorContext'

// AMOBILE-212: with several accounts signed in, the app always says which one
// it's acting as. The Profile tab shows the active account's photo, and the
// composers name it.

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/+$/, '')

export function useActiveAccount() {
  const user = useAuthStore((s) => s.user)
  const accounts = useAuthStore((s) => s.accounts)
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const account = accounts.find((a) => a.id === activeAccountId)
  const multi = accounts.length > 1
  // The server is only worth naming when the accounts aren't all on one.
  const host = account && new Set(accounts.map((a) => a.instanceUrl)).size > 1
    ? hostOf(account.instanceUrl)
    : ''
  const handle = user ? `@${user.username}${host ? ` · ${host}` : ''}` : ''
  return { user, multi, host, handle }
}

// The Profile tab's icon: the active account's photo, or its initial. A photo
// can't take the tab tint like the other icons, so a ring marks it selected.
// Sized to fill the same box as an icon of `size`.
export function ProfileTabIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
  const c = useC()
  const user = useAuthStore((s) => s.user)
  if (!imgUrl(user?.avatar_url)) {
    // A solid disc in the tab's tint with the letter knocked out. Avatar's own
    // letter is too small and faint at tab bar size, and an outlined letter
    // reads as a symbol (a "C" looks like a copyright sign).
    const letter = (user?.display_name || user?.username || '?')[0].toUpperCase()
    return (
      <View style={[st.initial, { width: size - 1, height: size - 1, borderRadius: size / 2, backgroundColor: color }]}>
        <Text allowFontScaling={false} style={{ color: c.card, fontSize: Math.round(size * 0.52), fontWeight: '700' }}>{letter}</Text>
      </View>
    )
  }
  return (
    <View style={[st.ring, { borderRadius: size / 2, borderColor: focused ? c.primary : 'transparent' }]}>
      <Avatar url={user?.avatar_url} name={user?.display_name || user?.username} size={size - 6} />
    </View>
  )
}

// "Posting as @name" for the group and wall composers. Only shown with two
// or more accounts, where it's what tells them apart.
export function PostingAsLine({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useC()
  const { user, multi, handle } = useActiveAccount()
  if (!multi || !user) return null
  return (
    <View style={[st.line, style]} accessible accessibilityLabel={`Posting as ${handle}`}>
      <Avatar url={user.avatar_url} name={user.display_name || user.username} size={20} />
      <Text style={[st.lineText, { color: c.textMuted }]} numberOfLines={1}>
        Posting as <Text style={{ color: c.text, fontWeight: '600' }}>{handle}</Text>
      </Text>
    </View>
  )
}

const st = StyleSheet.create({
  ring:     { padding: 1, borderWidth: 2 },
  initial:  { alignItems: 'center', justifyContent: 'center' },
  line:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { flex: 1, fontSize: 14 },
})
