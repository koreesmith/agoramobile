import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, Alert, StyleSheet } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner, Avatar } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { usersApi, friendsApi, feedApi, dmApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

export default function ProfileViewScreen() {
  const c = useC()
  const { username } = useLocalSearchParams<{ username: string }>()
  const { user: me } = useAuthStore()
  const qc = useQueryClient()

  const { data: profile, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.getProfile(username!).then(r => r.data),
  })

  const { data: postsData } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => feedApi.getUserPosts(username!).then(r => r.data),
    enabled: !!profile && !profile.profile_private,
  })

  const inv = () => { qc.invalidateQueries({ queryKey: ['profile', username] }); qc.invalidateQueries({ queryKey: ['friends'] }); qc.invalidateQueries({ queryKey: ['requests'] }) }
  const sendReq  = useMutation({ mutationFn: () => friendsApi.sendRequest(profile!.id), onSuccess: inv })
  const accept   = useMutation({ mutationFn: () => friendsApi.acceptRequest(profile!.id), onSuccess: inv })
  const unfriend = useMutation({ mutationFn: () => friendsApi.unfriend(profile!.id), onSuccess: inv })
  const startDM  = useMutation({ mutationFn: () => dmApi.startConversation(username!), onSuccess: (res) => router.push(`/conversation/${res.data.id}`) })

  const posts = postsData?.posts || []
  const isSelf = me?.username === username
  const status = profile?.friend_status

  if (isLoading) return <Screen><Spinner /></Screen>
  if (!profile) return <Screen><Text style={{ textAlign: 'center', marginTop: 80, color: c.textMuted }}>User not found</Text></Screen>

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, headerTitle: profile.display_name || username, headerBackTitle: 'Back', headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary }} />
      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}>
        <View style={s.cover}>
          {profile.cover_url ? <Image source={{ uri: imgUrl(profile.cover_url) }} style={{ width: '100%', height: 100 }} resizeMode="cover" /> : null}
        </View>
        <View style={s.profileCard}>
          <View style={s.avatarRow}>
            <View style={s.avatarBorder}><Avatar url={profile.avatar_url} name={profile.display_name || profile.username} size={72} /></View>
            {!isSelf && (
              <View style={s.actions}>
                {status === 'accepted' && (
                  <TouchableOpacity onPress={() => startDM.mutate()} style={s.actionBtn}>
                    <Ionicons name="chatbubble-outline" size={15} color={c.primary} />
                    <Text style={s.actionBtnText}>Message</Text>
                  </TouchableOpacity>
                )}
                {!status && (
                  <TouchableOpacity onPress={() => sendReq.mutate()} disabled={sendReq.isPending} style={s.primaryBtn}>
                    <Text style={s.primaryBtnText}>Add friend</Text>
                  </TouchableOpacity>
                )}
                {status === 'pending' && (
                  <View style={s.actionBtn}><Text style={{ fontSize: 13, color: c.textMuted }}>Pending</Text></View>
                )}
                {status === 'pending_incoming' && (
                  <TouchableOpacity onPress={() => accept.mutate()} style={s.primaryBtn}>
                    <Text style={s.primaryBtnText}>Accept</Text>
                  </TouchableOpacity>
                )}
                {status === 'accepted' && (
                  <TouchableOpacity onPress={() => Alert.alert('Unfriend?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Unfriend', style: 'destructive', onPress: () => unfriend.mutate() },
                  ])} style={s.actionBtn}>
                    <Ionicons name="checkmark" size={15} color={c.green} />
                    <Text style={s.actionBtnText}>Friends</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <Text style={[s.name, { color: c.text }]}>{profile.display_name || profile.username}</Text>
            {profile.pronouns ? <Text style={[s.pronouns, { color: c.textLight }]}>({profile.pronouns})</Text> : null}
          </View>
          <Text style={[s.username, { color: c.textMuted }]}>@{profile.username}</Text>
          {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
          <Text style={s.friends}><Text style={{ fontWeight: 'bold', color: c.text }}>{profile.friend_count || 0}</Text> friends</Text>
        </View>

        {profile.profile_private && status !== 'accepted' ? (
          <View style={s.private}>
            <Ionicons name="lock-closed" size={32} color={c.textLight} />
            <Text style={s.privateTitle}>This profile is private</Text>
            <Text style={s.privateText}>Add {profile.display_name} as a friend to see their posts</Text>
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            {posts.map((post: any) => <PostCard key={post.id} post={post} queryKey={['user-posts', username]} />)}
            {posts.length === 0 && <Text style={s.noPosts}>No posts yet.</Text>}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  cover: { height: 100, backgroundColor: C.primaryLt },
  profileCard: { backgroundColor: C.card, paddingHorizontal: 16, paddingBottom: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -36, marginBottom: 12 },
  avatarBorder: { borderWidth: 4, borderColor: C.card, borderRadius: 40 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 36 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  actionBtnText: { fontSize: 13, fontWeight: '500', color: C.textMd },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  primaryBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  name: { fontSize: 20, fontWeight: 'bold', color: C.text },
  pronouns: { fontSize: 13 },
  username: { fontSize: 14, color: C.textMuted },
  bio: { fontSize: 14, color: C.textMd, marginTop: 6 },
  friends: { fontSize: 14, color: C.textMuted, marginTop: 10 },
  private: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  privateTitle: { fontSize: 16, fontWeight: '600', color: C.textMd, marginTop: 12 },
  privateText: { fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 4 },
  noPosts: { textAlign: 'center', color: C.textLight, fontSize: 14, paddingVertical: 48 },
})
