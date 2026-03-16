import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image,
} from 'react-native'
import { router, Stack } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { Screen, Avatar } from '../../components/ui'
import { usersApi, feedApi } from '../../api'
import { useAuthStore } from '../../store/auth'

export default function EditProfileScreen() {
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
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</Text>
      <TextInput
        className={`border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900 ${multiline ? 'min-h-[80px]' : ''}`}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  )

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: 'Edit Profile',
        headerBackTitle: 'Profile',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#6366f1',
        headerRight: () => (
          <TouchableOpacity onPress={() => save.mutate()} disabled={save.isPending}>
            {save.isPending
              ? <ActivityIndicator size="small" color="#6366f1" />
              : <Text className="text-indigo-600 font-semibold text-base">Save</Text>}
          </TouchableOpacity>
        ),
      }} />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView className="flex-1 px-4 py-6" keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View className="items-center mb-6">
            <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar}>
              <View className="relative">
                <Avatar url={avatarUrl} name={user?.display_name || user?.username} size={80} />
                <View className="absolute bottom-0 right-0 w-7 h-7 bg-indigo-600 rounded-full items-center justify-center border-2 border-white">
                  {uploadingAvatar
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text className="text-white text-xs">✏️</Text>}
                </View>
              </View>
            </TouchableOpacity>
            <Text className="text-indigo-600 text-sm mt-2">Change photo</Text>
          </View>

          <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Your name" />
          <Field label="Pronouns" value={pronouns} onChangeText={setPronouns} placeholder="e.g. they/them" />
          <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Tell people about yourself" multiline />
          <Field label="Location" value={location} onChangeText={setLocation} placeholder="Where are you?" />
          <Field label="Website" value={website} onChangeText={setWebsite} placeholder="https://yoursite.com" />

          <TouchableOpacity
            onPress={() => save.mutate()}
            disabled={save.isPending}
            className={`rounded-xl py-3.5 items-center mt-2 mb-8 ${save.isPending ? 'bg-indigo-300' : 'bg-indigo-600'}`}
          >
            <Text className="text-white font-semibold text-base">{save.isPending ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
