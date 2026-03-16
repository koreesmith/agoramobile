import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { formatDistanceToNow } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState, Avatar } from '../../components/ui'
import { dmApi } from '../../api'
import { useAuthStore } from '../../store/auth'

export default function MessagesScreen() {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => dmApi.listConversations().then(r => r.data),
    refetchInterval: 30_000,
  })

  const convs = data?.conversations || []
  const other = (conv: any) => conv.participants?.find((p: any) => p.user_id !== user?.id)

  const filtered = convs.filter((c: any) => {
    const o = other(c)
    if (!o) return false
    if (!search) return true
    return o.username.toLowerCase().includes(search.toLowerCase()) || (o.display_name || '').toLowerCase().includes(search.toLowerCase())
  })

  const requests = filtered.filter((c: any) => !c.is_accepted)
  const accepted = filtered.filter((c: any) => c.is_accepted)

  const ConvRow = ({ conv }: { conv: any }) => {
    const o = other(conv)
    if (!o) return null
    const preview = conv.last_message
      ? conv.last_message.deleted_at ? '(deleted)' : conv.last_message.content || '📷 Image'
      : 'No messages yet'

    return (
      <TouchableOpacity
        onPress={() => router.push(`/conversation/${conv.id}`)}
        className="flex-row items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800"
      >
        <View className="relative">
          <Avatar url={o.avatar_url} name={o.display_name || o.username} size={48} />
          {conv.unread_count > 0 && (
            <View className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full items-center justify-center">
              <Text className="text-white text-[10px] font-bold">{conv.unread_count > 9 ? '9+' : conv.unread_count}</Text>
            </View>
          )}
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center justify-between">
            <Text className={`text-sm ${conv.unread_count > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
              {o.display_name || o.username}
            </Text>
            {conv.last_message && (
              <Text className="text-xs text-gray-400 ml-2 flex-shrink-0">
                {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}
              </Text>
            )}
          </View>
          <Text className={`text-xs mt-0.5 ${conv.unread_count > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`} numberOfLines={1}>
            {!conv.is_accepted ? '⚠️ Message request' : preview}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Screen>
      <Header
        title="Messages"
        right={
          <TouchableOpacity onPress={() => router.push('/new-conversation')} className="p-1">
            <Ionicons name="create-outline" size={22} color="#6366f1" />
          </TouchableOpacity>
        }
      />

      <View className="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 gap-2">
          <Ionicons name="search" size={15} color="#9ca3af" />
          <TextInput
            className="flex-1 text-sm text-gray-900 dark:text-white"
            placeholder="Search conversations…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {isLoading ? <Spinner /> : (
        <FlatList
          data={[...requests, ...accepted]}
          keyExtractor={(c: any) => c.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />}
          ListEmptyComponent={<EmptyState icon="💬" title="No messages yet" subtitle="Message a friend to get started" />}
          ListHeaderComponent={requests.length > 0 ? (
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-3 pb-1">
              Requests ({requests.length})
            </Text>
          ) : null}
          renderItem={({ item }) => <ConvRow conv={item} />}
        />
      )}
    </Screen>
  )
}
