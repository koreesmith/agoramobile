import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Switch, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api'
import { useC } from '../constants/ColorContext'
import { useToastStore } from '../store/toast'

// AMOBILE-213: the Remote Media Cache card from web's Storage tab
// (AGORA-380/381). The cache holds local copies of profile pictures and
// covers from other servers. The orphan scan beside it leaves those files
// alone.

interface CacheSettings { enabled: boolean, max_mb: number, max_file_mb: number }
interface CacheStats { files: number, bytes: number, orphaned_files: number }
// The limits as typed, so a field can be empty while it's being edited.
interface Form { enabled: boolean, max_mb: string, max_file_mb: string }

const QUERY_KEY = ['admin-remote-media-cache']
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)
const toForm = (s: CacheSettings): Form => ({ enabled: s.enabled, max_mb: String(s.max_mb), max_file_mb: String(s.max_file_mb) })
const parseLimit = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)

export default function RemoteMediaCacheCard() {
  const c = useC()
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.show)
  const { data, error } = useQuery<{ settings: CacheSettings, stats: CacheStats }>({
    queryKey: QUERY_KEY,
    queryFn: () => adminApi.getRemoteMediaCache().then(r => r.data),
    retry: false,
  })
  const [form, setForm] = useState<Form | null>(null)
  useEffect(() => { if (data && !form) setForm(toForm(data.settings)) }, [data, form])

  const refresh = (next: any) => qc.setQueryData(QUERY_KEY, (old: any) => ({ ...old, ...next }))
  const save = useMutation({
    mutationFn: (s: CacheSettings) => adminApi.updateRemoteMediaCache(s),
    onSuccess: (res) => { refresh(res.data); setForm(toForm(res.data.settings)); toast('Cache settings saved') },
    onError: (e: any) => toast(e.response?.data?.error || 'Could not save cache settings', 'error'),
  })
  const prune = useMutation({
    mutationFn: () => adminApi.pruneRemoteMediaCache(),
    onSuccess: (res) => {
      refresh({ stats: res.data.stats })
      const r = res.data.result
      toast(`Pruned ${r.orphans_removed + r.evicted} file(s), freed ${mb(r.bytes_freed)} MB`)
    },
    onError: () => toast('Prune failed', 'error'),
  })
  const clear = useMutation({
    mutationFn: () => adminApi.clearRemoteMediaCache(),
    onSuccess: (res) => { refresh({ stats: res.data.stats }); toast(`Cleared the cache, freed ${mb(res.data.result.bytes_freed)} MB`) },
    onError: () => toast('Clear failed', 'error'),
  })
  // Refreshing is what (re)caches avatars and covers, so this is also how to
  // repopulate the cache right after clearing it.
  const refreshAll = useMutation({
    mutationFn: () => adminApi.refreshRemoteProfiles(),
    onSuccess: (res) => toast(res.data.started
      ? 'Refreshing remote profiles in the background'
      : 'A refresh is already running'),
    onError: () => toast('Could not start the refresh', 'error'),
  })

  // Servers older than v4.0.0 have no cache to manage, so there's nothing to
  // show rather than an error.
  if ((error as any)?.response?.status === 404) return null

  const card = [s.card, { backgroundColor: c.card, borderColor: c.border }]
  const title = <Text style={[s.title, { color: c.textMuted }]}>Remote Media Cache</Text>
  if (error) return (
    <View style={card}>
      {title}
      <Text style={{ color: c.textMuted, fontSize: 15 }}>Couldn't load the cache settings.</Text>
    </View>
  )
  if (!data || !form) return null

  const stats = data.stats
  const limitBytes = data.settings.max_mb * 1024 * 1024
  const pct = limitBytes ? Math.min(100, (stats.bytes / limitBytes) * 100) : 0
  const maxMB = parseLimit(form.max_mb)
  const maxFileMB = parseLimit(form.max_file_mb)
  const valid = maxMB >= 1 && maxFileMB >= 1
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(data.settings))
  const busy = prune.isPending || clear.isPending

  const confirmClear = () => Alert.alert(
    'Clear the cache?',
    'Remove every cached copy? Profiles fall back to the original links until they are cached again.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear cache', style: 'destructive', onPress: () => clear.mutate() },
    ]
  )

  const limitInput = (label: string, key: 'max_mb' | 'max_file_mb') => (
    <View style={{ gap: 4 }}>
      <Text style={[s.label, { color: c.textMd }]}>{label}</Text>
      <TextInput
        style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
        value={form[key]}
        onChangeText={v => setForm({ ...form, [key]: v })}
        keyboardType="number-pad"
        returnKeyType="done"
        accessibilityLabel={label}
      />
    </View>
  )

  return (
    <View style={card}>
      {title}
      <Text style={[s.body, { color: c.textMd }]}>
        Local copies of profile pictures and cover photos from other servers, so they keep working when the original
        link expires or is removed. Unused copies are pruned hourly, and the oldest are evicted when the cache passes its limit.
      </Text>

      <View style={{ gap: 6 }}>
        <Text style={{ color: c.text, fontSize: 15 }}>
          <Text style={{ fontWeight: '700' }}>{stats.files}</Text> file{stats.files !== 1 ? 's' : ''} · {mb(stats.bytes)} MB of {data.settings.max_mb} MB
        </Text>
        <View style={[s.track, { backgroundColor: c.border }]} accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
          <View style={[s.fill, { width: `${pct}%`, backgroundColor: pct >= 90 ? c.amber : c.primary }]} />
        </View>
        {stats.orphaned_files > 0 && (
          <Text style={{ color: c.textMuted, fontSize: 13 }}>{stats.orphaned_files} unused, pruned next run</Text>
        )}
      </View>

      <View style={s.switchRow}>
        <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>Cache remote profile pictures and covers</Text>
        <Switch value={form.enabled} onValueChange={v => setForm({ ...form, enabled: v })}
          trackColor={{ false: c.border, true: c.primary }} />
      </View>
      {limitInput('Total size limit (MB)', 'max_mb')}
      {limitInput('Largest single file (MB)', 'max_file_mb')}
      {!form.enabled && (
        <Text style={{ color: c.textMuted, fontSize: 13 }}>
          While off, nothing new is cached and existing copies stay until pruned or cleared. Profiles without a copy load from the original server.
        </Text>
      )}

      <View style={s.buttons}>
        <TouchableOpacity
          disabled={!dirty || !valid || save.isPending}
          onPress={() => save.mutate({ enabled: form.enabled, max_mb: maxMB, max_file_mb: maxFileMB })}
          style={[s.btn, { backgroundColor: c.primary, opacity: !dirty || !valid || save.isPending ? 0.5 : 1 }]}>
          <Text style={[s.btnText, { color: c.onPrimary }]}>{save.isPending ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={() => prune.mutate()}
          style={[s.btn, { borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, opacity: busy ? 0.5 : 1 }]}>
          <Text style={[s.btnText, { color: c.textMd }]}>{prune.isPending ? 'Pruning…' : 'Prune now'}</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={busy || !stats.files} onPress={confirmClear}
          style={[s.btn, { backgroundColor: '#ef4444', opacity: busy || !stats.files ? 0.5 : 1 }]}>
          <Text style={[s.btnText, { color: 'white' }]}>{clear.isPending ? 'Clearing…' : 'Clear cache'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[s.divider, { borderTopColor: c.border }]}>
        <Text style={[s.body, { color: c.textMd }]}>
          Remote profiles refresh on their own every hour. To pick up new profile pictures now, refresh every
          followed or recently active account in the background.
        </Text>
        <TouchableOpacity disabled={refreshAll.isPending} onPress={() => refreshAll.mutate()}
          style={[s.btn, { borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, alignSelf: 'flex-start', opacity: refreshAll.isPending ? 0.5 : 1 }]}>
          <Text style={[s.btnText, { color: c.textMd }]}>{refreshAll.isPending ? 'Starting…' : 'Refresh remote profiles now'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card:      { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12 },
  title:     { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -6 },
  body:      { fontSize: 13, lineHeight: 18 },
  track:     { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill:      { height: 8, borderRadius: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label:     { fontSize: 13, fontWeight: '600' },
  input:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  buttons:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn:       { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  btnText:   { fontSize: 15, fontWeight: '600' },
  divider:   { borderTopWidth: 1, paddingTop: 12, gap: 10 },
})
