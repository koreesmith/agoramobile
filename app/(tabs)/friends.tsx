import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState, Avatar } from '../../components/ui'
import { friendsApi, usersApi, instanceApi } from '../../api'

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
  const { data: instanceData } = useQuery({ queryKey: ['instance-info'], queryFn: () => instanceApi.getInfo().then(r => r.data), staleTime: 5 * 60_000 })
  const invitesEnabled = instanceData?.user_invites_enabled === 'true'

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
      <View style={{ flex: 1 }}>
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
              <Ionicons name="search" size={15} color={c.textLight} />
              <TextInput style={[s.searchInput, { color: c.text }]} placeholder="Search friends…" placeholderTextColor={c.textLight} value={search} onChangeText={setSearch} />
            </View>
            {fl ? <Spinner /> : (
              <FlatList data={filtered} keyExtractor={(f: any) => f.id}
                refreshControl={<RefreshControl refreshing={rfr} onRefresh={rf} tintColor={c.primary} />}
                ListEmptyComponent={<EmptyState icon="👋" title="No friends yet" />}
                ListFooterComponent={invitesEnabled ? <View style={{ height: 88 }} /> : null}
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
            ListFooterComponent={invitesEnabled ? <View style={{ height: 88 }} /> : null}
            renderItem={({ item: f }) => <PersonRow user={f} right={
              f._type === 'incoming' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => accept.mutate(f.id)} style={[s.acceptBtn, { backgroundColor: c.primary }]}><Text style={s.acceptBtnText}>Accept</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => decline.mutate(f.id)} style={[s.declineBtn, { backgroundColor: c.bg, borderColor: c.border }]}><Text style={[s.declineBtnText, { color: c.textMd }]}>Decline</Text></TouchableOpacity>
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
              ListFooterComponent={invitesEnabled ? <View style={{ height: 88 }} /> : null}
              renderItem={({ item: u }) => <PersonRow user={u} right={
                u.friend_status === 'pending' ? <Text style={{ fontSize: 12, color: c.textMuted }}>Sent</Text>
                : u.friend_status === 'accepted' ? <Text style={{ fontSize: 12, color: '#22c55e', fontWeight: '500' }}>Friends</Text>
                : <TouchableOpacity onPress={() => sendReq.mutate(u.id)} style={[s.acceptBtn, { backgroundColor: c.primary }]}><Text style={s.acceptBtnText}>Add</Text></TouchableOpacity>
              } />}
            />
          )
        )}

        {/* Invite FAB */}
        {invitesEnabled && (
          <TouchableOpacity
            onPress={() => router.push('/invite-friend')}
            style={[s.fab, { backgroundColor: c.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="mail" size={20} color="white" />
            <Text style={s.fabText}>Invite a Friend</Text>
          </TouchableOpacity>
        )}
      </View>
    </Screen>
  )
}

const s = StyleSheet.create({
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:       { fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput:   { flex: 1, fontSize: 14 },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  name:          { fontWeight: '600', fontSize: 14 },
  username:      { fontSize: 12 },
  acceptBtn:     { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
  declineBtn:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  declineBtnText:{ fontSize: 12, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { color: 'white', fontWeight: '700', fontSize: 15 },
})
