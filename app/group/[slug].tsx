import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, Image, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { normalizeImageOrientation } from '../../utils/image'
import { Screen, Spinner, Avatar } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { groupsApi, feedApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

export default function GroupScreen() {
  const c = useC()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [showCW, setShowCW] = useState(false)
  const [cwLabel, setCwLabel] = useState('')

  const resetCompose = () => { setContent(''); setImageUrl(''); setShowCW(false); setCwLabel(''); setShowCompose(false) }
  const [uploading, setUploading] = useState(false)
  const [showCompose, setShowCompose] = useState(false)

  const { data: groupData, isLoading: gl, refetch: rg } = useQuery({ queryKey: ['group', slug], queryFn: () => groupsApi.get(slug!).then(r => r.data) })
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch: rf, isRefetching } = useInfiniteQuery({
    queryKey: ['group-feed', slug],
    queryFn: ({ pageParam = 0 }) => groupsApi.getFeed(slug!, pageParam).then(r => r.data),
    getNextPageParam: (last, pages) => last.posts?.length === 20 ? pages.length : undefined,
    initialPageParam: 0,
  })

  const posts = data?.pages.flatMap(p => p.posts) ?? []
  const group = groupData?.group || groupData

  const join = useMutation({ mutationFn: () => groupsApi.join(slug!), onSuccess: () => { qc.invalidateQueries({ queryKey: ['group', slug] }); qc.invalidateQueries({ queryKey: ['groups'] }) } })
  const leave = useMutation({ mutationFn: () => groupsApi.leave(slug!), onSuccess: () => { qc.invalidateQueries({ queryKey: ['group', slug] }); router.back() } })
  const createPost = useMutation({
    mutationFn: () => groupsApi.createPost(slug!, {
      content,
      image_url: imageUrl,
      content_warning: showCW && cwLabel.trim() ? cwLabel.trim() : '',
    }),
    onSuccess: () => { resetCompose(); qc.invalidateQueries({ queryKey: ['group-feed', slug] }) },
  })

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
    if (result.canceled) return
    setUploading(true)
    try {
      const uri = await normalizeImageOrientation(result.assets[0].uri)
      const file = { uri, type: 'image/jpeg', name: 'photo.jpg' } as any
      const res = await feedApi.uploadMedia(file, 'posts')
      setImageUrl(res.data.url)
    } catch { Alert.alert('Upload failed') }
    finally { setUploading(false) }
  }

  if (gl || !group) return <Screen><Stack.Screen options={{ headerShown: true, headerTitle: 'Group', headerTintColor: c.primary }} /><Spinner /></Screen>

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true, headerTitle: group.name, headerBackTitle: 'Groups',
        headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary,
        headerRight: () => group.is_member ? (
          <TouchableOpacity onPress={() => Alert.alert('Leave group?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => leave.mutate() },
          ])}><Ionicons name="exit-outline" size={22} color={c.red} /></TouchableOpacity>
        ) : null,
      }} />
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PostCard post={item} queryKey={['group-feed', slug]} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { rg(); rf() }} tintColor={c.primary} />}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={c.primary} style={{ padding: 16 }} /> : null}
        ListHeaderComponent={(
          <View>
            <View style={s.cover}>
              {group.cover_url ? <Image source={{ uri: imgUrl(group.cover_url) }} style={{ width: '100%', height: 100 }} resizeMode="cover" /> : null}
            </View>
            <View style={s.groupCard}>
              <View style={s.groupHeaderRow}>
                <View style={s.groupIcon}>
                  {group.avatar_url ? <Image source={{ uri: imgUrl(group.avatar_url) }} style={{ width: 64, height: 64 }} /> : <Text style={s.groupLetter}>{group.name[0]}</Text>}
                </View>
                {!group.is_member && (
                  <TouchableOpacity onPress={() => join.mutate()} disabled={join.isPending} style={s.joinBtn}>
                    <Text style={s.joinBtnText}>Join</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={s.groupName}>{group.name}</Text>
              <Text style={s.groupMeta}>{group.privacy} · {group.member_count} members</Text>
              {group.description ? <Text style={s.groupDesc}>{group.description}</Text> : null}
            </View>

            {group.is_member && (
              <View style={s.composer}>
                {showCompose ? (
                  <>
                    {showCW && (
                      <View style={{ borderWidth: 1, borderColor: '#fcd34d', backgroundColor: '#fffbeb', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>⚠️ Trigger warning</Text>
                        <TextInput style={{ fontSize: 13, color: '#92400e', padding: 0 }} placeholder="e.g. spoilers, violence…" placeholderTextColor="#d97706"
                          value={cwLabel} onChangeText={setCwLabel} returnKeyType="done" />
                      </View>
                    )}
                    <TextInput style={s.composeInput} placeholder={`Post to ${group.name}…`} placeholderTextColor={c.textLight}
                      value={content} onChangeText={setContent} multiline autoFocus={!showCW} />
                    {imageUrl ? (
                      <View>
                        <Image source={{ uri: imageUrl }} style={{ height: 120, borderRadius: 8, width: '100%' }} resizeMode="cover" />
                        <TouchableOpacity onPress={() => setImageUrl('')} style={s.removeImg}>
                          <Ionicons name="close" size={12} color="white" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <View style={s.composeActions}>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TouchableOpacity onPress={pickImage} disabled={uploading}>
                          {uploading ? <ActivityIndicator size="small" color={c.primary} /> : <Ionicons name="image-outline" size={20} color={c.primary} />}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowCW(v => !v)}
                          style={{ borderWidth: 1, borderColor: showCW ? '#fcd34d' : c.border, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: showCW ? '#fef3c7' : 'transparent' }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: showCW ? '#92400e' : c.textMuted }}>TW</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={resetCompose} style={s.cancelBtn}>
                          <Text style={s.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => createPost.mutate()} disabled={(!content.trim() && !imageUrl) || createPost.isPending} style={[s.postBtn, (!content.trim() && !imageUrl) && { backgroundColor: c.primaryLt }]}>
                          <Text style={s.postBtnText}>{createPost.isPending ? '…' : 'Post'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setShowCompose(true)} style={s.composerPrompt}>
                    <Avatar url={user?.avatar_url} name={user?.display_name} size={32} />
                    <Text style={s.composerText}>Post to {group.name}…</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <Text style={s.postsHeader}>Posts</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>{group.is_member ? 'No posts yet. Be the first!' : 'Join to see posts.'}</Text>}
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  cover: { height: 100, backgroundColor: C.primaryLt },
  groupCard: { backgroundColor: C.card, paddingHorizontal: 16, paddingBottom: 16 },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -32 },
  groupIcon: { width: 64, height: 64, borderRadius: 12, backgroundColor: C.primaryBg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.card },
  groupLetter: { color: C.primary, fontWeight: 'bold', fontSize: 26 },
  joinBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, marginTop: 32 },
  joinBtnText: { color: 'white', fontWeight: '600' },
  groupName: { fontSize: 20, fontWeight: 'bold', color: C.text, marginTop: 10 },
  groupMeta: { fontSize: 12, color: C.textMuted, marginTop: 2, textTransform: 'capitalize' },
  groupDesc: { fontSize: 14, color: C.textMd, marginTop: 6 },
  composer: { backgroundColor: C.card, marginHorizontal: 12, marginTop: 12, borderRadius: 14, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  composerPrompt: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  composerText: { color: C.textLight, fontSize: 14 },
  composeInput: { fontSize: 14, color: C.text, minHeight: 60 },
  composeActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  cancelBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  cancelBtnText: { fontSize: 13, color: C.textMd },
  postBtn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  postBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  removeImg: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  postsHeader: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  empty: { textAlign: 'center', color: C.textLight, fontSize: 14, paddingVertical: 32 },
})
