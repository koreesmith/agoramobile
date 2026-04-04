import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet, Modal, Dimensions, Linking, TextInput, PanResponder } from 'react-native'
import { Image } from 'expo-image'
import ZoomableImage from './ZoomableImage'
import { router } from 'expo-router'
import * as MediaLibrary from 'expo-media-library'
import * as FileSystem from 'expo-file-system'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { feedApi, imgUrl, blockApi, moderationApi, friendsApi } from '../api'
import { useAuthStore } from '../store/auth'
import { useBlockStore } from '../store/blocks'
import { Avatar } from './ui'
import { useC } from '../constants/ColorContext'

const REACTIONS = [
  { type: 'like', emoji: '❤️' }, { type: 'love', emoji: '😍' },
  { type: 'laugh', emoji: '😂' }, { type: 'wow', emoji: '😮' },
  { type: 'angry', emoji: '😡' }, { type: 'care', emoji: '🤗' },
  { type: 'pride', emoji: '🏳️‍🌈' }, { type: 'thankful', emoji: '🙏' },
  { type: 'vomit', emoji: '🤮' },
]

function PollWidget({ post, onRefresh }: { post: any; onRefresh: () => void }) {
  const c = useC()
  const [showAddOption, setShowAddOption] = useState(false)
  const [newOptionText, setNewOptionText] = useState('')

  const vote = useMutation({
    mutationFn: (optionId: string | null) =>
      optionId ? feedApi.pollVote(post.id, optionId) : feedApi.pollUnvote(post.id),
    onSuccess: onRefresh,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not vote'),
  })

  const addOption = useMutation({
    mutationFn: () => feedApi.pollAddOption(post.id, newOptionText.trim()),
    onSuccess: () => { setNewOptionText(''); setShowAddOption(false); onRefresh() },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not add option'),
  })

  const opts: any[] = post.poll_options || []
  const totalVotes = opts.reduce((s: number, o: any) => s + (o.votes || 0), 0)
  const myVotes = new Set([post.my_poll_vote, ...(post.my_poll_votes || [])].filter(Boolean))
  const hasVoted = myVotes.size > 0
  const isExpired = !!post.poll_expired
  const canVote = !isExpired

  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      {isExpired && (
        <Text style={{ fontSize: 12, color: c.textMuted }}>🔒 This poll has ended</Text>
      )}
      {!isExpired && post.poll_expires_at && (
        <Text style={{ fontSize: 12, color: c.textMuted }}>
          ⏱ Closes {new Date(post.poll_expires_at).toLocaleString()}
        </Text>
      )}
      {post.poll_multiple_choice && canVote && !hasVoted && (
        <Text style={{ fontSize: 11, color: c.textMuted }}>Select all that apply</Text>
      )}

      {opts.map((opt: any) => {
        const isMyVote = myVotes.has(opt.id)
        const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
        const showResults = hasVoted || isExpired

        return showResults ? (
          <TouchableOpacity
            key={opt.id}
            onPress={() => canVote ? vote.mutate(isMyVote ? null : opt.id) : undefined}
            disabled={!canVote}
            style={[pw.resultRow, { borderColor: isMyVote ? c.primary : c.border }]}
          >
            <View style={[pw.resultFill, { width: `${pct}%` as any, backgroundColor: isMyVote ? c.primaryBg : c.bg }]} />
            <View style={pw.resultContent}>
              <Text style={[pw.resultText, { color: isMyVote ? c.primary : c.textMd, fontWeight: isMyVote ? '700' : '400' }]}>
                {isMyVote ? '✓ ' : ''}{opt.text}
              </Text>
              <Text style={[pw.resultPct, { color: c.textMuted }]}>{pct}%</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            key={opt.id}
            onPress={() => vote.mutate(opt.id)}
            disabled={vote.isPending}
            style={[pw.optionRow, { borderColor: c.border }]}
          >
            {post.poll_multiple_choice && (
              <Ionicons name="square-outline" size={14} color={c.textMuted} style={{ marginRight: 6 }} />
            )}
            <Text style={[pw.optionText, { color: c.textMd }]}>{opt.text}</Text>
          </TouchableOpacity>
        )
      })}

      {canVote && post.poll_allows_new_options && !showAddOption && (
        <TouchableOpacity
          onPress={() => setShowAddOption(true)}
          style={[pw.addOptionBtn, { borderColor: c.border }]}
        >
          <Ionicons name="add" size={14} color={c.textMuted} />
          <Text style={[pw.addOptionText, { color: c.textMuted }]}>Add your own option…</Text>
        </TouchableOpacity>
      )}

      {showAddOption && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[pw.addOptionInput, { borderColor: c.border, color: c.text, backgroundColor: c.card, flex: 1 }]}
            placeholder="Your option…"
            placeholderTextColor={c.textLight}
            value={newOptionText}
            onChangeText={setNewOptionText}
            maxLength={100}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => newOptionText.trim() && addOption.mutate()}
          />
          <TouchableOpacity
            onPress={() => addOption.mutate()}
            disabled={!newOptionText.trim() || addOption.isPending}
            style={[pw.addBtn, { backgroundColor: c.primary }]}
          >
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
              {addOption.isPending ? '…' : 'Add'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowAddOption(false); setNewOptionText('') }}
            style={[pw.addBtn, { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }]}
          >
            <Text style={{ color: c.textMuted, fontSize: 13 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <Text style={[pw.voteCount, { color: c.textMuted }]}>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </Text>
        {hasVoted && canVote && (
          <TouchableOpacity onPress={() => vote.mutate(null)}>
            <Text style={{ fontSize: 11, color: c.primary, textDecorationLine: 'underline' }}>Remove vote</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const pw = StyleSheet.create({
  resultRow:    { borderWidth: 1, borderRadius: 10, overflow: 'hidden', position: 'relative', marginBottom: 2 },
  resultFill:   { position: 'absolute', top: 0, bottom: 0, left: 0 },
  resultContent:{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, alignItems: 'center' },
  resultText:   { fontSize: 13, flex: 1 },
  resultPct:    { fontSize: 12, flexShrink: 0 },
  optionRow:    { borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  optionText:   { fontSize: 13 },
  addOptionBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addOptionText:{ fontSize: 13 },
  addOptionInput:{ borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  addBtn:       { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  voteCount:    { fontSize: 11 },
})

export default function PostCard({ post, queryKey }: { post: any; queryKey: any[] }) {
  const { user } = useAuthStore()
  const { addBlock } = useBlockStore()
  const qc = useQueryClient()
  const [showReactions, setShowReactions] = useState(false)
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null)
  const pickerRef = useRef<View>(null)
  const gestureState = useRef({
    isPicking: false,
    hoveredType: null as string | null,
    timer: null as ReturnType<typeof setTimeout> | null,
    pickerLayout: null as { x: number; width: number } | null,
  })
  const reactMutateRef = useRef<(vars: { type: string }) => void>(() => {})
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => gestureState.current.isPicking,
    onMoveShouldSetPanResponderCapture: () => gestureState.current.isPicking,
    onPanResponderTerminationRequest: () => !gestureState.current.isPicking,
    onPanResponderGrant: () => {
      const gs = gestureState.current
      gs.isPicking = false
      gs.hoveredType = null
      gs.timer = setTimeout(() => { gs.isPicking = true; setShowReactions(true) }, 400)
    },
    onPanResponderMove: (evt) => {
      const gs = gestureState.current
      if (!gs.isPicking || !gs.pickerLayout) return
      const relX = evt.nativeEvent.pageX - gs.pickerLayout.x
      const idx = Math.floor(relX / (gs.pickerLayout.width / REACTIONS.length))
      const hovered = idx >= 0 && idx < REACTIONS.length ? REACTIONS[idx].type : null
      gs.hoveredType = hovered
      setHoveredReaction(hovered)
    },
    onPanResponderRelease: () => {
      const gs = gestureState.current
      if (gs.timer) { clearTimeout(gs.timer); gs.timer = null }
      if (!gs.isPicking) {
        reactMutateRef.current({ type: 'like' })
      } else {
        if (gs.hoveredType) reactMutateRef.current({ type: gs.hoveredType })
        setShowReactions(false)
        setHoveredReaction(null)
      }
      gs.isPicking = false
      gs.hoveredType = null
    },
    onPanResponderTerminate: () => {
      const gs = gestureState.current
      if (gs.timer) { clearTimeout(gs.timer); gs.timer = null }
      gs.isPicking = false
      gs.hoveredType = null
      setShowReactions(false)
      setHoveredReaction(null)
    },
  })).current
  const [twExpanded, setTwExpanded] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareContent, setShareContent] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editContent, setEditContent] = useState(post.content || '')
  const [editCW, setEditCW] = useState(post.content_warning || '')
  const [showEditCW, setShowEditCW] = useState(!!post.content_warning)
  const [editVisibility, setEditVisibility] = useState<'public'|'friends'|'group'>(
    post.visibility === 'locked' ? 'group' : (post.visibility || 'friends')
  )
  const [editFriendListId, setEditFriendListId] = useState<string>(post.group_id || '')
  const [showEditVisibilitySheet, setShowEditVisibilitySheet] = useState(false)
  const [showEditListSheet, setShowEditListSheet] = useState(false)
  const c = useC()

  const { data: friendListsData } = useQuery({
    queryKey: ['friend-lists'],
    queryFn: () => friendsApi.listFriendLists().then(r => r.data),
    enabled: showEdit,
  })
  const editFriendLists: any[] = friendListsData?.groups || []
  const selectedEditFriendList = editFriendLists.find((g: any) => g.id === editFriendListId)

  const invalidate = () => qc.invalidateQueries({ queryKey })

  const react = useMutation({
    mutationFn: ({ type }: { type: string }) =>
      post.my_reaction === type ? feedApi.unreactPost(post.id) : feedApi.reactPost(post.id, type),
    onSuccess: invalidate,
  })
  reactMutateRef.current = (vars) => react.mutate(vars)

  const repost = useMutation({
    mutationFn: () => feedApi.repostPost(post.id, { content: shareContent, visibility: 'friends' }),
    onSuccess: () => { setShowShare(false); setShareContent(''); invalidate() },
    onError: (e: any) => Alert.alert('Cannot share', e.response?.data?.error || 'Could not share post'),
  })
  const del    = useMutation({ mutationFn: () => feedApi.deletePost(post.id), onSuccess: invalidate })
  const edit   = useMutation({
    mutationFn: () => feedApi.editPost(post.id, {
      content: editContent,
      content_warning: showEditCW && editCW.trim() ? editCW.trim() : '',
      visibility: editVisibility,
      group_id: editVisibility === 'group' ? editFriendListId : undefined,
    }),
    onSuccess: () => { setShowEdit(false); invalidate() },
    onError: () => Alert.alert('Error', 'Could not save changes'),
  })

  const blockUser = useMutation({
    mutationFn: async () => {
      await blockApi.blockUser(post.author_id)
      await moderationApi.createReport({
        reported_user_id: post.author_id,
        violation_type: 'harassment',
        details: 'User blocked by another user.',
      }).catch(() => {})
    },
    onSuccess: () => {
      addBlock(post.author_id)
      qc.invalidateQueries({ queryKey })
    },
    onError: () => Alert.alert('Error', 'Could not block user. Please try again.'),
  })

  const isOwn    = user?.id === post.author_id
  const author   = post.repost_of_id ? post.repost_author_display_name : (post.author_display_name || post.display_name)
  const pronouns = post.repost_of_id ? post.repost_author_pronouns     : post.author_pronouns
  const username = post.repost_of_id ? post.repost_author_username    : (post.author_username || post.username)
  const avatar   = imgUrl(post.repost_of_id ? post.repost_author_avatar_url  : (post.author_avatar_url || post.avatar_url))
  const content  = post.repost_of_id ? post.repost_content            : post.content
  const imageUrl = imgUrl(post.repost_of_id ? post.repost_image_url   : post.image_url)
  const linkImage = imgUrl(post.link_image)

  const [showLightbox, setShowLightbox] = useState(false)
  const screenWidth = Dimensions.get('window').width
  const screenHeight = Dimensions.get('window').height

  const saveImageToLibrary = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to save images.')
      return
    }
    try {
      const filename = imageUrl.split('/').pop() || 'image.jpg'
      const localUri = FileSystem.cacheDirectory + filename
      await FileSystem.downloadAsync(imageUrl, localUri)
      await MediaLibrary.saveToLibraryAsync(localUri)
      Alert.alert('Saved', 'Image saved to your photo library.')
    } catch {
      Alert.alert('Error', 'Could not save the image.')
    }
  }

  const onLightboxLongPress = () => {
    Alert.alert('Save image', 'Save this image to your photo library?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: saveImageToLibrary },
    ])
  }
  const reactionCounts: Record<string, number> = post.reaction_counts || {}
  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0)
  const myReactionEmoji = REACTIONS.find(r => r.type === post.my_reaction)?.emoji

  return (
    <View style={[s.card, { backgroundColor: c.card }, post.group_slug && { borderLeftWidth: 3, borderLeftColor: c.primaryLt }]}>
      {/* Group badge */}
      {post.group_slug && (
        <TouchableOpacity
          onPress={() => router.push(`/group/${post.group_slug}`)}
          style={[s.groupBadge, { backgroundColor: c.primaryBg }]}
        >
          <Ionicons name="people" size={11} color={c.primary} />
          <Text style={[s.groupBadgeText, { color: c.primary }]}>{post.group_name}</Text>
          <Text style={[s.groupBadgeArrow, { color: c.textLight }]}>· View in group →</Text>
        </TouchableOpacity>
      )}
      {post.repost_of_id && (
        <View style={s.banner}>
          <Ionicons name="repeat" size={13} color={c.primary} />
          <Text style={[s.bannerText, { color: c.primary }]}>{post.author_display_name} reposted</Text>
        </View>
      )}
      {post.wall_user_id && (
        <View style={s.banner}>
          <Ionicons name="arrow-forward" size={13} color={c.primary} />
          <Text style={[s.bannerText, { color: c.primary }]}>{post.author_display_name} to {post.wall_display_name}'s wall</Text>
        </View>
      )}

      <View style={s.body}>
        <TouchableOpacity style={s.authorRow} onPress={() => router.push(`/profile/${username}`)}>
          <Avatar url={avatar} name={author} size={40} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
              <Text style={[s.authorName, { color: c.text }]}>{author}</Text>
              {pronouns ? <Text style={[s.pronouns, { color: c.textLight }]}>({pronouns})</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[s.authorMeta, { color: c.textMuted }]}>@{username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</Text>
              <Ionicons
                name={
                  post.visibility === 'public'  ? 'globe-outline' :
                  post.visibility === 'friends' ? 'people-outline' :
                  'lock-closed-outline'
                }
                size={11}
                color={c.textLight}
              />
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={{ padding: 4 }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={c.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>

        {post.content_warning && !twExpanded && (
          <View style={[s.cw, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.cwText, { fontWeight: '700' }]}>Trigger Warning</Text>
              <Text style={s.cwText} numberOfLines={1}>{post.content_warning}</Text>
            </View>
            <TouchableOpacity onPress={() => setTwExpanded(true)}
              style={{ borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, color: '#92400e', fontWeight: '500' }}>Show post</Text>
            </TouchableOpacity>
          </View>
        )}

        {post.content_warning && twExpanded && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: '#b45309' }}>⚠️ {post.content_warning}</Text>
            <TouchableOpacity onPress={() => setTwExpanded(false)} style={{ marginLeft: 'auto' }}>
              <Text style={{ fontSize: 11, color: c.textMuted }}>Hide</Text>
            </TouchableOpacity>
          </View>
        )}

        {(!post.content_warning || twExpanded) && content ? (
          <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)}>
            <Text style={[s.content, { color: c.textMd }]}>{content}</Text>
          </TouchableOpacity>
        ) : null}

        {(!post.content_warning || twExpanded) && imageUrl ? (
          <View style={s.imageWrapper}>
            <TouchableOpacity onPress={() => setShowLightbox(true)} activeOpacity={0.9}>
              <Image source={{ uri: imageUrl }} style={s.image} contentFit="cover" />
            </TouchableOpacity>
            <Modal visible={showLightbox} transparent animationType="fade" onRequestClose={() => setShowLightbox(false)}>
              <View style={s.lightboxBg}>
                <ZoomableImage
                  uri={imageUrl}
                  width={screenWidth}
                  height={screenHeight * 0.8}
                  onClose={() => setShowLightbox(false)}
                  onLongPress={onLightboxLongPress}
                />
                <Text style={s.lightboxClose}>✕ tap to close · pinch to zoom · hold to save</Text>
              </View>
            </Modal>
          </View>
        ) : null}

        {(!post.content_warning || twExpanded) && post.link_url && !imageUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(post.link_url)} activeOpacity={0.8}
            style={[s.linkPreview, { borderColor: c.border }]}>
            {linkImage ? <Image source={{ uri: linkImage }} style={{ height: 140, width: '100%' }} contentFit="cover" /> : null}
            <View style={{ padding: 10 }}>
              <Text style={[s.linkDomain, { color: c.textMuted }]}>{post.link_domain}</Text>
              {post.link_title ? <Text style={[s.linkTitle, { color: c.text }]}>{post.link_title}</Text> : null}
              {post.link_description ? <Text style={[s.linkDesc, { color: c.textMuted }]} numberOfLines={2}>{post.link_description}</Text> : null}
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Poll */}
        {post.poll_options && post.poll_options.length >= 2 && (
          <PollWidget post={post} onRefresh={invalidate} />
        )}

        {totalReactions > 0 && (
          <View style={s.reactionCounts}>
            {Object.entries(reactionCounts).filter(([,v]) => v > 0).map(([type, count]) => {
              const emoji = REACTIONS.find(r => r.type === type)?.emoji ?? '❤️'
              const isActive = post.my_reaction === type
              return (
                <TouchableOpacity key={type} onPress={() => react.mutate({ type })}
                  style={[s.chip, { borderColor: isActive ? c.primaryLt : c.border, backgroundColor: isActive ? c.primaryBg : c.bg }]}>
                  <Text style={{ fontSize: 12 }}>{emoji}</Text>
                  <Text style={[s.chipCount, { color: isActive ? c.primary : c.textMuted }]}>{count}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={[s.actions, { borderTopColor: c.border }]}>
          <View>
            <View style={s.actionBtn} {...panResponder.panHandlers}>
              <Text style={{ fontSize: 19 }}>{myReactionEmoji ?? '🤍'}</Text>
              {totalReactions > 0 && <Text style={[s.actionCount, { color: c.textMuted }]}>{totalReactions}</Text>}
            </View>
            {showReactions && (
              <View
                ref={pickerRef}
                onLayout={() => {
                  pickerRef.current?.measure((_x, _y, w, _h, pageX) => {
                    gestureState.current.pickerLayout = { x: pageX, width: w }
                  })
                }}
                style={[s.picker, { backgroundColor: c.card, borderColor: c.border }]}
              >
                {REACTIONS.map(r => (
                  <TouchableOpacity
                    key={r.type}
                    onPress={() => { react.mutate({ type: r.type }); setShowReactions(false); setHoveredReaction(null) }}
                    style={[
                      s.pickerItem,
                      (post.my_reaction === r.type || hoveredReaction === r.type) && { backgroundColor: c.primaryBg },
                      hoveredReaction === r.type && { transform: [{ scale: 1.25 }] },
                    ]}
                  >
                    <Text style={{ fontSize: 28 }}>{r.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/post/${post.id}`)}>
            <Ionicons name="chatbubble-outline" size={17} color={c.textMuted} />
            {post.comment_count > 0 && <Text style={[s.actionCount, { color: c.textMuted }]}>{post.comment_count}</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => post.visibility === 'public' ? setShowShare(true) : Alert.alert('Cannot share', 'Friends-only posts cannot be shared.')}
          >
            <Ionicons name="repeat" size={17} color={post.reposted ? c.primary : post.visibility !== 'public' ? c.border : c.textMuted} />
            {post.repost_count > 0 && <Text style={[s.actionCount, { color: post.reposted ? c.primary : c.textMuted }]}>{post.repost_count}</Text>}
          </TouchableOpacity>

        </View>
      </View>

      {/* ── Three-dots menu ───────────────────────────────────────── */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[s.menuSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            {isOwn ? (
              <>
                <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); setEditContent(post.content || ''); setEditCW(post.content_warning || ''); setShowEditCW(!!post.content_warning); setEditVisibility(post.visibility === 'locked' ? 'group' : (post.visibility || 'friends')); setEditFriendListId(post.group_id || ''); setShowEditVisibilitySheet(false); setShowEditListSheet(false); setShowEdit(true) }}>
                  <Ionicons name="pencil-outline" size={18} color={c.text} />
                  <Text style={[s.menuItemText, { color: c.text }]}>Edit post</Text>
                </TouchableOpacity>
                <View style={[s.menuDivider, { backgroundColor: c.border }]} />
                <TouchableOpacity style={s.menuItem} onPress={() => {
                  setShowMenu(false)
                  Alert.alert('Delete post?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
                  ])
                }}>
                  <Ionicons name="trash-outline" size={18} color={c.red} />
                  <Text style={[s.menuItemText, { color: c.red }]}>Delete post</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={s.menuItem} onPress={() => {
                  setShowMenu(false)
                  router.push({ pathname: '/report', params: { postId: post.id } } as any)
                }}>
                  <Ionicons name="flag-outline" size={18} color={c.red} />
                  <Text style={[s.menuItemText, { color: c.red }]}>Report post</Text>
                </TouchableOpacity>
                <View style={[s.menuDivider, { backgroundColor: c.border }]} />
                <TouchableOpacity style={s.menuItem} onPress={() => {
                  setShowMenu(false)
                  Alert.alert(
                    'Block user?',
                    `@${username} will be removed from your feed instantly and our team will be notified.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Block', style: 'destructive', onPress: () => blockUser.mutate() },
                    ]
                  )
                }}>
                  <Ionicons name="ban-outline" size={18} color={c.red} />
                  <Text style={[s.menuItemText, { color: c.red }]}>Block @{username}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit modal ────────────────────────────────────────────── */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEdit(false)}>
        <View style={[s.editModal, { backgroundColor: c.card }]}>
          <View style={[s.editHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={() => setShowEdit(false)}>
              <Text style={{ fontSize: 16, color: c.textMuted }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[s.editTitle, { color: c.text }]}>Edit post</Text>
            <TouchableOpacity
              onPress={() => edit.mutate()}
              disabled={!editContent.trim() || edit.isPending}
              style={[s.editSaveBtn, (!editContent.trim() || edit.isPending) && { backgroundColor: c.primaryLt }]}
            >
              <Text style={s.editSaveBtnText}>{edit.isPending ? '…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          {/* Audience row */}
          <TouchableOpacity
            onPress={() => setShowEditVisibilitySheet(v => !v)}
            style={[s.editAudienceRow, { borderBottomColor: c.border, backgroundColor: c.card }]}
          >
            <Ionicons
              name={editVisibility === 'public' ? 'globe-outline' : editVisibility === 'group' ? 'people-outline' : 'person-outline'}
              size={15}
              color={c.primary}
            />
            <Text style={[s.editAudienceLabel, { color: c.primary }]}>
              {editVisibility === 'public' ? 'Public' : editVisibility === 'group' ? (selectedEditFriendList?.name || 'Select a list…') : 'Friends'}
            </Text>
            <Ionicons name={showEditVisibilitySheet ? 'chevron-up' : 'chevron-down'} size={13} color={c.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {/* Inline visibility picker */}
          {showEditVisibilitySheet && (
            <View style={[s.editInlinePicker, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
              {[
                { value: 'public',  icon: 'globe-outline',  label: 'Public',      desc: 'Anyone on Agora' },
                { value: 'friends', icon: 'person-outline', label: 'Friends',     desc: 'Only your friends' },
                { value: 'group',   icon: 'people-outline', label: 'Friend List', desc: 'Pick a specific list' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    setEditVisibility(opt.value as any)
                    if (opt.value !== 'group') setEditFriendListId('')
                    setShowEditVisibilitySheet(false)
                    if (opt.value === 'group') setShowEditListSheet(true)
                  }}
                  style={[s.editInlineOption, { borderBottomColor: c.border, backgroundColor: editVisibility === opt.value ? c.primaryBg : 'transparent' }]}
                >
                  <Ionicons name={opt.icon as any} size={18} color={editVisibility === opt.value ? c.primary : c.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: editVisibility === opt.value ? c.primary : c.text }}>{opt.label}</Text>
                    <Text style={{ fontSize: 12, color: c.textMuted }}>{opt.desc}</Text>
                  </View>
                  {editVisibility === opt.value && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Inline group list picker */}
          {showEditListSheet && editVisibility === 'group' && (
            <View style={[s.editInlinePicker, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setShowEditListSheet(false)} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ fontSize: 12, color: c.textMuted }}>← Back to audience</Text>
              </TouchableOpacity>
              {editFriendLists.length === 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: c.textMuted, fontSize: 13, textAlign: 'center' }}>
                    No friend lists yet. Create one in the Friends tab.
                  </Text>
                </View>
              ) : (
                editFriendLists.map((g: any) => (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => { setEditFriendListId(g.id); setShowEditListSheet(false) }}
                    style={[s.editInlineOption, { borderBottomColor: c.border, backgroundColor: editFriendListId === g.id ? c.primaryBg : 'transparent' }]}
                  >
                    <Ionicons name="people-outline" size={18} color={editFriendListId === g.id ? c.primary : c.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: editFriendListId === g.id ? c.primary : c.text }}>{g.name}</Text>
                      <Text style={{ fontSize: 12, color: c.textMuted }}>{g.member_count ?? 0} friends</Text>
                    </View>
                    {editFriendListId === g.id && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <View style={{ padding: 16 }}>
            {showEditCW && (
              <View style={{ borderWidth: 1, borderColor: '#fcd34d', backgroundColor: '#fffbeb', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>⚠️ Trigger warning</Text>
                <TextInput
                  style={{ fontSize: 14, color: '#92400e', padding: 0 }}
                  value={editCW}
                  onChangeText={setEditCW}
                  placeholder="e.g. spoilers, violence…"
                  placeholderTextColor="#d97706"
                  returnKeyType="done"
                />
              </View>
            )}
            <TextInput
              style={[s.editInput, { color: c.text, borderColor: c.border }]}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              autoFocus
              placeholderTextColor={c.textLight}
              placeholder="What's on your mind?"
            />
            <TouchableOpacity
              onPress={() => setShowEditCW(v => !v)}
              style={[s.editCWBtn, { borderColor: showEditCW ? '#fcd34d' : c.border, backgroundColor: showEditCW ? '#fef3c7' : 'transparent' }]}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: showEditCW ? '#92400e' : c.textMuted }}>TW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Share modal ───────────────────────────────────────────── */}
      <Modal visible={showShare} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowShare(false)}>
        <View style={[s.editModal, { backgroundColor: c.card }]}>
          <View style={[s.editHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={() => { setShowShare(false); setShareContent('') }}>
              <Text style={{ fontSize: 16, color: c.textMuted }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[s.editTitle, { color: c.text }]}>Share post</Text>
            <TouchableOpacity
              onPress={() => repost.mutate()}
              disabled={repost.isPending}
              style={[s.editSaveBtn, repost.isPending && { backgroundColor: c.primaryLt }]}
            >
              <Text style={s.editSaveBtnText}>{repost.isPending ? '…' : 'Share'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <TextInput
              style={[s.editInput, { color: c.text, borderColor: c.border }]}
              value={shareContent}
              onChangeText={setShareContent}
              multiline
              autoFocus
              placeholderTextColor={c.textLight}
              placeholder="Say something about this… (optional)"
            />
            {/* Preview of post being shared */}
            <View style={[s.sharePreview, { borderColor: c.border, backgroundColor: c.bg }]}>
              <Text style={[s.sharePreviewAuthor, { color: c.text }]}>
                {post.author_display_name || post.author_username}
                <Text style={{ color: c.textMuted, fontWeight: '400' }}> @{post.author_username}</Text>
              </Text>
              {post.content ? <Text style={[s.sharePreviewContent, { color: c.textMd }]} numberOfLines={3}>{post.content}</Text> : null}
              {post.image_url ? <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>📷 Photo</Text> : null}
            </View>
            <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 8 }}>
              This will be shared with your friends.
            </Text>
          </View>
        </View>
      </Modal>

    </View>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 16, marginHorizontal: 12, marginVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2, overflow: 'hidden' },
  groupBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  groupBadgeText: { fontSize: 12, fontWeight: '600' },
  groupBadgeArrow: { fontSize: 11 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  bannerText: { fontSize: 12 },
  body: { padding: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  authorName: { fontWeight: '600', fontSize: 14 },
  pronouns:   { fontSize: 12, fontWeight: '400' },
  authorMeta: { fontSize: 12, marginTop: 1 },
  cw: { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  cwText: { fontSize: 12, color: '#92400e', fontWeight: '500' },
  content: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  imageWrapper: { marginHorizontal: -14, marginVertical: 8 },
  image: { width: '100%', aspectRatio: 1 },
  linkPreview: { marginTop: 8, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  linkDomain: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
  linkTitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  linkDesc: { fontSize: 12, marginTop: 2 },
  reactionCounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14, borderWidth: 1 },
  chipCount: { fontSize: 13 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 12 },
  picker: { position: 'absolute', bottom: 40, left: 0, borderWidth: 1, borderRadius: 24, padding: 8, flexDirection: 'row', gap: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10, zIndex: 99 },
  pickerItem: { borderRadius: 10, padding: 4 },
  pickerItemActive: { borderRadius: 10 },
  lightboxBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  lightboxClose: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 16 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menuSheet: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', minWidth: 220 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText: { fontSize: 16 },
  menuDivider: { height: 1 },
  editModal: { flex: 1 },
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1 },
  editTitle: { fontWeight: '600', fontSize: 16 },
  editSaveBtn: { backgroundColor: '#486581', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 6 },
  editSaveBtnText: { color: 'white', fontWeight: '600' },
  editInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 120, textAlignVertical: 'top', marginBottom: 12 },
  editCWBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  editAudienceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  editAudienceLabel: { fontSize: 13, fontWeight: '600' },
  editInlinePicker: { borderBottomWidth: 1 },
  editInlineOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sharePreview:        { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  sharePreviewAuthor:  { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  sharePreviewContent: { fontSize: 13, lineHeight: 19 },
})
