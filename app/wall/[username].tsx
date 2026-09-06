import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, RefreshControl, Alert, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner, Avatar, LinkedText, renderName } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi, usersApi } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useC } from '../../constants/ColorContext'

// AMOBILE-186, mirroring web's Wall tab on ProfilePage. Split into its own
// screen rather than a tab on the profile screen, matching how mobile
// already splits Albums out (app/album, app/albums) instead of tabbing them
// inline.
export default function WallScreen() {
  const c = useC()
  const { username } = useLocalSearchParams<{ username: string }>()
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const [showComposer, setShowComposer] = useState(false)
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.getProfile(username!).then(r => r.data),
  })

  const isSelf = me?.username === username
  const status = profile?.friend_status

  const { data: wallData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['wall', username],
    queryFn: () => feedApi.getWall(username!).then(r => r.data),
    enabled: !!profile,
  })

  const { data: queueData, refetch: refetchQueue } = useQuery({
    queryKey: ['wall-queue'],
    queryFn: () => feedApi.getWallQueue().then(r => r.data),
    enabled: !!profile && isSelf,
  })

  const approve = useMutation({
    mutationFn: (id: string) => feedApi.wallApprove(id),
    onSuccess: () => { refetch(); refetchQueue() },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not approve post'),
  })
  const reject = useMutation({
    mutationFn: (id: string) => feedApi.wallReject(id),
    onSuccess: () => { refetch(); refetchQueue() },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not reject post'),
  })

  const post = async () => {
    if (!content.trim() || !profile) return
    setPosting(true)
    try {
      await feedApi.createPost({ content: content.trim(), wall_user_id: profile.id })
      setContent('')
      setShowComposer(false)
      refetch()
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Could not post to wall')
    } finally {
      setPosting(false)
    }
  }

  const posts = wallData?.posts || []
  const pending = queueData?.posts || []

  if (isLoading || !profile) return <Screen><Spinner /></Screen>

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: `${profile.display_name || profile.username}'s Wall`,
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />
      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}>
        <View style={{ padding: 12, gap: 12 }}>
          {!isSelf && status === 'accepted' && (
            showComposer ? (
              <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[s.cardTitle, { color: c.textMd }]}>Write on {profile.display_name}'s wall</Text>
                <TextInput
                  style={[s.textarea, { backgroundColor: c.bg, color: c.text, borderColor: c.border }]}
                  placeholder={`Write something on ${profile.display_name}'s wall…`}
                  placeholderTextColor={c.textLight}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  numberOfLines={3}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <TouchableOpacity onPress={() => { setShowComposer(false); setContent('') }} style={[s.btn, { borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }]}>
                    <Text style={{ color: c.textMd, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={post}
                    disabled={!content.trim() || posting}
                    style={[s.btn, { backgroundColor: (!content.trim() || posting) ? c.primaryLt : c.primary }]}
                  >
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{posting ? 'Posting…' : 'Post to wall'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setShowComposer(true)} style={[s.card, s.composerPrompt, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="create-outline" size={16} color={c.primary} />
                <Text style={{ color: c.primary, fontWeight: '600', fontSize: 15 }}>Write on {profile.display_name}'s wall</Text>
              </TouchableOpacity>
            )
          )}

          {isSelf && pending.length > 0 && (
            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[s.cardTitle, { color: c.textMd, flexDirection: 'row' }]}>
                <Ionicons name="time-outline" size={15} color={c.textMd} /> Pending approval ({pending.length})
              </Text>
              {pending.map((p: any) => (
                <View key={p.id} style={[s.pendingRow, { borderColor: c.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Avatar url={p.author_avatar_url} name={p.author_display_name || p.author_username} size={28} />
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>
                        {p.author_display_name ? renderName(p.author_display_name, p.author_emojis) : p.author_username}
                      </Text>
                      <Text style={{ fontSize: 12, color: c.textMuted }}>@{p.author_username}</Text>
                    </View>
                  </View>
                  <LinkedText text={p.content} style={{ fontSize: 14, color: c.textMd, marginTop: 6 }} emojis={p.emojis} />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => approve.mutate(p.id)}
                      disabled={approve.isPending}
                      style={[s.smallBtn, { backgroundColor: c.primary }]}
                    >
                      <Ionicons name="checkmark-circle-outline" size={13} color="white" />
                      <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => reject.mutate(p.id)}
                      disabled={reject.isPending}
                      style={[s.smallBtn, { borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }]}
                    >
                      <Ionicons name="close-circle-outline" size={13} color={c.red} />
                      <Text style={{ color: c.red, fontSize: 13, fontWeight: '600' }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {posts.map((p: any) => <PostCard key={p.id} post={p} queryKey={['wall', username]} />)}

          {posts.length === 0 && (
            <View style={[s.empty]}>
              <Ionicons name="create-outline" size={28} color={c.textLight} />
              <Text style={{ color: c.textMuted, marginTop: 6 }}>No wall posts yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  composerPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  textarea: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15, minHeight: 70, textAlignVertical: 'top', marginTop: 8 },
  btn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  pendingRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  empty: { alignItems: 'center', paddingVertical: 48 },
})
