import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header } from '../../components/ui'
import { feedApi, pagesApi, imgUrl } from '../../api'
import { useC } from '../../constants/ColorContext'

const PAGE_TYPES = [
  { value: 'band',         label: 'Band',         icon: 'musical-notes', desc: 'For musicians and bands' },
  { value: 'business',     label: 'Business',     icon: 'briefcase',     desc: 'For companies and shops' },
  { value: 'organization', label: 'Organization', icon: 'people',        desc: 'For non-profits and clubs' },
  { value: 'creator',      label: 'Creator',      icon: 'sparkles',      desc: 'For artists and influencers' },
]

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function CreatePageScreen() {
  const c = useC()
  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 5

  // Step 1
  const [displayName, setDisplayName] = useState('')
  // Step 2
  const [bio, setBio] = useState('')
  // Step 3
  const [pageType, setPageType] = useState<string | null>(null)
  // Step 4
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  const slug = toSlug(displayName)

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

  const createPage = useMutation({
    mutationFn: () => pagesApi.create({
      display_name: displayName.trim(),
      bio: bio.trim(),
      page_type: pageType,
      avatar_url: avatarUrl ?? '',
      cover_url: coverUrl ?? '',
      privacy: 'public',
    }),
    onSuccess: (res) => {
      const newSlug = res.data?.slug || slug
      router.replace(`/pages/${newSlug}` as any)
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not create page'),
  })

  const canNext = () => {
    if (step === 1) return displayName.trim().length > 0
    if (step === 3) return pageType !== null
    return true
  }

  const handleBack = () => {
    if (step === 1) router.back()
    else setStep(s => s - 1)
  }

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(s => s + 1)
    else createPage.mutate()
  }

  return (
    <Screen>
      <Header
        title="Create Page"
        left={
          <TouchableOpacity onPress={handleBack} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={22} color={c.primary} />
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Text style={{ color: c.textMuted, fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        }
      />

      {/* Progress bar */}
      <View style={[s.progressWrap, { backgroundColor: c.border }]}>
        <View style={[s.progressFill, { backgroundColor: c.primary, width: `${(step / TOTAL_STEPS) * 100}%` as any }]} />
      </View>
      <Text style={[s.stepLabel, { color: c.textMuted }]}>Step {step} of {TOTAL_STEPS}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

          {/* Step 1: Name */}
          {step === 1 && (
            <View>
              <Text style={[s.stepTitle, { color: c.text }]}>Name your page</Text>
              <Text style={[s.stepDesc, { color: c.textMuted }]}>Choose a display name. This is what people will see.</Text>
              <TextInput
                style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                placeholder="e.g. The Rolling Stones"
                placeholderTextColor={c.textLight}
                value={displayName}
                onChangeText={setDisplayName}
                autoFocus
                maxLength={80}
              />
              {displayName.trim().length > 0 && (
                <View style={[s.slugPreview, { backgroundColor: c.primaryBg, borderColor: c.primaryLt }]}>
                  <Text style={[s.slugLabel, { color: c.textMuted }]}>Page URL</Text>
                  <Text style={[s.slugValue, { color: c.primary }]}>agora.social/pages/{slug || '…'}</Text>
                </View>
              )}
            </View>
          )}

          {/* Step 2: Bio */}
          {step === 2 && (
            <View>
              <Text style={[s.stepTitle, { color: c.text }]}>Add a bio</Text>
              <Text style={[s.stepDesc, { color: c.textMuted }]}>Tell people what your page is about. (Optional)</Text>
              <TextInput
                style={[s.input, s.inputMulti, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                placeholder="A short description…"
                placeholderTextColor={c.textLight}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={300}
                autoFocus
              />
              <Text style={[{ color: c.textLight, fontSize: 12, textAlign: 'right', marginTop: 4 }]}>{bio.length}/300</Text>
            </View>
          )}

          {/* Step 3: Type */}
          {step === 3 && (
            <View>
              <Text style={[s.stepTitle, { color: c.text }]}>Page type</Text>
              <Text style={[s.stepDesc, { color: c.textMuted }]}>What best describes your page?</Text>
              <View style={{ gap: 10, marginTop: 8 }}>
                {PAGE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setPageType(t.value)}
                    style={[s.typeCard, {
                      borderColor: pageType === t.value ? c.primary : c.border,
                      backgroundColor: pageType === t.value ? c.primaryBg : c.card,
                    }]}
                  >
                    <View style={[s.typeIcon, { backgroundColor: pageType === t.value ? c.primary : c.bg }]}>
                      <Ionicons name={t.icon as any} size={22} color={pageType === t.value ? 'white' : c.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.typeLabel, { color: pageType === t.value ? c.primary : c.text }]}>{t.label}</Text>
                      <Text style={[s.typeDesc, { color: c.textMuted }]}>{t.desc}</Text>
                    </View>
                    {pageType === t.value && <Ionicons name="checkmark-circle" size={20} color={c.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 4: Photos */}
          {step === 4 && (
            <View>
              <Text style={[s.stepTitle, { color: c.text }]}>Add photos</Text>
              <Text style={[s.stepDesc, { color: c.textMuted }]}>Upload an avatar and cover photo. Both are optional.</Text>
              <View style={{ gap: 14, marginTop: 8 }}>
                {/* Avatar */}
                <View style={[s.photoCard, { borderColor: c.border, backgroundColor: c.card }]}>
                  <Text style={[s.photoCardLabel, { color: c.text }]}>Avatar</Text>
                  {avatarUrl ? (
                    <Image source={{ uri: imgUrl(avatarUrl) }} style={s.avatarPreview} contentFit="cover" />
                  ) : null}
                  <TouchableOpacity
                    onPress={() => pickAndUpload('avatar')}
                    disabled={uploadingAvatar}
                    style={[s.uploadBtn, { borderColor: c.primary }]}
                  >
                    {uploadingAvatar
                      ? <ActivityIndicator size="small" color={c.primary} />
                      : <><Ionicons name="camera-outline" size={18} color={c.primary} /><Text style={[s.uploadBtnText, { color: c.primary }]}>{avatarUrl ? 'Change avatar' : 'Upload avatar'}</Text></>
                    }
                  </TouchableOpacity>
                </View>
                {/* Cover */}
                <View style={[s.photoCard, { borderColor: c.border, backgroundColor: c.card }]}>
                  <Text style={[s.photoCardLabel, { color: c.text }]}>Cover photo</Text>
                  {coverUrl ? (
                    <Image source={{ uri: imgUrl(coverUrl) }} style={s.coverPreview} contentFit="cover" />
                  ) : null}
                  <TouchableOpacity
                    onPress={() => pickAndUpload('cover')}
                    disabled={uploadingCover}
                    style={[s.uploadBtn, { borderColor: c.primary }]}
                  >
                    {uploadingCover
                      ? <ActivityIndicator size="small" color={c.primary} />
                      : <><Ionicons name="image-outline" size={18} color={c.primary} /><Text style={[s.uploadBtnText, { color: c.primary }]}>{coverUrl ? 'Change cover' : 'Upload cover'}</Text></>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <View>
              <Text style={[s.stepTitle, { color: c.text }]}>Review & publish</Text>
              <Text style={[s.stepDesc, { color: c.textMuted }]}>Check everything looks right before creating your page.</Text>
              <View style={[s.reviewCard, { borderColor: c.border, backgroundColor: c.card }]}>
                {avatarUrl && (
                  <Image source={{ uri: imgUrl(avatarUrl) }} style={s.reviewAvatar} contentFit="cover" />
                )}
                <View style={{ gap: 8 }}>
                  <View>
                    <Text style={[s.reviewLabel, { color: c.textMuted }]}>Display name</Text>
                    <Text style={[s.reviewValue, { color: c.text }]}>{displayName}</Text>
                  </View>
                  <View>
                    <Text style={[s.reviewLabel, { color: c.textMuted }]}>URL slug</Text>
                    <Text style={[s.reviewValue, { color: c.primary }]}>/{slug}</Text>
                  </View>
                  {bio ? (
                    <View>
                      <Text style={[s.reviewLabel, { color: c.textMuted }]}>Bio</Text>
                      <Text style={[s.reviewValue, { color: c.text }]}>{bio}</Text>
                    </View>
                  ) : null}
                  <View>
                    <Text style={[s.reviewLabel, { color: c.textMuted }]}>Type</Text>
                    <Text style={[s.reviewValue, { color: c.text }]}>{PAGE_TYPES.find(t => t.value === pageType)?.label ?? '—'}</Text>
                  </View>
                  <View>
                    <Text style={[s.reviewLabel, { color: c.textMuted }]}>Privacy</Text>
                    <Text style={[s.reviewValue, { color: c.text }]}>Public</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Next / Create button */}
      <View style={[s.footer, { borderTopColor: c.border }]}>
        <TouchableOpacity
          onPress={handleNext}
          disabled={!canNext() || createPage.isPending}
          style={[s.nextBtn, { backgroundColor: !canNext() ? c.primaryLt : c.primary }]}
        >
          {createPage.isPending
            ? <ActivityIndicator color="white" />
            : <Text style={s.nextBtnText}>{step === TOTAL_STEPS ? 'Create Page' : 'Next'}</Text>
          }
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const s = StyleSheet.create({
  progressWrap:   { height: 4, marginHorizontal: 16, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  progressFill:   { height: 4, borderRadius: 2 },
  stepLabel:      { fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 4 },
  body:           { padding: 20, paddingBottom: 40 },
  stepTitle:      { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  stepDesc:       { fontSize: 14, marginBottom: 18, lineHeight: 20 },
  input:          { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  inputMulti:     { minHeight: 100, textAlignVertical: 'top' },
  slugPreview:    { marginTop: 12, borderWidth: 1, borderRadius: 10, padding: 12 },
  slugLabel:      { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  slugValue:      { fontSize: 14, fontWeight: '500' },
  typeCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  typeIcon:       { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeLabel:      { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  typeDesc:       { fontSize: 12 },
  photoCard:      { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  photoCardLabel: { fontSize: 14, fontWeight: '600' },
  avatarPreview:  { width: 72, height: 72, borderRadius: 36 },
  coverPreview:   { width: '100%', height: 100, borderRadius: 10 },
  uploadBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  uploadBtnText:  { fontSize: 14, fontWeight: '600' },
  reviewCard:     { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  reviewAvatar:   { width: 64, height: 64, borderRadius: 32 },
  reviewLabel:    { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  reviewValue:    { fontSize: 15, fontWeight: '500' },
  footer:         { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  nextBtn:        { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  nextBtnText:    { color: 'white', fontSize: 16, fontWeight: '700' },
})
