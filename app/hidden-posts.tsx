import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl, StyleSheet } from 'react-native'
import { Stack, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Screen, Avatar, Spinner, EmptyState } from '../components/ui'
import { hiddenPostsApi } from '../api'
import { useC } from '../constants/ColorContext'

interface HiddenPost {
  id: string
  content: string
  image_url?: string
  username: string
  display_name?: string
  avatar_url?: string
}

// AGORA-309, mirroring app/blocked-users.tsx and web's Settings tab, which puts
// hidden posts alongside blocked users. Both are "things I have chosen not to
// see", and hiding is only useful if it can be undone: without this screen a
// post hidden by a stray tap would be gone with no way back to it.
export default function HiddenPostsScreen() {
  const c = useC()
  const qc = useQueryClient()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['hidden-posts'],
    queryFn: () => hiddenPostsApi.list().then(r => r.data),
  })

  const posts: HiddenPost[] = data?.posts || []

  const unhide = useMutation({
    mutationFn: (postId: string) => hiddenPostsApi.unhide(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hidden-posts'] })
      // The feed is holding a result that excluded this post, so it has to be
      // refetched or the post stays missing until something else invalidates.
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not unhide post'),
  })

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: 'Hidden Posts',
        headerBackTitle: 'Settings',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />

      {isLoading ? <Spinner /> : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListHeaderComponent={
            <Text style={[s.intro, { color: c.textMuted }]}>
              Posts you've hidden from your own timeline. Hiding is private: the author isn't told, and the post is
              unaffected for everyone else.
            </Text>
          }
          ListEmptyComponent={
            <EmptyState icon="🙈" title="You haven't hidden any posts" subtitle="Hidden posts will appear here" />
          }
          renderItem={({ item }) => (
            <View style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 }}
                onPress={() => router.push(`/post/${item.id}`)}
              >
                <Avatar url={item.avatar_url} name={item.display_name || item.username} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.name, { color: c.text }]}>{item.display_name || item.username}</Text>
                  {/* Enough to recognise which post this was, not a second feed.
                      numberOfLines keeps a long post from turning the list into
                      a wall of text. */}
                  <Text style={[s.preview, { color: c.textMuted }]} numberOfLines={2}>
                    {item.content || (item.image_url ? '(image)' : '(no text)')}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => unhide.mutate(item.id)}
                disabled={unhide.isPending}
                style={[s.unhideBtn, { borderColor: c.border, backgroundColor: c.bg }]}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.textMd }}>Unhide</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  intro:     { fontSize: 15, padding: 16, paddingBottom: 8 },
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  name:      { fontWeight: '600', fontSize: 17 },
  preview:   { fontSize: 14, marginTop: 2, lineHeight: 19 },
  unhideBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
})
