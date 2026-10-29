import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native'
import { router, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Avatar, renderName } from '../components/ui'
import { useAuthStore, MAX_ACCOUNTS } from '../store/auth'
import { useToastStore } from '../store/toast'
import { clearPushForAccount } from '../utils/push'
import { C } from '../constants/colors'
import { useC } from '../constants/ColorContext'

// AMOBILE-193: see every signed-in account, switch between them, and sign
// out of one or all. The push-token handoff and query-cache clear that
// follow an active-account change are handled centrally in app/_layout.tsx.
export default function ManageAccountsScreen() {
  const c = useC()
  const accounts = useAuthStore((s) => s.accounts)
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount)
  const removeAccount = useAuthStore((s) => s.removeAccount)
  const logout = useAuthStore((s) => s.logout)
  const showToast = useToastStore((s) => s.show)

  const atLimit = accounts.length >= MAX_ACCOUNTS

  const headerOpts = {
    headerShown: true,
    headerTitle: 'Accounts',
    headerBackTitle: 'Settings',
    headerStyle: { backgroundColor: c.card },
    headerTintColor: c.primary,
  }

  const switchTo = (id: string) => {
    if (id === activeAccountId) return
    const acct = accounts.find((a) => a.id === id)
    setActiveAccount(id)
    if (acct) showToast(`Now posting as @${acct.user.username}`)
  }

  const signOutOne = (id: string) => {
    const acct = accounts.find((a) => a.id === id)
    if (!acct) return
    Alert.alert(`Sign out of @${acct.user.username}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          // Best-effort: let this account's server stop pushing to the
          // device. Only the active account actually holds a token, so this
          // is a no-op for the rest.
          clearPushForAccount(acct)
          removeAccount(id)
        },
      },
    ])
  }

  const signOutAll = () => {
    Alert.alert('Sign out of all accounts?', 'You will need to sign back in to each one.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out of all',
        style: 'destructive',
        onPress: () => {
          accounts.forEach(clearPushForAccount)
          logout()
        },
      },
    ])
  }

  const addAccount = () => {
    if (atLimit) return
    useAuthStore.getState().setAddingAccount(true)
    router.push({ pathname: '/(auth)', params: { add: '1' } } as any)
  }

  return (
    <Screen>
      <Stack.Screen options={headerOpts} />
      <ScrollView>
        <Text style={[s.section, { color: c.textMuted }]}>Signed in</Text>
        {accounts.map((a) => {
          const isActive = a.id === activeAccountId
          const host = a.instanceUrl.replace(/^https?:\/\//, '')
          const name = a.user.display_name || a.user.username
          return (
            <View key={a.id} style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <TouchableOpacity style={s.rowMain} onPress={() => switchTo(a.id)} activeOpacity={isActive ? 1 : 0.6}>
                <Avatar url={a.user.avatar_url} name={name} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{renderName(name)}</Text>
                    {isActive && <Ionicons name="checkmark-circle" size={16} color={c.primary} />}
                  </View>
                  <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>@{a.user.username} · {host}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => signOutOne(a.id)} style={s.signOutBtn}>
                <Text style={[s.signOutText, { color: c.red }]}>Sign out</Text>
              </TouchableOpacity>
            </View>
          )
        })}

        <TouchableOpacity
          onPress={addAccount}
          disabled={atLimit}
          style={[s.addRow, { backgroundColor: c.card, borderBottomColor: c.border }, atLimit && { opacity: 0.4 }]}
        >
          <View style={[s.addIcon, { backgroundColor: c.primaryBg }]}>
            <Ionicons name="add" size={20} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.addLabel, { color: c.text }]}>Add account</Text>
            {atLimit && (
              <Text style={[s.meta, { color: c.textMuted }]}>
                You're signed in to the maximum of {MAX_ACCOUNTS}.
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {accounts.length > 1 && (
          <View style={{ marginTop: 24 }}>
            <TouchableOpacity onPress={signOutAll} style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <View style={[s.addIcon, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="log-out-outline" size={18} color={c.red} />
              </View>
              <Text style={[s.addLabel, { color: c.red, marginLeft: 12 }]}>Sign out of all accounts</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  section:      { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  rowMain:      { flex: 1, flexDirection: 'row', alignItems: 'center' },
  name:         { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  meta:         { fontSize: 13, marginTop: 1 },
  signOutBtn:   { paddingHorizontal: 8, paddingVertical: 6 },
  signOutText:  { fontSize: 15, fontWeight: '600' },
  addRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  addIcon:      { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addLabel:     { fontSize: 16, fontWeight: '500' },
})
