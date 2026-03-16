import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState, Avatar } from '../../components/ui'
import { friendsApi, usersApi } from '../../api'

type Tab = 'friends' | 'requests' | 'discover'

export default function FriendsScreen() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('friends')
  const [search, setSearch] = useState('')

  const { data: friendsData, isLoading: fl, refetch: rf, isRefetching: rfr } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.listFriends().then(r => r.data),
  })

  const { data: reqData, isLoading: rl, refetch: rr } = useQuery({
    queryKey: ['requests'],
    queryFn: () => friendsApi.listRequests().then(r => r.data),
  })

  const { data: discoverData, isLoading: dl, refetch: dr } = useQuery({
    queryKey: ['discover'],
    queryFn: () => usersApi.discover().then(r => r.data),
    enabled: tab === 'discover',
  })

  const inv = () => { qc.invalidateQueries({ queryKey: ['friends'] }); qc.invalidateQueries({ queryKey: ['requests'] }) }

  const accept   = useMutation({ mutationFn: (id: string) => friendsApi.acceptRequest(id),  onSuccess: inv })
  const decline  = useMutation({ mutationFn: (id: string) => friendsApi.declineRequest(id), onSuccess: inv })
  const unfriend = useMutation({ mutationFn: (id: string) => friendsApi.unfriend(id),       onSuccess: inv })
  const sendReq  = useMutation({ mutationFn: (id: string) => friendsApi.sendRequest(id),    onSuccess: () => qc.invalidateQueries({ queryKey: ['discover'] }) })

  const friends  = friendsData?.friends || []
  const incoming = reqData?.incoming || []
  const outgoing = reqData?.outgoing || []
  const discover = discoverData?.users || []

  const filtered = friends.filter((f: any) =>
    !search || f.username.toLowerCase().includes(search.toLowerCase()) || (f.display_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const pendingCount = incoming.length

  const PersonRow = ({ user, right }: { user: any; right: React.ReactNode }) => (
    <TouchableOpacity
      onPress={() => router.push(`/profile/${user.username}`)}
      className="flex-row items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800"
    >
      <Avatar url={user.avatar_url} name={user.display_name || user.username} size={44} />
      <View className="flex-1 min-w-0">
        <Text className="font-semibold text-gray-900 dark:text-white text-sm">{user.display_name || user.username}</Text>
        <Text className="text-xs text-gray-400">@{user.username}</Text>
      </View>
      <View className="flex-shrink-0">{right}</View>
    </TouchableOpacity>
  )

  return (
    <Screen>
      <Header title="Friends" />

      {/* Tab bar */}
      <View className="flex-row bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        {(['friends', 'requests', 'discover'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-3 items-center border-b-2 ${tab === t ? 'border-indigo-600' : 'border-transparent'}`}
          >
            <Text className={`text-sm font-medium capitalize ${tab === t ? 'text-indigo-600' : 'text-gray-500'}`}>
              {t === 'requests' && pendingCount > 0 ? `Requests (${pendingCount})` : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'friends' && (
        <>
          <View className="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
            <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 gap-2">
              <Ionicons name="search" size={15} color="#9ca3af" />
              <TextInput
                className="flex-1 text-sm text-gray-900 dark:text-white"
                placeholder="Search friends…"
                placeholderTextColor="#9ca3af"
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>
          {fl ? <Spinner /> : (
            <FlatList
              data={filtered}
              keyExtractor={(f: any) => f.id}
              refreshControl={<RefreshControl refreshing={rfr} onRefresh={rf} tintColor="#6366f1" />}
              ListEmptyComponent={<EmptyState icon="👋" title="No friends yet" subtitle="Discover people to connect with" />}
              renderItem={({ item: f }) => (
                <PersonRow user={f} right={
                  <TouchableOpacity
                    onPress={() => Alert.alert('Unfriend?', `Remove ${f.display_name || f.username}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Unfriend', style: 'destructive', onPress: () => unfriend.mutate(f.id) },
                    ])}
                    className="p-2"
                  >
                    <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                } />
              )}
            />
          )}
        </>
      )}

      {tab === 'requests' && (
        <FlatList
          data={[...incoming.map((f: any) => ({ ...f, _type: 'incoming' })), ...outgoing.map((f: any) => ({ ...f, _type: 'outgoing' }))]}
          keyExtractor={(f: any) => f.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={rr} tintColor="#6366f1" />}
          ListEmptyComponent={<EmptyState icon="📬" title="No pending requests" />}
          ListHeaderComponent={incoming.length > 0 ? (
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 pb-1">Incoming</Text>
          ) : null}
          renderItem={({ item: f }) => (
            <PersonRow user={f} right={
              f._type === 'incoming' ? (
                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => accept.mutate(f.id)} className="bg-indigo-600 rounded-lg px-3 py-1.5">
                    <Text className="text-white text-xs font-semibold">Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => decline.mutate(f.id)} className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                    <Text className="text-xs text-gray-600 dark:text-gray-300 font-semibold">Decline</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text className="text-xs text-gray-400">Pending</Text>
              )
            } />
          )}
        />
      )}

      {tab === 'discover' && (
        dl ? <Spinner /> : (
          <FlatList
            data={discover}
            keyExtractor={(u: any) => u.id}
            refreshControl={<RefreshControl refreshing={false} onRefresh={dr} tintColor="#6366f1" />}
            ListEmptyComponent={<EmptyState icon="🔍" title="No suggestions" subtitle="Add more friends to see people you might know" />}
            renderItem={({ item: u }) => (
              <PersonRow user={u} right={
                u.friend_status === 'pending' ? (
                  <Text className="text-xs text-gray-400">Sent</Text>
                ) : u.friend_status === 'accepted' ? (
                  <Text className="text-xs text-green-600 font-medium">Friends</Text>
                ) : (
                  <TouchableOpacity onPress={() => sendReq.mutate(u.id)} className="bg-indigo-600 rounded-lg px-3 py-1.5">
                    <Text className="text-white text-xs font-semibold">Add</Text>
                  </TouchableOpacity>
                )
              } />
            )}
          />
        )
      )}
    </Screen>
  )
}
