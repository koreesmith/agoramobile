import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet, Modal, Dimensions, Linking, TextInput, PanResponder, ScrollView, KeyboardAvoidingView } from 'react-native'
import { Image } from 'expo-image'
import { VideoView, useVideoPlayer } from 'expo-video'
import ZoomableImage from './ZoomableImage'
import AutoGrowInput from './AutoGrowInput'
import PollVotersModal from './PollVotersModal'
import { router } from 'expo-router'
import * as MediaLibrary from 'expo-media-library'
import * as FileSystem from 'expo-file-system'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { feedApi, imgUrl, blockApi, moderationApi, friendsApi, pagesApi } from '../api'
import { trackInteraction } from '../utils/interactions'
import { handle } from '../utils/handle'
import { useAuthStore } from '../store/auth'
import { useBlockStore } from '../store/blocks'
import { useToastStore } from '../store/toast'
import { Avatar, LinkedText } from './ui'
import { useC } from '../constants/ColorContext'
import ReactorsModal from './ReactorsModal'

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
  const [showVoters, setShowVoters] = useState(false)

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
  // AGORA-210: an inbound fediverse poll has no way to deliver a vote back
  // to the origin server, so voting locally would either do nothing real or
  // misrepresent the poll's actual tally — read-only here, same as an
  // expired poll, but with its own honest label rather than claiming it
  // "ended" when it may still be open on the source instance.
  const isRemote = !!post.is_remote
  const canVote = !isExpired && !isRemote

  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      {isExpired && (
        <Text style={{ fontSize: 12, color: c.textMuted }}>🔒 This poll has ended</Text>
      )}
      {!isExpired && isRemote && (
        <Text style={{ fontSize: 12, color: c.textMuted }}>📡 Results from the fediverse — voting happens on the original post</Text>
      )}
      {!isExpired && !isRemote && post.poll_expires_at && (
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
        const showResults = hasVoted || isExpired || isRemote

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

      {totalVotes > 0 && (
        <TouchableOpacity onPress={() => setShowVoters(true)}>
          <Text style={{ fontSize: 12, color: c.textMuted, textDecorationLine: 'underline' }}>
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </Text>
        </TouchableOpacity>
      )}
      <PollVotersModal postId={post.id} visible={showVoters} onClose={() => setShowVoters(false)} />

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
  const showToast = useToastStore(s => s.show)
  const qc = useQueryClient()
  const [showReactions, setShowReactions] = useState(false)
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null)
  const [pickerPosition, setPickerPosition] = useState<{ bottom: number; left: number } | null>(null)
  const pickerRef = useRef<View>(null)
  const wrapperRef = useRef<View>(null)
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
      gs.timer = setTimeout(() => {
        gs.isPicking = true
        wrapperRef.current?.measure((_x, _y, _w, h, pageX, pageY) => {
          const sh = Dimensions.get('window').height
          setPickerPosition({ bottom: sh - pageY - h + 40, left: pageX })
          setShowReactions(true)
        })
      }, 400)
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
  const [showReactors, setShowReactors] = useState(false)
  const [reactorsTab, setReactorsTab] = useState('all')
  const [twExpanded, setTwExpanded] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareContent, setShareContent] = useState('')
  const [shareVisibility, setShareVisibility] = useState<'public'|'friends'|'group'>('friends')
  const [shareFriendListId, setShareFriendListId] = useState('')
  const [showShareVisibilitySheet, setShowShareVisibilitySheet] = useState(false)
  const [showShareListSheet, setShowShareListSheet] = useState(false)
  const [showShareCW, setShowShareCW] = useState(false)
  const [shareCW, setShareCW] = useState('')
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
    enabled: showEdit || showShare,
  })
  const editFriendLists: any[] = friendListsData?.groups || []
  const selectedEditFriendList = editFriendLists.find((g: any) => g.id === editFriendListId)
  const selectedShareFriendList = editFriendLists.find((g: any) => g.id === shareFriendListId)

  const invalidate = () => qc.invalidateQueries({ queryKey })

  const react = useMutation({
    mutationFn: ({ type }: { type: string }) =>
      post.my_reaction === type ? feedApi.unreactPost(post.id) : feedApi.reactPost(post.id, type),
    onSuccess: (_data, vars) => {
      if (post.my_reaction !== vars.type) trackInteraction('like', post.id)
      invalidate()
    },
  })
  reactMutateRef.current = (vars) => react.mutate(vars)

  const repost = useMutation({
    mutationFn: () => feedApi.repostPost(post.id, {
      content: shareContent,
      visibility: shareVisibility,
      group_id: shareVisibility === 'group' ? shareFriendListId : undefined,
      content_warning: showShareCW && shareCW.trim() ? shareCW.trim() : '',
    }),
    onSuccess: () => {
      closeShareModal(); trackInteraction('repost', post.id); invalidate()
      showToast('Shared!')
    },
    onError: (e: any) => showToast(e.response?.data?.error || 'Could not share post', 'error'),
  })

  const closeShareModal = () => {
    setShowShare(false); setShareContent('')
    setShareVisibility('friends'); setShareFriendListId('')
    setShowShareVisibilitySheet(false); setShowShareListSheet(false)
    setShowShareCW(false); setShareCW('')
  }
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

  const commentMutation = useMutation({
    mutationFn: () => feedApi.createComment(post.id, { content: inlineComment.trim() }),
    onSuccess: () => { setInlineComment(''); trackInteraction('comment', post.id); invalidate() },
    onError: () => Alert.alert('Error', 'Could not post comment'),
  })
  const submitInlineComment = () => {
    if (!inlineComment.trim() || commentMutation.isPending) return
    commentMutation.mutate()
  }

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
  // Page posts: use page identity for author display
  const isPagePost = !!post.page_id && !post.repost_of_id
  // Author row always identifies whoever made *this* post — for a repost, that's
  // the person sharing it, not the original author (shown in the nested quote card below).
  const author   = isPagePost ? post.page_display_name : (post.author_display_name || post.display_name)
  const pronouns = isPagePost ? undefined : post.author_pronouns
  const username = isPagePost ? post.page_slug : (post.author_username || post.username)
  const avatar   = imgUrl(isPagePost ? post.page_avatar_url : (post.author_avatar_url || post.avatar_url))
  const content  = post.content

  const subscribePageMutation = useMutation({
    mutationFn: () => post.page_is_subscribed
      ? pagesApi.unsubscribe(post.page_slug)
      : pagesApi.subscribe(post.page_slug),
    onSuccess: invalidate,
  })
  const linkImage = imgUrl(post.link_image)

  // Normalize image URLs: prefer photo_urls array (AGORA-93), fall back to single image_url
  const rawImageUrls: string[] = post.photo_urls?.length ? post.photo_urls : post.image_url ? [post.image_url] : []
  const postImageUrls = rawImageUrls.map((u: string) => imgUrl(u)).filter(Boolean) as string[]
  const imageUrl = postImageUrls[0]

  const [videoPlaying, setVideoPlaying] = useState(false)
  const videoSource = post.video_url ? imgUrl(post.video_url) ?? null : null
  const videoPlayer = useVideoPlayer(videoSource, p => { p.loop = false })
  useEffect(() => {
    videoPlayer.muted = !videoPlaying
    if (videoPlaying) videoPlayer.play()
    else videoPlayer.pause()
  }, [videoPlaying, videoPlayer])
  const [inlineComment, setInlineComment] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [showLightbox, setShowLightbox] = useState(false)
  const screenWidth = Dimensions.get('window').width
  const screenHeight = Dimensions.get('window').height

  const openLightbox = (index: number) => { setLightboxIndex(index); setShowLightbox(true) }

  const saveImageToLibrary = async (url: string) => {
    const { status } = await MediaLibrary.requestPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to save images.')
      return
    }
    try {
      const filename = url.split('/').pop() || 'image.jpg'
      const localUri = FileSystem.cacheDirectory + filename
      await FileSystem.downloadAsync(url, localUri)
      await MediaLibrary.saveToLibraryAsync(localUri)
      Alert.alert('Saved', 'Image saved to your photo library.')
    } catch {
      Alert.alert('Error', 'Could not save the image.')
    }
  }

  const onLightboxLongPress = () => {
    const url = postImageUrls[lightboxIndex]
    Alert.alert('Save image', 'Save this image to your photo library?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: () => saveImageToLibrary(url) },
    ])
  }
  const reactionCounts: Record<string, number> = post.reaction_counts || {}
  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0)
  const myReactionEmoji = REACTIONS.find(r => r.type === post.my_reaction)?.emoji

  return (
    <View style={[s.card, { backgroundColor: c.card }, post.group_slug && { borderLeftWidth: 3, borderLeftColor: c.primaryLt }]}>
      {/* Group badge */}
      {/* Page badge */}
      {isPagePost && (
        <TouchableOpacity
          onPress={() => router.push(`/pages/${post.page_slug}` as any)}
          style={[s.groupBadge, { backgroundColor: c.primaryBg }]}
        >
          <Ionicons name="bookmark" size={11} color={c.primary} />
          <Text style={[s.groupBadgeText, { color: c.primary }]}>{post.page_display_name}</Text>
          {post.page_is_verified && <Ionicons name="checkmark-circle" size={12} color={c.primary} />}
          <Text style={[s.groupBadgeArrow, { color: c.textLight }]}>
            · {post.page_type ? post.page_type.charAt(0).toUpperCase() + post.page_type.slice(1) : 'Page'}
          </Text>
        </TouchableOpacity>
      )}
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
          <Text style={[s.bannerText, { color: c.primary }]}>Reposted</Text>
        </View>
      )}
      {post.wall_user_id && (
        <View style={s.banner}>
          <Ionicons name="arrow-forward" size={13} color={c.primary} />
          <Text style={[s.bannerText, { color: c.primary }]}>{post.author_display_name} to {post.wall_display_name}'s wall</Text>
        </View>
      )}

      <View style={s.body}>
        <TouchableOpacity
          style={s.authorRow}
          onPress={() => isPagePost
            ? router.push(`/pages/${post.page_slug}` as any)
            : router.push(`/profile/${username}`)
          }
        >
          <Avatar url={avatar} name={author} size={40} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
              <Text style={[s.authorName, { color: c.text }]}>{author}</Text>
              {post.page_is_verified && isPagePost && (
                <Ionicons name="checkmark-circle" size={14} color={c.primary} />
              )}
              {pronouns ? <Text style={[s.pronouns, { color: c.textLight }]}>({pronouns})</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[s.authorMeta, { color: c.textMuted }]}>
                {isPagePost ? post.page_type || 'Page' : handle(username, post.is_remote, post.remote_instance)} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </Text>
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
          <LinkedText text={content} style={[s.content, { color: c.textMd }]} />
        ) : null}

        {/* Quoted post — the original post being shared, nested so it reads as quoted material rather than the reposter's own words */}
        {(!post.content_warning || twExpanded) && post.repost_of_id ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/post/${post.repost_of_id}` as any)}
            style={[s.quotedPost, { borderColor: c.border }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
              <Avatar url={post.repost_author_avatar_url} name={post.repost_author_display_name} size={22} />
              <Text style={[s.quotedAuthorName, { color: c.text }]}>
                {post.repost_author_display_name || post.repost_author_username}
              </Text>
              {post.repost_author_pronouns ? (
                <Text style={[s.pronouns, { color: c.textLight }]}>({post.repost_author_pronouns})</Text>
              ) : null}
              <Text style={[s.quotedAuthorMeta, { color: c.textMuted }]}>{handle(post.repost_author_username)}</Text>
            </View>
            {post.repost_content ? (
              <LinkedText text={post.repost_content} style={[s.quotedContent, { color: c.textMd }]} />
            ) : null}
            {post.repost_image_url ? (
              <Image source={{ uri: imgUrl(post.repost_image_url) }} style={s.quotedImage} contentFit="cover" />
            ) : null}
            {/* AGORA-252: the quoted post's own link preview — e.g. a
                Bluesky quote of a link-only news article has no
                repost_image_url, only this. */}
            {post.repost_link_url ? (
              <TouchableOpacity onPress={() => Linking.openURL(post.repost_link_url!)} activeOpacity={0.8}
                style={[s.quotedLinkPreview, { borderColor: c.border }]}>
                {post.repost_link_image ? (
                  <Image source={{ uri: imgUrl(post.repost_link_image) }} style={s.quotedLinkImage} contentFit="cover" />
                ) : null}
                <View style={{ flex: 1, padding: 8 }}>
                  <Text style={[s.linkDomain, { color: c.textMuted }]}>{post.repost_link_domain}</Text>
                  {post.repost_link_title ? (
                    <Text style={[s.linkTitle, { color: c.text }]} numberOfLines={2}>{post.repost_link_title}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        ) : null}

        {(!post.content_warning || twExpanded) && post.video_url && postImageUrls.length === 0 ? (
          <View style={[s.imageWrapper, { position: 'relative' }]}>
            <VideoView
              player={videoPlayer}
              style={[s.image, { backgroundColor: '#000' }]}
              contentFit="contain"
              nativeControls={videoPlaying}
            />
            {!videoPlaying && (
              <>
                {post.video_thumb_url ? (
                  <Image
                    source={{ uri: imgUrl(post.video_thumb_url) }}
                    style={[s.image, StyleSheet.absoluteFill]}
                    contentFit="cover"
                  />
                ) : null}
                <TouchableOpacity
                  onPress={() => setVideoPlaying(true)}
                  style={s.playBtn}
                >
                  <Ionicons name="play-circle" size={52} color="rgba(255,255,255,0.9)" />
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {(!post.content_warning || twExpanded) && postImageUrls.length > 0 ? (
          <View style={s.imageWrapper}>
            {postImageUrls.length === 1 ? (
              <TouchableOpacity onPress={() => openLightbox(0)} activeOpacity={0.9}>
                <Image source={{ uri: postImageUrls[0] }} style={s.image} contentFit="cover" />
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 2 }}
              >
                {postImageUrls.map((url, i) => (
                  <TouchableOpacity key={i} onPress={() => openLightbox(i)} activeOpacity={0.9}>
                    <Image source={{ uri: url }} style={s.imageMulti} contentFit="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Modal visible={showLightbox} transparent animationType="fade" onRequestClose={() => setShowLightbox(false)}>
              <View style={s.lightboxBg}>
                <ZoomableImage
                  uri={postImageUrls[lightboxIndex]}
                  width={screenWidth}
                  height={screenHeight * 0.8}
                  onClose={() => setShowLightbox(false)}
                  onLongPress={onLightboxLongPress}
                />
                {postImageUrls.length > 1 && (
                  <View style={s.lightboxNav}>
                    <TouchableOpacity
                      onPress={() => setLightboxIndex(i => Math.max(0, i - 1))}
                      disabled={lightboxIndex === 0}
                      style={[s.lightboxNavBtn, lightboxIndex === 0 && { opacity: 0.3 }]}
                    >
                      <Text style={s.lightboxNavText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={s.lightboxCounter}>{lightboxIndex + 1} / {postImageUrls.length}</Text>
                    <TouchableOpacity
                      onPress={() => setLightboxIndex(i => Math.min(postImageUrls.length - 1, i + 1))}
                      disabled={lightboxIndex === postImageUrls.length - 1}
                      style={[s.lightboxNavBtn, lightboxIndex === postImageUrls.length - 1 && { opacity: 0.3 }]}
                    >
                      <Text style={s.lightboxNavText}>›</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
                <TouchableOpacity key={type} onPress={() => { setReactorsTab(type); setShowReactors(true) }}
                  style={[s.chip, { borderColor: isActive ? c.primaryLt : c.border, backgroundColor: isActive ? c.primaryBg : c.bg }]}>
                  <Text style={{ fontSize: 12 }}>{emoji}</Text>
                  <Text style={[s.chipCount, { color: isActive ? c.primary : c.textMuted }]}>{count}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={[s.actions, { borderTopColor: c.border }]}>
          <View ref={wrapperRef}>
            <View style={s.actionBtn} {...panResponder.panHandlers}>
              <Text style={{ fontSize: 19 }}>{myReactionEmoji ?? '🤍'}</Text>
              {totalReactions > 0 && <Text style={[s.actionCount, { color: c.textMuted }]}>{totalReactions}</Text>}
            </View>
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

        {/* Inline comment box */}
        <View style={[s.inlineComment, { borderTopColor: c.border }]}>
          <Avatar url={imgUrl(user?.avatar_url)} name={user?.display_name} size={28} />
          <AutoGrowInput
            minHeight={32}
            maxHeight={80}
            style={[s.inlineCommentInput, { color: c.text, borderColor: c.border }]}
            placeholder="Write a comment…"
            placeholderTextColor={c.textLight}
            value={inlineComment}
            onChangeText={setInlineComment}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={submitInlineComment}
          />
          {inlineComment.trim().length > 0 && (
            <TouchableOpacity onPress={submitInlineComment} disabled={commentMutation.isPending}>
              <Ionicons name="send" size={18} color={commentMutation.isPending ? c.textLight : c.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Three-dots menu ───────────────────────────────────────── */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[s.menuSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            {isPagePost && (
              <>
                <TouchableOpacity style={s.menuItem} onPress={() => {
                  setShowMenu(false)
                  subscribePageMutation.mutate()
                }}>
                  <Ionicons name={post.page_is_subscribed ? 'bookmark' : 'bookmark-outline'} size={18} color={c.primary} />
                  <Text style={[s.menuItemText, { color: c.primary }]}>
                    {post.page_is_subscribed ? 'Unsubscribe from page' : 'Subscribe to page'}
                  </Text>
                </TouchableOpacity>
                <View style={[s.menuDivider, { backgroundColor: c.border }]} />
              </>
            )}
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
      <Modal visible={showShare} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeShareModal}>
        <View style={[s.editModal, { backgroundColor: c.card }]}>
          <View style={[s.editHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={closeShareModal}>
              <Text style={{ fontSize: 16, color: c.textMuted }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[s.editTitle, { color: c.text }]}>Share post</Text>
            <TouchableOpacity
              onPress={() => repost.mutate()}
              disabled={repost.isPending || (shareVisibility === 'group' && !shareFriendListId) || (showShareCW && !shareCW.trim())}
              style={[s.editSaveBtn, (repost.isPending || (shareVisibility === 'group' && !shareFriendListId) || (showShareCW && !shareCW.trim())) && { backgroundColor: c.primaryLt }]}
            >
              <Text style={s.editSaveBtnText}>{repost.isPending ? '…' : 'Share'}</Text>
            </TouchableOpacity>
          </View>

          {/* AGORA-226: audience row, mirroring the edit modal's own */}
          <TouchableOpacity
            onPress={() => setShowShareVisibilitySheet(v => !v)}
            style={[s.editAudienceRow, { borderBottomColor: c.border, backgroundColor: c.card }]}
          >
            <Ionicons
              name={shareVisibility === 'public' ? 'globe-outline' : shareVisibility === 'group' ? 'people-outline' : 'person-outline'}
              size={15}
              color={c.primary}
            />
            <Text style={[s.editAudienceLabel, { color: c.primary }]}>
              {shareVisibility === 'public' ? 'Public' : shareVisibility === 'group' ? (selectedShareFriendList?.name || 'Select a list…') : 'Friends'}
            </Text>
            <Ionicons name={showShareVisibilitySheet ? 'chevron-up' : 'chevron-down'} size={13} color={c.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {showShareVisibilitySheet && (
            <View style={[s.editInlinePicker, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
              {[
                { value: 'public',  icon: 'globe-outline',  label: 'Public',      desc: 'Anyone on Agora' },
                { value: 'friends', icon: 'person-outline', label: 'Friends',     desc: 'Only your friends' },
                { value: 'group',   icon: 'people-outline', label: 'Friend List', desc: 'Pick a specific list' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    setShareVisibility(opt.value as any)
                    if (opt.value !== 'group') setShareFriendListId('')
                    setShowShareVisibilitySheet(false)
                    if (opt.value === 'group') setShowShareListSheet(true)
                  }}
                  style={[s.editInlineOption, { borderBottomColor: c.border, backgroundColor: shareVisibility === opt.value ? c.primaryBg : 'transparent' }]}
                >
                  <Ionicons name={opt.icon as any} size={18} color={shareVisibility === opt.value ? c.primary : c.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: shareVisibility === opt.value ? c.primary : c.text }}>{opt.label}</Text>
                    <Text style={{ fontSize: 12, color: c.textMuted }}>{opt.desc}</Text>
                  </View>
                  {shareVisibility === opt.value && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showShareListSheet && shareVisibility === 'group' && (
            <View style={[s.editInlinePicker, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setShowShareListSheet(false)} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
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
                    onPress={() => { setShareFriendListId(g.id); setShowShareListSheet(false) }}
                    style={[s.editInlineOption, { borderBottomColor: c.border, backgroundColor: shareFriendListId === g.id ? c.primaryBg : 'transparent' }]}
                  >
                    <Ionicons name="people-outline" size={18} color={shareFriendListId === g.id ? c.primary : c.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: shareFriendListId === g.id ? c.primary : c.text }}>{g.name}</Text>
                      <Text style={{ fontSize: 12, color: c.textMuted }}>{g.member_count ?? 0} friends</Text>
                    </View>
                    {shareFriendListId === g.id && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <View style={{ padding: 16 }}>
            {/* AGORA-225: trigger warning for the sharer's own commentary */}
            {showShareCW && (
              <View style={{ borderWidth: 1, borderColor: '#fcd34d', backgroundColor: '#fffbeb', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>⚠️ Trigger warning</Text>
                <TextInput
                  style={{ fontSize: 14, color: '#92400e', padding: 0 }}
                  value={shareCW}
                  onChangeText={setShareCW}
                  placeholder="e.g. spoilers, violence…"
                  placeholderTextColor="#d97706"
                  returnKeyType="done"
                />
              </View>
            )}
            <TextInput
              style={[s.editInput, { color: c.text, borderColor: c.border }]}
              value={shareContent}
              onChangeText={setShareContent}
              multiline
              autoFocus
              placeholderTextColor={c.textLight}
              placeholder="Say something about this… (optional)"
            />
            <TouchableOpacity
              onPress={() => setShowShareCW(v => !v)}
              style={[s.editCWBtn, { borderColor: showShareCW ? '#fcd34d' : c.border, backgroundColor: showShareCW ? '#fef3c7' : 'transparent' }]}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: showShareCW ? '#92400e' : c.textMuted }}>TW</Text>
            </TouchableOpacity>
            {/* Preview of post being shared */}
            <View style={[s.sharePreview, { borderColor: c.border, backgroundColor: c.bg }]}>
              <Text style={[s.sharePreviewAuthor, { color: c.text }]}>
                {post.author_display_name || post.author_username}
                <Text style={{ color: c.textMuted, fontWeight: '400' }}> {handle(post.author_username, post.is_remote, post.remote_instance)}</Text>
              </Text>
              {post.content ? <Text style={[s.sharePreviewContent, { color: c.textMd }]} numberOfLines={3}>{post.content}</Text> : null}
              {(post.photo_urls?.length > 1 ? true : post.image_url) ? (
                <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>
                  📷 {post.photo_urls?.length > 1 ? `${post.photo_urls.length} photos` : 'Photo'}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reactors modal ───────────────────────────────────────── */}
      <ReactorsModal
        postId={post.id}
        visible={showReactors}
        onClose={() => setShowReactors(false)}
        initialTab={reactorsTab}
      />

      {/* ── Reaction picker modal ─────────────────────────────────── */}
      <Modal visible={showReactions} transparent animationType="none" onRequestClose={() => { setShowReactions(false); setHoveredReaction(null) }}>
        <View style={{ flex: 1 }} pointerEvents="box-none">
          {pickerPosition && (
            <View
              ref={pickerRef}
              onLayout={() => {
                pickerRef.current?.measure((_x, _y, w, _h, pageX) => {
                  gestureState.current.pickerLayout = { x: pageX, width: w }
                })
              }}
              style={[s.pickerModal, { backgroundColor: c.card, borderColor: c.border, bottom: pickerPosition.bottom, left: pickerPosition.left }]}
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
                  <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  quotedPost: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  quotedAuthorName: { fontWeight: '600', fontSize: 13 },
  quotedAuthorMeta: { fontSize: 12 },
  quotedContent: { fontSize: 13, lineHeight: 19 },
  quotedImage: { width: '100%', aspectRatio: 1.4, borderRadius: 8, marginTop: 6 },
  quotedLinkPreview: { flexDirection: 'row', marginTop: 6, borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  quotedLinkImage: { width: 56, height: 56 },
  imageWrapper: { marginHorizontal: -14, marginVertical: 8 },
  image: { width: '100%', aspectRatio: 1 },
  imageMulti: { width: Dimensions.get('window').width * 0.72, aspectRatio: 1 },
  lightboxNav: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 12 },
  lightboxNavBtn: { padding: 8 },
  lightboxNavText: { color: 'white', fontSize: 36, lineHeight: 40 },
  lightboxCounter: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
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
  pickerModal: { position: 'absolute', borderWidth: 1, borderRadius: 24, padding: 8, flexDirection: 'row', gap: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  pickerItem: { borderRadius: 10, padding: 3 },
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
  playBtn: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  inlineComment: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth },
  inlineCommentInput: { flex: 1, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, maxHeight: 80 },
})
