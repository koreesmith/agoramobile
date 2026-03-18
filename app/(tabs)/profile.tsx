import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, Alert, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, Avatar } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi, usersApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'

import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

export default function ProfileScreen() {
  const c = useC()
  const { user, logout } = useAuthStore()

  const { data: profile, isLoading: pl, refetch: rp, isRefetching: rpr } = useQuery({
    queryKey: ['profile', user?.username],
    queryFn: () => usersApi.getProfile(user!.username).then(r => r.data),
    enabled: !!user,
  })

  const { data: postsData, isLoading: postL, refetch: rpost } = useQuery({
    queryKey: ['user-posts', user?.username],
    queryFn: () => feedApi.getUserPosts(user!.username).then(r => r.data),
    enabled: !!user,
  })

  const posts = postsData?.posts || []
  const p = profile || user

  if (pl) return <Screen><Header title="Profile" /><Spinner /></Screen>

  return (
    <Screen>
      <Header title="Profile" right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => router.push('/settings')} style={{ padding: 4 }}>
            <Ionicons name="settings-outline" size={22} color={c.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Sign out?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: logout },
          ])} style={{ padding: 4 }}>
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
      } />

      <ScrollView refreshControl={<RefreshControl refreshing={rpr} onRefresh={() => { rp(); rpost() }} tintColor={c.primary} />}>
        <View style={s.cover}>
          {p?.cover_url ? <Image source={{ uri: imgUrl(p.cover_url) }} style={{ width: '100%', height: 100 }} resizeMode="cover" /> : null}
        </View>

        <View style={[s.profileCard, { backgroundColor: c.card }]}>
          <View style={s.avatarRow}>
            <View style={[s.avatarBorder, { borderColor: c.card }]}>
              <Avatar url={p?.avatar_url} name={p?.display_name || p?.username} size={72} />
            </View>
            <TouchableOpacity onPress={() => router.push('/edit-profile')} style={[s.editBtn, { borderColor: c.border }]}>
              <Text style={[s.editBtnText, { color: c.textMd }]}>Edit profile</Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.name, { color: c.text }]}>{p?.display_name || p?.username}</Text>
          {p?.pronouns ? <Text style={[s.pronouns, { color: c.textLight }]}>({p.pronouns})</Text> : null}
          <Text style={[s.username, { color: c.textMuted }]}>@{p?.username}</Text>
          {p?.bio ? <Text style={[s.bio, { color: c.textMd }]}>{p.bio}</Text> : null}
          <Text style={[s.friends, { color: c.textMuted }]}><Text style={[s.friendCount, { color: c.text }]}>{(p as any)?.friend_count || 0}</Text> friends</Text>
        </View>

        <View style={{ marginTop: 8 }}>
          {postL ? <Spinner /> : posts.length === 0 ? (
            <Text style={[s.noPosts, { color: c.textLight }]}>No posts yet.</Text>
          ) : posts.map((post: any) => (
            <PostCard key={post.id} post={post} queryKey={['user-posts', user?.username]} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  cover: { height: 100, backgroundColor: '#627d98' },
  profileCard: { backgroundColor: C.card, paddingHorizontal: 16, paddingBottom: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -36, marginBottom: 12 },
  avatarBorder: { borderWidth: 4, borderColor: 'white', borderRadius: 40 },
  editBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 6, marginTop: 36 },
  editBtnText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  pronouns: { fontSize: 14, color: '#9ca3af' },
  username: { fontSize: 14, color: '#6b7280' },
  bio: { fontSize: 14, color: '#374151', marginTop: 8 },
  friends: { fontSize: 14, color: '#6b7280', marginTop: 12 },
  friendCount: { fontWeight: 'bold', color: '#111827' },
  noPosts: { textAlign: 'center', color: '#9ca3af', fontSize: 14, paddingVertical: 48 },
})

