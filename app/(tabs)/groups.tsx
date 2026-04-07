import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image, TextInput, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState } from '../../components/ui'
import { groupsApi } from '../../api'

import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

export default function GroupsScreen() {
  const c = useC()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: joinedData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['groups', 'joined'],
    queryFn: () => groupsApi.listFilter('joined').then(r => r.data),
  })
  const { data: discoverData } = useQuery({
    queryKey: ['groups', 'discover'],
    queryFn: () => groupsApi.list().then(r => r.data),
  })

  const join = useMutation({ mutationFn: (slug: string) => groupsApi.join(slug), onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }) } })

  const myGroups = joinedData?.groups || []
  const allDiscover = (discoverData?.groups || []).filter((g: any) => !myGroups.find((m: any) => m.id === g.id))

  const q = search.toLowerCase()
  const filteredMyGroups = q ? myGroups.filter((g: any) => g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)) : myGroups
  const discover = q ? allDiscover.filter((g: any) => g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)) : allDiscover

  const GroupRow = ({ group }: { group: any }) => (
    <TouchableOpacity onPress={() => router.push(`/group/${group.slug}`)} style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      <View style={s.groupIcon}>
        {group.avatar_url ? <Image source={{ uri: group.avatar_url }} style={{ width: 48, height: 48 }} /> : <Text style={s.groupLetter}>{group.name[0]}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.name, { color: c.text }]}>{group.name}</Text>
        <Text style={[s.meta, { color: c.textMuted }]}>{group.member_count} {group.member_count === 1 ? 'member' : 'members'} · {group.privacy}</Text>
      </View>
      {!group.is_member
        ? <TouchableOpacity onPress={() => join.mutate(group.slug)} style={s.joinBtn}><Text style={s.joinBtnText}>Join</Text></TouchableOpacity>
        : <Ionicons name="chevron-forward" size={16} color="#9ca3af" />}
    </TouchableOpacity>
  )

  if (isLoading) return <Screen><Header title="Groups" /><Spinner /></Screen>
  const allGroups = [...filteredMyGroups, ...discover]

  return (
    <Screen>
      <Header title="Groups" />
      <View style={[s.searchWrap, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <Ionicons name="search" size={16} color={c.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          style={[s.searchInput, { color: c.text }]}
          placeholder="Search groups..."
          placeholderTextColor={c.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={allGroups}
        keyExtractor={(g: any) => g.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title={search ? 'No groups found' : 'No groups yet'}
            subtitle={search ? `No groups match "${search}"` : 'Join a group to get started'}
          />
        }
        ListHeaderComponent={filteredMyGroups.length > 0 ? (
          <View>
            <Text style={[s.sectionHeader, { color: c.textMuted }]}>Joined</Text>
            {filteredMyGroups.map((g: any) => <GroupRow key={g.id} group={g} />)}
            {discover.length > 0 && <Text style={[s.sectionHeader, { color: c.textMuted }]}>Discover</Text>}
          </View>
        ) : discover.length > 0 ? <Text style={[s.sectionHeader, { color: c.textMuted }]}>Discover</Text> : null}
        renderItem={({ item }) => filteredMyGroups.includes(item) ? null : <GroupRow group={item} />}
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  groupIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#d9e2ec', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  groupLetter: { color: '#486581', fontWeight: 'bold', fontSize: 20 },
  name: { fontWeight: '600', color: '#111827', fontSize: 14 },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  joinBtn: { backgroundColor: '#486581', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  joinBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
  sectionHeader: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
})

