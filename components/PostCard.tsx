import { useState } from 'react'
import {
  View, Text, Image, TouchableOpacity, Alert, Share,
} from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { feedApi } from '../api'
import { useAuthStore } from '../store/auth'
import { Avatar } from './ui'

const REACTIONS = ['❤️','😂','😮','😢','🤗','🏳️‍🌈','🙏','🤮']

export default function PostCard({ post, queryKey }: { post: any; queryKey: any[] }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showReactions, setShowReactions] = useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey })

  const react = useMutation({
    mutationFn: ({ type }: { type: string }) =>
      post.my_reaction === type ? feedApi.unreactPost(post.id) : feedApi.reactPost(post.id, type),
    onSuccess: invalidate,
  })

  const repost = useMutation({
    mutationFn: () => feedApi.repostPost(post.id),
    onSuccess: invalidate,
  })

  const del = useMutation({
    mutationFn: () => feedApi.deletePost(post.id),
    onSuccess: invalidate,
  })

  const isOwn = user?.id === post.author_id
  const author = post.repost_of_id ? post.repost_author_display_name : post.author_display_name
  const username = post.repost_of_id ? post.repost_author_username : post.author_username
  const avatar = post.repost_of_id ? post.repost_author_avatar_url : post.author_avatar_url
  const content = post.repost_of_id ? post.repost_content : post.content
  const imageUrl = post.repost_of_id ? post.repost_image_url : post.image_url

  const totalReactions = Object.values(post.reaction_counts || {}).reduce((a: any, b: any) => a + b, 0) as number

  return (
    <View className="bg-white dark:bg-gray-900 rounded-2xl mx-3 my-1.5 overflow-hidden shadow-sm">
      {/* Repost banner */}
      {post.repost_of_id && (
        <View className="flex-row items-center gap-1.5 px-4 pt-3 pb-1">
          <Ionicons name="repeat" size={13} color="#6366f1" />
          <Text className="text-xs text-indigo-500">
            {post.author_display_name} reposted
          </Text>
        </View>
      )}

      {/* Wall banner */}
      {post.wall_user_id && (
        <View className="flex-row items-center gap-1.5 px-4 pt-3 pb-1">
          <Ionicons name="arrow-forward" size={13} color="#6366f1" />
          <Text className="text-xs text-indigo-500">
            {post.author_display_name} → {post.wall_display_name}'s wall
          </Text>
        </View>
      )}

      <View className="p-4">
        {/* Author row */}
        <TouchableOpacity
          className="flex-row items-center gap-3 mb-3"
          onPress={() => router.push(`/profile/${username}`)}
        >
          <Avatar url={avatar} name={author} size={40} />
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 dark:text-white text-sm">{author}</Text>
            <Text className="text-gray-400 text-xs">
              @{username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </Text>
          </View>
          {isOwn && (
            <TouchableOpacity
              onPress={() => Alert.alert('Delete post?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
              ])}
              className="p-1"
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Content warning */}
        {post.content_warning && (
          <View className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl px-3 py-2 mb-2">
            <Text className="text-yellow-700 dark:text-yellow-400 text-xs font-medium">⚠️ {post.content_warning}</Text>
          </View>
        )}

        {/* Content */}
        {content ? (
          <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)}>
            <Text className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">{content}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Image */}
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="rounded-xl mt-2 w-full"
            style={{ height: 200 }}
            resizeMode="cover"
          />
        ) : null}

        {/* Link preview */}
        {post.link_url && !imageUrl && (
          <TouchableOpacity
            className="mt-2 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
            onPress={() => {/* open link */}}
          >
            {post.link_image && (
              <Image source={{ uri: post.link_image }} style={{ height: 120 }} resizeMode="cover" />
            )}
            <View className="px-3 py-2">
              <Text className="text-xs text-gray-400">{post.link_domain}</Text>
              {post.link_title && <Text className="text-sm font-medium text-gray-800 dark:text-gray-200">{post.link_title}</Text>}
            </View>
          </TouchableOpacity>
        )}

        {/* Reaction counts */}
        {totalReactions > 0 && (
          <View className="flex-row flex-wrap gap-1 mt-2">
            {Object.entries(post.reaction_counts || {}).filter(([,v]) => (v as number) > 0).map(([emoji, count]) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => react.mutate({ type: emoji })}
                className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full border ${post.my_reaction === emoji ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-600' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <Text style={{ fontSize: 13 }}>{emoji}</Text>
                <Text className="text-xs text-gray-600 dark:text-gray-400">{count as number}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Action bar */}
        <View className="flex-row items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          {/* React */}
          <View className="flex-1 relative">
            <TouchableOpacity
              className="flex-row items-center gap-1.5"
              onPress={() => setShowReactions(v => !v)}
            >
              <Text style={{ fontSize: 16 }}>{post.my_reaction || '🤍'}</Text>
              <Text className="text-xs text-gray-500">{totalReactions > 0 ? totalReactions : ''}</Text>
            </TouchableOpacity>
            {showReactions && (
              <View className="absolute bottom-8 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-2 flex-row gap-1 shadow-lg z-10">
                {REACTIONS.map(r => (
                  <TouchableOpacity key={r} onPress={() => { react.mutate({ type: r }); setShowReactions(false) }}>
                    <Text style={{ fontSize: 22 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Comment */}
          <TouchableOpacity
            className="flex-1 flex-row items-center gap-1.5"
            onPress={() => router.push(`/post/${post.id}`)}
          >
            <Ionicons name="chatbubble-outline" size={17} color="#6b7280" />
            <Text className="text-xs text-gray-500">{post.comment_count > 0 ? post.comment_count : ''}</Text>
          </TouchableOpacity>

          {/* Repost */}
          <TouchableOpacity
            className="flex-1 flex-row items-center gap-1.5"
            onPress={() => repost.mutate()}
          >
            <Ionicons name="repeat" size={17} color={post.reposted ? '#6366f1' : '#6b7280'} />
            <Text className={`text-xs ${post.reposted ? 'text-indigo-500' : 'text-gray-500'}`}>
              {post.repost_count > 0 ? post.repost_count : ''}
            </Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            onPress={() => Share.share({ message: content || '' })}
          >
            <Ionicons name="share-outline" size={17} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
