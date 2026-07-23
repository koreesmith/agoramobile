import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { pollApi } from '../api'
import { useC } from '../constants/ColorContext'
import { Avatar, renderName } from './ui'

interface Voter {
  id: string
  username: string
  display_name: string
  avatar_url: string
  emojis?: Record<string, string>
}
interface OptionVoters {
  option_id: string
  option_text: string
  voters: Voter[]
}

interface Props {
  postId: string
  visible: boolean
  onClose: () => void
}

// No gating (poll open/closed, voted or not) and no privacy filtering --
// matches web's actual shipped behavior (AGORA-48): voters are visible to
// anyone anytime a vote exists, since neither the server endpoint nor web's
// own UI restricts it.
export default function PollVotersModal({ postId, visible, onClose }: Props) {
  const c = useC()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['poll-voters', postId],
    queryFn: () => pollApi.getVoters(postId).then(r => r.data),
    enabled: visible,
  })

  const options: OptionVoters[] = data?.options ?? []

  const goToProfile = (username: string) => {
    onClose()
    router.push(`/profile/${username}`)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[s.header, { borderBottomColor: c.border }]}>
            <Text style={[s.title, { color: c.text }]}>Poll votes</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator style={{ marginVertical: 40 }} color={c.primary} />
          ) : isError ? (
            <Text style={[s.empty, { color: c.textMuted }]}>Could not load votes.</Text>
          ) : options.length === 0 ? (
            <Text style={[s.empty, { color: c.textMuted }]}>No votes yet.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {options.map(opt => (
                <View key={opt.option_id} style={s.section}>
                  <Text style={[s.optionLabel, { color: c.textMuted }]}>{opt.option_text}</Text>
                  {opt.voters.length === 0 ? (
                    <Text style={[s.noVotes, { color: c.textLight }]}>No votes</Text>
                  ) : opt.voters.map(v => (
                    <TouchableOpacity key={v.id} style={s.row} onPress={() => goToProfile(v.username)}>
                      <Avatar url={v.avatar_url} name={v.display_name || v.username} size={30} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[s.displayName, { color: c.text }]} numberOfLines={1}>
                          {v.display_name ? renderName(v.display_name, v.emojis) : v.username}
                        </Text>
                        <Text style={[s.username, { color: c.textMuted }]} numberOfLines={1}>@{v.username}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, maxHeight: '70%' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title:       { fontWeight: '700', fontSize: 19 },
  closeBtn:    { padding: 4 },
  section:     { paddingHorizontal: 20, paddingTop: 12 },
  optionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  noVotes:     { fontSize: 13, fontStyle: 'italic', marginBottom: 4 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  displayName: { fontWeight: '600', fontSize: 16 },
  username:    { fontSize: 13, marginTop: 1 },
  empty:       { textAlign: 'center', marginVertical: 40, fontSize: 16 },
})
