import { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ScrollView,
  RefreshControl, Modal, Alert, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { normalizeImageOrientation } from '../../utils/image'
import { Screen, Header, Spinner, EmptyState } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi, feedsApi, friendsApi, instanceApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useBlockStore } from '../../store/blocks'

import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

function isGifUrl(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    const path = u.pathname.toLowerCase()
    if (path.endsWith('.gif')) return true
    if (host.includes('giphy.com') || host.endsWith('tenor.com') || host.endsWith('tenor.co') || host.includes('gfycat.com')) return true
    if (host.includes('imgur.com') && (path.endsWith('.gif') || path.endsWith('.gifv'))) return true
  } catch {
    const lower = url.toLowerCase()
    if (lower.includes('.gif') || lower.includes('tenor.com') || lower.includes('giphy.com')) return true
  }
  return false
}

const URL_RE = /https?:\/\/[^\s]+/g

export default function FeedScreen() {
  const c = useC()
  const { user } = useAuthStore()
  const { blockedIds } = useBlockStore()
  const { data: instanceData } = useQuery({
    queryKey: ['instance-info'],
    queryFn: () => instanceApi.getInfo().then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const invitesEnabled = instanceData?.user_invites_enabled === 'true'
  const qc = useQueryClient()
  const [showCompose, setShowCompose] = useState(false)
  const [content, setContent] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [showCW, setShowCW] = useState(false)
  const [cwLabel, setCwLabel] = useState('')
  const [showPoll, setShowPoll] = useState(false)
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [pollMultiple, setPollMultiple] = useState(false)
  const [pollAllowsNew, setPollAllowsNew] = useState(false)
  const [pollExpiresHours, setPollExpiresHours] = useState(24)
  const [visibility, setVisibility] = useState<'public'|'friends'|'group'>('friends')
  const [friendListId, setFriendListId] = useState('')
  const [showVisibilitySheet, setShowVisibilitySheet] = useState(false)
  const [showListSheet, setShowListSheet] = useState(false)
  const [linkPreview, setLinkPreview] = useState<{url:string,title:string,description:string,image:string,domain:string}|null>(null)
  const [linkFetching, setLinkFetching] = useState(false)
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null)

  const { data: customFeedsData } = useQuery({
    queryKey: ['custom-feeds'],
    queryFn: () => feedsApi.list().then(r => r.data),
    staleTime: 0,
  })
  const customFeeds: any[] = customFeedsData?.feeds || []

  const { data: groupsData } = useQuery({
    queryKey: ['friend-lists'],
    queryFn: () => friendsApi.listFriendLists().then(r => r.data),
    enabled: showCompose,
  })
  const friendLists: any[] = groupsData?.groups || []

  const selectedFriendList = friendLists.find((g: any) => g.id === friendListId)

  const resetCompose = () => {
    setContent(''); setImageUrls([]); setShowCW(false); setCwLabel('')
    setShowPoll(false); setPollOptions(['', '']); setPollMultiple(false)
    setPollAllowsNew(false); setPollExpiresHours(24)
    setVisibility('friends'); setFriendListId('')
    setLinkPreview(null); setLinkFetching(false)
    setShowCompose(false)
  }

  const MAX_IMAGES = 4

  // Auto-detect URLs pasted into content: GIFs become inline images, others become link preview cards
  useEffect(() => {
    if (imageUrls.length > 0) return
    const match = content.match(URL_RE)
    if (!match) return
    const url = match[0].replace(/[.,!?)]+$/, '')

    if (isGifUrl(url)) {
      // Call preview API to resolve share URLs (tenor.com/xPpM.gif) to direct media URLs
      feedApi.previewUrl(url).then(res => {
        const preview = res.data
        const resolvedUrl = preview?.image || url
        setImageUrls([resolvedUrl])
        setContent(c => c.replace(url, '').trim())
      }).catch(() => {
        setImageUrls([url])
        setContent(c => c.replace(url, '').trim())
      })
      return
    }

    // Non-GIF URL: fetch link preview (skip if we already have one for this URL)
    if (linkPreview?.url === url) return
    setLinkPreview(null)
    setLinkFetching(true)
    feedApi.previewUrl(url).then(res => {
      const preview = res.data
      if (preview?.url) setLinkPreview(preview)
    }).catch(() => {
      // No preview available — silently ignore
    }).finally(() => setLinkFetching(false))
  }, [content])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } = useInfiniteQuery({
    queryKey: ['feed', activeFeedId],
    queryFn: ({ pageParam = 0 }) => feedApi.getFeed(pageParam, activeFeedId ?? undefined).then(r => r.data),
    getNextPageParam: (last, pages) => last.posts?.length === 20 ? pages.length * 20 : undefined,
    initialPageParam: 0,
  })

  const posts = (data?.pages.flatMap(p => p.posts) ?? [])
    .filter((p: any) => !blockedIds.includes(p.author_id))

  const createPost = useMutation({
    mutationFn: () => feedApi.createPost({
      content,
      image_url: imageUrls[0] || '',
      image_urls: imageUrls,
      visibility,
      group_id: visibility === 'group' ? friendListId : undefined,
      content_warning: showCW && cwLabel.trim() ? cwLabel.trim() : '',
      poll_options: showPoll ? pollOptions.filter(o => o.trim()) : [],
      poll_multiple_choice: showPoll ? pollMultiple : false,
      poll_allows_new_options: showPoll ? pollAllowsNew : false,
      poll_expires_hours: showPoll ? pollExpiresHours : 0,
      link_url: linkPreview?.url ?? '',
      link_title: linkPreview?.title ?? '',
      link_description: linkPreview?.description ?? '',
      link_image: linkPreview?.image ?? '',
      link_domain: linkPreview?.domain ?? '',
    }),
    onSuccess: () => { resetCompose(); qc.invalidateQueries({ queryKey: ['feed'] }) },
    onError: () => Alert.alert('Error', 'Could not create post'),
  })

  const pickImage = async () => {
    const remaining = MAX_IMAGES - imageUrls.length
    if (remaining <= 0) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    })
    if (result.canceled) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const asset of result.assets) {
        const uri = await normalizeImageOrientation(asset.uri)
        const file = { uri, type: 'image/jpeg', name: 'photo.jpg' } as any
        const res = await feedApi.uploadMedia(file, 'posts')
        uploaded.push(res.data.url)
      }
      setImageUrls(prev => [...prev, ...uploaded].slice(0, MAX_IMAGES))
    } catch { Alert.alert('Upload failed') }
    finally { setUploading(false) }
  }

  return (
    <Screen>
      <Header title="Feed" right={
        <TouchableOpacity onPress={() => setShowCompose(true)} style={s.postBtn}>
          <Text style={s.postBtnText}>Post</Text>
        </TouchableOpacity>
      } />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.switcher, { borderBottomColor: c.border }]}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' }}
      >
        <TouchableOpacity
          onPress={() => setActiveFeedId(null)}
          style={[s.feedTab, { borderColor: c.border }, activeFeedId === null && { backgroundColor: c.primary, borderColor: c.primary }]}
        >
          <Text style={[s.feedTabText, { color: activeFeedId === null ? 'white' : c.textMuted }]}>Home</Text>
        </TouchableOpacity>
        {customFeeds.map((feed: any) => (
          <TouchableOpacity
            key={feed.id}
            onPress={() => setActiveFeedId(feed.id)}
            style={[s.feedTab, { borderColor: c.border }, activeFeedId === feed.id && { backgroundColor: c.primary, borderColor: c.primary }]}
          >
            <Text style={[s.feedTabText, { color: activeFeedId === feed.id ? 'white' : c.textMuted }]}>{feed.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => router.push('/manage-feeds')} style={[s.feedTab, { borderColor: c.border }]}>
          <Ionicons name="options-outline" size={14} color={c.textMuted} />
          <Text style={[s.feedTabText, { color: c.textMuted }]}>Manage</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ flex: 1 }}>
        {isLoading ? <Spinner /> : (
          <FlatList
            data={posts}
            keyExtractor={p => p.id}
            renderItem={({ item }) => <PostCard post={item} queryKey={['feed', activeFeedId]} />}
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: invitesEnabled ? 88 : 8 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
            onEndReached={() => hasNextPage && fetchNextPage()}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={<EmptyState icon="📭" title="Nothing here yet" subtitle="Follow some friends to see their posts" />}
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} color={c.primary} /> : null}
          />
        )}

        {invitesEnabled && (
          <TouchableOpacity
            onPress={() => router.push('/invite-friend')}
            style={[s.fab, { backgroundColor: c.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="mail" size={20} color="white" />
            <Text style={s.fabText}>Invite a Friend</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showCompose} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: c.card }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={resetCompose}>
              <Text style={[s.cancelText, { color: c.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: c.text }]}>New post</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* CW toggle */}
              <TouchableOpacity onPress={() => setShowCW(v => !v)}
                style={[s.cwBtn, showCW && { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: showCW ? '#92400e' : c.textMuted }}>TW</Text>
              </TouchableOpacity>
              {/* Poll toggle */}
              <TouchableOpacity onPress={() => setShowPoll(v => !v)}
                style={[s.cwBtn, showPoll && { backgroundColor: c.primaryBg, borderColor: c.primaryLt }]}>
                <Ionicons name="bar-chart-outline" size={16} color={showPoll ? c.primary : c.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} disabled={uploading || showPoll || imageUrls.length >= MAX_IMAGES}>
                {uploading
                  ? <ActivityIndicator size="small" color={c.primary} />
                  : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="image-outline" size={22} color={(showPoll || imageUrls.length >= MAX_IMAGES) ? c.border : c.primary} />
                      {imageUrls.length > 0 && !showPoll && (
                        <Text style={{ fontSize: 11, color: c.primary, fontWeight: '600' }}>{imageUrls.length}/{MAX_IMAGES}</Text>
                      )}
                    </View>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => createPost.mutate()}
                disabled={(!content.trim() && imageUrls.length === 0 && !(showPoll && pollOptions.filter(o=>o.trim()).length>=2)) || createPost.isPending}
                style={[s.submitBtn, (!content.trim() && imageUrls.length === 0 && !(showPoll && pollOptions.filter(o=>o.trim()).length>=2)) && s.submitBtnDisabled]}
              >
                <Text style={s.submitBtnText}>{createPost.isPending ? '…' : 'Post'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Audience row — tapping expands inline picker */}
          <TouchableOpacity
            onPress={() => setShowVisibilitySheet(v => !v)}
            style={[s.audienceRow, { borderBottomColor: c.border, backgroundColor: c.card }]}
          >
            <Ionicons
              name={visibility === 'public' ? 'globe-outline' : visibility === 'group' ? 'people-outline' : 'person-outline'}
              size={15}
              color={c.primary}
            />
            <Text style={[s.audienceLabel, { color: c.primary }]}>
              {visibility === 'public' ? 'Public' : visibility === 'group' ? (selectedFriendList?.name || 'Select a list…') : 'Friends'}
            </Text>
            <Ionicons name={showVisibilitySheet ? 'chevron-up' : 'chevron-down'} size={13} color={c.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {/* Inline visibility picker */}
          {showVisibilitySheet && (
            <View style={[s.inlinePicker, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
              {[
                { value: 'public',  icon: 'globe-outline',  label: 'Public',      desc: 'Anyone on Agora' },
                { value: 'friends', icon: 'person-outline', label: 'Friends',     desc: 'Only your friends' },
                { value: 'group',   icon: 'people-outline', label: 'Friend List', desc: 'Pick a specific list' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    setVisibility(opt.value as any)
                    if (opt.value !== 'group') setFriendListId('')
                    setShowVisibilitySheet(false)
                    if (opt.value === 'group') setShowListSheet(true)
                  }}
                  style={[s.inlineOption, { borderBottomColor: c.border, backgroundColor: visibility === opt.value ? c.primaryBg : 'transparent' }]}
                >
                  <Ionicons name={opt.icon as any} size={18} color={visibility === opt.value ? c.primary : c.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: visibility === opt.value ? c.primary : c.text }}>{opt.label}</Text>
                    <Text style={{ fontSize: 12, color: c.textMuted }}>{opt.desc}</Text>
                  </View>
                  {visibility === opt.value && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Inline group list picker */}
          {showListSheet && visibility === 'group' && (
            <View style={[s.inlinePicker, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setShowListSheet(false)} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ fontSize: 12, color: c.textMuted }}>← Back to audience</Text>
              </TouchableOpacity>
              {friendLists.length === 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: c.textMuted, fontSize: 13, textAlign: 'center' }}>
                    No friend lists yet. Create one in the Friends tab.
                  </Text>
                </View>
              ) : (
                friendLists.map((g: any) => (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => { setFriendListId(g.id); setShowListSheet(false) }}
                    style={[s.inlineOption, { borderBottomColor: c.border, backgroundColor: friendListId === g.id ? c.primaryBg : 'transparent' }]}
                  >
                    <Ionicons name="people-outline" size={18} color={friendListId === g.id ? c.primary : c.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: friendListId === g.id ? c.primary : c.text }}>{g.name}</Text>
                      <Text style={{ fontSize: 12, color: c.textMuted }}>{g.member_count ?? 0} friends</Text>
                    </View>
                    {friendListId === g.id && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* CW input */}
            {showCW && (
              <View style={[s.cwInputWrap, { borderColor: '#fcd34d', backgroundColor: '#fffbeb' }]}>
                <Text style={s.cwInputLabel}>⚠️ Trigger warning label</Text>
                <TextInput style={s.cwInput} placeholder="e.g. spoilers, violence…"
                  placeholderTextColor="#d97706" value={cwLabel} onChangeText={setCwLabel}
                  returnKeyType="done" />
              </View>
            )}

            <TextInput
              style={[s.composeInput, { color: c.text }]}
              placeholder={showPoll ? 'Ask a question…' : 'What\'s on your mind?'}
              placeholderTextColor={c.textLight}
              value={content} onChangeText={setContent} multiline autoFocus={!showCW}
            />

            {/* Poll editor */}
            {showPoll && (
              <View style={[s.pollEditor, { borderColor: c.border }]}>
                <Text style={[s.pollEditorLabel, { color: c.textMuted }]}>POLL OPTIONS</Text>
                {pollOptions.map((opt, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <TextInput
                      style={[s.pollOptionInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg, flex: 1 }]}
                      placeholder={i < 2 ? `Option ${i+1} (required)` : `Option ${i+1} (optional)`}
                      placeholderTextColor={c.textLight}
                      value={opt} onChangeText={t => setPollOptions(opts => opts.map((o,j)=>j===i?t:o))}
                      maxLength={100} returnKeyType="next"
                    />
                    {pollOptions.length > 2 && (
                      <TouchableOpacity onPress={() => setPollOptions(opts=>opts.filter((_,j)=>j!==i))}>
                        <Ionicons name="close-circle" size={18} color={c.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {pollOptions.length < 6 && (
                  <TouchableOpacity onPress={() => setPollOptions(opts=>[...opts,''])} style={s.pollAddBtn}>
                    <Ionicons name="add" size={14} color={c.primary} />
                    <Text style={{ fontSize: 13, color: c.primary }}>Add option</Text>
                  </TouchableOpacity>
                )}
                {/* Poll settings */}
                <View style={[s.pollSettings, { borderTopColor: c.border }]}>
                  <Text style={[s.pollEditorLabel, { color: c.textMuted }]}>SETTINGS</Text>
                  {/* Duration */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: c.textMd, flex: 1 }}>Duration</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[{h:1,l:'1h'},{h:24,l:'1d'},{h:72,l:'3d'},{h:168,l:'1w'},{h:0,l:'∞'}].map(({h,l}) => (
                        <TouchableOpacity key={h} onPress={() => setPollExpiresHours(h)}
                          style={[s.durationBtn, { borderColor: pollExpiresHours===h ? c.primary : c.border, backgroundColor: pollExpiresHours===h ? c.primaryBg : 'transparent' }]}>
                          <Text style={{ fontSize: 12, color: pollExpiresHours===h ? c.primary : c.textMuted }}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  {/* Multiple choice */}
                  <TouchableOpacity onPress={() => setPollMultiple(v=>!v)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                    <Ionicons name={pollMultiple ? 'checkbox' : 'square-outline'} size={18} color={pollMultiple ? c.primary : c.border} />
                    <Text style={{ fontSize: 13, color: c.textMd }}>Allow multiple selections</Text>
                  </TouchableOpacity>
                  {/* Allow new options */}
                  <TouchableOpacity onPress={() => setPollAllowsNew(v=>!v)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                    <Ionicons name={pollAllowsNew ? 'checkbox' : 'square-outline'} size={18} color={pollAllowsNew ? c.primary : c.border} />
                    <Text style={{ fontSize: 13, color: c.textMd }}>Let respondents add options</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!showPoll && imageUrls.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 12 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {imageUrls.map((url, i) => (
                  <View key={i} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: imgUrl(url) }}
                      style={[s.imagePreview, imageUrls.length > 1 && { width: Dimensions.get('window').width * 0.6 }]}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      onPress={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                      style={s.removeImage}
                    >
                      <Ionicons name="close" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {!showPoll && imageUrls.length === 0 && linkFetching && (
              <View style={[s.linkPreviewCard, { borderColor: c.border, backgroundColor: c.bg }]}>
                <ActivityIndicator size="small" color={c.primary} />
              </View>
            )}

            {!showPoll && imageUrls.length === 0 && linkPreview && (
              <View style={[s.linkPreviewCard, { borderColor: c.border, backgroundColor: c.bg }]}>
                {linkPreview.image ? (
                  <Image source={{ uri: linkPreview.image }} style={s.linkPreviewImage} contentFit="cover" />
                ) : null}
                <View style={s.linkPreviewBody}>
                  {linkPreview.domain ? <Text style={[s.linkPreviewDomain, { color: c.textMuted }]}>{linkPreview.domain}</Text> : null}
                  {linkPreview.title ? <Text style={[s.linkPreviewTitle, { color: c.text }]} numberOfLines={2}>{linkPreview.title}</Text> : null}
                  {linkPreview.description ? <Text style={[s.linkPreviewDesc, { color: c.textMuted }]} numberOfLines={2}>{linkPreview.description}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => setLinkPreview(null)} style={s.removeImage}>
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
          </KeyboardAvoidingView>

        </View>
      </Modal>
    </Screen>
  )
}

const s = StyleSheet.create({
  switcher: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  feedTab: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  feedTabText: { fontSize: 13, fontWeight: '500' },
  postBtn: { backgroundColor: '#486581', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  postBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { color: 'white', fontWeight: '700', fontSize: 15 },
  modal: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  cancelText: { color: '#6b7280', fontSize: 16 },
  modalTitle: { fontWeight: '600', color: '#111827', fontSize: 16 },
  submitBtn: { backgroundColor: '#486581', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 6 },
  submitBtnDisabled: { backgroundColor: '#9fb3c8' },
  submitBtnText: { color: 'white', fontWeight: '600' },
  composeInput: { fontSize: 16, color: '#111827', flex: 1 },
  imagePreview: { height: 180, width: '100%', borderRadius: 12, marginTop: 8 },
  removeImage: { position: 'absolute', top: 10, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  cwBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  cwInputWrap: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  cwInputLabel: { fontSize: 11, fontWeight: '600', color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  cwInput: { fontSize: 14, color: '#92400e', padding: 0 },
  pollEditor: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  pollEditorLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 },
  pollOptionInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  pollAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, marginBottom: 4 },
  pollSettings: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  durationBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  linkPreviewCard: { marginTop: 12, borderWidth: 1, borderRadius: 12, overflow: 'hidden', minHeight: 48, justifyContent: 'center' },
  linkPreviewImage: { width: '100%', height: 160 },
  linkPreviewBody: { padding: 10, gap: 2 },
  linkPreviewDomain: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  linkPreviewTitle: { fontSize: 14, fontWeight: '600' },
  linkPreviewDesc: { fontSize: 12 },
  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1 },
  audienceLabel: { fontSize: 13, fontWeight: '600' },
  inlinePicker: { borderBottomWidth: 1 },
  inlineOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
})

