import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, StyleSheet, Switch, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner } from '../../../components/ui'
import { feedApi, pagesApi, imgUrl } from '../../../api'
import { useC } from '../../../constants/ColorContext'

const PAGE_TYPES = ['band', 'business', 'organization', 'creator']

export default function EditPageScreen() {
  const c = useC()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const qc = useQueryClient()

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['page', slug],
    queryFn: () => pagesApi.get(slug).then(r => r.data),
    enabled: !!slug,
  })
  const page = pageData?.page || pageData

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [pageType, setPageType] = useState('band')
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [initialised, setInitialised] = useState(false)

  useEffect(() => {
    if (page && !initialised) {
      setDisplayName(page.display_name || '')
      setBio(page.bio || '')
      setPageType(page.page_type || 'band')
      setPrivacy(page.privacy === 'private' ? 'private' : 'public')
      setAvatarUrl(page.avatar_url || null)
      setCoverUrl(page.cover_url || null)
      setInitialised(true)
    }
  }, [page, initialised])

  const pickAndUpload = async (type: 'avatar' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [3, 1],
    })
    if (result.canceled) return
    const asset = result.assets[0]
    const file = { uri: asset.uri, type: 'image/jpeg', name: `${type}.jpg` } as any
    if (type === 'avatar') {
      setUploadingAvatar(true)
      try {
        const res = await feedApi.uploadMedia(file, 'pages')
        setAvatarUrl(res.data.url)
      } catch { Alert.alert('Upload failed') }
      finally { setUploadingAvatar(false) }
    } else {
      setUploadingCover(true)
      try {
        const res = await feedApi.uploadMedia(file, 'pages')
        setCoverUrl(res.data.url)
      } catch { Alert.alert('Upload failed') }
      finally { setUploadingCover(false) }
    }
  }

  const save = useMutation({
    mutationFn: () => pagesApi.update(slug, {
      display_name: displayName.trim(),
      bio: bio.trim(),
      page_type: pageType,
      privacy,
      avatar_url: avatarUrl ?? '',
      cover_url: coverUrl ?? '',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['page', slug] })
      Alert.alert('Saved', 'Page settings updated.')
      router.back()
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not save changes'),
  })

  if (isLoading) return <Screen><Spinner /></Screen>

  return (
    <Screen>
      <Header
        title="Edit Page"
        left={
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={22} color={c.primary} />
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

          {/* Display name */}
          <Text style={[s.label, { color: c.textMd }]}>Display name</Text>
          <TextInput
            style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Page name"
            placeholderTextColor={c.textLight}
            maxLength={80}
          />

          {/* Bio */}
          <Text style={[s.label, { color: c.textMd }]}>Bio</Text>
          <TextInput
            style={[s.input, s.inputMulti, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Short description"
            placeholderTextColor={c.textLight}
            multiline
            maxLength={300}
          />

          {/* Page type */}
          <Text style={[s.label, { color: c.textMd }]}>Page type</Text>
          <View style={s.typeRow}>
            {PAGE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setPageType(t)}
                style={[s.typeChip, {
                  borderColor: pageType === t ? c.primary : c.border,
                  backgroundColor: pageType === t ? c.primaryBg : c.card,
                }]}
              >
                <Text style={[s.typeChipText, { color: pageType === t ? c.primary : c.textMuted }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Privacy */}
          <View style={[s.switchRow, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.switchLabel, { color: c.text }]}>Private page</Text>
              <Text style={[s.switchDesc, { color: c.textMuted }]}>Only approved followers can see posts</Text>
            </View>
            <Switch
              value={privacy === 'private'}
              onValueChange={v => setPrivacy(v ? 'private' : 'public')}
              trackColor={{ false: c.border, true: c.primary }}
            />
          </View>

          {/* Avatar */}
          <Text style={[s.label, { color: c.textMd }]}>Avatar</Text>
          <View style={s.photoRow}>
            {avatarUrl ? (
              <Image source={{ uri: imgUrl(avatarUrl) }} style={s.avatarPreview} contentFit="cover" />
            ) : (
              <View style={[s.avatarPlaceholder, { backgroundColor: c.bg, borderColor: c.border }]}>
                <Ionicons name="person" size={28} color={c.textLight} />
              </View>
            )}
            <TouchableOpacity
              onPress={() => pickAndUpload('avatar')}
              disabled={uploadingAvatar}
              style={[s.uploadBtn, { borderColor: c.primary }]}
            >
              {uploadingAvatar
                ? <ActivityIndicator size="small" color={c.primary} />
                : <Text style={[s.uploadBtnText, { color: c.primary }]}>{avatarUrl ? 'Change' : 'Upload'}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Cover */}
          <Text style={[s.label, { color: c.textMd }]}>Cover photo</Text>
          {coverUrl ? (
            <Image source={{ uri: imgUrl(coverUrl) }} style={s.coverPreview} contentFit="cover" />
          ) : null}
          <TouchableOpacity
            onPress={() => pickAndUpload('cover')}
            disabled={uploadingCover}
            style={[s.uploadBtn, { borderColor: c.primary, marginBottom: 24 }]}
          >
            {uploadingCover
              ? <ActivityIndicator size="small" color={c.primary} />
              : <><Ionicons name="image-outline" size={16} color={c.primary} /><Text style={[s.uploadBtnText, { color: c.primary }]}>{coverUrl ? 'Change cover' : 'Upload cover'}</Text></>
            }
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity
            onPress={() => save.mutate()}
            disabled={!displayName.trim() || save.isPending}
            style={[s.saveBtn, { backgroundColor: !displayName.trim() ? c.primaryLt : c.primary }]}
          >
            {save.isPending
              ? <ActivityIndicator color="white" />
              : <Text style={s.saveBtnText}>Save changes</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  body:             { padding: 20, paddingBottom: 40 },
  label:            { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input:            { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  inputMulti:       { minHeight: 90, textAlignVertical: 'top' },
  typeRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:         { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  typeChipText:     { fontSize: 13, fontWeight: '600' },
  switchRow:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 14, gap: 12 },
  switchLabel:      { fontSize: 15, fontWeight: '500' },
  switchDesc:       { fontSize: 12, marginTop: 2 },
  photoRow:         { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarPreview:    { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder:{ width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  coverPreview:     { width: '100%', height: 100, borderRadius: 10, marginBottom: 8 },
  uploadBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  uploadBtnText:    { fontSize: 14, fontWeight: '600' },
  saveBtn:          { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveBtnText:      { color: 'white', fontSize: 16, fontWeight: '700' },
})
