import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  RefreshControl, Image, ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { formatDistanceToNow } from 'date-fns'
import { Screen, Spinner, Avatar } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { groupsApi, feedApi } from '../../api'
import { useAuthStore } from '../../store/auth'

export default function GroupScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showCompose, setShowCompose] = useState(false)

  const { data: groupData, isLoading: gl, refetch: rg } = useQuery({
    queryKey: ['group', slug],
    queryFn: () => groupsApi.get(slug!).then(r => r.data),
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch: rf, isRefetching } = useInfiniteQuery({
    queryKey: ['group-feed', slug],
    queryFn: ({ pageParam = 0 }) => groupsApi.getFeed(slug!, pageParam).then(r => r.data),
    getNextPageParam: (last, pages) => last.posts?.length === 20 ? pages.length : undefined,
    initialPageParam: 0,
  })

  const posts = data?.pages.flatMap(p => p.posts) ?? []
  const group = groupData?.group || groupData

  const join = useMutation({
    mutationFn: () => groupsApi.join(slug!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['group', slug] }); qc.invalidateQueries({ queryKey: ['groups'] }) },
  })

  const leave = useMutation({
    mutationFn: () => groupsApi.leave(slug!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['group', slug] }); router.back() },
  })

  const createPost = useMutation({
    mutationFn: () => groupsApi.createPost(slug!, { content, image_url: imageUrl }),
    onSuccess: () => {
      setContent(''); setImageUrl(''); setShowCompose(false)
      qc.invalidateQueries({ queryKey: ['group-feed', slug] })
    },
  })

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
    if (result.canceled) return
    setUploading(true)
    try {
      const file = { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' } as any
      const res = await feedApi.uploadMedia(file, 'posts')
      setImageUrl(res.data.url)
    } catch { Alert.alert('Upload failed') }
    finally { setUploading(false) }
  }

  if (gl || !group) return <Screen><Stack.Screen options={{ headerShown: true, headerTitle: 'Group', headerTintColor: '#6366f1' }} /><Spinner /></Screen>

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: group.name,
        headerBackTitle: 'Groups',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#6366f1',
        headerRight: () => group.is_member ? (
          <TouchableOpacity onPress={() => Alert.alert('Leave group?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => leave.mutate() },
          ])}>
            <Ionicons name="exit-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        ) : null,
      }} />

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PostCard post={item} queryKey={['group-feed', slug]} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { rg(); rf() }} tintColor="#6366f1" />}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListHeaderComponent={(
          <View>
            {/* Group header */}
            <View style={{ height: 100 }} className="bg-indigo-400">
              {group.cover_url ? <Image source={{ uri: group.cover_url }} style={{ width: '100%', height: 100 }} resizeMode="cover" /> : null}
            </View>
            <View className="bg-white dark:bg-gray-900 px-4 pb-4">
              <View className="flex-row items-end justify-between -mt-8 mb-3">
                <View className="w-16 h-16 rounded-xl bg-indigo-100 overflow-hidden border-4 border-white dark:border-gray-900 items-center justify-center">
                  {group.avatar_url
                    ? <Image source={{ uri: group.avatar_url }} style={{ width: 64, height: 64 }} />
                    : <Text className="text-indigo-600 font-bold text-2xl">{group.name[0]}</Text>}
                </View>
                {!group.is_member ? (
                  <TouchableOpacity onPress={() => join.mutate()} disabled={join.isPending}
                    className="bg-indigo-600 rounded-xl px-4 py-2">
                    <Text className="text-white font-semibold">Join</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text className="text-xl font-bold text-gray-900 dark:text-white">{group.name}</Text>
              <Text className="text-xs text-gray-400 mt-0.5 capitalize">{group.privacy} · {group.member_count} members</Text>
              {group.description ? <Text className="text-sm text-gray-600 dark:text-gray-400 mt-2">{group.description}</Text> : null}
            </View>

            {/* Compose */}
            {group.is_member && (
              <View className="bg-white dark:bg-gray-900 mx-3 mt-3 mb-1 rounded-2xl p-3">
                {showCompose ? (
                  <>
                    <TextInput
                      className="text-sm text-gray-900 dark:text-white min-h-[60px]"
                      placeholder={`Post something to ${group.name}…`}
                      placeholderTextColor="#9ca3af"
                      value={content}
                      onChangeText={setContent}
                      multiline
                      autoFocus
                    />
                    {imageUrl ? (
                      <View className="relative mt-2">
                        <Image source={{ uri: imageUrl }} style={{ height: 120, borderRadius: 8 }} resizeMode="cover" />
                        <TouchableOpacity onPress={() => setImageUrl('')}
                          className="absolute top-1 right-1 bg-black/60 rounded-full w-6 h-6 items-center justify-center">
                          <Ionicons name="close" size={12} color="white" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <TouchableOpacity onPress={pickImage} disabled={uploading}>
                        {uploading ? <ActivityIndicator size="small" color="#6366f1" /> : <Ionicons name="image-outline" size={20} color="#6366f1" />}
                      </TouchableOpacity>
                      <View className="flex-row gap-2">
                        <TouchableOpacity onPress={() => { setShowCompose(false); setContent(''); setImageUrl('') }}
                          className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-1">
                          <Text className="text-sm text-gray-600 dark:text-gray-300">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => createPost.mutate()}
                          disabled={(!content.trim() && !imageUrl) || createPost.isPending}
                          className={`rounded-xl px-4 py-1 ${(!content.trim() && !imageUrl) || createPost.isPending ? 'bg-indigo-300' : 'bg-indigo-600'}`}>
                          <Text className="text-white font-semibold text-sm">{createPost.isPending ? '…' : 'Post'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setShowCompose(true)}
                    className="flex-row items-center gap-3">
                    <Avatar url={user?.avatar_url} name={user?.display_name} size={32} />
                    <Text className="text-gray-400 text-sm flex-1">Post something to {group.name}…</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-3 pb-1">Posts</Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="py-12 items-center">
            <Text className="text-gray-400 text-sm">{group.is_member ? 'No posts yet. Be the first!' : 'Join to see posts.'}</Text>
          </View>
        }
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#6366f1" className="py-4" /> : null}
      />
    </Screen>
  )
}
