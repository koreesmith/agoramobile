import { useState } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert, RefreshControl, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Screen, Spinner, EmptyState } from '../components/ui'
import { keywordMutesApi } from '../api'
import { useC } from '../constants/ColorContext'

interface KeywordMute {
  id: string
  keyword: string
  expires_at: string | null
}

const DURATIONS: { label: string; days: number }[] = [
  { label: 'Forever', days: 0 },
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

function remaining(expiresAt: string | null) {
  if (!expiresAt) return 'Forever'
  const ms = new Date(expiresAt).getTime() - Date.now()
  const days = Math.ceil(ms / 86400000)
  if (days >= 2) return `${days} days left`
  const hours = Math.max(1, Math.ceil(ms / 3600000))
  return hours >= 24 ? '1 day left' : `${hours} ${hours === 1 ? 'hour' : 'hours'} left`
}

// AGORA-428, mirroring the muted keywords card in web's Settings. A muted word
// hides matching posts from the timelines only; Bookmarks, profiles and search
// still show them.
export default function MutedKeywordsScreen() {
  const c = useC()
  const qc = useQueryClient()
  const [word, setWord] = useState('')
  const [days, setDays] = useState(0)

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['keyword-mutes'],
    queryFn: () => keywordMutesApi.list().then(r => r.data),
  })
  const mutes: KeywordMute[] = data?.mutes || []

  // The feed is holding a result computed before this change, so it has to be
  // refetched or the new mute does not show until something else invalidates.
  const changed = () => {
    qc.invalidateQueries({ queryKey: ['keyword-mutes'] })
    qc.invalidateQueries({ queryKey: ['feed'] })
  }

  const add = useMutation({
    mutationFn: () => keywordMutesApi.add(word.trim(), days),
    onSuccess: () => { setWord(''); changed() },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not mute keyword'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => keywordMutesApi.remove(id),
    onSuccess: changed,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not unmute keyword'),
  })

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: 'Muted Keywords',
        headerBackTitle: 'Settings',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />

      {isLoading ? <Spinner /> : (
        <FlatList
          data={mutes}
          keyExtractor={m => m.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListHeaderComponent={
            <View style={{ padding: 16, gap: 12 }}>
              <Text style={[s.intro, { color: c.textMuted }]}>
                Posts containing a muted word or phrase are hidden from your timelines, including posts from the
                Fediverse and Bluesky. Matching ignores capitals and whole words only, so muting "cat" does not hide
                "category". It checks the post text, content warning and image description. Muted posts still show in
                Bookmarks, on profiles and in search.
              </Text>
              <TextInput
                value={word}
                onChangeText={setWord}
                placeholder="Word or phrase"
                placeholderTextColor={c.textLight}
                maxLength={100}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => { if (word.trim()) add.mutate() }}
                style={[s.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
              />
              <View style={s.chips}>
                {DURATIONS.map(d => {
                  const on = d.days === days
                  return (
                    <TouchableOpacity
                      key={d.days}
                      onPress={() => setDays(d.days)}
                      style={[s.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.card }]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : c.textMd }}>{d.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <TouchableOpacity
                onPress={() => add.mutate()}
                disabled={add.isPending || !word.trim()}
                style={[s.muteBtn, { backgroundColor: c.primary, opacity: add.isPending || !word.trim() ? 0.5 : 1 }]}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Mute</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="🔇" title="You haven't muted any keywords" subtitle="Muted words will appear here" />
          }
          renderItem={({ item }) => (
            <View style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.word, { color: c.text }]}>{item.keyword}</Text>
                <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>{remaining(item.expires_at)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => remove.mutate(item.id)}
                disabled={remove.isPending}
                style={[s.unmuteBtn, { borderColor: c.border, backgroundColor: c.bg }]}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.textMd }}>Unmute</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  intro:     { fontSize: 15 },
  input:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  muteBtn:   { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  word:      { fontWeight: '600', fontSize: 17 },
  unmuteBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
})
