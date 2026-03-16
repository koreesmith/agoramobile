import { useState } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, RefreshControl,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { Screen, Spinner, Avatar } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi } from '../../api'
import { useAuthStore } from '../../store/auth'

function CommentRow({ comment, postId, userId, onDeleted }: {
  comment: any; postId: string; userId?: string; onDeleted: () => void
}) {
  const del = useMutation({
    mutationFn: () => feedApi.deleteComment(postId, comment.id),
    onSuccess: onDeleted,
  })
  return (
    <View className="flex-row gap-2.5 py-2.5 border-b border-gray-100 dark:border-gray-800">
      <TouchableOpacity onPress={() => router.push(`/profile/${comment.author_username}`)}>
        <Avatar url={comment.author_avatar_url} name={comment.author_display_name} size={32} />
      </TouchableOpacity>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <TouchableOpacity onPress={() => router.push(`/profile/${comment.author_username}`)}>
            <Text className="font-semibold text-sm text-gray-900 dark:text-white">
              {comment.author_display_name || comment.author_username}
            </Text>
          </TouchableOpacity>
          <Text className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </Text>
        </View>
        <Text className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{comment.content}</Text>
        {comment.replies?.map((reply: any) => (
          <View key={reply.id} className="ml-4 mt-2 flex-row gap-2">
            <Avatar url={reply.author_avatar_url} name={reply.author_display_name} size={24} />
            <View className="flex-1">
              <Text className="font-semibold text-xs text-gray-900 dark:text-white">{reply.author_display_name}</Text>
              <Text className="text-xs text-gray-700 dark:text-gray-300">{reply.content}</Text>
            </View>
          </View>
        ))}
      </View>
      {comment.author_id === userId && (
        <TouchableOpacity onPress={() => Alert.alert('Delete comment?', undefined, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
        ])}>
          <Ionicons name="trash-outline" size={14} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')

  const { data: postData, isLoading: pl, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => feedApi.getPost(id!).then(r => r.data),
  })

  const { data: commentsData, isLoading: cl, refetch: rc } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => feedApi.getComments(id!).then(r => r.data),
  })

  const createComment = useMutation({
    mutationFn: () => feedApi.createComment(id!, { content: comment }),
    onSuccess: () => { setComment(''); rc() },
  })

  const post = postData?.post
  const comments = commentsData?.comments || []

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: 'Post',
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#6366f1',
      }} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={pl || cl} onRefresh={() => { refetch(); rc() }} tintColor="#6366f1" />}
        >
          {pl ? <Spinner /> : post ? (
            <PostCard post={post} queryKey={['post', id]} />
          ) : null}

          <View className="px-4 pb-2">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3">
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </Text>
            {cl ? <Spinner /> : comments.map((c: any) => (
              <CommentRow
                key={c.id}
                comment={c}
                postId={id!}
                userId={user?.id}
                onDeleted={() => rc()}
              />
            ))}
          </View>
        </ScrollView>

        {/* Comment input */}
        <View className="flex-row items-center gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <Avatar url={user?.avatar_url} name={user?.display_name} size={32} />
          <TextInput
            className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2 text-sm text-gray-900 dark:text-white"
            placeholder="Write a comment…"
            placeholderTextColor="#9ca3af"
            value={comment}
            onChangeText={setComment}
            returnKeyType="send"
            onSubmitEditing={() => comment.trim() && createComment.mutate()}
          />
          <TouchableOpacity
            onPress={() => comment.trim() && createComment.mutate()}
            disabled={!comment.trim() || createComment.isPending}
          >
            <Ionicons name="send" size={20} color={comment.trim() ? '#6366f1' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}
