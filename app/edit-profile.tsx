import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, StyleSheet } from 'react-native'
import { router, Stack } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { Screen, Avatar } from '../components/ui'
import { usersApi, feedApi } from '../api'
import { useAuthStore } from '../store/auth'
import { C } from '../constants/colors'
import { useC } from '../constants/ColorContext'

export default function EditProfileScreen() {
  const c = useC()
  const { user, updateUser } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [pronouns, setPronouns] = useState(user?.pronouns || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [location, setLocation] = useState((user as any)?.location || '')
  const [website, setWebsite] = useState((user as any)?.website || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const save = useMutation({
    mutationFn: () => usersApi.updateProfile({ display_name: displayName, pronouns, bio, location, website }),
    onSuccess: () => {
      updateUser({ display_name: displayName, pronouns, bio })
      Alert.alert('Saved!', undefined, [{ text: 'OK', onPress: () => router.back() }])
    },
    onError: () => Alert.alert('Error', 'Could not save profile'),
  })

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [1,1] })
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

  const Field = ({ label, value, onChangeText, placeholder, multiline = false }: any) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        placeholder={placeholder} placeholderTextColor={c.textLight}
        value={value} onChangeText={onChangeText}
        multiline={multiline} autoCapitalize="none" autoCorrect={false}
      />
    </View>
  )

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Edit Profile', headerBackTitle: 'Profile', headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary,
        headerRight: () => (
          <TouchableOpacity onPress={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <ActivityIndicator size="small" color={c.primary} /> : <Text style={{ color: c.primary, fontWeight: '600', fontSize: 16 }}>Save</Text>}
          </TouchableOpacity>
        ),
      }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={s.avatarSection}>
            <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar}>
              <View style={{ position: 'relative' }}>
                <Avatar url={avatarUrl} name={user?.display_name || user?.username} size={80} />
                <View style={s.editBadge}>
                  {uploadingAvatar ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: 'white', fontSize: 14 }}>✏️</Text>}
                </View>
              </View>
            </TouchableOpacity>
            <Text style={{ color: c.primary, fontSize: 14, marginTop: 8 }}>Change photo</Text>
          </View>
          <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Your name" />
          <Field label="Pronouns" value={pronouns} onChangeText={setPronouns} placeholder="e.g. they/them" />
          <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Tell people about yourself" multiline />
          <Field label="Location" value={location} onChangeText={setLocation} placeholder="Where are you?" />
          <Field label="Website" value={website} onChangeText={setWebsite} placeholder="https://yoursite.com" />
          <TouchableOpacity onPress={() => save.mutate()} disabled={save.isPending}
            style={[s.saveBtn, save.isPending && { backgroundColor: c.primaryLt }]}>
            <Text style={s.saveBtnText}>{save.isPending ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, backgroundColor: C.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  label: { fontSize: 14, fontWeight: '500', color: C.textMd, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.text, backgroundColor: C.card },
  saveBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  saveBtnText: { color: 'white', fontWeight: '600', fontSize: 16 },
})
