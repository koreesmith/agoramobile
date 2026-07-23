import { useState } from 'react'
import { View, Text, Image, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native'
import { Stack, useLocalSearchParams, router } from 'expo-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner } from '../components/ui'
import { feedApi } from '../api'
import { useC } from '../constants/ColorContext'

// Guest-reachable public feed, mirroring web's ExplorePage.tsx (/explore,
// AGORA-145) — reached from the login screen before any credentials are
// entered, so it can't use the shared `api` client (which reads
// instanceUrl/token from the auth store) or the shared PostCard (which
// assumes an authenticated user for its like/comment/react mutations).
// This renders a read-only card instead, matching web's guest treatment
// of PostCard (view-only, no interactive actions).
export default function ExploreScreen() {
  const c = useC()
  const { instanceUrl, instanceName } = useLocalSearchParams<{ instanceUrl: string; instanceName?: string }>()

  const toAbsolute = (u?: string | null) => {
    if (!u) return undefined
    if (u.startsWith('http://') || u.startsWith('https://')) return u
    return `${instanceUrl}${u}`
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['public-feed', instanceUrl],
    queryFn: ({ pageParam = 0 }) => feedApi.getPublicFeedWithUrl(instanceUrl!, pageParam as number).then(r => r.data),
    getNextPageParam: (last, pages) => last.posts?.length === 20 ? pages.length * 20 : undefined,
    initialPageParam: 0,
    enabled: !!instanceUrl,
  })

  const posts = data?.pages.flatMap((p: any) => p.posts ?? []) ?? []
  const [revealedCW, setRevealedCW] = useState<Record<string, boolean>>({})

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: instanceName || 'Explore',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />
      {isLoading ? <Spinner /> : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <Text style={[s.intro, { color: c.textMuted }]}>Public posts from across {instanceName || 'this community'}.</Text>
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={c.primary} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: c.textMd }]}>No public posts yet</Text>
            </View>
          }
          renderItem={({ item }: { item: any }) => {
            const avatarUrl = toAbsolute(item.avatar_url)
            const imageUrl = toAbsolute(item.image_url)
            const showCW = item.content_warning && !revealedCW[item.id]
            return (
              <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={s.header}>
                  {avatarUrl
                    ? <Image source={{ uri: avatarUrl }} style={s.avatar} />
                    : <View style={[s.avatar, s.avatarFallback, { backgroundColor: c.primaryBg }]}>
                        <Text style={{ color: c.primary, fontWeight: '700' }}>{(item.display_name || item.username || '?')[0].toUpperCase()}</Text>
                      </View>}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.name, { color: c.text }]}>{item.display_name || item.username}</Text>
                    <Text style={[s.handle, { color: c.textMuted }]}>@{item.username}</Text>
                  </View>
                </View>

                {showCW ? (
                  <TouchableOpacity onPress={() => setRevealedCW(v => ({ ...v, [item.id]: true }))} style={[s.cwBanner, { borderColor: c.border, backgroundColor: c.bg }]}>
                    <Ionicons name="warning-outline" size={14} color={c.textMuted} />
                    <Text style={{ color: c.textMuted, fontSize: 15, flex: 1 }}>{item.content_warning} — tap to view</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {!!item.content && <Text style={[s.content, { color: c.text }]}>{item.content}</Text>}
                    {imageUrl && <Image source={{ uri: imageUrl }} style={s.postImage} resizeMode="cover" />}
                  </>
                )}

                <View style={s.metaRow}>
                  <Text style={[s.metaText, { color: c.textLight }]}>{item.like_count ?? 0} likes</Text>
                  <Text style={[s.metaText, { color: c.textLight }]}>{item.comment_count ?? 0} comments</Text>
                  <Text style={[s.metaText, { color: c.textLight }]}>{item.repost_count ?? 0} reposts</Text>
                </View>
              </View>
            )
          }}
        />
      )}

      <View style={[s.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.signInBtn, { backgroundColor: c.primary }]}>
          <Text style={s.signInText}>Sign in to interact</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const s = StyleSheet.create({
  intro:         { fontSize: 15, marginBottom: 12, paddingHorizontal: 2 },
  card:          { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar:        { width: 36, height: 36, borderRadius: 18 },
  avatarFallback:{ alignItems: 'center', justifyContent: 'center' },
  name:          { fontWeight: '600', fontSize: 16 },
  handle:        { fontSize: 13, marginTop: 1 },
  content:       { fontSize: 16, lineHeight: 20 },
  postImage:     { width: '100%', height: 200, borderRadius: 10, marginTop: 8 },
  cwBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  metaRow:       { flexDirection: 'row', gap: 16, marginTop: 10 },
  metaText:      { fontSize: 13 },
  empty:         { alignItems: 'center', paddingVertical: 64 },
  emptyTitle:    { fontSize: 17, fontWeight: '600' },
  footer:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, padding: 12 },
  signInBtn:     { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  signInText:    { color: 'white', fontWeight: '700', fontSize: 17 },
})
