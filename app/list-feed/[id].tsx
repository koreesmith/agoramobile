import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Screen, Spinner } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi, friendsApi } from '../../api'
import { useC } from '../../constants/ColorContext'

export default function ListFeedScreen() {
  const c = useC()
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data: listsData } = useQuery({
    queryKey: ['friend-lists'],
    queryFn: () => friendsApi.listFriendLists().then(r => r.data),
  })
  const lists: any[] = listsData?.friend_groups || listsData?.groups || listsData?.lists || (Array.isArray(listsData) ? listsData : [])
  const list = lists.find((l: any) => l.id === id)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching, isLoading } = useInfiniteQuery({
    queryKey: ['list-feed', id],
    queryFn: ({ pageParam = 0 }) => feedApi.getFeed(pageParam as number, undefined, id!).then(r => r.data),
    getNextPageParam: (last, pages) => last.posts?.length === 20 ? pages.length * 20 : undefined,
    initialPageParam: 0,
    enabled: !!id,
  })

  const posts = data?.pages.flatMap(p => p.posts ?? []) ?? []
  const listName = list?.name || 'Friend List'

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: listName,
        headerBackTitle: 'Lists',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />
      {isLoading ? <Spinner /> : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <PostCard post={item} queryKey={['list-feed', id]} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={c.primary} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: c.textMd }]}>No posts yet</Text>
              <Text style={[s.emptySub, { color: c.textMuted }]}>Posts from people in this list will appear here. You can post with "Friend List" visibility from the main feed to share here.</Text>
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
