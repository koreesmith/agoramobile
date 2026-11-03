import { FlatList, RefreshControl, Text, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { Screen, Spinner, EmptyState } from '../components/ui'
import PostCard from '../components/PostCard'
import ProfilePostsFooter from '../components/ProfilePostsFooter'
import { useBookmarks } from '../utils/useBookmarks'
import { useC } from '../constants/ColorContext'

// AGORA-429: the posts the viewer saved to come back to, most recently saved
// first. Private to them: nothing here is shown to anyone else.
export default function BookmarksScreen() {
  const c = useC()
  const { posts, isLoading, isError, refetch, isRefetching, isFetchingNextPage, loadMoreFailed, loadMore, onScroll } = useBookmarks()

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: 'Bookmarks',
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />

      {isLoading ? <Spinner /> : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <PostCard post={item} queryKey={['bookmarks']} />}
          onScroll={onScroll}
          scrollEventThrottle={200}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListHeaderComponent={
            <Text style={[s.intro, { color: c.textMuted }]}>Posts you saved to come back to. Only you can see this list.</Text>
          }
          ListEmptyComponent={isError
            ? <EmptyState icon="⚠️" title="Could not load your bookmarks" />
            : <EmptyState icon="🔖" title="Nothing saved yet" subtitle="Use the bookmark button under a post to save it here." />}
          ListFooterComponent={<ProfilePostsFooter loading={isFetchingNextPage} failed={loadMoreFailed} onRetry={loadMore} />}
        />
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  intro: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 12 },
})
