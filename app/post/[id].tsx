import { useState } from 'react'
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { formatDistanceToNow } from 'date-fns'
import { Screen, Spinner, Avatar } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

const REACTIONS = [
  { type: 'like', emoji: '❤️' }, { type: 'love', emoji: '😍' },
  { type: 'laugh', emoji: '😂' }, { type: 'wow', emoji: '😮' },
  { type: 'angry', emoji: '😡' }, { type: 'care', emoji: '🤗' },
  { type: 'thankful', emoji: '🙏' }, { type: 'vomit', emoji: '🤮' },
]

function CommentRow({ comment, postId, userId, onDeleted, onReacted }: {
  comment: any; postId: string; userId?: string; onDeleted: () => void; onReacted: () => void
}) {
  const c = useC()
  const [showPicker, setShowPicker] = useState(false)

  const del = useMutation({ mutationFn: () => feedApi.deleteComment(postId, comment.id), onSuccess: onDeleted })
  const react = useMutation({
    mutationFn: ({ type }: { type: string }) =>
      comment.my_reaction === type ? feedApi.unreactPost(comment.id) : feedApi.reactPost(comment.id, type),
    onSuccess: () => { setShowPicker(false); onReacted() },
  })

  const reactionCounts: Record<string, number> = comment.reaction_counts || {}
  const totalReactions = Object.values(reactionCounts).reduce((a: any, b: any) => a + b, 0) as number
  const myEmoji = REACTIONS.find(r => r.type === comment.my_reaction)?.emoji

  return (
    <View style={s.comment}>
      <TouchableOpacity onPress={() => router.push(`/profile/${comment.username}`)}>
        <Avatar url={comment.avatar_url} name={comment.display_name || comment.username} size={32} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[s.commentAuthor, { color: c.text }]}>{comment.display_name || comment.username}</Text>
          <Text style={[s.commentTime, { color: c.textLight }]}>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</Text>
        </View>
        <Text style={[s.commentText, { color: c.textMd }]}>{comment.content}</Text>
        {comment.image_url ? (
          <Image source={{ uri: imgUrl(comment.image_url) }} style={{ width: '100%', height: 160, borderRadius: 8, marginTop: 6 }} resizeMode="cover" />
        ) : null}

        {/* Reaction counts */}
        {totalReactions > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {Object.entries(reactionCounts).filter(([,v]) => (v as number) > 0).map(([type, count]) => {
              const emoji = REACTIONS.find(r => r.type === type)?.emoji ?? '❤️'
              const isActive = comment.my_reaction === type
              return (
                <TouchableOpacity key={type} onPress={() => react.mutate({ type })}
                  style={[s.reactionChip, { borderColor: isActive ? c.primaryLt : c.border, backgroundColor: isActive ? c.primaryBg : c.bg }]}>
                  <Text style={{ fontSize: 11 }}>{emoji}</Text>
                  <Text style={{ fontSize: 11, color: isActive ? c.primary : c.textMuted }}>{count as number}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* React button */}
        <View style={{ position: 'relative' }}>
          <TouchableOpacity onPress={() => setShowPicker(v => !v)} style={s.reactBtn}>
            <Text style={{ fontSize: 14 }}>{myEmoji ?? '🤍'}</Text>
            <Text style={[s.reactBtnText, { color: c.textLight }]}>React</Text>
          </TouchableOpacity>
          {showPicker && (
            <View style={[s.picker, { backgroundColor: c.card, borderColor: c.border }]}>
              {REACTIONS.map(r => (
                <TouchableOpacity key={r.type} onPress={() => react.mutate({ type: r.type })}>
                  <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
      {comment.author_id === userId && (
        <TouchableOpacity onPress={() => Alert.alert('Delete comment?', undefined, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
        ])} style={{ paddingLeft: 8 }}>
          <Ionicons name="trash-outline" size={14} color={c.red} />
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function PostScreen() {
  const c = useC()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [commentImage, setCommentImage] = useState('')
  const [uploading, setUploading] = useState(false)

  const { data: postData, isLoading: pl, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => feedApi.getPost(id!).then(r => r.data),
  })
  const { data: commentsData, isLoading: cl, refetch: rc } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => feedApi.getComments(id!).then(r => r.data),
  })

  const createComment = useMutation({
    mutationFn: () => feedApi.createComment(id!, { content: comment, image_url: commentImage || undefined }),
    onSuccess: () => { setComment(''); setCommentImage(''); rc() },
  })

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
    if (result.canceled) return
    setUploading(true)
    try {
      const file = { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' } as any
      const res = await feedApi.uploadMedia(file, 'posts')
      setCommentImage(res.data.url)
    } catch { Alert.alert('Upload failed') }
    finally { setUploading(false) }
  }

  const post = postData?.post
  const comments = commentsData?.comments || []
  const canSend = (comment.trim() || commentImage) && !createComment.isPending

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Post', headerBackTitle: 'Back', headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={pl || cl} onRefresh={() => { refetch(); rc() }} tintColor={c.primary} />}>
          {pl ? <Spinner /> : post ? <PostCard post={post} queryKey={['post', id]} /> : null}
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={s.commentsHeader}>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</Text>
            {cl ? <Spinner /> : comments.map((comment: any) => (
              <CommentRow key={comment.id} comment={comment} postId={id!} userId={user?.id} onDeleted={() => rc()} onReacted={() => rc()} />
            ))}
          </View>
        </ScrollView>
        <View style={[s.composerWrap, { borderTopColor: c.border, backgroundColor: c.card }]}>
          {commentImage ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <Image source={{ uri: imgUrl(commentImage) }} style={{ height: 80, width: 120, borderRadius: 8 }} resizeMode="cover" />
              <TouchableOpacity onPress={() => setCommentImage('')}
                style={{ position: 'absolute', top: 4, left: 110, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={10} color="white" />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={s.composer}>
            <Avatar url={user?.avatar_url} name={user?.display_name} size={32} />
            <TextInput style={[s.commentInput, { backgroundColor: c.bg, color: c.text }]}
              placeholder="Write a comment…" placeholderTextColor={c.textLight}
              value={comment} onChangeText={setComment} returnKeyType="send"
              onSubmitEditing={() => canSend && createComment.mutate()} />
            <TouchableOpacity onPress={pickImage} disabled={uploading} style={{ padding: 4 }}>
              {uploading
                ? <ActivityIndicator size="small" color={c.primary} />
                : <Ionicons name="image-outline" size={20} color={c.textMuted} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => canSend && createComment.mutate()} disabled={!canSend}>
              <Ionicons name="send" size={20} color={canSend ? c.primary : c.textLight} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  commentsHeader: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingVertical: 12 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  commentAuthor: { fontWeight: '600', fontSize: 13 },
  commentTime: { fontSize: 11 },
  commentText: { fontSize: 13, marginTop: 2 },
  reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  reactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  reactBtnText: { fontSize: 11 },
  picker: { position: 'absolute', top: 24, left: 0, borderWidth: 1, borderRadius: 16, padding: 6, flexDirection: 'row', gap: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8, zIndex: 99 },
  composerWrap: { borderTopWidth: 1 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  commentInput: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
})
