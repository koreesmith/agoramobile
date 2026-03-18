import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { router, Stack } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../components/ui'
import { usersApi, authApi } from '../api'
import { useAuthStore } from '../store/auth'
import { C } from '../constants/colors'
import { useC } from '../constants/ColorContext'
import { useThemeStore, ThemePreference } from '../store/theme'

export default function SettingsScreen() {
  const c = useC()
  const { user, updateUser, logout } = useAuthStore()
  const { preference, setPreference } = useThemeStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [section, setSection] = useState<'main' | 'password'>('main')

  const togglePrivacy = useMutation({
    mutationFn: () => usersApi.updateProfile({ profile_private: !user?.profile_private }),
    onSuccess: () => updateUser({ profile_private: !user?.profile_private }),
  })

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => { setCurrentPassword(''); setNewPassword(''); Alert.alert('Password changed!'); setSection('main') },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not change password'),
  })

  const Row = ({ icon, label, onPress, right, destructive = false }: any) => (
    <TouchableOpacity onPress={onPress} style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: destructive ? '#fee2e2' : c.primaryBg }]}>
        <Ionicons name={icon} size={18} color={destructive ? c.red : c.primary} />
      </View>
      <Text style={[s.rowLabel, destructive && { color: c.red }]}>{label}</Text>
      {right ?? <Ionicons name="chevron-forward" size={16} color={c.textLight} />}
    </TouchableOpacity>
  )

  const headerOpts = (title: string, back: string) => ({
    headerShown: true, headerTitle: title, headerBackTitle: back,
    headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary,
  })

  if (section === 'password') return (
    <Screen>
      <Stack.Screen options={headerOpts('Change Password', 'Settings')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Current password</Text>
          <TextInput style={[s.input, { marginBottom: 16 }]} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} placeholder="••••••••" placeholderTextColor={c.textLight} />
          <Text style={s.label}>New password</Text>
          <TextInput style={[s.input, { marginBottom: 24 }]} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" placeholderTextColor={c.textLight} />
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
        <Text style={s.section}>Account</Text>
        <Row icon="person-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <Row icon="key-outline" label="Change password" onPress={() => setSection('password')} />
        <Text style={s.section}>Appearance</Text>
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
        <Text style={s.section}>Privacy</Text>
        <Row icon="lock-closed-outline" label="Private profile"
          right={<Switch value={user?.profile_private ?? false} onValueChange={() => togglePrivacy.mutate()} trackColor={{ false: c.border, true: c.primary }} />} />
        <Text style={s.section}>About</Text>
        <Row icon="person-circle-outline" label={`Signed in as @${user?.username}`} onPress={() => {}} right={<View />} />
        <Row icon="server-outline" label={`Instance: ${useAuthStore.getState().instanceUrl?.replace(/^https?:\/\//, '')}`} onPress={() => {}} right={<View />} />
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
