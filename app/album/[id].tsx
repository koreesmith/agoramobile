import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Image,
  Alert, StyleSheet, Modal, Dimensions, ActivityIndicator,
  RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Screen, Spinner, UploadingModal } from '../../components/ui'
import { albumsApi, feedApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useC } from '../../constants/ColorContext'
import { C } from '../../constants/colors'
import { normalizeImageOrientation } from '../../utils/image'

const { width } = Dimensions.get('window')
const PHOTO_SIZE = (width - 4) / 3

export default function AlbumScreen() {
  const c = useC()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user: me } = useAuthStore()
  const qc = useQueryClient()

  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['album', id],
    queryFn: () => albumsApi.get(id!).then(r => r.data),
  })

  const album = data?.album || data
  const photos: any[] = album?.photos || []
  const isOwner = me?.id === album?.user_id || me?.username === album?.username

  const updateAlbum = useMutation({
    mutationFn: (d: { name: string; description?: string }) => albumsApi.update(id!, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['album', id] })
      qc.invalidateQueries({ queryKey: ['user-albums'] })
      setShowEditModal(false)
    },
    onError: () => Alert.alert('Error', 'Could not update album.'),
  })

  const deleteAlbum = useMutation({
    mutationFn: () => albumsApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-albums'] })
      router.back()
    },
    onError: () => Alert.alert('Error', 'Could not delete album.'),
  })

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => albumsApi.deletePhoto(id!, photoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['album', id] }),
    onError: () => Alert.alert('Error', 'Could not delete photo.'),
  })

  const openEditModal = () => {
    setEditName(album?.name || '')
    setEditDesc(album?.description || '')
    setShowEditModal(true)
  }

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    })
    if (result.canceled) return
    setUploading(true)
    const slowTimer = setTimeout(() => setShowUploadModal(true), 1000)
    try {
      for (const asset of result.assets) {
        const uri = await normalizeImageOrientation(asset.uri)
        const file = { uri, type: 'image/jpeg', name: 'photo.jpg' } as any
        const res = await feedApi.uploadMedia(file, 'posts')
        await albumsApi.addPhoto(id!, { url: res.data.url })
      }
      qc.invalidateQueries({ queryKey: ['album', id] })
    } catch {
      Alert.alert('Upload failed', 'Could not add photo.')
    } finally {
      clearTimeout(slowTimer)
      setShowUploadModal(false)
      setUploading(false)
    }
  }

  const handleLongPressPhoto = (photo: any) => {
    if (!isOwner) return
    Alert.alert('Remove photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deletePhoto.mutate(photo.id) },
    ])
  }

  const handleDeleteAlbum = () => {
    Alert.alert('Delete album?', 'This will permanently delete the album and all its photos.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAlbum.mutate() },
    ])
  }

  if (isLoading || !album) return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Album', headerTintColor: c.primary }} />
      <Spinner />
    </Screen>
  )

  return (
    <Screen>
      <UploadingModal visible={showUploadModal} />
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: album.name,
        headerBackTitle: 'Albums',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
        headerRight: () => isOwner ? (
          <TouchableOpacity onPress={() => Alert.alert(album.name, undefined, [
            { text: 'Edit album', onPress: openEditModal },
            { text: 'Delete album', style: 'destructive', onPress: handleDeleteAlbum },
            { text: 'Cancel', style: 'cancel' },
          ])}>
            <Ionicons name="ellipsis-horizontal" size={22} color={c.primary} />
          </TouchableOpacity>
        ) : null,
      }} />

      <FlatList
        data={photos}
        keyExtractor={p => p.id}
        numColumns={3}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
        columnWrapperStyle={{ gap: 2 }}
        contentContainerStyle={{ gap: 2, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() => handleLongPressPhoto(item)}
            activeOpacity={0.8}
            style={s.photoCell}
          >
            <Image source={{ uri: imgUrl(item.url) }} style={s.photo} resizeMode="cover" />
            {item.caption ? (
              <View style={s.captionOverlay}>
                <Text style={s.captionText} numberOfLines={2}>{item.caption}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )}
        ListHeaderComponent={(
          <View style={[s.header, { backgroundColor: c.card }]}>
            {album.description ? (
              <Text style={[s.description, { color: c.textMd }]}>{album.description}</Text>
            ) : null}
            <Text style={[s.photoCount, { color: c.textMuted }]}>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</Text>
            {isOwner && (
              <TouchableOpacity
                onPress={handleAddPhoto}
                disabled={uploading}
                style={[s.addBtn, { backgroundColor: c.primary }]}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="white" />
                  : <>
                      <Ionicons name="add" size={18} color="white" />
                      <Text style={s.addBtnText}>Add photos</Text>
                    </>}
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={(
          <View style={s.empty}>
            <Ionicons name="images-outline" size={48} color={c.textLight} />
            <Text style={[s.emptyText, { color: c.textLight }]}>No photos yet</Text>
            {isOwner && (
              <Text style={[s.emptySubtext, { color: c.textMuted }]}>Tap "Add photos" to get started</Text>
            )}
          </View>
        )}
      />

      {/* Edit album modal */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={[s.modalCancel, { color: c.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[s.modalTitle, { color: c.text }]}>Edit Album</Text>
              <TouchableOpacity
                onPress={() => updateAlbum.mutate({ name: editName.trim(), description: editDesc.trim() || undefined })}
                disabled={!editName.trim() || updateAlbum.isPending}
              >
                <Text style={[s.modalSave, { color: editName.trim() ? c.primary : c.textLight }]}>
                  {updateAlbum.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[s.field, { borderColor: c.border }]}>
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>Name</Text>
              <TextInput
                style={[s.fieldInput, { color: c.text }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Album name"
                placeholderTextColor={c.textLight}
                autoFocus
              />
            </View>
            <View style={[s.field, { borderColor: c.border }]}>
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>Description (optional)</Text>
              <TextInput
                style={[s.fieldInput, { color: c.text }]}
                value={editDesc}
                onChangeText={setEditDesc}
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
  header:        { padding: 16, gap: 8 },
  description:   { fontSize: 14, lineHeight: 20 },
  photoCount:    { fontSize: 13 },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  addBtnText:    { color: 'white', fontWeight: '600', fontSize: 14 },
  photoCell:     { width: PHOTO_SIZE, height: PHOTO_SIZE, position: 'relative' },
  photo:         { width: '100%', height: '100%' },
  captionOverlay:{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', padding: 4 },
  captionText:   { color: 'white', fontSize: 10, lineHeight: 13 },
  empty:         { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyText:     { fontSize: 16, fontWeight: '500' },
  emptySubtext:  { fontSize: 13 },
  modal:         { flex: 1, padding: 20 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle:    { fontSize: 17, fontWeight: '600' },
  modalCancel:   { fontSize: 16 },
  modalSave:     { fontSize: 16, fontWeight: '600' },
  field:         { borderBottomWidth: 1, paddingVertical: 12, marginBottom: 8 },
  fieldLabel:    { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldInput:    { fontSize: 16 },
})
