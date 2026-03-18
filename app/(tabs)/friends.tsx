import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState, Avatar } from '../../components/ui'
import { friendsApi, usersApi } from '../../api'

import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

type Tab = 'friends' | 'requests' | 'discover'

export default function FriendsScreen() {
  const c = useC()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('friends')
  const [search, setSearch] = useState('')

  const { data: friendsData, isLoading: fl, refetch: rf, isRefetching: rfr } = useQuery({ queryKey: ['friends'], queryFn: () => friendsApi.listFriends().then(r => r.data) })
  const { data: reqData, refetch: rr } = useQuery({ queryKey: ['requests'], queryFn: () => friendsApi.listRequests().then(r => r.data) })
  const { data: discoverData, isLoading: dl, refetch: dr } = useQuery({ queryKey: ['discover'], queryFn: () => usersApi.discover().then(r => r.data), enabled: tab === 'discover' })

  const inv = () => { qc.invalidateQueries({ queryKey: ['friends'] }); qc.invalidateQueries({ queryKey: ['requests'] }) }
  const accept = useMutation({ mutationFn: (id: string) => friendsApi.acceptRequest(id), onSuccess: inv })
  const decline = useMutation({ mutationFn: (id: string) => friendsApi.declineRequest(id), onSuccess: inv })
  const unfriend = useMutation({ mutationFn: (id: string) => friendsApi.unfriend(id), onSuccess: inv })
  const sendReq = useMutation({ mutationFn: (id: string) => friendsApi.sendRequest(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['discover'] }) })

  const friends = friendsData?.friends || []
  const incoming = reqData?.incoming || []
  const outgoing = reqData?.outgoing || []
  const discover = discoverData?.users || []
  const pendingCount = incoming.length

  const filtered = friends.filter((f: any) => !search || f.username.toLowerCase().includes(search.toLowerCase()) || (f.display_name || '').toLowerCase().includes(search.toLowerCase()))

  const PersonRow = ({ user, right }: { user: any; right: React.ReactNode }) => (
    <TouchableOpacity onPress={() => router.push(`/profile/${user.username}`)} style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      <Avatar url={user.avatar_url} name={user.display_name || user.username} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={[s.name, { color: c.text }]}>{user.display_name || user.username}</Text>
        <Text style={[s.username, { color: c.textMuted }]}>@{user.username}</Text>
      </View>
      <View style={{ flexShrink: 0 }}>{right}</View>
    </TouchableOpacity>
  )

  return (
    <Screen>
      <Header title="Friends" />
      <View style={[s.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {(['friends', 'requests', 'discover'] as Tab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabItem, tab === t && { borderBottomColor: c.primary }]}>
            <Text style={[s.tabText, { color: c.textMuted }, tab === t && { color: c.primary }]}>
              {t === 'requests' && pendingCount > 0 ? `Requests (${pendingCount})` : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'friends' && (
        <>
          <View style={[s.searchWrap, { backgroundColor: c.card, borderBottomColor: c.border }]}>
            <Ionicons name="search" size={15} color="#9ca3af" />
            <TextInput style={[s.searchInput, { color: c.text }]} placeholder="Search friends…" placeholderTextColor="#9ca3af" value={search} onChangeText={setSearch} />
          </View>
          {fl ? <Spinner /> : (
            <FlatList data={filtered} keyExtractor={(f: any) => f.id}
              refreshControl={<RefreshControl refreshing={rfr} onRefresh={rf} tintColor={c.primary} />}
              ListEmptyComponent={<EmptyState icon="👋" title="No friends yet" />}
              renderItem={({ item: f }) => <PersonRow user={f} right={
                <TouchableOpacity onPress={() => Alert.alert('Unfriend?', `Remove ${f.display_name || f.username}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Unfriend', style: 'destructive', onPress: () => unfriend.mutate(f.id) },
                ])} style={{ padding: 8 }}>
                  <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              } />}
            />
          )}
        </>
      )}

      {tab === 'requests' && (
        <FlatList
          data={[...incoming.map((f: any) => ({ ...f, _type: 'incoming' })), ...outgoing.map((f: any) => ({ ...f, _type: 'outgoing' }))]}
          keyExtractor={(f: any) => f.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={rr} tintColor={c.primary} />}
          ListEmptyComponent={<EmptyState icon="📬" title="No pending requests" />}
          renderItem={({ item: f }) => <PersonRow user={f} right={
            f._type === 'incoming' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => accept.mutate(f.id)} style={s.acceptBtn}><Text style={s.acceptBtnText}>Accept</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => decline.mutate(f.id)} style={s.declineBtn}><Text style={s.declineBtnText}>Decline</Text></TouchableOpacity>
              </View>
            ) : <Text style={{ fontSize: 12, color: c.textMuted }}>Pending</Text>
          } />}
        />
      )}

      {tab === 'discover' && (
        dl ? <Spinner /> : (
          <FlatList data={discover} keyExtractor={(u: any) => u.id}
            refreshControl={<RefreshControl refreshing={false} onRefresh={dr} tintColor={c.primary} />}
            ListEmptyComponent={<EmptyState icon="🔍" title="No suggestions" />}
            renderItem={({ item: u }) => <PersonRow user={u} right={
              u.friend_status === 'pending' ? <Text style={{ fontSize: 12, color: c.textMuted }}>Sent</Text>
              : u.friend_status === 'accepted' ? <Text style={{ fontSize: 12, color: '#22c55e', fontWeight: '500' }}>Friends</Text>
              : <TouchableOpacity onPress={() => sendReq.mutate(u.id)} style={s.acceptBtn}><Text style={s.acceptBtnText}>Add</Text></TouchableOpacity>
            } />}
          />
        )
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#486581' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#486581', textTransform: 'capitalize' },
  tabTextActive: { color: '#486581' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  name: { fontWeight: '600', color: '#111827', fontSize: 14 },
  username: { fontSize: 12, color: '#486581' },
  acceptBtn: { backgroundColor: '#486581', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
  declineBtn: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  declineBtnText: { fontSize: 12, color: '#486581', fontWeight: '600' },
})

