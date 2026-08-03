import { useState, useRef } from 'react'
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, RefreshControl, StyleSheet, Modal, Dimensions } from 'react-native'
import ZoomableImage from '../../components/ZoomableImage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { normalizeImageOrientation } from '../../utils/image'
import { timeAgo } from '../../utils/handle'
import { Screen, Spinner, Avatar, LinkedText, renderName } from '../../components/ui'
import PostCard from '../../components/PostCard'
import ReactorsModal from '../../components/ReactorsModal'
import { feedApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'
import { REACTIONS, reactionDisplay, pickerMetrics } from '../../utils/reactions'

// AMOBILE-170: the comment picker carries the same ten reactions as the post one
// and needs the same width-driven sizing. See pickerMetrics.
const PICKER = pickerMetrics(Dimensions.get('window').width)

// Depth controls indentation and avatar size
const DEPTH_INDENT = 20
const DEPTH_AVATAR = [36, 28, 22]

function CommentRow({ comment, postId, userId, depth = 0, onRefresh, onReply }: {
  comment: any
  postId: string
  userId?: string
  depth?: number
  onRefresh: () => void
  onReply: (username: string, commentId: string) => void
}) {
  const c = useC()
  const [showPicker, setShowPicker] = useState(false)
  const [pickerPosition, setPickerPosition] = useState<{ bottom: number; left: number } | null>(null)
  const [showReactors, setShowReactors] = useState(false)
  const [reactorsTab, setReactorsTab] = useState('all')
  const wrapperRef = useRef<View>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showCommentLightbox, setShowCommentLightbox] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

  const del = useMutation({
    mutationFn: () => feedApi.deleteComment(postId, comment.id),
    onSuccess: onRefresh,
  })

  const edit = useMutation({
    mutationFn: () => feedApi.editComment(postId, comment.id, editContent.trim()),
    onSuccess: () => { setIsEditing(false); onRefresh() },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error || 'Could not edit comment'),
  })
  const react = useMutation({
    mutationFn: ({ type }: { type: string }) =>
      comment.my_reaction === type
        ? feedApi.unreactComment(postId, comment.id)
        : feedApi.reactComment(postId, comment.id, type),
    onSuccess: () => { setShowPicker(false); setPickerPosition(null); onRefresh() },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error || 'Could not react to comment'),
  })

  const reactionCounts: Record<string, number> = comment.reaction_counts || {}
  const totalReactions = Object.values(reactionCounts).reduce((a: any, b: any) => a + b, 0) as number
  const myEmoji = comment.my_reaction ? reactionDisplay(comment.my_reaction).emoji : undefined
  const avatarSize = DEPTH_AVATAR[Math.min(depth, 2)]
  const indent = depth * DEPTH_INDENT

  return (
    <View>
      <View style={[s.comment, { marginLeft: indent, borderBottomColor: c.border }]}>
        <Avatar url={comment.avatar_url} name={comment.display_name || comment.username} size={avatarSize} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
            <Text style={[s.commentAuthor, { color: c.text }]}>{comment.display_name ? renderName(comment.display_name, comment.author_emojis) : comment.username}</Text>
            {comment.pronouns ? <Text style={{ fontSize: 12, color: c.textLight }}>({comment.pronouns})</Text> : null}
            <Text style={[s.commentTime, { color: c.textLight }]}>{timeAgo(comment.published_at || comment.created_at)}</Text>
          </View>
          {isEditing ? (
            <View style={{ marginTop: 4 }}>
              <TextInput
                value={editContent}
                onChangeText={setEditContent}
                multiline
                autoFocus
                style={[s.commentText, { color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 8, backgroundColor: c.bg }]}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TouchableOpacity onPress={() => edit.mutate()} disabled={!editContent.trim() || edit.isPending}
                  style={[s.actionBtn, { backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 }]}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{edit.isPending ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setIsEditing(false); setEditContent(comment.content) }} style={[s.actionBtn, { paddingHorizontal: 12, paddingVertical: 5 }]}>
                  <Text style={{ color: c.textMuted, fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={[s.commentText, { color: c.textMd }]}><LinkedText text={comment.content} emojis={comment.content_emojis} />{comment.edited_at ? <Text style={{ color: c.textLight, fontSize: 12 }}> (edited)</Text> : null}</Text>
          )}
          {comment.image_url ? (
            <>
              <TouchableOpacity onPress={() => setShowCommentLightbox(true)} activeOpacity={0.9}>
                <Image source={{ uri: imgUrl(comment.image_url) }} style={{ width: '100%', height: 140, borderRadius: 8, marginTop: 6 }} resizeMode="cover" />
              </TouchableOpacity>
              <Modal visible={showCommentLightbox} transparent animationType="fade" onRequestClose={() => setShowCommentLightbox(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}>
                  <ZoomableImage
                    uri={imgUrl(comment.image_url)}
                    width={screenWidth}
                    height={screenHeight * 0.8}
                    onClose={() => setShowCommentLightbox(false)}
                  />
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 16 }}>✕ tap to close · pinch to zoom</Text>
                </View>
              </Modal>
            </>
          ) : null}

          {/* Reaction chips */}
          {totalReactions > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {Object.entries(reactionCounts).filter(([, v]) => (v as number) > 0).map(([type, count]) => {
                const emoji = reactionDisplay(type).emoji
                const isActive = comment.my_reaction === type
                return (
                  <TouchableOpacity key={type} onPress={() => { setReactorsTab(type); setShowReactors(true) }}
                    style={[s.reactionChip, { borderColor: isActive ? c.primaryLt : c.border, backgroundColor: isActive ? c.primaryBg : c.bg }]}>
                    <Text style={{ fontSize: 15 }}>{emoji}</Text>
                    <Text style={{ fontSize: 13, color: isActive ? c.primary : c.textMuted }}>{count as number}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* Action row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 }}>
            {/* React */}
            <View ref={wrapperRef} collapsable={false}>
              <TouchableOpacity
                style={[s.actionBtn, { paddingVertical: 4, paddingHorizontal: 2 }]}
                onPress={() => {
                  if (showPicker) { setShowPicker(false); setPickerPosition(null); return }
                  react.mutate({ type: 'like' })
                }}
                onLongPress={() => {
                  wrapperRef.current?.measure((_x, _y, _w, h, pageX, pageY) => {
                    const sh = Dimensions.get('window').height
                    const sw = Dimensions.get('window').width
                    // AMOBILE-170: clamp so the ten-item row can't run off the
                    // right edge, which matters more here than on a post card
                    // since a nested comment's anchor is already indented.
                    const left = Math.max(PICKER.margin, Math.min(pageX, sw - PICKER.width - PICKER.margin))
                    setPickerPosition({ bottom: sh - pageY - h + 40, left })
                    setShowPicker(true)
                  })
                }}
                delayLongPress={400}
              >
                {/* Unreacted is an outline thumb now that Like is a thumbs-up (AMOBILE-170). */}
                {myEmoji
                  ? <Text style={{ fontSize: 16 }}>{myEmoji}</Text>
                  : <Ionicons name="thumbs-up-outline" size={15} color={c.textMuted} />}
                <Text style={[s.actionBtnText, { color: c.textLight }]}>React</Text>
              </TouchableOpacity>
            </View>
            <Modal visible={showPicker} transparent animationType="none" onRequestClose={() => { setShowPicker(false); setPickerPosition(null) }}>
              <View style={{ flex: 1 }} pointerEvents="box-none">
                {pickerPosition && (
                  <View
                    style={[s.pickerModal, { backgroundColor: c.card, borderColor: c.border, bottom: pickerPosition.bottom, left: pickerPosition.left }]}
                  >
                    {REACTIONS.map(r => (
                      <TouchableOpacity
                        key={r.type}
                        onPress={() => { react.mutate({ type: r.type }); setShowPicker(false); setPickerPosition(null) }}
                        style={[
                          s.pickerItem,
                          comment.my_reaction === r.type && { backgroundColor: c.primaryBg },
                        ]}
                      >
                        <Text style={{ fontSize: PICKER.emoji, textAlign: 'center' }}>{r.emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </Modal>
            {/* Reply — only available at depth < 2 */}
            {depth < 2 && (
              <TouchableOpacity onPress={() => onReply(comment.username, comment.id)} style={s.actionBtn}>
                <Ionicons name="return-down-forward-outline" size={14} color={c.textLight} />
                <Text style={[s.actionBtnText, { color: c.textLight }]}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Three-dots menu — show for all users */}
        <TouchableOpacity onPress={() => setShowMenu(true)} style={{ paddingLeft: 6, paddingTop: 2 }}>
          <Ionicons name="ellipsis-horizontal" size={15} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Nested replies */}
      {comment.replies?.map((reply: any) => (
        <View key={reply.id}>
          <CommentRow comment={reply} postId={postId} userId={userId} depth={depth + 1} onRefresh={onRefresh} onReply={onReply} />
          {/* Depth-2 replies */}
          {reply.replies?.map((r2: any) => (
            <CommentRow key={r2.id} comment={r2} postId={postId} userId={userId} depth={depth + 2} onRefresh={onRefresh} onReply={onReply} />
          ))}
        </View>
      ))}

      {/* Reactors modal */}
      <ReactorsModal
        postId={comment.id}
        visible={showReactors}
        onClose={() => setShowReactors(false)}
        initialTab={reactorsTab}
      />

      {/* Comment menu modal */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[s.menuSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            {comment.author_id === userId ? (
              <>
                <TouchableOpacity style={s.menuItem} onPress={() => {
                  setShowMenu(false)
                  setEditContent(comment.content)
                  setIsEditing(true)
                }}>
                  <Ionicons name="pencil-outline" size={18} color={c.text} />
                  <Text style={[s.menuItemText, { color: c.text }]}>Edit comment</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.menuItem} onPress={() => {
                  setShowMenu(false)
                  Alert.alert('Delete comment?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
                  ])
                }}>
                  <Ionicons name="trash-outline" size={18} color={c.red} />
                  <Text style={[s.menuItemText, { color: c.red }]}>Delete comment</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={s.menuItem} onPress={() => {
                setShowMenu(false)
                router.push({ pathname: '/report', params: { commentId: comment.id } } as any)
              }}>
                <Ionicons name="flag-outline" size={18} color={c.red} />
                <Text style={[s.menuItemText, { color: c.red }]}>Report comment</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

export default function PostScreen() {
  const c = useC()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const [comment, setComment] = useState('')
  const [commentImage, setCommentImage] = useState('')
  const [uploading, setUploading] = useState(false)
  // replyTo: { username, commentId } — when set, we're replying to a comment
  const [replyTo, setReplyTo] = useState<{ username: string; commentId: string } | null>(null)
  const inputRef = useRef<TextInput>(null)

  const { data: postData, isLoading: pl, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => feedApi.getPost(id!).then(r => r.data),
  })
  const { data: commentsData, isLoading: cl, refetch: rc } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => feedApi.getComments(id!).then(r => r.data),
  })

  const createComment = useMutation({
    mutationFn: () => feedApi.createComment(id!, {
      content: comment,
      image_url: commentImage || undefined,
      ...(replyTo ? { reply_to_id: replyTo.commentId } : {}),
    }),
    onSuccess: () => { setComment(''); setCommentImage(''); setReplyTo(null); rc() },
    onError: () => Alert.alert('Error', 'Could not post comment'),
  })

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
    if (result.canceled) return
    setUploading(true)
    try {
      const uri = await normalizeImageOrientation(result.assets[0].uri)
      const file = { uri, type: 'image/jpeg', name: 'photo.jpg' } as any
      const res = await feedApi.uploadMedia(file, 'posts')
      setCommentImage(res.data.url)
    } catch { Alert.alert('Upload failed') }
    finally { setUploading(false) }
  }

  const handleReply = (username: string, commentId: string) => {
    setReplyTo({ username, commentId })
    setComment(`@${username} `)
    // Focus the input
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const cancelReply = () => {
    setReplyTo(null)
    setComment('')
  }

  const post = postData?.post
  const comments = commentsData?.comments || []
  const nestedReplyIds = new Set(comments.flatMap((c: any) => c.replies?.map((r: any) => r.id) ?? []))
  const rootComments = comments.filter((c: any) => !nestedReplyIds.has(c.id))
  const canSend = (comment.trim() || commentImage) && !createComment.isPending

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true, headerTitle: 'Post', headerBackTitle: 'Back',
        headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary,
      }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={insets.top + 44}>
        <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={pl || cl} onRefresh={() => { refetch(); rc() }} tintColor={c.primary} />}>
          {pl ? <Spinner /> : post ? <PostCard post={post} queryKey={['post', id]} /> : null}
          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <Text style={[s.commentsHeader, { color: c.textMuted }]}>
              {rootComments.length} {rootComments.length === 1 ? 'comment' : 'comments'}
            </Text>
            {cl ? <Spinner /> : rootComments.map((comment: any) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                postId={id!}
                userId={user?.id}
                depth={0}
                onRefresh={rc}
                onReply={handleReply}
              />
            ))}
          </View>
        </ScrollView>

        {/* Composer */}
        <View style={[s.composerWrap, { borderTopColor: c.border, backgroundColor: c.card, paddingBottom: insets.bottom }]}>
          {/* Reply banner */}
          {replyTo && (
            <View style={[s.replyBanner, { backgroundColor: c.primaryBg, borderBottomColor: c.border }]}>
              <Text style={[s.replyBannerText, { color: c.primary }]}>
                Replying to <Text style={{ fontWeight: '700' }}>@{replyTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={cancelReply}>
                <Ionicons name="close" size={16} color={c.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          {/* Image preview */}
          {commentImage ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <Image source={{ uri: imgUrl(commentImage) }} style={{ height: 72, width: 100, borderRadius: 8 }} resizeMode="cover" />
              <TouchableOpacity onPress={() => setCommentImage('')}
                style={{ position: 'absolute', top: 4, left: 94, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={10} color="white" />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={s.composer}>
            <Avatar url={user?.avatar_url} name={user?.display_name} size={30} />
            <TextInput
              ref={inputRef}
              style={[s.commentInput, { backgroundColor: c.bg, color: c.text }]}
              placeholder={replyTo ? `Reply to @${replyTo.username}…` : 'Write a comment…'}
              placeholderTextColor={c.textLight}
              value={comment}
              onChangeText={setComment}
              returnKeyType="send"
              onSubmitEditing={() => canSend && createComment.mutate()}
              multiline
            />
            <TouchableOpacity onPress={pickImage} disabled={uploading} style={{ padding: 4 }}>
              {uploading
                ? null
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
  commentsHeader:  { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingVertical: 12 },
  comment:         { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  commentAuthor:   { fontWeight: '600', fontSize: 15 },
  commentTime:     { fontSize: 12 },
  commentText:     { fontSize: 16, marginTop: 2, lineHeight: 20 },
  reactionChip:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  actionBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText:   { fontSize: 13 },
  pickerModal:     { position: 'absolute', width: PICKER.width, borderWidth: 1, borderRadius: 24, paddingVertical: 8, flexDirection: 'row', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  pickerItem:      { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 3 },
  composerWrap:    { borderTopWidth: 1 },
  replyBanner:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  replyBannerText: { fontSize: 15 },
  composer:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  commentInput:    { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 16, maxHeight: 80 },
  menuOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuSheet:       { borderRadius: 16, margin: 12, borderWidth: 1, overflow: 'hidden' },
  menuItem:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 16 },
  menuItemText:    { fontSize: 17, fontWeight: '500' },
})
