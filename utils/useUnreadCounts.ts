import { useQuery } from '@tanstack/react-query'
import { notificationsApi, dmApi } from '../api'
import { useAuthStore } from '../store/auth'

// The unread alert and message counts that badge the bottom bar. Shared by the
// tab layout and the More screen so a destination moved into More keeps its
// badge. Both screens read the same query keys, so this is one request each,
// not two.
export function useUnreadCounts() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount().then(r => r.data),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  })
  const unread: number = unreadData?.count ?? 0

  const { data: convsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => dmApi.listConversations().then(r => r.data),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  })
  const unreadMessages: number = (convsData?.conversations ?? []).reduce((sum: number, c: any) => sum + (c.unread_count ?? 0), 0)

  return { unread, unreadMessages, unreadData }
}
