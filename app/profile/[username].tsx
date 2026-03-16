import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, Alert } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner, Avatar, Button } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { usersApi, friendsApi, feedApi, dmApi } from '../../api'
import { useAuthStore } from '../../store/auth'

export default function ProfileViewScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const { user: me } = useAuthStore()
  const qc = useQueryClient()

  const { data: profile, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.getProfile(username!).then(r => r.data),
  })

  const { data: postsData } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => feedApi.getUserPosts(username!).then(r => r.data),
    enabled: !!profile && !profile.profile_private,
  })

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['profile', username] })
    qc.invalidateQueries({ queryKey: ['friends'] })
    qc.invalidateQueries({ queryKey: ['requests'] })
  }

  const sendReq  = useMutation({ mutationFn: () => friendsApi.sendRequest(profile!.id), onSuccess: inv })
  const accept   = useMutation({ mutationFn: () => friendsApi.acceptRequest(profile!.id), onSuccess: inv })
  const unfriend = useMutation({ mutationFn: () => friendsApi.unfriend(profile!.id), onSuccess: inv })
  const startDM  = useMutation({
    mutationFn: () => dmApi.startConversation(username!),
    onSuccess: (res) => router.push(`/conversation/${res.data.id}`),
  })

  const posts = postsData?.posts || []
  const isSelf = me?.username === username
  const status = profile?.friend_status

  if (isLoading) return <Screen><Spinner /></Screen>
  if (!profile) return <Screen><Text className="text-center mt-20 text-gray-400">User not found</Text></Screen>

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: profile.display_name || username,
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#6366f1',
      }} />

      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />}>
        {/* Cover */}
        <View style={{ height: 100 }} className="bg-indigo-400">
          {profile.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={{ width: '100%', height: 100 }} resizeMode="cover" />
          ) : null}
        </View>

        <View className="bg-white dark:bg-gray-900 px-4 pb-4">
          <View className="flex-row items-end justify-between -mt-8 mb-3">
            <View className="border-4 border-white dark:border-gray-900 rounded-full">
              <Avatar url={profile.avatar_url} name={profile.display_name || profile.username} size={72} />
            </View>

            {!isSelf && (
              <View className="flex-row gap-2 mt-8">
                {status === 'accepted' && (
                  <TouchableOpacity
                    onPress={() => startDM.mutate()}
                    className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-1.5 flex-row items-center gap-1"
                  >
                    <Ionicons name="chatbubble-outline" size={15} color="#6366f1" />
                    <Text className="text-sm font-medium text-indigo-600">Message</Text>
                  </TouchableOpacity>
                )}
                {!status && (
                  <TouchableOpacity
                    onPress={() => sendReq.mutate()}
                    disabled={sendReq.isPending}
                    className="bg-indigo-600 rounded-xl px-4 py-1.5"
                  >
                    <Text className="text-white font-semibold text-sm">Add friend</Text>
                  </TouchableOpacity>
                )}
                {status === 'pending' && (
                  <View className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-1.5">
                    <Text className="text-sm text-gray-500">Pending</Text>
                  </View>
                )}
                {status === 'pending_incoming' && (
                  <View className="flex-row gap-2">
                    <TouchableOpacity onPress={() => accept.mutate()} className="bg-indigo-600 rounded-xl px-3 py-1.5">
                      <Text className="text-white font-semibold text-sm">Accept</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {status === 'accepted' && (
                  <TouchableOpacity
                    onPress={() => Alert.alert('Unfriend?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Unfriend', style: 'destructive', onPress: () => unfriend.mutate() },
                    ])}
                    className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-1.5 flex-row items-center gap-1"
                  >
                    <Ionicons name="checkmark" size={15} color="#22c55e" />
                    <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Friends</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <Text className="text-xl font-bold text-gray-900 dark:text-white">{profile.display_name || profile.username}</Text>
          {profile.pronouns ? <Text className="text-sm text-gray-400">({profile.pronouns})</Text> : null}
          <Text className="text-sm text-gray-500">@{profile.username}</Text>
          {profile.bio ? <Text className="text-sm text-gray-700 dark:text-gray-300 mt-2">{profile.bio}</Text> : null}
          <View className="flex-row gap-4 mt-3">
            <Text className="text-sm text-gray-500">
              <Text className="font-bold text-gray-900 dark:text-white">{profile.friend_count || 0}</Text> friends
            </Text>
          </View>
        </View>

        {/* Posts */}
        {profile.profile_private && status !== 'accepted' ? (
          <View className="py-12 items-center px-8">
            <Ionicons name="lock-closed" size={32} color="#9ca3af" />
            <Text className="text-gray-500 font-medium mt-2">This profile is private</Text>
            <Text className="text-gray-400 text-sm text-center mt-1">Add {profile.display_name} as a friend to see their posts</Text>
          </View>
        ) : (
          <View className="mt-2">
            {posts.map((post: any) => (
              <PostCard key={post.id} post={post} queryKey={['user-posts', username]} />
            ))}
            {posts.length === 0 && (
              <Text className="text-center text-gray-400 text-sm py-12">No posts yet.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}
