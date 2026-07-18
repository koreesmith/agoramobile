import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { router, Stack } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import { Screen } from '../components/ui'
import { usersApi, authApi, instanceApi, interactionsApi } from '../api'
import { resetWhatsNew } from '../components/WhatsNewModal'
import { useAuthStore } from '../store/auth'
import { useWhatsNewStore } from '../store/whatsNew'
import { useToastStore } from '../store/toast'
import { C } from '../constants/colors'
import { useC } from '../constants/ColorContext'
import { useThemeStore, ThemePreference } from '../store/theme'

export default function SettingsScreen() {
  const c = useC()
  const qc = useQueryClient()
  const showToast = useToastStore(s => s.show)
  const { user, updateUser, logout } = useAuthStore()
  const { preference, setPreference } = useThemeStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [section, setSection] = useState<'main' | 'password' | 'email'>('main')
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const togglePrivacy = useMutation({
    mutationFn: () => usersApi.updateProfile({ profile_private: !user?.profile_private }),
    onSuccess: () => updateUser({ profile_private: !user?.profile_private }),
  })

  const toggleHideTimeline = useMutation({
    mutationFn: () => usersApi.updateProfile({ hide_timeline: !(user as any)?.hide_timeline }),
    onSuccess: () => updateUser({ hide_timeline: !(user as any)?.hide_timeline } as any),
  })

  const toggleApproveWallPosts = useMutation({
    mutationFn: () => usersApi.updateProfile({ approve_wall_posts: !(user as any)?.approve_wall_posts }),
    onSuccess: () => updateUser({ approve_wall_posts: !(user as any)?.approve_wall_posts } as any),
  })

  const toggleActivityPub = useMutation({
    mutationFn: () => usersApi.updateProfile({ activitypub_enabled: !(user as any)?.activitypub_enabled }),
    onSuccess: () => updateUser({ activitypub_enabled: !(user as any)?.activitypub_enabled } as any),
  })

  const toggleFediverseNotifications = useMutation({
    mutationFn: () => usersApi.updateProfile({ fediverse_notifications_enabled: !(user as any)?.fediverse_notifications_enabled }),
    onSuccess: () => updateUser({ fediverse_notifications_enabled: !(user as any)?.fediverse_notifications_enabled } as any),
  })

  const toggleAtproto = useMutation({
    mutationFn: () => usersApi.updateProfile({ atproto_enabled: !(user as any)?.atproto_enabled }),
    onSuccess: () => updateUser({ atproto_enabled: !(user as any)?.atproto_enabled } as any),
  })

  const toggleAtprotoNotifications = useMutation({
    mutationFn: () => usersApi.updateProfile({ atproto_notifications_enabled: !(user as any)?.atproto_notifications_enabled }),
    onSuccess: () => updateUser({ atproto_notifications_enabled: !(user as any)?.atproto_notifications_enabled } as any),
  })

  const MESSAGE_PERM_OPTIONS = [
    { label: 'Everyone', value: 'everyone' },
    { label: 'Friends only', value: 'friends' },
    { label: 'Nobody', value: 'nobody' },
  ]
  const currentMsgPerm = (user as any)?.message_permissions ?? 'everyone'
  const setMsgPerm = useMutation({
    mutationFn: (value: string) => usersApi.updateProfile({ message_permissions: value }),
    onSuccess: (_, value) => updateUser({ message_permissions: value } as any),
  })

  const { data: instanceData } = useQuery({
    queryKey: ['instance-info'],
    queryFn: () => instanceApi.getInfo().then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const invitesEnabled = instanceData?.user_invites_enabled === 'true'

  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')

  const changeEmail = useMutation({
    mutationFn: () => authApi.changeEmail({ new_email: newEmail, current_password: emailPassword }),
    onSuccess: () => {
      setNewEmail(''); setEmailPassword('')
      Alert.alert('Verification email sent', `A verification link has been sent to ${newEmail}. Please check your inbox to confirm the change.`)
      setSection('main')
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not change email'),
  })

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => { setCurrentPassword(''); setNewPassword(''); Alert.alert('Password changed!'); setSection('main') },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not change password'),
  })

  const exportData = async () => {
    setExportLoading(true)
    try {
      const { token, instanceUrl } = useAuthStore.getState()
      const fileUri = FileSystem.cacheDirectory + 'agora-data-export.zip'
      const result = await FileSystem.downloadAsync(
        `${instanceUrl}/api/users/me/export`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (result.status !== 200) throw new Error('Export failed')
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(result.uri, { mimeType: 'application/zip', dialogTitle: 'Save your data export' })
      } else {
        Alert.alert('Export saved', `Your data has been saved to:\n${result.uri}`)
      }
    } catch {
      Alert.alert('Error', 'Could not export data. Please try again.')
    } finally {
      setExportLoading(false)
    }
  }

  const resetFeedHistory = useMutation({
    mutationFn: () => interactionsApi.reset(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      showToast('Your feed history has been reset')
    },
    onError: (e: any) => showToast(e.response?.data?.error || 'Could not reset feed history', 'error'),
  })

  const requestDeletion = useMutation({
    mutationFn: () => usersApi.requestDeletion(),
    onSuccess: (res) => {
      setDeletionScheduledAt(res.data.deletion_scheduled_at)
      const date = new Date(res.data.deletion_scheduled_at).toLocaleDateString()
      Alert.alert('Account deletion scheduled', `Your account will be permanently deleted on ${date}. You can cancel this before then.`)
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not schedule deletion'),
  })

  const cancelDeletion = useMutation({
    mutationFn: () => usersApi.cancelDeletion(),
    onSuccess: () => {
      setDeletionScheduledAt(null)
      Alert.alert('Deletion cancelled', 'Your account deletion has been cancelled.')
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not cancel deletion'),
  })

  const Row = ({ icon, label, onPress, right, destructive = false }: any) => (
    <TouchableOpacity onPress={onPress} style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      <View style={[s.rowIcon, { backgroundColor: destructive ? '#fee2e2' : c.primaryBg }]}>
        <Ionicons name={icon} size={18} color={destructive ? c.red : c.primary} />
      </View>
      <Text style={[s.rowLabel, { color: destructive ? c.red : c.text }]}>{label}</Text>
      {right ?? <Ionicons name="chevron-forward" size={16} color={c.textLight} />}
    </TouchableOpacity>
  )

  const headerOpts = (title: string, back: string) => ({
    headerShown: true, headerTitle: title, headerBackTitle: back,
    headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary,
  })

  if (section === 'email') return (
    <Screen>
      <Stack.Screen options={headerOpts('Change Email', 'Settings')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={[s.label, { color: c.textMd }]}>Current email</Text>
          <Text style={[s.input, { marginBottom: 16, backgroundColor: c.card, borderColor: c.border, color: c.textMuted, paddingTop: 11 }]}>{user?.email}</Text>
          <Text style={[s.label, { color: c.textMd }]}>New email address</Text>
          <TextInput style={[s.input, { marginBottom: 16, backgroundColor: c.card, borderColor: c.border, color: c.text }]} keyboardType="email-address" autoCapitalize="none" value={newEmail} onChangeText={setNewEmail} placeholder="new@example.com" placeholderTextColor={c.textLight} />
          <Text style={[s.label, { color: c.textMd }]}>Current password</Text>
          <TextInput style={[s.input, { marginBottom: 24, backgroundColor: c.card, borderColor: c.border, color: c.text }]} secureTextEntry value={emailPassword} onChangeText={setEmailPassword} placeholder="••••••••" placeholderTextColor={c.textLight} />
          <TouchableOpacity onPress={() => changeEmail.mutate()} disabled={!newEmail || !emailPassword || changeEmail.isPending}
            style={[s.btn, (!newEmail || !emailPassword) && { backgroundColor: c.primaryLt }]}>
            <Text style={s.btnText}>{changeEmail.isPending ? 'Sending…' : 'Send verification email'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )

  if (section === 'password') return (
    <Screen>
      <Stack.Screen options={headerOpts('Change Password', 'Settings')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={[s.label, { color: c.textMd }]}>Current password</Text>
          <TextInput style={[s.input, { marginBottom: 16, backgroundColor: c.card, borderColor: c.border, color: c.text }]} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} placeholder="••••••••" placeholderTextColor={c.textLight} />
          <Text style={[s.label, { color: c.textMd }]}>New password</Text>
          <TextInput style={[s.input, { marginBottom: 24, backgroundColor: c.card, borderColor: c.border, color: c.text }]} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" placeholderTextColor={c.textLight} />
          <TouchableOpacity onPress={() => changePassword.mutate()} disabled={!currentPassword || !newPassword || changePassword.isPending}
            style={[s.btn, (!currentPassword || !newPassword) && { backgroundColor: c.primaryLt }]}>
            <Text style={s.btnText}>{changePassword.isPending ? 'Saving…' : 'Change password'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )

  return (
    <Screen>
      <Stack.Screen options={headerOpts('Settings', 'Profile')} />
      <ScrollView>
        <Text style={[s.section, { color: c.textMuted }]}>Account</Text>
        <Row icon="person-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <Row icon="people-outline" label="Friend lists" onPress={() => router.push('/friend-lists')} />
        <Row icon="mail-outline" label="Change email" onPress={() => setSection('email')} />
        <Row icon="key-outline" label="Change password" onPress={() => setSection('password')} />
        {invitesEnabled && (
          <Row icon="mail-outline" label="Invite a friend" onPress={() => router.push('/invite-friend')} />
        )}
        {(user?.role === 'admin' || user?.role === 'moderator') && (
          <>
            <Text style={[s.section, { color: c.textMuted }]}>Administration</Text>
            <Row icon="shield-outline" label="Admin Panel" onPress={() => router.push('/admin')} />
          </>
        )}
        <Text style={[s.section, { color: c.textMuted }]}>Appearance</Text>
        <View style={[s.themeRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <View style={[s.rowIcon, { backgroundColor: c.primaryBg }]}>
            <Ionicons name="color-palette-outline" size={18} color={c.primary} />
          </View>
          <Text style={[s.rowLabel, { color: c.text }]}>Theme</Text>
          <View style={[s.themePicker, { backgroundColor: c.bg, borderColor: c.border }]}>
            {(['light', 'system', 'dark'] as const).map(opt => (
              <TouchableOpacity key={opt} onPress={() => setPreference(opt)}
                style={[s.themeOption, preference === opt && { backgroundColor: c.primary }]}>
                <Text style={[s.themeOptionText, { color: preference === opt ? c.white : c.textMuted }]}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={[s.section, { color: c.textMuted }]}>Privacy</Text>
        <Row icon="lock-closed-outline" label="Private profile"
          right={<Switch value={user?.profile_private ?? false} onValueChange={() => togglePrivacy.mutate()} trackColor={{ false: c.border, true: c.primary }} />} />
        <Row icon="eye-off-outline" label="Hide timeline"
          right={<Switch value={!!(user as any)?.hide_timeline} onValueChange={() => toggleHideTimeline.mutate()} trackColor={{ false: c.border, true: c.primary }} disabled={toggleHideTimeline.isPending} />} />
        <Row icon="checkmark-circle-outline" label="Approve wall posts"
          right={<Switch value={!!(user as any)?.approve_wall_posts} onValueChange={() => toggleApproveWallPosts.mutate()} trackColor={{ false: c.border, true: c.primary }} disabled={toggleApproveWallPosts.isPending} />} />
        <View style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <View style={[s.rowIcon, { backgroundColor: c.primaryBg }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={c.primary} />
          </View>
          <Text style={[s.rowLabel, { color: c.text }]}>Messages from</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {MESSAGE_PERM_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.value} onPress={() => setMsgPerm.mutate(opt.value)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
                  borderColor: currentMsgPerm === opt.value ? c.primary : c.border,
                  backgroundColor: currentMsgPerm === opt.value ? c.primaryBg : 'transparent' }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: currentMsgPerm === opt.value ? c.primary : c.textMuted }}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={[s.section, { color: c.textMuted }]}>Fediverse</Text>
        <Text style={[s.sectionHint, { color: c.textMuted }]}>
          Agora can talk to Mastodon and the rest of the fediverse over ActivityPub. Turning this on lets people
          out there find, follow, and see your public posts. Private and friends-only posts are never federated.
        </Text>
        <Row icon="planet-outline" label="Fediverse (ActivityPub)"
          right={<Switch value={(user as any)?.activitypub_enabled ?? true} onValueChange={() => toggleActivityPub.mutate()} trackColor={{ false: c.border, true: c.primary }} disabled={toggleActivityPub.isPending} />} />
        <Row icon="notifications-outline" label="Fediverse post notifications"
          right={<Switch value={(user as any)?.fediverse_notifications_enabled ?? true} onValueChange={() => toggleFediverseNotifications.mutate()} trackColor={{ false: c.border, true: c.primary }} disabled={toggleFediverseNotifications.isPending} />} />
        <Row icon="people-outline" label="Manage fediverse follows" onPress={() => router.push('/connections?tab=fediverse' as any)} />
        <Text style={[s.section, { color: c.textMuted }]}>Bluesky</Text>
        <Text style={[s.sectionHint, { color: c.textMuted }]}>
          Agora can also talk to Bluesky over AT Protocol, a separate network from the fediverse. Turning this on
          lets people on Bluesky find, follow, and see your public posts.
        </Text>
        <Row icon="cloud-outline" label="Bluesky (AT Protocol)"
          right={<Switch value={(user as any)?.atproto_enabled ?? true} onValueChange={() => toggleAtproto.mutate()} trackColor={{ false: c.border, true: c.primary }} disabled={toggleAtproto.isPending} />} />
        <Row icon="notifications-outline" label="Bluesky post notifications"
          right={<Switch value={(user as any)?.atproto_notifications_enabled ?? true} onValueChange={() => toggleAtprotoNotifications.mutate()} trackColor={{ false: c.border, true: c.primary }} disabled={toggleAtprotoNotifications.isPending} />} />
        <Row icon="people-outline" label="Manage Bluesky follows" onPress={() => router.push('/connections?tab=bluesky' as any)} />
        <Text style={[s.section, { color: c.textMuted }]}>Data</Text>
        <Row icon="download-outline" label={exportLoading ? 'Exporting…' : 'Export my data'} onPress={exportData} />
        <Row icon="refresh-circle-outline" label="Reset feed history" onPress={() =>
          Alert.alert('Reset feed history?', 'This will clear your interaction history and your feed will return to the default ranking.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: () => resetFeedHistory.mutate() },
          ])} />
        {deletionScheduledAt ? (
          <Row icon="refresh-outline" label="Cancel account deletion" onPress={() =>
            Alert.alert('Cancel deletion?', `Your account is scheduled for deletion on ${new Date(deletionScheduledAt).toLocaleDateString()}. Cancel this?`, [
              { text: 'Keep scheduled', style: 'cancel' },
              { text: 'Cancel deletion', onPress: () => cancelDeletion.mutate() },
            ])} />
        ) : (
          <Row icon="trash-outline" label="Delete account" destructive onPress={() =>
            Alert.alert('Delete account?', 'Your account will be scheduled for deletion. You\'ll have a grace period to cancel before it\'s permanently removed.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete account', style: 'destructive', onPress: () => requestDeletion.mutate() },
            ])} right={<View />} />
        )}
        <Text style={[s.section, { color: c.textMuted }]}>Help</Text>
        <Row icon="help-circle-outline" label="Help & Documentation" onPress={() => {
          const instanceUrl = useAuthStore.getState().instanceUrl
          if (instanceUrl) WebBrowser.openBrowserAsync(`${instanceUrl}/docs#user/index`)
        }} />
        <Row icon="sparkles-outline" label="What's New" onPress={() => {
          resetWhatsNew().then(() => {
            useWhatsNewStore.getState().trigger()
            router.back()
          })
        }} />
        <Text style={[s.section, { color: c.textMuted }]}>About</Text>
        <Row icon="person-circle-outline" label={`Signed in as @${user?.username}`} onPress={() => {}} right={<View />} />
        <Row icon="server-outline" label={`Instance: ${useAuthStore.getState().instanceUrl?.replace(/^https?:\/\//, '')}`} onPress={() => {}} right={<View />} />
        <Row icon="information-circle-outline" label={`Version ${Constants.expoConfig?.version ?? '—'}`} onPress={() => {}} right={<View />} />
        <View style={{ marginTop: 8 }}>
          <Row icon="log-out-outline" label="Sign out" destructive onPress={() => Alert.alert('Sign out?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: logout },
          ])} right={<View />} />
        </View>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  section: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  sectionHint: { fontSize: 12, lineHeight: 17, paddingHorizontal: 16, paddingBottom: 10 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  themePicker: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  themeOption: { paddingHorizontal: 12, paddingVertical: 6 },
  themeOptionText: { fontSize: 13, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  rowIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, color: C.text },
  label: { fontSize: 14, fontWeight: '500', color: C.textMd, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.text, backgroundColor: C.card },
  btn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600', fontSize: 16 },
})
