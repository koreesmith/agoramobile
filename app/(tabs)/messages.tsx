import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { formatDistanceToNow } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState, Avatar } from '../../components/ui'
import { dmApi } from '../../api'
import { useAuthStore } from '../../store/auth'

import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

export default function MessagesScreen() {
  const c = useC()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => dmApi.listConversations().then(r => r.data),
    refetchInterval: 30_000,
  })

  const convs = data?.conversations || []
  const other = (conv: any) => conv.participants?.find((p: any) => p.user_id !== user?.id)
  const filtered = convs.filter((c: any) => {
    const o = other(c)
    if (!o || !search) return !!o
    return o.username.toLowerCase().includes(search.toLowerCase()) || (o.display_name || '').toLowerCase().includes(search.toLowerCase())
  })

  return (
    <Screen>
      <Header title="Messages" right={
        <TouchableOpacity onPress={() => router.push('/new-conversation')} style={{ padding: 4 }}>
          <Ionicons name="create-outline" size={22} color={c.primary} />
        </TouchableOpacity>
      } />

      <View style={[s.searchWrap, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <Ionicons name="search" size={15} color="#9ca3af" />
        <TextInput style={[s.searchInput, { color: c.text }]} placeholder="Search conversations…" placeholderTextColor="#9ca3af" value={search} onChangeText={setSearch} />
      </View>

      {isLoading ? <Spinner /> : (
        <FlatList
          data={filtered}
          keyExtractor={(c: any) => c.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListEmptyComponent={<EmptyState icon="💬" title="No messages yet" />}
          renderItem={({ item: conv }) => {
            const o = other(conv)
            if (!o) return null
            const preview = conv.last_message ? (conv.last_message.deleted_at ? '(deleted)' : conv.last_message.content || '📷 Image') : 'No messages yet'
            return (
              <TouchableOpacity onPress={() => router.push(`/conversation/${conv.id}`)} style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
                <View style={{ position: 'relative' }}>
                  <Avatar url={o.avatar_url} name={o.display_name || o.username} size={48} />
                  {conv.unread_count > 0 && (
                    <View style={s.badge}><Text style={s.badgeText}>{conv.unread_count > 9 ? '9+' : conv.unread_count}</Text></View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[s.name, conv.unread_count > 0 && { fontWeight: '700' }]}>{o.display_name || o.username}</Text>
                    {conv.last_message && <Text style={[s.time, { color: c.textLight }]}>{formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}</Text>}
                  </View>
                  <Text style={[s.preview, conv.unread_count > 0 && { color: '#374151', fontWeight: '500' }]} numberOfLines={1}>
                    {!conv.is_accepted ? '⚠️ Message request' : preview}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  badge: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#486581', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  name: { fontSize: 14, fontWeight: '500', color: '#374151' },
  time: { fontSize: 12, color: '#9ca3af' },
  preview: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
})

