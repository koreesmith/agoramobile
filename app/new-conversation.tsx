import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { router, Stack } from 'expo-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Avatar, Spinner } from '../../components/ui'
import { dmApi, friendsApi } from '../../api'
import { useAuthStore } from '../../store/auth'

export default function NewConversationScreen() {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.listFriends().then(r => r.data),
  })

  const friends = friendsData?.friends || []
  const filtered = friends.filter((f: any) =>
    !search || f.username.toLowerCase().includes(search.toLowerCase()) ||
    (f.display_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const start = useMutation({
    mutationFn: (username: string) => dmApi.startConversation(username),
    onSuccess: (res) => router.replace(`/conversation/${res.data.id}`),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not start conversation'),
  })

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: 'New Message',
        headerBackTitle: 'Messages',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#6366f1',
      }} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Search */}
        <View className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2.5 gap-2">
            <Ionicons name="search" size={16} color="#9ca3af" />
            <TextInput
              className="flex-1 text-base text-gray-900 dark:text-white"
              placeholder="Search friends…"
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
        </View>

        {isLoading ? <Spinner /> : (
          <FlatList
            data={filtered}
            keyExtractor={(f: any) => f.id}
            renderItem={({ item: f }) => (
              <TouchableOpacity
                onPress={() => start.mutate(f.username)}
                disabled={start.isPending}
                className="flex-row items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
              >
                <Avatar url={f.avatar_url} name={f.display_name || f.username} size={44} />
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900 dark:text-white">{f.display_name || f.username}</Text>
                  <Text className="text-sm text-gray-400">@{f.username}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="py-16 items-center">
                <Text className="text-gray-400">{search ? 'No friends match your search' : 'No friends yet'}</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}
