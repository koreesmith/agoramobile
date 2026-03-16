import { useState, useRef, useEffect } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Image, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { formatDistanceToNow } from 'date-fns'
import { Screen, Spinner, Avatar } from '../../components/ui'
import { dmApi, feedApi } from '../../api'
import { useAuthStore } from '../../store/auth'

const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '👎']

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [reacting, setReacting] = useState<string | null>(null)
  const flatListRef = useRef<FlatList>(null)

  const { data: convData } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => dmApi.getConversation(id!).then(r => r.data),
  })

  const { data: msgData, refetch } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => dmApi.getMessages(id!).then(r => r.data),
    refetchInterval: 5_000,
  })

  const messages = msgData?.messages || []
  const conv = convData
  const other = conv?.participants?.find((p: any) => p.user_id !== user?.id)

  useEffect(() => {
    if (id) { dmApi.markRead(id); qc.invalidateQueries({ queryKey: ['conversations'] }) }
  }, [id, messages.length])

  const send = useMutation({
    mutationFn: () => dmApi.sendMessage(id!, text, imageUrl || undefined),
    onSuccess: () => { setText(''); setImageUrl(''); refetch(); qc.invalidateQueries({ queryKey: ['conversations'] }) },
  })

  const del = useMutation({
    mutationFn: (msgId: string) => dmApi.deleteMessage(msgId),
    onSuccess: refetch,
  })

  const accept = useMutation({
    mutationFn: () => dmApi.acceptRequest(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', id] }),
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

  const MessageBubble = ({ msg }: { msg: any }) => {
    const isOwn = msg.author_id === user?.id
    if (msg.deleted_at) {
      return (
        <View className={`flex-row my-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <Text className="text-xs text-gray-400 italic px-3 py-1.5">Message deleted</Text>
        </View>
      )
    }

    return (
      <View className={`flex-row items-end gap-1.5 my-0.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwn && <Avatar url={msg.author_avatar_url} name={msg.author_display_name} size={28} />}

        <TouchableOpacity
          onLongPress={() => {
            if (isOwn) {
              Alert.alert('Message options', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => del.mutate(msg.id) },
              ])
            } else {
              setReacting(msg.id)
            }
          }}
          className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${isOwn ? 'bg-indigo-600 rounded-br-sm' : 'bg-gray-100 dark:bg-gray-800 rounded-bl-sm'}`}
        >
          {msg.content ? (
            <Text className={`text-sm ${isOwn ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
              {msg.content}
            </Text>
          ) : null}
          {msg.image_url ? (
            <Image source={{ uri: msg.image_url }} style={{ width: 180, height: 140, borderRadius: 8, marginTop: msg.content ? 4 : 0 }} resizeMode="cover" />
          ) : null}
          <Text className={`text-[10px] mt-1 ${isOwn ? 'text-indigo-200' : 'text-gray-400'}`}>
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
            {msg.edited_at ? ' · edited' : ''}
          </Text>
        </TouchableOpacity>

        {/* Reaction picker (long press) */}
        {reacting === msg.id && (
          <View className="absolute bottom-8 left-0 right-0 items-center z-10">
            <View className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-2 flex-row gap-2 shadow-lg">
              {REACTIONS.map(r => (
                <TouchableOpacity key={r} onPress={() => setReacting(null)}>
                  <Text style={{ fontSize: 24 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: other?.display_name || other?.username || 'Message',
        headerBackTitle: 'Messages',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#6366f1',
        headerRight: () => other ? (
          <TouchableOpacity onPress={() => router.push(`/profile/${other.username}`)}>
            <Avatar url={other.avatar_url} name={other.display_name || other.username} size={32} />
          </TouchableOpacity>
        ) : null,
      }} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Message request banner */}
        {conv && !conv.is_accepted && (
          <View className="mx-4 mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
            <Text className="text-sm font-medium text-amber-800 dark:text-amber-300">Message request</Text>
            <Text className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 mb-2">Accept to reply</Text>
            <TouchableOpacity onPress={() => accept.mutate()} className="bg-indigo-600 rounded-lg py-1.5 items-center">
              <Text className="text-white font-semibold text-sm">Accept</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          contentContainerStyle={{ padding: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-gray-400 text-sm">No messages yet. Say hello!</Text>
            </View>
          }
        />

        {/* Image preview */}
        {imageUrl ? (
          <View className="px-4 pt-2 relative w-fit">
            <Image source={{ uri: imageUrl }} style={{ height: 80, width: 100, borderRadius: 8 }} resizeMode="cover" />
            <TouchableOpacity
              onPress={() => setImageUrl('')}
              className="absolute top-1 right-0 bg-black/60 rounded-full w-5 h-5 items-center justify-center"
            >
              <Ionicons name="close" size={10} color="white" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Composer */}
        {(conv?.is_accepted !== false) && (
          <View className="flex-row items-end gap-2 px-3 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <TouchableOpacity onPress={pickImage} disabled={uploading} className="pb-1">
              {uploading
                ? <ActivityIndicator size="small" color="#6366f1" />
                : <Ionicons name="image-outline" size={22} color="#6366f1" />}
            </TouchableOpacity>
            <TextInput
              className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2 text-sm text-gray-900 dark:text-white max-h-24"
              placeholder="Message…"
              placeholderTextColor="#9ca3af"
              value={text}
              onChangeText={setText}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => (text.trim() || imageUrl) && send.mutate()}
            />
            <TouchableOpacity
              onPress={() => (text.trim() || imageUrl) && send.mutate()}
              disabled={(!text.trim() && !imageUrl) || send.isPending}
              className="pb-1"
            >
              <Ionicons name="send" size={20} color={(text.trim() || imageUrl) ? '#6366f1' : '#9ca3af'} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}
