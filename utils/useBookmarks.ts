import { useInfiniteQuery } from '@tanstack/react-query'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { bookmarksApi } from '../api'

const PAGE_SIZE = 20
// How far from the bottom (in points) the next page starts loading.
const LOAD_AHEAD = 600

/**
 * The viewer's saved posts, newest saved first, a page at a time (AGORA-429).
 * Same paging approach as a profile's posts (useProfilePosts).
 */
export function useBookmarks() {
  const q = useInfiniteQuery({
    queryKey: ['bookmarks'],
    queryFn: ({ pageParam = 0 }) =>
      bookmarksApi.list({ offset: pageParam as number, limit: PAGE_SIZE }).then(r => r.data),
    getNextPageParam: (last: any, pages) => last.posts?.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
  })

  // Offset paging can repeat a post when the list shifts underneath it
  // (something was unsaved), so de-duplicate by id across pages.
  const posts: any[] = Array.from(
    new Map((q.data?.pages.flatMap((pg: any) => pg.posts ?? []) ?? []).map((p: any) => [p.id, p])).values()
  )

  // A failed page stops auto-loading (otherwise every scroll event would retry
  // it); the footer's Retry button calls loadMore directly.
  const loadMore = () => {
    if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage()
  }
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (q.isFetchNextPageError) return
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - LOAD_AHEAD) loadMore()
  }

  return {
    posts,
    isLoading: q.isLoading,
    isError: q.isError && !q.data,
    refetch: q.refetch,
    isRefetching: q.isRefetching,
    isFetchingNextPage: q.isFetchingNextPage,
    loadMoreFailed: q.isFetchNextPageError && !q.isFetchingNextPage,
    loadMore,
    onScroll,
  }
}
