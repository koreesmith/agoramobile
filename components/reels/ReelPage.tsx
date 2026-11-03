import { memo, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, Modal, TextInput, Alert, Animated, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMutation } from '@tanstack/react-query'
import { formatDistanceToNowStrict } from 'date-fns'
import { feedApi, bookmarksApi, hiddenPostsApi, blockApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useBlockStore } from '../../store/blocks'
import { useToastStore } from '../../store/toast'
import { useReelsStore } from '../../store/reels'
import { Avatar, LinkedText, renderName } from '../ui'
import { isShareable, sharePost } from '../../utils/share'
import { handle } from '../../utils/handle'
import { reactionDisplay } from '../../utils/reactions'
import ReelPlayer from './ReelPlayer'

// AGORA-442: one full-screen reel. The picture (a poster, plus a real player
// while this is the reel on screen or the one either side), the author and
// caption bottom left, and the actions down the right, the same ones a post has.

interface Props {
  post: any
  width: number
  height: number
  active: boolean     // the reel on screen
  near: boolean       // within one of it: mount a real player
  playAllowed: boolean // the screen is focused and the app is in front
  onViewed: (id: string) => void
  onRemove: (id: string, blockedAuthorId?: string) => void
}

const VIEWED_AFTER_MS = 3000
const DOUBLE_TAP_MS = 280

function networkLabel(post: any): string {
  if (!post.is_remote) return ''
  return post.remote_instance === 'bsky.app' ? 'Bluesky' : (post.remote_instance || 'Fediverse')
}

