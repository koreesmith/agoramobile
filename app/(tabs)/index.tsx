import { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ScrollView,
  RefreshControl, Modal, Alert, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Screen, Header, Spinner, EmptyState } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { feedApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'

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
  const qc = useQueryClient()
  const [showCompose, setShowCompose] = useState(false)
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  // Auto-detect GIF URLs pasted into content
  useEffect(() => {
    if (imageUrl) return
    const match = content.match(URL_RE)
    if (!match) return
    const url = match[0].replace(/[.,!?)]+$/, '')
    if (!isGifUrl(url)) return

    // Call preview API to resolve share URLs (tenor.com/xPpM.gif) to direct media URLs
    feedApi.previewUrl(url).then(res => {
      const preview = res.data
      // If preview returns a direct image URL (for GIFs), use that
      const resolvedUrl = preview?.image || url
      setImageUrl(resolvedUrl)
      setContent(c => c.replace(url, '').trim())
    }).catch(() => {
      // Fallback: use the URL as-is
      setImageUrl(url)
      setContent(c => c.replace(url, '').trim())
    })
  }, [content])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam = 0 }) => feedApi.getFeed(pageParam).then(r => r.data),
    getNextPageParam: (last, pages) => last.posts?.length === 20 ? pages.length * 20 : undefined,
    initialPageParam: 0,
  })

  const posts = data?.pages.flatMap(p => p.posts) ?? []

  const createPost = useMutation({
    mutationFn: () => feedApi.createPost({ content, image_url: imageUrl, visibility: 'friends' }),
    onSuccess: () => { setContent(''); setImageUrl(''); setShowCompose(false); qc.invalidateQueries({ queryKey: ['feed'] }) },
    onError: () => Alert.alert('Error', 'Could not create post'),
  })

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaType.Images, quality: 0.8 })
    if (result.canceled) return
    setUploading(true)
    try {
      const file = { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' } as any
      const res = await feedApi.uploadMedia(file, 'posts')
      setImageUrl(res.data.url)
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

      {isLoading ? <Spinner /> : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <PostCard post={item} queryKey={['feed']} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState icon="📭" title="Nothing here yet" subtitle="Follow some friends to see their posts" />}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} color={c.primary} /> : null}
        />
      )}

      <Modal visible={showCompose} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[s.modal, { backgroundColor: c.card }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={() => { setShowCompose(false); setContent(''); setImageUrl('') }}>
              <Text style={[s.cancelText, { color: c.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: c.text }]}>New post</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={pickImage} disabled={uploading}>
                {uploading
                  ? <ActivityIndicator size="small" color={c.primary} />
                  : <Ionicons name="image-outline" size={22} color={c.primary} />}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => createPost.mutate()}
                disabled={(!content.trim() && !imageUrl) || createPost.isPending}
                style={[s.submitBtn, (!content.trim() && !imageUrl) && s.submitBtnDisabled]}
              >
                <Text style={s.submitBtnText}>{createPost.isPending ? '…' : 'Post'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <TextInput
              style={[s.composeInput, { color: c.text }]}
              placeholder="What's on your mind?"
              placeholderTextColor={c.textLight}
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
            />
            {imageUrl ? (
              <View style={{ marginTop: 12 }}>
                <Image source={{ uri: imgUrl(imageUrl) }} style={s.imagePreview} contentFit="cover" />
                <TouchableOpacity onPress={() => setImageUrl('')} style={s.removeImage}>
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

const s = StyleSheet.create({
  postBtn: { backgroundColor: '#486581', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  postBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
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
  modalFooter: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10, borderTopWidth: 1, flexDirection: 'row', gap: 16 },
})

