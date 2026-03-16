import { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  RefreshControl, Modal, Image, Alert, ActivityIndicator,
} from 'react-native'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Screen, Header, Spinner, EmptyState } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi } from '../../api'
import { useAuthStore } from '../../store/auth'

export default function FeedScreen() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showCompose, setShowCompose] = useState(false)
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading, refetch, isRefetching,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam = 0 }) => feedApi.getFeed(pageParam).then(r => r.data),
    getNextPageParam: (last, pages) => last.posts?.length === 20 ? pages.length : undefined,
    initialPageParam: 0,
  })

  const posts = data?.pages.flatMap(p => p.posts) ?? []

  const createPost = useMutation({
    mutationFn: () => feedApi.createPost({ content, image_url: imageUrl, visibility: 'friends' }),
    onSuccess: () => {
      setContent(''); setImageUrl(''); setShowCompose(false)
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
    onError: () => Alert.alert('Error', 'Could not create post'),
  })

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (result.canceled) return
    setUploading(true)
    try {
      const file = {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any
      const res = await feedApi.uploadMedia(file, 'posts')
      setImageUrl(res.data.url)
    } catch { Alert.alert('Upload failed') }
    finally { setUploading(false) }
  }

  return (
    <Screen>
      <Header
        title="Feed"
        right={
          <TouchableOpacity onPress={() => setShowCompose(true)} className="bg-indigo-600 rounded-xl px-3 py-1.5">
            <Text className="text-white font-semibold text-sm">Post</Text>
          </TouchableOpacity>
        }
      />

      {isLoading ? <Spinner /> : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <PostCard post={item} queryKey={['feed']} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState icon="📭" title="Nothing here yet" subtitle="Follow some friends to see their posts" />}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="py-4" color="#6366f1" /> : null}
        />
      )}

      {/* Compose modal */}
      <Modal visible={showCompose} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white dark:bg-gray-900">
          <View className="flex-row items-center justify-between px-4 pt-5 pb-3 border-b border-gray-200 dark:border-gray-800">
            <TouchableOpacity onPress={() => { setShowCompose(false); setContent(''); setImageUrl('') }}>
              <Text className="text-gray-600 dark:text-gray-400 text-base">Cancel</Text>
            </TouchableOpacity>
            <Text className="font-semibold text-gray-900 dark:text-white">New post</Text>
            <TouchableOpacity
              onPress={() => createPost.mutate()}
              disabled={(!content.trim() && !imageUrl) || createPost.isPending}
              className={`rounded-xl px-4 py-1.5 ${(!content.trim() && !imageUrl) || createPost.isPending ? 'bg-indigo-300' : 'bg-indigo-600'}`}
            >
              <Text className="text-white font-semibold">{createPost.isPending ? '…' : 'Post'}</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-1 p-4">
            <TextInput
              className="text-base text-gray-900 dark:text-white flex-1"
              placeholder="What's on your mind?"
              placeholderTextColor="#9ca3af"
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
            />
            {imageUrl ? (
              <View className="relative mt-2">
                <Image source={{ uri: imageUrl }} style={{ height: 180, borderRadius: 12 }} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => setImageUrl('')}
                  className="absolute top-2 right-2 bg-black/60 rounded-full w-7 h-7 items-center justify-center"
                >
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View className="px-4 pb-8 pt-2 border-t border-gray-100 dark:border-gray-800 flex-row gap-4">
            <TouchableOpacity onPress={pickImage} disabled={uploading} className="flex-row items-center gap-2">
              {uploading
                ? <ActivityIndicator size="small" color="#6366f1" />
                : <Ionicons name="image-outline" size={22} color="#6366f1" />}
              <Text className="text-indigo-600 text-sm font-medium">{uploading ? 'Uploading…' : 'Photo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}
