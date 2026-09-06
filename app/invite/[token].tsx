import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner } from '../../components/ui'
import { groupsApi } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useC } from '../../constants/ColorContext'

// AMOBILE-182: must match the key the root layout checks after a successful
// login/register so a redeemed link isn't lost when the user has to
// authenticate first.
const PENDING_INVITE_KEY = 'agora_pending_invite'

type Status = 'loading' | 'success' | 'already' | 'error'

export default function InviteScreen() {
  const c = useC()
  const { token } = useLocalSearchParams<{ token: string }>()
  const { isAuthenticated } = useAuthStore()
  const [status, setStatus] = useState<Status>('loading')
  const [slug, setSlug] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) return

    if (!isAuthenticated) {
      // Stash the token and send them to log in first; the root layout
      // resumes redemption once setAuth() fires.
      SecureStore.setItemAsync(PENDING_INVITE_KEY, token)
      router.replace('/(auth)')
      return
    }

    groupsApi.joinByInvite(token)
      .then(res => {
        setSlug(res.data.slug || res.data.group?.slug || '')
        setStatus(res.data.message === 'you are already a member' ? 'already' : 'success')
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'Invalid or expired invite link'
        if (typeof msg === 'string' && msg.includes('already')) {
          setStatus('already')
        } else {
          setErrorMsg(msg)
          setStatus('error')
        }
      })
  }, [token, isAuthenticated])

  const goToGroup = () => slug ? router.replace(`/group/${slug}`) : router.replace('/(tabs)/groups')

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Invite', headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary }} />
      <View style={s.wrap}>
        {status === 'loading' && (
          <View style={s.center}>
            <Spinner />
            <Text style={[s.msg, { color: c.textMuted }]}>Joining group…</Text>
          </View>
        )}

        {status === 'success' && (
          <View style={s.center}>
            <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            <Text style={[s.title, { color: c.text }]}>You're in!</Text>
            <Text style={[s.msg, { color: c.textMuted }]}>You've successfully joined the group.</Text>
            <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={goToGroup}>
              <Text style={s.btnText}>Go to Group</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'already' && (
          <View style={s.center}>
            <Ionicons name="checkmark-circle" size={48} color={c.textMuted} />
            <Text style={[s.title, { color: c.text }]}>Already a member</Text>
            <Text style={[s.msg, { color: c.textMuted }]}>You're already in this group.</Text>
            <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={goToGroup}>
              <Text style={s.btnText}>{slug ? 'Go to Group' : 'Browse Groups'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'error' && (
          <View style={s.center}>
            <Ionicons name="close-circle" size={48} color="#ef4444" />
            <Text style={[s.title, { color: c.text }]}>Invite not valid</Text>
            <Text style={[s.msg, { color: c.textMuted }]}>{errorMsg}</Text>
            <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={() => router.replace('/(tabs)/groups')}>
              <Text style={s.btnText}>Browse Groups</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Screen>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', gap: 10, maxWidth: 320 },
  title: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  msg: { fontSize: 14, textAlign: 'center' },
  btn: { marginTop: 10, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  btnText: { color: 'white', fontWeight: '600', fontSize: 15 },
})
