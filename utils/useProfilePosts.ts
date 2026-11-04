import { useInfiniteQuery } from '@tanstack/react-query'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { feedApi } from '../api'

const PAGE_SIZE = 20
// How far from the bottom (in points) the next page starts loading, so it is
// usually in by the time the person gets there.
const LOAD_AHEAD = 600

/**
 * A profile's posts, a page at a time (AGORA-424, mirroring web's profile
 * page). Shared by the own-profile tab and other people's profiles, which use
 * the same ['user-posts', username] key.
 */
export function useProfilePosts(username: string | undefined, enabled: boolean) {
  const q = useInfiniteQuery({
    queryKey: ['user-posts', username],
    queryFn: ({ pageParam = 0 }) =>
      feedApi.getUserPosts(username!, { offset: pageParam as number, limit: PAGE_SIZE }).then(r => r.data),
    getNextPageParam: (last: any, pages) => last.posts?.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
    enabled: enabled && !!username,
  })

  // Offset paging can repeat a post when a new one is published mid-scroll,
  // so de-duplicate by id across pages.
  // AGORA-447: the first page also carries the author's pinned posts. They show
  // first, marked, and are left out of the list below so none shows twice. The
  // page itself still holds every post, so paging is unchanged.
  const pinnedPosts: any[] = q.data?.pages?.[0]?.pinned_posts ?? []
  const pinnedIds = new Set(pinnedPosts.map((p: any) => p.id))
  const posts: any[] = Array.from(
    new Map((q.data?.pages.flatMap((pg: any) => pg.posts ?? []) ?? []).map((p: any) => [p.id, p])).values()
  ).filter((p: any) => !pinnedIds.has(p.id))

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
    pinnedPosts,
    isLoading: q.isLoading,
    refetch: q.refetch,
    isFetchingNextPage: q.isFetchingNextPage,
    loadMoreFailed: q.isFetchNextPageError && !q.isFetchingNextPage,
    loadMore,
    onScroll,
  }
}
