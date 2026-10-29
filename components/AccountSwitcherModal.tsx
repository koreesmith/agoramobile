import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Avatar, renderName } from './ui'
import { useAuthStore, MAX_ACCOUNTS } from '../store/auth'
import { useToastStore } from '../store/toast'
import { useC } from '../constants/ColorContext'

// AMOBILE-192: the account switcher. Opened by a long-press on the Profile
// tab and by a visible control in the Profile header. Switching active
// account is handled by the store; the push-token move and the query-cache
// clear are driven centrally off activeAccountId in app/_layout.tsx.
export default function AccountSwitcherModal({ visible, onClose }: {
  visible: boolean
  onClose: () => void
}) {
  const c = useC()
  const accounts = useAuthStore((s) => s.accounts)
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount)
  const setAddingAccount = useAuthStore((s) => s.setAddingAccount)
  const showToast = useToastStore((s) => s.show)

  const atLimit = accounts.length >= MAX_ACCOUNTS

  const select = (id: string) => {
    if (id !== activeAccountId) {
      const acct = accounts.find((a) => a.id === id)
      setActiveAccount(id)
      if (acct) showToast(`Now posting as @${acct.user.username}`)
    }
    onClose()
  }

  const addAccount = () => {
    if (atLimit) return
    setAddingAccount(true)
    onClose()
    router.push({ pathname: '/(auth)', params: { add: '1' } } as any)
  }

  const manage = () => {
    onClose()
    router.push('/manage-accounts' as any)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: c.card }]}>
        <View style={[s.header, { borderBottomColor: c.border }]}>
          <Text style={[s.title, { color: c.text }]}>Accounts</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }}>
          {accounts.map((a) => {
            const isActive = a.id === activeAccountId
            const host = a.instanceUrl.replace(/^https?:\/\//, '')
            const name = a.user.display_name || a.user.username
            return (
              <TouchableOpacity
                key={a.id}
                onPress={() => select(a.id)}
                style={[s.row, { borderBottomColor: c.border, backgroundColor: isActive ? c.primaryBg : 'transparent' }]}
              >
                <Avatar url={a.user.avatar_url} name={name} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{renderName(name)}</Text>
                  <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>@{a.user.username} · {host}</Text>
                </View>
                {isActive && <Ionicons name="checkmark-circle" size={22} color={c.primary} />}
              </TouchableOpacity>
            )
          })}

          <TouchableOpacity
            onPress={addAccount}
            disabled={atLimit}
            style={[s.actionRow, { borderBottomColor: c.border }, atLimit && { opacity: 0.4 }]}
          >
            <View style={[s.actionIcon, { backgroundColor: c.primaryBg }]}>
              <Ionicons name="add" size={20} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.actionLabel, { color: c.text }]}>Add account</Text>
              {atLimit && (
                <Text style={[s.meta, { color: c.textMuted }]}>
                  You're signed in to the maximum of {MAX_ACCOUNTS}. Remove one first.
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={manage} style={[s.actionRow, { borderBottomColor: c.border }]}>
            <View style={[s.actionIcon, { backgroundColor: c.primaryBg }]}>
              <Ionicons name="settings-outline" size={18} color={c.primary} />
            </View>
            <Text style={[s.actionLabel, { color: c.text }]}>Manage accounts</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title:       { fontSize: 19, fontWeight: '700' },
  closeBtn:    { padding: 4 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  name:        { fontSize: 16, fontWeight: '600' },
  meta:        { fontSize: 13, marginTop: 1 },
  actionRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  actionIcon:  { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 16, fontWeight: '500' },
})
