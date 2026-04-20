import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { Screen, Header, Spinner, EmptyState } from '../../components/ui'
import { notificationsApi, friendsApi } from '../../api'

import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

const ICONS: Record<string, any> = {
  friend_request: 'person-add', friend_accepted: 'checkmark-circle',
  post_like: 'heart', comment_like: 'heart', post_reaction: 'happy',
  comment_reaction: 'happy', post_comment: 'chatbubble', post_repost: 'repeat',
  post_mention: 'at', comment_reply: 'return-down-forward', wall_post: 'pencil',
  wall_post_pending: 'time', wall_post_approved: 'checkmark-circle', user_post: 'notifications',
  waitlist_signup: 'person-add-outline',
}

const COLORS: Record<string, string> = {
  friend_request: '#486581', friend_accepted: '#22c55e', post_like: '#ef4444',
  comment_like: '#ef4444', post_reaction: '#f59e0b', comment_reaction: '#f59e0b',
  post_comment: '#486581', post_repost: '#22c55e', post_mention: '#3b82f6',
  wall_post: '#486581', wall_post_pending: '#f59e0b', wall_post_approved: '#22c55e', user_post: '#486581',
  waitlist_signup: '#8b5cf6',
}

const TEXT: Record<string, string> = {
  friend_request: 'sent you a friend request', friend_accepted: 'accepted your friend request',
  post_like: 'liked your post', comment_like: 'liked your comment',
  post_reaction: 'reacted to your post', comment_reaction: 'reacted to your comment',
  post_comment: 'commented on your post', post_repost: 'reposted your post',
  post_mention: 'mentioned you in a post', comment_reply: 'replied to your comment',
  wall_post: 'posted on your wall', wall_post_pending: 'wants to post on your wall',
  wall_post_approved: 'approved your wall post', user_post: 'made a new post',
  waitlist_signup: 'joined the waitlist',
}

function formatActorLabel(n: any): string {
  const count: number = n.actor_count ?? 1
  const actors: any[] = n.actors ?? []
  const primary = n.actor_display_name || n.actor_username || 'Someone'

  if (count <= 1 || actors.length <= 1) return primary

  const second = actors[1]?.display_name || actors[1]?.username
  if (count === 2 && second) return `${primary} and ${second}`

  const others = count - 1
  return second
    ? `${primary}, ${second}, and ${others - 1} other${others - 1 === 1 ? '' : 's'}`
    : `${primary} and ${others} other${others === 1 ? '' : 's'}`
}

export default function NotificationsScreen() {
  const c = useC()
  const qc = useQueryClient()
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then(r => r.data),
    refetchInterval: 30_000,
  })
  const invalidateNotifs = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread-count'] }) }
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] })
      await qc.cancelQueries({ queryKey: ['unread-count'] })
      const prevNotifs = qc.getQueryData(['notifications'])
      const prevUnread = qc.getQueryData(['unread-count'])
      qc.setQueryData(['notifications'], (old: any) => ({
        ...old,
        notifications: old?.notifications?.map((n: any) => ({ ...n, read: true })) || [],
      }))
      qc.setQueryData(['unread-count'], { count: 0 })
      return { prevNotifs, prevUnread }
    },
    onError: (_err: any, _vars: any, ctx: any) => {
      if (ctx?.prevNotifs) qc.setQueryData(['notifications'], ctx.prevNotifs)
      if (ctx?.prevUnread) qc.setQueryData(['unread-count'], ctx.prevUnread)
    },
    onSettled: invalidateNotifs,
  })
  const accept = useMutation({ mutationFn: (id: string) => friendsApi.acceptRequest(id), onSuccess: invalidateNotifs })
  const decline = useMutation({ mutationFn: (id: string) => friendsApi.declineRequest(id), onSuccess: invalidateNotifs })

  const notifs = data?.notifications || []
  const hasUnread = notifs.some((n: any) => !n.read)

  const handlePress = (n: any) => {
    if (!n.read) {
      qc.setQueryData(['notifications'], (old: any) => ({
        ...old,
        notifications: old?.notifications?.map((item: any) =>
          item.id === n.id ? { ...item, read: true } : item
        ) || [],
      }))
      qc.setQueryData(['unread-count'], (old: any) => ({ count: Math.max(0, (old?.count ?? 1) - 1) }))
      const ids: string[] = n.notification_ids?.length ? n.notification_ids : [n.id]
      Promise.all(ids.map((id: string) => notificationsApi.markRead(id))).then(invalidateNotifs)
    }
    if (n.type === 'friend_request' || n.type === 'friend_accepted') {
      if (n.actor_username) router.push(`/profile/${n.actor_username}`)
    } else if (n.type === 'waitlist_signup') {
      router.push('/admin?tab=waitlist' as any)
    } else if (n.post_id) router.push(`/post/${n.post_id}`)
  }

  return (
    <Screen>
      <Header title="Notifications" right={hasUnread ? (
        <TouchableOpacity onPress={() => markAll.mutate()}>
          <Text style={{ color: c.primary, fontSize: 14, fontWeight: '500' }}>Mark all read</Text>
        </TouchableOpacity>
      ) : undefined} />
      {isLoading ? <Spinner /> : (
        <FlatList
          data={notifs}
          keyExtractor={(n: any) => n.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListEmptyComponent={<EmptyState icon="🔔" title="No notifications yet" />}
          renderItem={({ item: n }) => (
            <TouchableOpacity onPress={() => handlePress(n)} style={[s.row, { backgroundColor: n.read ? c.card : c.primaryBg, borderBottomColor: c.border }]}>
              <View style={[s.icon, { backgroundColor: (COLORS[n.type] || '#627d98') + '20' }]}>
                <Ionicons name={ICONS[n.type] || 'notifications'} size={18} color={COLORS[n.type] || '#627d98'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.notifText, { color: c.text }]}>
                  <Text style={{ fontWeight: '600' }}>{formatActorLabel(n)}</Text>
                  {' '}{TEXT[n.type] || 'did something'}
                </Text>
                <Text style={[s.notifTime, { color: c.textLight }]}>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</Text>
                {n.type === 'friend_request' && n.friend_status !== 'accepted' && n.friend_status !== 'declined' && (
                  <View style={s.friendActions}>
                    <TouchableOpacity onPress={() => accept.mutate(n.actor_id)} style={s.acceptBtn}>
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => decline.mutate(n.actor_id)} style={s.declineBtn}>
                      <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {!n.read && <View style={s.dot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  rowUnread: { backgroundColor: '#f0f4f8' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifText: { fontSize: 14, color: '#1f2937' },
  notifTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  friendActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptBtn: { backgroundColor: '#486581', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  declineBtn: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#486581', marginTop: 6, flexShrink: 0 },
})

