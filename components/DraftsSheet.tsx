import { View, Text, Modal, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNowStrict } from 'date-fns'
import { draftsApi } from '../api'
import { useC } from '../constants/ColorContext'

// AGORA-431: the drafts someone has saved, to pick one up where they left it or
// throw it away. They live on the server, so a draft saved on the web is here
// too.

export interface Draft {
  id: string
  content: string
  data: Record<string, any>
  updated_at: string
}

export default function DraftsSheet({ visible, onPick, onClose }: { visible: boolean; onPick: (d: Draft) => void; onClose: () => void }) {
  const c = useC()
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['drafts'],
    queryFn: () => draftsApi.list().then((r) => r.data),
    enabled: visible,
  })
  const drafts: Draft[] = data?.drafts ?? []
  const remove = useMutation({
    mutationFn: (id: string) => draftsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drafts'] }),
    onError: () => Alert.alert('Error', 'Could not delete that draft'),
  })

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: c.card }]}>
        <View style={[s.header, { borderBottomColor: c.border }]}>
          <Text style={[s.title, { color: c.text }]}>Drafts</Text>
          <TouchableOpacity onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={c.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView>
          {isLoading ? <Text style={[s.note, { color: c.textMuted }]}>Loading drafts…</Text> : null}
          {isError ? (
            <TouchableOpacity onPress={() => refetch()}><Text style={[s.note, { color: c.red }]}>Couldn't load your drafts. Tap to try again.</Text></TouchableOpacity>
          ) : null}
          {!isLoading && !isError && drafts.length === 0 ? (
            <Text style={[s.note, { color: c.textMuted }]}>No drafts. Choose Save draft while writing a post to keep it for later.</Text>
          ) : null}
          {drafts.map((d) => {
            const photos = (d.data.image_urls ?? []).length
            const hasPoll = (d.data.poll_options ?? []).some((o: string) => o?.trim())
            return (
              <View key={d.id} style={[s.row, { borderBottomColor: c.border }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => onPick(d)} accessibilityRole="button">
                  <Text style={{ color: d.content.trim() ? c.text : c.textLight, fontSize: 16 }} numberOfLines={2}>
                    {d.content.trim() || 'No text'}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>
                    {formatDistanceToNowStrict(new Date(d.updated_at), { addSuffix: true })}
                    {photos > 0 ? ` · ${photos} photo${photos === 1 ? '' : 's'}` : ''}
                    {d.data.video_url ? ' · video' : ''}
                    {hasPoll ? ' · poll' : ''}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Alert.alert('Delete this draft?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(d.id) },
                  ])}
                  style={s.trash} accessibilityRole="button" accessibilityLabel="Delete draft">
                  <Ionicons name="trash-outline" size={20} color={c.textMuted} />
                </TouchableOpacity>
              </View>
            )
          })}
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title:     { fontSize: 19, fontWeight: '700' },
  close:     { padding: 4 },
  note:      { fontSize: 15, padding: 16 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  trash:     { padding: 14 },
})
