import { useState, useRef, useEffect } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Image, ActivityIndicator, Modal, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { normalizeImageOrientation } from '../../utils/image'
import { formatDistanceToNow } from 'date-fns'
import { Screen, Spinner, Avatar, UploadingModal, LinkedText } from '../../components/ui'
import { dmApi, feedApi } from '../../api'
import { useAuthStore } from '../../store/auth'
import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

export default function ConversationScreen() {
  const c = useC()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const headerHeight = insets.top + 44
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [reactionTarget, setReactionTarget] = useState<string | null>(null)
  const flatListRef = useRef<FlatList>(null)

  const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍']

  const { data: convData } = useQuery({ queryKey: ['conversation', id], queryFn: () => dmApi.getConversation(id!).then(r => r.data) })
  const { data: msgData, refetch } = useQuery({ queryKey: ['messages', id], queryFn: () => dmApi.getMessages(id!).then(r => r.data), refetchInterval: 5_000 })

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
  const del      = useMutation({ mutationFn: (msgId: string) => dmApi.deleteMessage(msgId), onSuccess: refetch })
  const react    = useMutation({
    mutationFn: ({ msgId, emoji }: { msgId: string; emoji: string }) => dmApi.reactMessage(msgId, emoji),
    onSuccess: () => { setReactionTarget(null); refetch() },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not react to message'),
  })
  const unreact  = useMutation({ mutationFn: (msgId: string) => dmApi.unreactMessage(msgId), onSuccess: refetch })
  const accept = useMutation({ mutationFn: () => dmApi.acceptRequest(id!), onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', id] }) })

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled) return
    setUploading(true)
    const slowTimer = setTimeout(() => setShowUploadModal(true), 1000)
    try {
      const uri = await normalizeImageOrientation(result.assets[0].uri)
      const file = { uri, type: 'image/jpeg', name: 'photo.jpg' } as any
      const res = await feedApi.uploadMedia(file, 'posts')
      setImageUrl(res.data.url)
    } catch { Alert.alert('Upload failed') }
    finally { clearTimeout(slowTimer); setShowUploadModal(false); setUploading(false) }
  }

  return (
    <Screen>
      <UploadingModal visible={showUploadModal} />
      <Stack.Screen options={{
        headerShown: true, headerTitle: other?.display_name || other?.username || 'Message',
        headerBackTitle: 'Messages', headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary,
        headerRight: () => other ? (
          <TouchableOpacity onPress={() => router.push(`/profile/${other.username}`)}>
            <Avatar url={other.avatar_url} name={other.display_name || other.username} size={32} />
          </TouchableOpacity>
        ) : null,
      }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight}>
        {conv && !conv.is_accepted && (
          <View style={s.requestBanner}>
            <Text style={s.requestTitle}>Message request</Text>
            <Text style={s.requestSub}>Accept to reply</Text>
            <TouchableOpacity onPress={() => accept.mutate()} style={s.acceptBtn}>
              <Text style={s.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: 48 }}><Text style={{ color: c.textLight }}>No messages yet. Say hello!</Text></View>}
          renderItem={({ item: msg }) => {
            const isOwn = msg.author_id === user?.id
            // GetMessages returns a `reactions` array (one entry per reacting
            // user), not a singular `reaction` field -- the badge shows only
            // the current viewer's own reaction, since tapping it unreacts
            // on their behalf specifically (DELETE is scoped to that user).
            const myReaction = msg.reactions?.find((r: any) => r.user_id === user?.id)?.reaction
            if (msg.deleted_at) return (
              <View style={[s.bubbleRow, isOwn && { justifyContent: 'flex-end' }]}>
                <Text style={s.deleted}>Message deleted</Text>
              </View>
            )
            return (
              <View style={[s.bubbleRow, isOwn && { justifyContent: 'flex-end' }]}>
                {!isOwn && <Avatar url={msg.author_avatar_url} name={msg.author_display_name} size={28} />}
                <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                  <TouchableOpacity
                    onLongPress={() => {
                      if (isOwn) {
                        Alert.alert('Message', undefined, [
                          { text: 'React', onPress: () => setReactionTarget(msg.id) },
                          { text: 'Delete', style: 'destructive', onPress: () => del.mutate(msg.id) },
                          { text: 'Cancel', style: 'cancel' },
                        ])
                      } else {
                        setReactionTarget(msg.id)
                      }
                    }}
                    style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}
                  >
                    {msg.content ? <LinkedText text={msg.content} style={[s.bubbleText, isOwn && { color: 'white' }]} linkStyle={isOwn ? { color: 'rgba(255,255,255,0.9)' } : undefined} /> : null}
                    {msg.image_url ? <Image source={{ uri: msg.image_url }} style={s.bubbleImage} resizeMode="cover" /> : null}
                    <Text style={[s.bubbleTime, isOwn && { color: 'rgba(255,255,255,0.7)' }]}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </Text>
                  </TouchableOpacity>
                  {myReaction && (
                    <TouchableOpacity onPress={() => unreact.mutate(msg.id)} style={s.msgReaction}>
                      <Text style={{ fontSize: 16 }}>{myReaction}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          }}
        />
        {imageUrl ? (
          <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
            <Image source={{ uri: imageUrl }} style={{ height: 80, width: 100, borderRadius: 8 }} resizeMode="cover" />
            <TouchableOpacity onPress={() => setImageUrl('')} style={s.removeImg}>
              <Ionicons name="close" size={10} color="white" />
            </TouchableOpacity>
          </View>
        ) : null}
        {/* Reaction picker modal */}
        <Modal visible={!!reactionTarget} transparent animationType="fade" onRequestClose={() => setReactionTarget(null)}>
          <View style={s.reactionOverlay}>
            {/* Full-screen backdrop — dismiss only; rendered beneath picker so it doesn't intercept emoji taps */}
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setReactionTarget(null)} />
            <View style={[s.reactionPicker, { backgroundColor: c.card, borderColor: c.border }]}>
              {QUICK_REACTIONS.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => reactionTarget && react.mutate({ msgId: reactionTarget, emoji })}
                  style={s.reactionBtn}>
                  <Text style={{ fontSize: 29 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {(conv?.is_accepted !== false) && (
          <View style={[s.composer, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TouchableOpacity onPress={pickImage} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color={c.primary} /> : <Ionicons name="image-outline" size={22} color={c.primary} />}
            </TouchableOpacity>
            <TextInput style={s.input} placeholder="Message…" placeholderTextColor={c.textLight}
              value={text} onChangeText={setText} multiline maxLength={2000} />
            <TouchableOpacity onPress={() => (text.trim() || imageUrl) && send.mutate()} disabled={(!text.trim() && !imageUrl) || send.isPending}>
              <Ionicons name="send" size={20} color={(text.trim() || imageUrl) ? c.primary : c.textLight} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  reactionOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  reactionPicker:  { flexDirection: 'row', gap: 6, padding: 14, borderRadius: 20, borderWidth: 1 },
  reactionBtn:     { padding: 6 },
  msgReaction:     { marginTop: 3, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 12 },
  requestBanner: { margin: 12, padding: 12, backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12 },
  requestTitle: { fontSize: 16, fontWeight: '600', color: '#92400e' },
  requestSub: { fontSize: 13, color: '#b45309', marginBottom: 8 },
  acceptBtn: { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  acceptBtnText: { color: 'white', fontWeight: '600', fontSize: 16 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: C.bg, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 16, color: C.text },
  bubbleTime: { fontSize: 11, color: C.textLight, marginTop: 3 },
  bubbleImage: { width: 180, height: 140, borderRadius: 8, marginTop: 4 },
  deleted: { fontSize: 13, color: C.textLight, fontStyle: 'italic', paddingHorizontal: 12, paddingVertical: 6 },
  removeImg: { position: 'absolute', top: 6, right: -2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card },
  input: { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 16, color: C.text, maxHeight: 100 },
})
