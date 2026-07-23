import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Image,
  Alert, StyleSheet, Modal, Dimensions, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner } from '../../components/ui'
import { albumsApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useC } from '../../constants/ColorContext'
import { C } from '../../constants/colors'

const { width } = Dimensions.get('window')
const CARD_SIZE = (width - 36) / 2

export default function UserAlbumsScreen() {
  const c = useC()
  const { username } = useLocalSearchParams<{ username: string }>()
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const isSelf = me?.username === username

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['user-albums', username],
    queryFn: () => {
      if (isSelf) return albumsApi.list().then(r => r.data)
      return albumsApi.getUserAlbums(username!).then(r => r.data)
    },
  })

  const albums: any[] = data?.albums || data || []

  const createAlbum = useMutation({
    mutationFn: () => albumsApi.create({ name: newName.trim(), description: newDesc.trim() || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['user-albums', username] })
      setShowCreateModal(false)
      setNewName('')
      setNewDesc('')
      const created = res.data?.album || res.data
      if (created?.id) router.push(`/album/${created.id}`)
    },
    onError: () => Alert.alert('Error', 'Could not create album.'),
  })

  const openCreate = () => {
    setNewName('')
    setNewDesc('')
    setShowCreateModal(true)
  }

  if (isLoading) return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Albums', headerTintColor: c.primary }} />
      <Spinner />
    </Screen>
  )

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: isSelf ? 'My Albums' : `${username}'s Albums`,
        headerBackTitle: 'Profile',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
        headerRight: () => isSelf ? (
          <TouchableOpacity onPress={openCreate} style={{ paddingRight: 4 }}>
            <Ionicons name="add" size={26} color={c.primary} />
          </TouchableOpacity>
        ) : null,
      }} />

      <FlatList
        data={albums}
        keyExtractor={a => a.id}
        numColumns={2}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
        columnWrapperStyle={s.row}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/album/${item.id}`)}
            style={[s.albumCard, { backgroundColor: c.card, borderColor: c.border }]}
            activeOpacity={0.8}
          >
            <View style={s.albumThumb}>
              {item.cover_url || item.photos?.[0]?.url ? (
                <Image
                  source={{ uri: imgUrl(item.cover_url || item.photos[0].url) }}
                  style={s.thumbImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[s.thumbPlaceholder, { backgroundColor: c.primaryBg }]}>
                  <Ionicons name="images-outline" size={32} color={c.textLight} />
                </View>
              )}
            </View>
            <View style={s.albumInfo}>
              <Text style={[s.albumName, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[s.albumMeta, { color: c.textMuted }]}>
                {item.photo_count ?? item.photos?.length ?? 0} {(item.photo_count ?? item.photos?.length ?? 0) === 1 ? 'photo' : 'photos'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={(
          <View style={s.empty}>
            <Ionicons name="albums-outline" size={52} color={c.textLight} />
            <Text style={[s.emptyText, { color: c.textLight }]}>No albums yet</Text>
            {isSelf && (
              <TouchableOpacity onPress={openCreate} style={[s.createBtn, { backgroundColor: c.primary }]}>
                <Text style={s.createBtnText}>Create album</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Create album modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={[s.modalCancel, { color: c.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[s.modalTitle, { color: c.text }]}>New Album</Text>
              <TouchableOpacity
                onPress={() => createAlbum.mutate()}
                disabled={!newName.trim() || createAlbum.isPending}
              >
                <Text style={[s.modalSave, { color: newName.trim() ? c.primary : c.textLight }]}>
                  {createAlbum.isPending ? 'Creating…' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[s.field, { borderColor: c.border }]}>
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>Name</Text>
              <TextInput
                style={[s.fieldInput, { color: c.text }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="Album name"
                placeholderTextColor={c.textLight}
                autoFocus
                returnKeyType="next"
              />
            </View>
            <View style={[s.field, { borderColor: c.border }]}>
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>Description (optional)</Text>
              <TextInput
                style={[s.fieldInput, { color: c.text }]}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Add a description…"
                placeholderTextColor={c.textLight}
                multiline
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

const s = StyleSheet.create({
  list:          { padding: 12, gap: 12, paddingBottom: 32 },
  row:           { gap: 12 },
  albumCard:     { width: CARD_SIZE, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  albumThumb:    { width: '100%', height: CARD_SIZE },
  thumbImage:    { width: '100%', height: '100%' },
  thumbPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  albumInfo:     { padding: 10 },
  albumName:     { fontSize: 16, fontWeight: '600' },
  albumMeta:     { fontSize: 13, marginTop: 2 },
  empty:         { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyText:     { fontSize: 18, fontWeight: '500' },
  createBtn:     { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  createBtnText: { color: 'white', fontWeight: '600', fontSize: 17 },
  modal:         { flex: 1, padding: 20 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle:    { fontSize: 19, fontWeight: '600' },
  modalCancel:   { fontSize: 18 },
  modalSave:     { fontSize: 18, fontWeight: '600' },
  field:         { borderBottomWidth: 1, paddingVertical: 12, marginBottom: 8 },
  fieldLabel:    { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldInput:    { fontSize: 18 },
})
