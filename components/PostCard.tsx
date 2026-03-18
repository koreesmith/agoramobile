import { useState } from 'react'
import { View, Text, TouchableOpacity, Alert, Share, StyleSheet, Modal, Dimensions, Linking } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { feedApi, imgUrl } from '../api'
import { useAuthStore } from '../store/auth'
import { Avatar } from './ui'
import { C } from '../constants/colors'
import { useC } from '../constants/ColorContext'

const REACTIONS = [
  { type: 'like', emoji: '❤️' }, { type: 'love', emoji: '😍' },
  { type: 'laugh', emoji: '😂' }, { type: 'wow', emoji: '😮' },
  { type: 'angry', emoji: '😡' }, { type: 'care', emoji: '🤗' },
  { type: 'pride', emoji: '🏳️‍🌈' }, { type: 'thankful', emoji: '🙏' },
  { type: 'vomit', emoji: '🤮' },
]

export default function PostCard({ post, queryKey }: { post: any; queryKey: any[] }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showReactions, setShowReactions] = useState(false)
  const [twExpanded, setTwExpanded] = useState(false)
  const c = useC()

  const invalidate = () => qc.invalidateQueries({ queryKey })

  const react = useMutation({
    mutationFn: ({ type }: { type: string }) =>
      post.my_reaction === type ? feedApi.unreactPost(post.id) : feedApi.reactPost(post.id, type),
    onSuccess: invalidate,
  })

  const repost = useMutation({ mutationFn: () => feedApi.repostPost(post.id), onSuccess: invalidate })
  const del    = useMutation({ mutationFn: () => feedApi.deletePost(post.id), onSuccess: invalidate })

  const isOwn    = user?.id === post.author_id
  const author   = post.repost_of_id ? post.repost_author_display_name : (post.author_display_name || post.display_name)
  const username = post.repost_of_id ? post.repost_author_username    : (post.author_username || post.username)
  const avatar   = imgUrl(post.repost_of_id ? post.repost_author_avatar_url  : (post.author_avatar_url || post.avatar_url))
  const content  = post.repost_of_id ? post.repost_content            : post.content
  const imageUrl = imgUrl(post.repost_of_id ? post.repost_image_url   : post.image_url)
  const linkImage = imgUrl(post.link_image)

  const [showLightbox, setShowLightbox] = useState(false)
  const screenWidth = Dimensions.get('window').width
  const screenHeight = Dimensions.get('window').height
  const reactionCounts: Record<string, number> = post.reaction_counts || {}
  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0)
  const myReactionEmoji = REACTIONS.find(r => r.type === post.my_reaction)?.emoji

  return (
    <View style={[s.card, { backgroundColor: c.card }]}>
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
            <Text style={[s.authorName, { color: c.text }]}>{author}</Text>
            <Text style={[s.authorMeta, { color: c.textMuted }]}>@{username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</Text>
          </View>
          {isOwn && (
            <TouchableOpacity onPress={() => Alert.alert('Delete post?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
            ])} style={{ padding: 4 }}>
              <Ionicons name="trash-outline" size={16} color={c.red} />
            </TouchableOpacity>
          )}
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
          <View>
            <TouchableOpacity onPress={() => setShowLightbox(true)} activeOpacity={0.9}>
              <Image source={{ uri: imageUrl }} style={s.image} contentFit="cover" />
            </TouchableOpacity>
            <Modal visible={showLightbox} transparent animationType="fade" onRequestClose={() => setShowLightbox(false)}>
              <TouchableOpacity style={s.lightboxBg} activeOpacity={1} onPress={() => setShowLightbox(false)}>
                <Image source={{ uri: imageUrl }} style={{ width: screenWidth, height: screenHeight * 0.8 }} contentFit="contain" />
                <Text style={s.lightboxClose}>✕ tap to close</Text>
              </TouchableOpacity>
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
            <TouchableOpacity style={s.actionBtn} onPress={() => setShowReactions(v => !v)}>
              <Text style={{ fontSize: 17 }}>{myReactionEmoji ?? '🤍'}</Text>
              {totalReactions > 0 && <Text style={[s.actionCount, { color: c.textMuted }]}>{totalReactions}</Text>}
            </TouchableOpacity>
            {showReactions && (
              <View style={[s.picker, { backgroundColor: c.card, borderColor: c.border }]}>
                {REACTIONS.map(r => (
                  <TouchableOpacity key={r.type} onPress={() => { react.mutate({ type: r.type }); setShowReactions(false) }}
                    style={post.my_reaction === r.type ? [s.pickerItemActive, { backgroundColor: c.primaryBg }] : undefined}>
                    <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/post/${post.id}`)}>
            <Ionicons name="chatbubble-outline" size={17} color={c.textMuted} />
            {post.comment_count > 0 && <Text style={[s.actionCount, { color: c.textMuted }]}>{post.comment_count}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={() => repost.mutate()}>
            <Ionicons name="repeat" size={17} color={post.reposted ? c.primary : c.textMuted} />
            {post.repost_count > 0 && <Text style={[s.actionCount, { color: post.reposted ? c.primary : c.textMuted }]}>{post.repost_count}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => Share.share({ message: content || '' })}>
            <Ionicons name="share-outline" size={17} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 16, marginHorizontal: 12, marginVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  bannerText: { fontSize: 12 },
  body: { padding: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  authorName: { fontWeight: '600', fontSize: 14 },
  authorMeta: { fontSize: 12, marginTop: 1 },
  cw: { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  cwText: { fontSize: 12, color: '#92400e', fontWeight: '500' },
  content: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  image: { height: 260, marginHorizontal: -14, marginVertical: 8 },
  linkPreview: { marginTop: 8, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  linkDomain: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
  linkTitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  linkDesc: { fontSize: 12, marginTop: 2 },
  reactionCounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  chipCount: { fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 12 },
  picker: { position: 'absolute', bottom: 36, left: 0, borderWidth: 1, borderRadius: 20, padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10, zIndex: 99, width: 240 },
  pickerItemActive: { borderRadius: 8 },
  lightboxBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  lightboxClose: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 16 },
})
