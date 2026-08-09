import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { timeAgo } from '../../utils/handle'
import { Screen, Header, Spinner, EmptyState, renderName, SearchIconButton } from '../../components/ui'
import { notificationsApi, friendsApi } from '../../api'

import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

// All type strings the API may send for a waitlist signup notification
const WAITLIST_TYPES = ['waitlist_signup', 'waitlist_join', 'waitlist_joined', 'waitlist']
// AMOBILE-178: group notifications all land on the group carried in `data`.
const GROUP_TYPES = ['group_join_request', 'group_join_approved', 'group_join_rejected', 'group_invite_accepted']

const ICONS: Record<string, any> = {
  friend_request: 'person-add', friend_accepted: 'checkmark-circle',
  post_like: 'heart', comment_like: 'heart', post_reaction: 'happy',
  comment_reaction: 'happy', post_comment: 'chatbubble', post_repost: 'repeat',
  post_mention: 'at', comment_reply: 'return-down-forward', wall_post: 'pencil',
  wall_post_pending: 'time', wall_post_approved: 'checkmark-circle', user_post: 'notifications',
  fediverse_post: 'planet', atproto_post: 'cloud',
  waitlist_signup: 'person-add-outline', waitlist_join: 'person-add-outline',
  waitlist_joined: 'person-add-outline', waitlist: 'person-add-outline',
  // AMOBILE-178: the fifteen types that had no entry here and were falling
  // through to the placeholder below. Web renders all of them, so the icon and
  // wording choices are matched rather than invented.
  fediverse_follow: 'planet', atproto_follow: 'cloud',
  group_join_request: 'people', group_join_approved: 'checkmark-circle',
  group_join_rejected: 'close-circle', group_invite_accepted: 'people',
  group_tag: 'pricetag', page_post: 'newspaper', page_member_invite: 'mail-open',
  new_report: 'flag', federation_request: 'git-network',
  custom_domain_live: 'globe', custom_domain_verified: 'shield-checkmark',
  custom_domain_failed: 'alert-circle', custom_domain_lost: 'alert-circle',
  custom_domain_rejected: 'close-circle',
}

const COLORS: Record<string, string> = {
  friend_request: '#486581', friend_accepted: '#22c55e', post_like: '#ef4444',
  comment_like: '#ef4444', post_reaction: '#f59e0b', comment_reaction: '#f59e0b',
  post_comment: '#486581', post_repost: '#22c55e', post_mention: '#3b82f6',
  // Had an icon and a sentence but no colour, so it rendered grey while every
  // other reply-shaped type did not. Caught while auditing coverage.
  comment_reply: '#486581',
  wall_post: '#486581', wall_post_pending: '#f59e0b', wall_post_approved: '#22c55e', user_post: '#486581',
  fediverse_post: '#0ea5e9', atproto_post: '#0ea5e9',
  waitlist_signup: '#8b5cf6', waitlist_join: '#8b5cf6',
  waitlist_joined: '#8b5cf6', waitlist: '#8b5cf6',
  fediverse_follow: '#0ea5e9', atproto_follow: '#0ea5e9',
  group_join_request: '#486581', group_join_approved: '#22c55e',
  group_join_rejected: '#ef4444', group_invite_accepted: '#22c55e',
  group_tag: '#3b82f6', page_post: '#486581', page_member_invite: '#8b5cf6',
  new_report: '#ef4444', federation_request: '#8b5cf6',
  custom_domain_live: '#22c55e', custom_domain_verified: '#22c55e',
  custom_domain_failed: '#ef4444', custom_domain_lost: '#ef4444',
  custom_domain_rejected: '#ef4444',
}

const TEXT: Record<string, string> = {
  friend_request: 'sent you a friend request', friend_accepted: 'accepted your friend request',
  post_like: 'liked your post', comment_like: 'liked your comment',
  post_reaction: 'reacted to your post', comment_reaction: 'reacted to your comment',
  post_comment: 'commented on your post', post_repost: 'reposted your post',
  post_mention: 'mentioned you in a post', comment_reply: 'replied to your comment',
  wall_post: 'posted on your wall', wall_post_pending: 'wants to post on your wall',
  wall_post_approved: 'approved your wall post', user_post: 'made a new post',
  fediverse_post: 'posted something new on the fediverse', atproto_post: 'posted something new on Bluesky',
  waitlist_signup: 'joined the waitlist', waitlist_join: 'joined the waitlist',
  waitlist_joined: 'joined the waitlist', waitlist: 'joined the waitlist',
  fediverse_follow: 'followed you from the fediverse',
  atproto_follow: 'followed you on Bluesky',
  group_join_request: 'wants to join your group',
  group_join_approved: 'approved your request to join a group',
  group_join_rejected: 'declined your request to join a group',
  group_invite_accepted: 'added you to a group',
  group_tag: 'tagged your group in a post',
  page_post: 'published a new post on a page you follow',
  page_member_invite: 'invited you to join a page as a team member',
  new_report: 'submitted a new report, tap to review',
}

