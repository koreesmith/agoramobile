import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl, StyleSheet } from 'react-native'
import { Stack, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Screen, Avatar, Spinner, EmptyState } from '../components/ui'
import { blockApi } from '../api'
import { useC } from '../constants/ColorContext'

interface BlockedUser {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
}

// Parity with web's SettingsPage.tsx blocked tab: a full list+unblock UI.
// blockApi.listBlocked already existed but was never called anywhere in
// app/ — mobile only supported one-off block/unblock from a profile page.
export default function BlockedUsersScreen() {
  const c = useC()
  const qc = useQueryClient()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => blockApi.listBlocked().then(r => r.data),
  })

  const blocked: BlockedUser[] = data?.blocked || []

  const unblock = useMutation({
    mutationFn: (username: string) => blockApi.unblockUser(username),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked-users'] }),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not unblock user'),
  })

  const confirmUnblock = (u: BlockedUser) => {
    Alert.alert(
      'Unblock user?',
      `Unblock ${u.display_name || u.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => unblock.mutate(u.username) },
      ]
    )
  }

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: 'Blocked Users',
        headerBackTitle: 'Settings',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />

      {isLoading ? <Spinner /> : (
        <FlatList
          data={blocked}
          keyExtractor={u => u.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListHeaderComponent={
            <Text style={[s.intro, { color: c.textMuted }]}>Blocked users cannot see your profile, contact you, or appear in your feed.</Text>
          }
          ListEmptyComponent={
            <EmptyState icon="🚫" title="You haven't blocked anyone" subtitle="Blocked users will appear here" />
          }
          renderItem={({ item }) => (
            <View style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
                onPress={() => router.push(`/profile/${item.username}`)}
              >
                <Avatar url={item.avatar_url} name={item.display_name || item.username} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.name, { color: c.text }]}>{item.display_name || item.username}</Text>
                  <Text style={[s.username, { color: c.textMuted }]}>@{item.username}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmUnblock(item)}
                disabled={unblock.isPending}
                style={[s.unblockBtn, { borderColor: c.border, backgroundColor: c.bg }]}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.textMd }}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  intro:      { fontSize: 15, padding: 16, paddingBottom: 8 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  name:       { fontWeight: '600', fontSize: 17 },
  username:   { fontSize: 15, marginTop: 1 },
  unblockBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
})