function ReelPage({ post, width, height, active, near, playAllowed, onViewed, onRemove }: Props) {
  const { instanceUrl, user } = useAuthStore()
  const { addBlock } = useBlockStore()
  const showToast = useToastStore((s) => s.show)
  const muted = useReelsStore((s) => s.muted)
  const setMuted = useReelsStore((s) => s.setMuted)

  const [firstFrame, setFirstFrame] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cwShown, setCwShown] = useState(false)
  const [captionOpen, setCaptionOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [repostOpen, setRepostOpen] = useState(false)

  const isOwn = user?.id === post.author_id
  const cwOk = !post.content_warning || cwShown
  const source = post.video_url ? imgUrl(post.video_url) ?? null : null
  const thumb = post.video_thumb_url ? imgUrl(post.video_thumb_url) : undefined

  // A reel that leaves the player window forgets what its player had shown.
  useEffect(() => {
    if (!near) { setFirstFrame(false); setIsPlaying(false); setProgress(0); setUserPaused(false) }
  }, [near])
  useEffect(() => { if (!active) setUserPaused(false) }, [active])

  // Fill the screen when the video is close to its shape, otherwise show all of
  // it: a 9:16 clip on a tall phone fills the page, a landscape one letterboxes.
  const ratio = post.video_width > 0 && post.video_height > 0 ? post.video_width / post.video_height : 0
  const fit: 'cover' | 'contain' = ratio > 0 && Math.abs(Math.log(ratio / (width / height))) < 0.2 ? 'cover' : 'contain'

  const shouldPlay = active && playAllowed && cwOk && !userPaused && !failed

  // Count it as watched after a few seconds of actual playback.
  useEffect(() => {
    if (!active || !isPlaying || !firstFrame) return
    const t = setTimeout(() => onViewed(post.id), VIEWED_AFTER_MS)
    return () => clearTimeout(t)
  }, [active, isPlaying, firstFrame, post.id, onViewed])

  // ── Actions, the same endpoints PostCard uses ──────────────────────────────
  const [myReaction, setMyReaction] = useState<string>(post.my_reaction || (post.liked ? 'like' : ''))
  const [reactionCount, setReactionCount] = useState<number>(post.reaction_count || post.like_count || 0)
  const react = useMutation({
    mutationFn: (type: string | null) => type ? feedApi.reactPost(post.id, type) : feedApi.unreactPost(post.id),
    onError: () => showToast('Could not update your reaction', 'error'),
  })
  const like = () => {
    if (myReaction) { setMyReaction(''); setReactionCount((n) => Math.max(0, n - 1)); react.mutate(null) }
    else { setMyReaction('like'); setReactionCount((n) => n + 1); react.mutate('like') }
  }

  // Double-tap only ever likes, never unlikes, like everywhere else it exists.
  const burst = useRef(new Animated.Value(0)).current
  const likeByDoubleTap = () => {
    if (!myReaction) { setMyReaction('like'); setReactionCount((n) => n + 1); react.mutate('like') }
    burst.setValue(0)
    Animated.sequence([
      Animated.timing(burst, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(250),
      Animated.timing(burst, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start()
  }

  const lastTap = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTap = () => {
    if (!cwOk || failed) return
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0
      if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null }
      likeByDoubleTap()
      return
    }
    lastTap.current = now
    tapTimer.current = setTimeout(() => { tapTimer.current = null; setUserPaused((p) => !p) }, DOUBLE_TAP_MS)
  }
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current) }, [])

  const [bookmarked, setBookmarked] = useState(!!post.bookmarked)
  const toggleBookmark = useMutation({
    mutationFn: (save: boolean) => save ? bookmarksApi.add(post.id) : bookmarksApi.remove(post.id),
    onMutate: (save: boolean) => setBookmarked(save),
    onError: (e: any, save: boolean) => {
      setBookmarked(!save)
      showToast(e.response?.data?.error || 'Could not update your bookmark', 'error')
    },
  })

  const hide = useMutation({
    mutationFn: () => hiddenPostsApi.hide(post.id),
    onSuccess: () => onRemove(post.id),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not hide post'),
  })
  const block = useMutation({
    // The server blocks by username.
    mutationFn: () => blockApi.blockUser(post.author_username),
    onSuccess: () => { addBlock(post.author_id); onRemove(post.id, post.author_id) },
    onError: () => Alert.alert('Error', 'Could not block user. Please try again.'),
  })

  const [repostText, setRepostText] = useState('')
  const [repostVisibility, setRepostVisibility] = useState<'friends' | 'public'>('friends')
  const repost = useMutation({
    mutationFn: () => feedApi.repostPost(post.id, { content: repostText, visibility: repostVisibility }),
    onSuccess: () => { setRepostOpen(false); setRepostText(''); showToast('Reposted!') },
    onError: (e: any) => showToast(e.response?.data?.error || 'Could not repost', 'error'),
  })

  const name = post.author_display_name || post.author_username
  const network = networkLabel(post)
  const who = handle(post.author_username, post.is_remote, post.remote_instance)

  const pill = { backgroundColor: 'rgba(0,0,0,0.4)' }

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* Picture: the poster until frames are showing, then the player */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap}
        accessibilityRole="button" accessibilityLabel={userPaused ? 'Play' : 'Pause'}>
        {thumb && !firstFrame ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="contain" />
        ) : null}
        {near && cwOk && source && !failed ? (
          <ReelPlayer
            source={source}
            shouldPlay={shouldPlay}
            rewind={!active}
            muted={muted}
            fit={fit}
            onFirstFrame={() => setFirstFrame(true)}
            onPlayingChange={setIsPlaying}
            onProgress={setProgress}
            onError={() => setFailed(true)}
          />
        ) : null}
        {active && userPaused && cwOk && !failed ? (
          <View style={s.centered} pointerEvents="none">
            <View style={s.playBadge}><Ionicons name="play" size={34} color="#fff" /></View>
          </View>
        ) : null}
        <Animated.View style={[s.centered, { opacity: burst, transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) }] }]} pointerEvents="none">
          <Ionicons name="thumbs-up" size={96} color="#fff" />
        </Animated.View>
      </Pressable>

      {/* Content warning gate */}
      {post.content_warning && !cwShown ? (
        <View style={[StyleSheet.absoluteFill, s.gate]}>
          <Ionicons name="warning-outline" size={30} color="#fbbf24" />
          <Text style={s.gateTitle}>Trigger Warning</Text>
          <Text style={s.gateBody}>{post.content_warning}</Text>
          <TouchableOpacity onPress={() => setCwShown(true)} style={s.gateBtn} accessibilityRole="button">
            <Text style={s.gateBtnText}>Show reel</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {failed ? (
        <View style={[StyleSheet.absoluteFill, s.gate]}>
          <Text style={s.gateTitle}>Couldn't play this video</Text>
          <Text style={s.gateBody}>It may have been removed, or the server it lives on isn't reachable.</Text>
          <TouchableOpacity onPress={() => router.push(`/post/${post.id}` as any)} style={s.gateBtn}>
            <Text style={s.gateBtnText}>Open the post</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Shading so the text reads over any video */}
      <View style={s.shade} pointerEvents="none" />

      {/* Right rail */}
      <View style={s.rail} pointerEvents="box-none">
        <TouchableOpacity onPress={() => setMuted(!muted)} style={s.railBtn} accessibilityRole="button"
          accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}>
          <View style={[s.round, pill]}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" /></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={like} style={s.railBtn} accessibilityRole="button"
          accessibilityState={{ selected: !!myReaction }} accessibilityLabel={myReaction ? 'Remove reaction' : 'Like'}>
          <View style={[s.round, pill]}>
            {myReaction ? <Text style={{ fontSize: 20 }}>{reactionDisplay(myReaction).emoji}</Text> : <Ionicons name="thumbs-up-outline" size={20} color="#fff" />}
          </View>
          <Text style={s.railCount}>{reactionCount || ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(`/post/${post.id}` as any)} style={s.railBtn} accessibilityRole="button"
          accessibilityLabel={`Comments, ${post.comment_count || 0}`}>
          <View style={[s.round, pill]}><Ionicons name="chatbubble-outline" size={20} color="#fff" /></View>
          <Text style={s.railCount}>{post.comment_count || ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => post.visibility === 'public' && setRepostOpen(true)} disabled={post.visibility !== 'public'}
          style={[s.railBtn, post.visibility !== 'public' && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Repost">
          <View style={[s.round, pill]}><Ionicons name="repeat" size={22} color="#fff" /></View>
          <Text style={s.railCount}>{post.repost_count || ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => toggleBookmark.mutate(!bookmarked)} style={s.railBtn} accessibilityRole="button"
          accessibilityState={{ selected: bookmarked }} accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark'}>
          <View style={[s.round, pill]}><Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color="#fff" /></View>
        </TouchableOpacity>
        {isShareable(post) ? (
          <TouchableOpacity onPress={() => sharePost(post, instanceUrl)} style={s.railBtn} accessibilityRole="button" accessibilityLabel="Share">
            <View style={[s.round, pill]}><Ionicons name="share-outline" size={20} color="#fff" /></View>
          </TouchableOpacity>
        ) : null}
        {!isOwn ? (
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={s.railBtn} accessibilityRole="button" accessibilityLabel="More">
            <View style={[s.round, pill]}><Ionicons name="ellipsis-horizontal" size={20} color="#fff" /></View>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Bottom left: who and what */}
      <View style={s.meta} pointerEvents="box-none">
        <TouchableOpacity style={s.author} onPress={() => router.push(`/profile/${post.author_username}` as any)} accessibilityRole="link">
          <Avatar url={post.author_avatar_url} name={name} size={36} />
          <View style={{ flexShrink: 1, marginLeft: 10 }}>
            <Text style={s.name} numberOfLines={1}>{renderName(name, post.author_emojis)}</Text>
            <Text style={s.sub} numberOfLines={1}>
              {who} · {formatDistanceToNowStrict(new Date(post.published_at || post.created_at), { addSuffix: true })}
            </Text>
          </View>
          {network ? <Text style={s.badge}>{network}</Text> : null}
        </TouchableOpacity>
        {post.content ? (
          <Pressable onPress={() => setCaptionOpen((o) => !o)} style={{ marginTop: 8 }}>
            <LinkedText text={post.content} emojis={post.content_emojis} mentionDomains={post.mention_domains}
              numberOfLines={captionOpen ? 12 : 3} style={s.caption} linkStyle={{ textDecorationLine: 'underline' }} />
          </Pressable>
        ) : null}
      </View>

      {/* Progress */}
      <View style={s.progressTrack} pointerEvents="none">
        <View style={[s.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
      </View>

      {/* Hide / report / block */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={s.sheet}>
            <TouchableOpacity style={s.sheetItem} onPress={() => { setMenuOpen(false); hide.mutate() }}>
              <Ionicons name="eye-off-outline" size={20} color="#111827" />
              <Text style={s.sheetText}>Hide post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetItem} onPress={() => { setMenuOpen(false); router.push({ pathname: '/report', params: { postId: post.id } } as any) }}>
              <Ionicons name="flag-outline" size={20} color="#dc2626" />
              <Text style={[s.sheetText, { color: '#dc2626' }]}>Report post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetItem} onPress={() => {
              setMenuOpen(false)
              Alert.alert('Block user?', `@${post.author_username} will be removed from your feed instantly and our team will be notified.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: () => block.mutate() },
              ])
            }}>
              <Ionicons name="ban-outline" size={20} color="#dc2626" />
              <Text style={[s.sheetText, { color: '#dc2626' }]}>Block @{post.author_username}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Repost */}
      <Modal visible={repostOpen} transparent animationType="fade" onRequestClose={() => setRepostOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={s.sheetBackdrop} onPress={() => setRepostOpen(false)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <Text style={s.sheetTitle}>Repost</Text>
              <TextInput value={repostText} onChangeText={setRepostText} multiline placeholder="Add a comment (optional)"
                placeholderTextColor="#9ca3af" style={s.input} />
              <View style={s.chips}>
                {(['friends', 'public'] as const).map((v) => (
                  <TouchableOpacity key={v} onPress={() => setRepostVisibility(v)}
                    style={[s.chip, repostVisibility === v && s.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: repostVisibility === v }}>
                    <Text style={[s.chipText, repostVisibility === v && { color: '#fff' }]}>{v === 'friends' ? 'Friends' : 'Public'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => repost.mutate()} disabled={repost.isPending} style={[s.primary, repost.isPending && { opacity: 0.6 }]}>
                <Text style={s.primaryText}>{repost.isPending ? 'Reposting…' : 'Repost'}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

export default memo(ReelPage)

const s = StyleSheet.create({
  centered:     { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playBadge:    { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  gate:         { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  gateTitle:    { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  gateBody:     { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  gateBtn:      { marginTop: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  gateBtnText:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  shade:        { position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%', backgroundColor: 'rgba(0,0,0,0.35)' },
  rail:         { position: 'absolute', right: 10, bottom: 28, alignItems: 'center', gap: 14 },
  railBtn:      { alignItems: 'center', minWidth: 48, minHeight: 48, justifyContent: 'center' },
  round:        { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  railCount:    { color: '#fff', fontSize: 12, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  meta:         { position: 'absolute', left: 14, right: 78, bottom: 22 },
  author:       { flexDirection: 'row', alignItems: 'center' },
  name:         { color: '#fff', fontSize: 15, fontWeight: '700' },
  sub:          { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  badge:        { marginLeft: 8, color: '#fff', fontSize: 10, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  caption:      { color: '#fff', fontSize: 14, lineHeight: 19 },
  progressTrack:{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  sheetBackdrop:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, gap: 4 },
  sheetItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetText:    { fontSize: 16, color: '#111827' },
  sheetTitle:   { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 },
  input:        { minHeight: 80, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 10, fontSize: 15, color: '#111827', textAlignVertical: 'top' },
  chips:        { flexDirection: 'row', gap: 8, marginVertical: 12 },
  chip:         { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  chipOn:       { backgroundColor: '#334e68', borderColor: '#334e68' },
  chipText:     { fontSize: 14, color: '#374151' },
  primary:      { backgroundColor: '#334e68', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryText:  { color: '#fff', fontSize: 16, fontWeight: '600' },
})
