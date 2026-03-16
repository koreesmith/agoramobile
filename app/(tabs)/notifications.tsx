import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { Screen, Header, Spinner, EmptyState, Avatar } from '../../components/ui'
import { notificationsApi, friendsApi } from '../../api'

const ICONS: Record<string, string> = {
  friend_request:     'person-add',
  friend_accepted:    'checkmark-circle',
  post_like:          'heart',
  comment_like:       'heart',
  post_reaction:      'happy',
  comment_reaction:   'happy',
  post_comment:       'chatbubble',
  post_repost:        'repeat',
  post_mention:       'at',
  comment_reply:      'return-down-forward',
  group_join_request: 'people',
  group_join_approved:'checkmark-circle',
  wall_post:          'pencil',
  wall_post_pending:  'time',
  wall_post_approved: 'checkmark-circle',
  user_post:          'notifications',
}

const ICON_COLORS: Record<string, string> = {
  friend_request:     '#6366f1',
  friend_accepted:    '#22c55e',
  post_like:          '#ef4444',
  comment_like:       '#ef4444',
  post_reaction:      '#f59e0b',
  comment_reaction:   '#f59e0b',
  post_comment:       '#6366f1',
  post_repost:        '#22c55e',
  post_mention:       '#3b82f6',
  comment_reply:      '#6366f1',
  group_join_request: '#8b5cf6',
  group_join_approved:'#22c55e',
  wall_post:          '#6366f1',
  wall_post_pending:  '#f59e0b',
  wall_post_approved: '#22c55e',
  user_post:          '#6366f1',
}

const TEXT: Record<string, string> = {
  friend_request:     'sent you a friend request',
  friend_accepted:    'accepted your friend request',
  post_like:          'liked your post',
  comment_like:       'liked your comment',
  post_reaction:      'reacted to your post',
  comment_reaction:   'reacted to your comment',
  post_comment:       'commented on your post',
  post_repost:        'reposted your post',
  post_mention:       'mentioned you in a post',
  comment_reply:      'replied to your comment',
  group_join_request: 'wants to join your group',
  group_join_approved:'your join request was approved',
  wall_post:          'posted on your wall',
  wall_post_pending:  'wants to post on your wall',
  wall_post_approved: 'approved your wall post',
  user_post:          'made a new post',
}

export default function NotificationsScreen() {
  const qc = useQueryClient()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then(r => r.data),
    refetchInterval: 30_000,
  })

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const accept = useMutation({
    mutationFn: (id: string) => friendsApi.acceptRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const decline = useMutation({
    mutationFn: (id: string) => friendsApi.declineRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifs = data?.notifications || []
  const hasUnread = notifs.some((n: any) => !n.read)

  const handlePress = (n: any) => {
    notificationsApi.markRead(n.id)
    qc.invalidateQueries({ queryKey: ['notifications'] })
    if (n.type === 'friend_request' || n.type === 'friend_accepted') {
      if (n.actor_username) router.push(`/profile/${n.actor_username}`)
    } else if (n.post_id) {
      router.push(`/post/${n.post_id}`)
    }
  }

  return (
    <Screen>
      <Header
        title="Notifications"
        right={hasUnread ? (
          <TouchableOpacity onPress={() => markAll.mutate()}>
            <Text className="text-indigo-600 text-sm font-medium">Mark all read</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {isLoading ? <Spinner /> : (
        <FlatList
          data={notifs}
          keyExtractor={(n: any) => n.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />}
          contentContainerStyle={{ paddingVertical: 8 }}
          ListEmptyComponent={<EmptyState icon="🔔" title="No notifications yet" />}
          renderItem={({ item: n }) => (
            <TouchableOpacity
              onPress={() => handlePress(n)}
              className={`flex-row items-start gap-3 px-4 py-3 ${!n.read ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}`}
            >
              {/* Icon */}
              <View className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center flex-shrink-0">
                <Ionicons
                  name={ICONS[n.type] || 'notifications'}
                  size={18}
                  color={ICON_COLORS[n.type] || '#6b7280'}
                />
              </View>

              <View className="flex-1">
                <Text className="text-sm text-gray-800 dark:text-gray-200">
                  <Text className="font-semibold">{n.actor_display_name || n.actor_username}</Text>
                  {' '}{TEXT[n.type] || 'did something'}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </Text>

                {/* Friend request actions */}
                {n.type === 'friend_request' && n.friend_status !== 'accepted' && n.friend_status !== 'declined' && (
                  <View className="flex-row gap-2 mt-2">
                    <TouchableOpacity
                      onPress={() => accept.mutate(n.actor_id)}
                      className="bg-indigo-600 rounded-lg px-3 py-1.5"
                    >
                      <Text className="text-white text-xs font-semibold">Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => decline.mutate(n.actor_id)}
                      className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5"
                    >
                      <Text className="text-gray-600 dark:text-gray-300 text-xs font-semibold">Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {n.type === 'friend_request' && n.friend_status === 'accepted' && (
                  <Text className="text-xs text-green-600 mt-1 font-medium">✓ You are now friends</Text>
                )}
              </View>

              {!n.read && (
                <View className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  )
}
