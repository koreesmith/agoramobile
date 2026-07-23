import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Screen, Spinner } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi, feedsApi } from '../../api'
import { useC } from '../../constants/ColorContext'

export default function FeedViewScreen() {
  const c = useC()
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data: feedMeta } = useQuery({
    queryKey: ['feed-meta', id],
    queryFn: () => feedsApi.get(id!).then(r => r.data),
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching, isLoading } = useInfiniteQuery({
    queryKey: ['custom-feed', id],
    queryFn: ({ pageParam = 0 }) => feedApi.getFeed(pageParam as number, id!).then(r => r.data),
    getNextPageParam: (last, pages) => last.posts?.length === 20 ? pages.length * 20 : undefined,
    initialPageParam: 0,
    enabled: !!id,
  })

  const posts = data?.pages.flatMap(p => p.posts ?? []) ?? []
  const feedName = feedMeta?.name || 'Custom Feed'

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: feedName,
        headerBackTitle: 'Feeds',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />
      {isLoading ? <Spinner /> : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <PostCard post={item} queryKey={['custom-feed', id]} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={c.primary} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: c.textMd }]}>No posts yet</Text>
              <Text style={[s.emptySub, { color: c.textMuted }]}>Posts matching your feed filters will appear here.</Text>
            </View>
          }
        />
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  empty:      { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptySub:   { fontSize: 16, textAlign: 'center', lineHeight: 20 },
})