// AMOBILE-178: notifications that come from the instance itself rather than
// from a person. There is no actor to name, so they render as a whole sentence
// with their subject inlined instead of the "<actor> <predicate>" shape every
// other type is built from. Feeding these through formatActorLabel would
// produce "Someone your domain is live", which is worse than the placeholder
// they were already getting.
//
// The subject rides in the notification's `data` column, matching web
// (AGORA-287 for the domains, AGORA-314 for the federation request).
const SYSTEM_TEXT: Record<string, (subject: string) => string> = {
  custom_domain_live:     d => `${d} is verified and live, it's your handle on Bluesky now`,
  custom_domain_verified: d => `${d} is verified and waiting for an administrator to approve it`,
  custom_domain_failed:   d => `We couldn't verify ${d}, tap to see what went wrong`,
  custom_domain_lost:     d => `${d} stopped verifying, so your handle has gone back to the one this instance issued you`,
  custom_domain_rejected: d => `Your request to use ${d} as your handle was declined`,
  federation_request:     d => `${d} has started federating with this instance`,
}

// AMOBILE-150: actor names get resolved through renderName (same as feed/
// comments/search) so a remote account's :shortcode: custom emoji renders
// as the inline image everywhere else in the app, not raw text here. This
// returns renderable nodes instead of a flat string because the "X and Y
// and N others" concatenation needs emoji substitution per-actor-name, not
// once over the joined string.
function formatActorLabel(n: any): React.ReactNode {
  const count: number = n.count ?? n.actor_count ?? 1
  const actors: any[] = n.actors ?? []
  const primaryName = actors[0]?.display_name || actors[0]?.username || n.actor_display_name || n.actor_username || 'Someone'
  const primary = renderName(primaryName, actors[0]?.emojis || n.actor_emojis)

  if (count <= 1 || actors.length <= 1) return primary

  const secondName = actors[1]?.display_name || actors[1]?.username
  const second = secondName ? renderName(secondName, actors[1]?.emojis) : null

  if (count === 2 && second) return <>{primary} and {second}</>

  const others = count - 1
  return second
    ? <>{primary}, {second}, and {others - 1} other{others - 1 === 1 ? '' : 's'}</>
    : <>{primary} and {others} other{others === 1 ? '' : 's'}</>
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
      const ids: string[] = n.ids?.length ? n.ids : n.notification_ids?.length ? n.notification_ids : [n.id]
      const markDone = ids.length > 1 ? notificationsApi.markManyRead(ids) : notificationsApi.markRead(ids[0])
      markDone.then(invalidateNotifs)
    }
    // AMOBILE-178: several of the types added here have nowhere to go by
    // post_id, and a row that navigates nowhere is only marginally better than
    // one that says nothing. Destinations match web's notifTarget.
    if (n.type === 'friend_request' || n.type === 'friend_accepted'
      || n.type === 'fediverse_follow' || n.type === 'atproto_follow') {
      // A follow has no post to land on, so it routes to the follower. Remote
      // stubs carry the synthetic handle@domain username, which /profile
      // already resolves.
      const username = n.actor_username || n.actors?.[0]?.username
      if (username) router.push(`/profile/${username}`)
    } else if (WAITLIST_TYPES.includes(n.type)) {
      router.push({ pathname: '/admin', params: { tab: 'waitlist' } } as any)
    } else if (n.type === 'new_report') {
      router.push({ pathname: '/admin', params: { tab: 'reports' } } as any)
    } else if (n.type === 'federation_request') {
      router.push({ pathname: '/admin', params: { tab: 'federation' } } as any)
    } else if (n.type.startsWith('custom_domain_')) {
      router.push({ pathname: '/settings', params: { tab: 'bluesky' } } as any)
    } else if (GROUP_TYPES.includes(n.type)) {
      router.push(n.data ? `/groups/${n.data}` : '/groups')
    } else if (n.type === 'page_member_invite') {
      router.push(n.data ? `/pages/${n.data}` : '/pages')
    } else if (n.post_id) router.push(`/post/${n.post_id}`)
  }

  return (
    <Screen>
      <Header title="Notifications" right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {hasUnread && (
            <TouchableOpacity onPress={() => markAll.mutate()}>
              <Text style={{ color: c.primary, fontSize: 16, fontWeight: '500' }}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <SearchIconButton />
        </View>
      } />
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
                  {SYSTEM_TEXT[n.type] ? (
                    // No actor to lead with: the subject is a domain or a
                    // server, so the whole sentence carries it.
                    SYSTEM_TEXT[n.type](n.data || 'A domain')
                  ) : (
                    <>
                      <Text style={{ fontWeight: '600' }}>{formatActorLabel(n)}</Text>
                      {' '}{TEXT[n.type] || 'sent you a notification'}
                    </>
                  )}
                </Text>
                <Text style={[s.notifTime, { color: c.textLight }]}>{timeAgo(n.created_at)}</Text>
                {n.type === 'friend_request' && n.friend_status !== 'accepted' && n.friend_status !== 'declined' && (
                  <View style={s.friendActions}>
                    <TouchableOpacity onPress={() => accept.mutate(n.actor_id)} style={s.acceptBtn}>
                      <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => decline.mutate(n.actor_id)} style={s.declineBtn}>
                      <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>Decline</Text>
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
  notifText: { fontSize: 16, color: '#1f2937' },
  notifTime: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  friendActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptBtn: { backgroundColor: '#486581', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  declineBtn: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#486581', marginTop: 6, flexShrink: 0 },
})
