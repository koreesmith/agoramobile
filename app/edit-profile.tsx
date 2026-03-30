import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, StyleSheet, Switch } from 'react-native'
import { router, Stack } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Screen, Avatar } from '../components/ui'
import { usersApi, notificationsApi, feedApi, imgUrl } from '../api'
import { useAuthStore } from '../store/auth'
import { useC } from '../constants/ColorContext'

// Field defined OUTSIDE component so React doesn't recreate it on every render
// (prevents keyboard dismissal bug with third-party keyboards)
const Field = ({
  label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default', c
}: {
  label: string; value: string; onChangeText: (t: string) => void
  placeholder?: string; multiline?: boolean; keyboardType?: any; c: any
}) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={[f.label, { color: c.textMd }]}>{label}</Text>
    <TextInput
      style={[f.input, { borderColor: c.border, color: c.text, backgroundColor: c.card },
        multiline && { minHeight: 90, textAlignVertical: 'top' }]}
      placeholder={placeholder}
      placeholderTextColor={c.textLight}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={keyboardType}
      // Prevents keyboard from dismissing between characters
      blurOnSubmit={!multiline}
    />
  </View>
)

export default function EditProfileScreen() {
  const c = useC()
  const insets = useSafeAreaInsets()
  const { user, updateUser } = useAuthStore()
  const queryClient = useQueryClient()

  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [pronouns, setPronouns] = useState(user?.pronouns || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [location, setLocation] = useState((user as any)?.location || '')
  const [website, setWebsite] = useState((user as any)?.website || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [coverUrl, setCoverUrl] = useState((user as any)?.cover_url || '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  // Email notification prefs
  const { data: emailPrefs } = useQuery({
    queryKey: ['email-prefs'],
    queryFn: () => notificationsApi.getEmailPrefs().then(r => r.data),
  })
  const emailEnabled = emailPrefs?.email_notifications_enabled ?? true

  const toggleEmail = useMutation({
    mutationFn: (enabled: boolean) => notificationsApi.updateEmailPrefs(enabled),
    onSuccess: (_, enabled) => queryClient.setQueryData(['email-prefs'], { email_notifications_enabled: enabled }),
    onError: () => Alert.alert('Error', 'Could not update notification settings'),
  })

  const togglePrivate = useMutation({
    mutationFn: (val: boolean) => usersApi.updateProfile({ profile_private: val } as any),
    onSuccess: (_, val) => updateUser({ profile_private: val } as any),
    onError: () => Alert.alert('Error', 'Could not update setting'),
  })

  const toggleHideTimeline = useMutation({
    mutationFn: (val: boolean) => usersApi.updateProfile({ hide_timeline: val } as any),
    onSuccess: (_, val) => updateUser({ hide_timeline: val } as any),
    onError: () => Alert.alert('Error', 'Could not update setting'),
  })

  const save = useMutation({
    mutationFn: () => usersApi.updateProfile({ display_name: displayName, pronouns, bio, location, website }),
    onSuccess: () => {
      updateUser({ display_name: displayName, pronouns, bio })
      Alert.alert('Saved!', undefined, [{ text: 'OK', onPress: () => router.back() }])
    },
    onError: () => Alert.alert('Error', 'Could not save profile'),
  })

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1] })
    if (result.canceled) return
    setUploadingAvatar(true)
    try {
      const file = { uri: result.assets[0].uri, type: 'image/jpeg', name: 'avatar.jpg' } as any
      const res = await usersApi.uploadAvatar(file)
      setAvatarUrl(res.data.avatar_url)
      updateUser({ avatar_url: res.data.avatar_url })
    } catch { Alert.alert('Upload failed') }
    finally { setUploadingAvatar(false) }
  }

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
    if (result.canceled) return
    setUploadingCover(true)
    try {
      const file = { uri: result.assets[0].uri, type: 'image/jpeg', name: 'cover.jpg' } as any
      const res = await feedApi.uploadMedia(file, 'covers')
      await usersApi.updateProfile({ cover_url: res.data.url })
      setCoverUrl(res.data.url)
      updateUser({ cover_url: res.data.url } as any)
    } catch { Alert.alert('Upload failed') }
    finally { setUploadingCover(false) }
  }

  // Stable handlers — won't cause Field to re-render unnecessarily
  const handleDisplayName = useCallback((t: string) => setDisplayName(t), [])
  const handlePronouns    = useCallback((t: string) => setPronouns(t), [])
  const handleBio         = useCallback((t: string) => setBio(t), [])
  const handleLocation    = useCallback((t: string) => setLocation(t), [])
  const handleWebsite     = useCallback((t: string) => setWebsite(t), [])

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true, headerTitle: 'Edit Profile', headerBackTitle: 'Back',
        headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary,
        headerRight: () => (
          <TouchableOpacity onPress={() => save.mutate()} disabled={save.isPending}>
            {save.isPending
              ? <ActivityIndicator size="small" color={c.primary} />
              : <Text style={{ color: c.primary, fontWeight: '600', fontSize: 16 }}>Save</Text>}
          </TouchableOpacity>
        ),
      }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 44}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >

          {/* Cover photo */}
          <TouchableOpacity onPress={pickCover} disabled={uploadingCover} style={{ marginBottom: 16 }}>
            <View style={[f.coverWrap, { backgroundColor: c.primaryBg }]}>
              {coverUrl
                ? <Image source={{ uri: imgUrl(coverUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                : <Text style={{ color: c.textMuted, fontSize: 13 }}>Tap to add cover photo</Text>}
              {uploadingCover && (
                <View style={f.coverOverlay}>
                  <ActivityIndicator color="white" />
                </View>
              )}
              <View style={f.coverEditBadge}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>EDIT</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Avatar */}
          <View style={f.avatarSection}>
            <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar}>
              <View style={{ position: 'relative' }}>
                <Avatar url={avatarUrl} name={user?.display_name || user?.username} size={80} />
                <View style={[f.editBadge, { backgroundColor: c.primary }]}>
                  {uploadingAvatar
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={{ color: 'white', fontSize: 14 }}>✏️</Text>}
                </View>
              </View>
            </TouchableOpacity>
            <Text style={{ color: c.primary, fontSize: 13, marginTop: 6 }}>Change photo</Text>
          </View>

          {/* Profile fields */}
          <Text style={[f.sectionLabel, { color: c.textMuted }]}>Profile</Text>
          <Field label="Display name" value={displayName} onChangeText={handleDisplayName} placeholder="Your name" c={c} />
          <Field label="Pronouns" value={pronouns} onChangeText={handlePronouns} placeholder="e.g. they/them" c={c} />
          <Field label="Bio" value={bio} onChangeText={handleBio} placeholder="Tell people about yourself" multiline c={c} />
          <Field label="Location" value={location} onChangeText={handleLocation} placeholder="Where are you?" c={c} />
          <Field label="Website" value={website} onChangeText={handleWebsite} placeholder="https://yoursite.com" keyboardType="url" c={c} />

          {/* Notification settings */}
          <Text style={[f.sectionLabel, { color: c.textMuted, marginTop: 8 }]}>Notifications</Text>
          <View style={[f.toggleRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: c.text, fontWeight: '500' }}>Email notifications</Text>
              <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>Receive emails for likes, comments, friend requests</Text>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={(val) => toggleEmail.mutate(val)}
              trackColor={{ false: c.border, true: c.primary }}
              disabled={toggleEmail.isPending}
            />
          </View>

          {/* Privacy settings */}
          <Text style={[f.sectionLabel, { color: c.textMuted, marginTop: 8 }]}>Privacy</Text>
          <View style={[f.toggleRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: c.text, fontWeight: '500' }}>Private profile</Text>
              <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>Only friends can see your profile and timeline</Text>
            </View>
            <Switch
              value={!!(user as any)?.profile_private}
              onValueChange={(val) => togglePrivate.mutate(val)}
              trackColor={{ false: c.border, true: c.primary }}
              disabled={togglePrivate.isPending}
            />
          </View>
          <View style={[f.toggleRow, { backgroundColor: c.card, borderColor: c.border, marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: c.text, fontWeight: '500' }}>Hide timeline</Text>
              <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>Nobody can browse your posts on your profile — posts still appear in friends' feeds</Text>
            </View>
            <Switch
              value={!!(user as any)?.hide_timeline}
              onValueChange={(val) => toggleHideTimeline.mutate(val)}
              trackColor={{ false: c.border, true: c.primary }}
              disabled={toggleHideTimeline.isPending}
            />
          </View>

          <TouchableOpacity
            onPress={() => save.mutate()}
            disabled={save.isPending}
            style={[f.saveBtn, { backgroundColor: save.isPending ? c.primaryLt : c.primary }]}
          >
            <Text style={f.saveBtnText}>{save.isPending ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const f = StyleSheet.create({
  sectionLabel:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  label:         { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input:         { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  editBadge:     { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  coverWrap:     { width: '100%', height: 120, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  coverEditBadge:{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  toggleRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  saveBtn:       { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText:   { color: 'white', fontWeight: '600', fontSize: 16 },
})
