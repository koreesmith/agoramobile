import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, Alert } from 'react-native'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, Avatar } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi, usersApi } from '../../api'
import { useAuthStore } from '../../store/auth'

export default function ProfileScreen() {
  const { user, logout } = useAuthStore()

  const { data: profile, isLoading: pl, refetch: rp, isRefetching: rpr } = useQuery({
    queryKey: ['profile', user?.username],
    queryFn: () => usersApi.getProfile(user!.username).then(r => r.data),
    enabled: !!user,
  })

  const { data: postsData, isLoading: postL, refetch: rpost } = useQuery({
    queryKey: ['user-posts', user?.username],
    queryFn: () => feedApi.getUserPosts(user!.username).then(r => r.data),
    enabled: !!user,
  })

  const posts = postsData?.posts || []

  if (pl) return <Screen><Header title="Profile" /><Spinner /></Screen>

  const p = profile || user

  return (
    <Screen>
      <Header
        title="Profile"
        right={
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => router.push('/settings')} className="p-1">
              <Ionicons name="settings-outline" size={22} color="#6366f1" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert('Sign out?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: logout },
              ])}
              className="p-1"
            >
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={rpr} onRefresh={() => { rp(); rpost() }} tintColor="#6366f1" />}
      >
        {/* Cover */}
        <View style={{ height: 100 }} className="bg-indigo-400">
          {p?.cover_url ? (
            <Image source={{ uri: p.cover_url }} style={{ width: '100%', height: 100 }} resizeMode="cover" />
          ) : null}
        </View>

        {/* Avatar + info */}
        <View className="bg-white dark:bg-gray-900 px-4 pb-4">
          <View className="flex-row items-end justify-between -mt-8 mb-3">
            <View className="border-4 border-white dark:border-gray-900 rounded-full">
              <Avatar url={p?.avatar_url} name={p?.display_name || p?.username} size={72} />
            </View>
            <TouchableOpacity
              onPress={() => router.push('/edit-profile')}
              className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-1.5"
            >
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Edit profile</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-xl font-bold text-gray-900 dark:text-white">{p?.display_name || p?.username}</Text>
          {p?.pronouns ? <Text className="text-sm text-gray-400">({p.pronouns})</Text> : null}
          <Text className="text-sm text-gray-500">@{p?.username}</Text>
          {p?.bio ? <Text className="text-sm text-gray-700 dark:text-gray-300 mt-2">{p.bio}</Text> : null}
          <View className="flex-row gap-4 mt-3">
            <Text className="text-sm text-gray-500"><Text className="font-bold text-gray-900 dark:text-white">{p?.friend_count || 0}</Text> friends</Text>
          </View>
        </View>

        {/* Posts */}
        <View className="mt-2">
          {postL ? <Spinner /> : posts.length === 0 ? (
            <View className="py-12 items-center">
              <Text className="text-gray-400 text-sm">No posts yet.</Text>
            </View>
          ) : (
            posts.map((post: any) => (
              <PostCard key={post.id} post={post} queryKey={['user-posts', user?.username]} />
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  )
}
