import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, StyleSheet } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Avatar } from '../components/ui'
import { federationApi, usersApi } from '../api'
import { useAuthStore } from '../store/auth'
import { useC } from '../constants/ColorContext'

interface FediversePreview {
  actor_url: string
  preferred_username: string
  name: string
  summary: string
  icon_url: string
  instance: string
}

export default function FediverseScreen() {
  const c = useC()
  const { user, updateUser } = useAuthStore()
  const [handle, setHandle] = useState('')
  const [preview, setPreview] = useState<FediversePreview | null>(null)
  const [searchError, setSearchError] = useState('')

  const toggleActivityPub = useMutation({
    mutationFn: () => usersApi.updateProfile({ activitypub_enabled: !(user as any)?.activitypub_enabled }),
    onSuccess: () => updateUser({ activitypub_enabled: !(user as any)?.activitypub_enabled } as any),
  })

  const resolve = useMutation({
    mutationFn: (h: string) => federationApi.resolveFediverseHandle(h).then(r => r.data),
    onSuccess: (data) => { setPreview(data); setSearchError('') },
    onError: (e: any) => { setPreview(null); setSearchError(e.response?.data?.error || 'Could not resolve that handle.') },
  })

  const follow = useMutation({
    mutationFn: (actorUrl: string) => federationApi.followFediverseAccount(actorUrl),
    onSuccess: () => { setPreview(null); setHandle('') },
    onError: (e: any) => setSearchError(e.response?.data?.error || 'Could not follow that account.'),
  })

  const handleSearch = () => {
    const trimmed = handle.trim()
    if (!trimmed) return
    setSearchError('')
    resolve.mutate(trimmed)
  }

  return (
    <Screen>
      <Header title="Fediverse" back />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View style={[s.card, { backgroundColor: c.card }]}>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: c.text }]}>Fediverse (ActivityPub)</Text>
              <Text style={[s.cardSubtitle, { color: c.textMuted }]}>
                Let people on Mastodon and other fediverse apps find, follow, and see your public posts.
              </Text>
            </View>
            <Switch
              value={(user as any)?.activitypub_enabled ?? true}
              onValueChange={() => toggleActivityPub.mutate()}
              trackColor={{ false: c.border, true: c.primary }}
              disabled={toggleActivityPub.isPending}
            />
          </View>
        </View>

        <View style={[s.card, { backgroundColor: c.card }]}>
          <Text style={[s.cardTitle, { color: c.text }]}>Follow a fediverse account</Text>
          <Text style={[s.cardSubtitle, { color: c.textMuted, marginBottom: 12 }]}>
            Enter a full handle (e.g. user@mastodon.social) or a profile URL. There's no way to search the
            fediverse by name — like Mastodon's own remote search, you need the exact handle.
          </Text>
          <View style={s.searchRow}>
            <TextInput
              style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              value={handle}
              onChangeText={setHandle}
              placeholder="user@instance.social"
              placeholderTextColor={c.textLight}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              onPress={handleSearch}
              disabled={resolve.isPending || !handle.trim()}
              style={[s.searchBtn, { backgroundColor: c.primaryBg }, (!handle.trim() || resolve.isPending) && { opacity: 0.5 }]}
            >
              <Ionicons name="search" size={18} color={c.primary} />
            </TouchableOpacity>
          </View>

          {!!searchError && <Text style={[s.error, { color: c.red }]}>{searchError}</Text>}

          {preview && (
            <View style={[s.previewRow, { borderColor: c.border }]}>
              <Avatar url={preview.icon_url} name={preview.name || preview.preferred_username} size={44} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[s.previewName, { color: c.text }]} numberOfLines={1}>
                  {preview.name || preview.preferred_username}
                </Text>
                <Text style={[s.previewHandle, { color: c.textMuted }]} numberOfLines={1}>
                  @{preview.preferred_username}@{preview.instance}
                </Text>
                {!!preview.summary && (
                  <Text style={[s.previewSummary, { color: c.textMuted }]} numberOfLines={2}>{preview.summary}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => follow.mutate(preview.actor_url)}
                disabled={follow.isPending}
                style={[s.followBtn, { backgroundColor: c.primary }]}
              >
                <Text style={s.followBtnText}>{follow.isPending ? 'Following…' : 'Follow'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardSubtitle: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  searchBtn: { width: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 13, marginTop: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14 },
  previewName: { fontSize: 14, fontWeight: '600' },
  previewHandle: { fontSize: 12, marginTop: 1 },
  previewSummary: { fontSize: 12, marginTop: 4 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginLeft: 8 },
  followBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
})
