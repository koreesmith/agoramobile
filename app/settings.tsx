import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Switch, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router, Stack } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../../components/ui'
import { usersApi, authApi } from '../../api'
import { useAuthStore } from '../../store/auth'

export default function SettingsScreen() {
  const { user, updateUser, logout } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [section, setSection] = useState<'main' | 'password'>('main')

  const togglePrivacy = useMutation({
    mutationFn: () => usersApi.updateProfile({ profile_private: !user?.profile_private }),
    onSuccess: () => updateUser({ profile_private: !user?.profile_private }),
  })

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      setCurrentPassword(''); setNewPassword('')
      Alert.alert('Password changed!')
      setSection('main')
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not change password'),
  })

  const SettingRow = ({ icon, label, onPress, right, destructive = false }: any) => (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800"
    >
      <View className={`w-8 h-8 rounded-lg items-center justify-center ${destructive ? 'bg-red-100' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
        <Ionicons name={icon} size={18} color={destructive ? '#ef4444' : '#6366f1'} />
      </View>
      <Text className={`flex-1 text-base font-medium ${destructive ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{label}</Text>
      {right ?? <Ionicons name="chevron-forward" size={16} color="#9ca3af" />}
    </TouchableOpacity>
  )

  if (section === 'password') {
    return (
      <Screen>
        <Stack.Screen options={{
          headerShown: true, headerTitle: 'Change Password',
          headerBackTitle: 'Settings', headerStyle: { backgroundColor: '#ffffff' }, headerTintColor: '#6366f1',
        }} />
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView className="flex-1 px-4 py-6" keyboardShouldPersistTaps="handled">
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current password</Text>
              <TextInput
                className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
                secureTextEntry value={currentPassword} onChangeText={setCurrentPassword}
                placeholder="••••••••" placeholderTextColor="#9ca3af"
              />
            </View>
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New password</Text>
              <TextInput
                className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
                secureTextEntry value={newPassword} onChangeText={setNewPassword}
                placeholder="••••••••" placeholderTextColor="#9ca3af"
              />
            </View>
            <TouchableOpacity
              onPress={() => changePassword.mutate()}
              disabled={!currentPassword || !newPassword || changePassword.isPending}
              className={`rounded-xl py-3.5 items-center ${!currentPassword || !newPassword ? 'bg-indigo-300' : 'bg-indigo-600'}`}
            >
              <Text className="text-white font-semibold">{changePassword.isPending ? 'Saving…' : 'Change password'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    )
  }

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true, headerTitle: 'Settings',
        headerBackTitle: 'Profile', headerStyle: { backgroundColor: '#ffffff' }, headerTintColor: '#6366f1',
      }} />
      <ScrollView className="flex-1">
        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-5 pb-2">Account</Text>
        <SettingRow icon="person-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <SettingRow icon="key-outline" label="Change password" onPress={() => setSection('password')} />

        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-5 pb-2">Privacy</Text>
        <SettingRow
          icon="lock-closed-outline"
          label="Private profile"
          right={
            <Switch
              value={user?.profile_private ?? false}
              onValueChange={() => togglePrivacy.mutate()}
              trackColor={{ true: '#6366f1' }}
            />
          }
        />

        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-5 pb-2">About</Text>
        <SettingRow icon="information-circle-outline" label={`Signed in as @${user?.username}`} onPress={() => {}} right={<View />} />
        <SettingRow icon="server-outline" label={`Instance: ${useAuthStore.getState().instanceUrl?.replace(/^https?:\/\//, '')}`} onPress={() => {}} right={<View />} />

        <View className="mt-4">
          <SettingRow
            icon="log-out-outline"
            label="Sign out"
            destructive
            onPress={() => Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: logout },
            ])}
            right={<View />}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}
