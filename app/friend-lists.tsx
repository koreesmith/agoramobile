import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Avatar, Spinner, EmptyState } from '../components/ui'
import { friendsApi, federationApi, atprotoApi } from '../api'
import { handle } from '../utils/handle'
import { C } from '../constants/colors'
import { useC } from '../constants/ColorContext'

// ── Types ─────────────────────────────────────────────────────────────────────
interface FriendList {
  id: string
  name: string
  member_count?: number
}

interface Friend {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  is_remote?: boolean
  remote_instance?: string
}

// ── Member Detail Modal ───────────────────────────────────────────────────────
function MemberDetailModal({
  visible,
  list,
  onClose,
}: {
  visible: boolean
  list: FriendList | null
  onClose: () => void
}) {
  const c = useC()
  const qc = useQueryClient()

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['friend-list-members', list?.id],
    queryFn: () => friendsApi.getFriendListMembers(list!.id).then(r => r.data),
    enabled: !!list?.id && visible,
  })

  const { data: friendsData, isLoading: friendsLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.listFriends().then(r => r.data),
    enabled: !!list?.id && visible,
  })

  // AGORA-182/AGORA-257: an accepted fediverse follow, or a native Bluesky
  // follow (no "accepted" concept there, AT Proto follows are unilateral),
  // each with a resolved cached user row, can join a list too, same as a
  // friend — merged here so the rest of this modal doesn't need to know
  // there are three underlying relationship types.
  const { data: followingData, isLoading: followingLoading } = useQuery({
    queryKey: ['fediverse-following'],
    queryFn: () => federationApi.listFollowing().then(r => r.data),
    enabled: !!list?.id && visible,
  })

  const { data: bskyFollowingData, isLoading: bskyFollowingLoading } = useQuery({
    queryKey: ['bluesky-following'],
    queryFn: () => atprotoApi.listBlueskyFollowing().then(r => r.data),
    enabled: !!list?.id && visible,
  })

  const members: Friend[] = membersData?.members || []
  const allFriends: Friend[] = friendsData?.friends || []
  const fediverseConnections: Friend[] = (followingData?.following || [])
    .filter((f: any) => f.accepted && f.user_id)
    .map((f: any) => ({ id: f.user_id, username: f.username, display_name: f.display_name, avatar_url: f.avatar_url, is_remote: true, remote_instance: f.instance }))
  const bskyConnections: Friend[] = (bskyFollowingData?.following || [])
    .filter((f: any) => f.user_id)
    .map((f: any) => ({ id: f.user_id, username: f.username, display_name: f.display_name, avatar_url: f.avatar_url, is_remote: true, remote_instance: 'bsky.app' }))
  const memberIds = new Set(members.map(m => m.id))
  const addableFriends = [...allFriends, ...fediverseConnections, ...bskyConnections].filter(f => !memberIds.has(f.id))

  const removeMember = useMutation({
    mutationFn: (friendId: string) => friendsApi.removeFriendFromList(list!.id, friendId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-list-members', list?.id] })
      qc.invalidateQueries({ queryKey: ['friend-lists'] })
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not remove member'),
  })

  const addMember = useMutation({
    mutationFn: (friendId: string) => friendsApi.addFriendToList(list!.id, friendId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-list-members', list?.id] })
      qc.invalidateQueries({ queryKey: ['friend-lists'] })
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not add member'),
  })

  const confirmRemove = (friend: Friend) => {
    Alert.alert(
      'Remove member?',
      `Remove @${friend.username} from "${list?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeMember.mutate(friend.id) },
      ]
    )
  }

  const isLoading = membersLoading || friendsLoading || followingLoading || bskyFollowingLoading

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.modalContainer, { backgroundColor: c.bg }]}>
        {/* Modal Header */}
        <View style={[s.modalHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <Text style={[s.modalTitle, { color: c.text }]}>{list?.name}</Text>
          <TouchableOpacity onPress={onClose} style={s.modalClose}>
            <Ionicons name="close" size={22} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <Spinner />
        ) : (
          <FlatList
            data={[...members.map(m => ({ ...m, _type: 'member' as const })), ...addableFriends.map(f => ({ ...f, _type: 'addable' as const }))]}
            keyExtractor={item => `${item._type}-${item.id}`}
            ListHeaderComponent={
              <>
                {members.length > 0 && (
                  <Text style={[s.sectionLabel, { color: c.textMuted }]}>Members</Text>
                )}
              </>
            }
            renderItem={({ item }) => {
              if (item._type === 'member') {
                return (
                  <View style={[s.friendRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
                    <Avatar url={item.avatar_url} name={item.display_name || item.username} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.friendName, { color: c.text }]}>{item.display_name || item.username}</Text>
                      <Text style={[s.friendUsername, { color: c.textMuted }]}>{handle(item.username, item.is_remote, item.remote_instance)}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => confirmRemove(item)}
                      disabled={removeMember.isPending}
                      style={s.removeBtn}
                    >
                      <Ionicons name="remove-circle-outline" size={22} color={c.red} />
                    </TouchableOpacity>
                  </View>
                )
              }

              // separator before addable section
              return null
            }}
            ListEmptyComponent={
              members.length === 0 ? (
                <EmptyState icon="👥" title="No members yet" subtitle="Add friends below" />
              ) : null
            }
            ListFooterComponent={
              addableFriends.length > 0 ? (
                <>
                  <Text style={[s.sectionLabel, { color: c.textMuted }]}>Add people</Text>
                  {addableFriends.map(f => (
                    <View key={f.id} style={[s.friendRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
                      <Avatar url={f.avatar_url} name={f.display_name || f.username} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.friendName, { color: c.text }]}>{f.display_name || f.username}</Text>
                        <Text style={[s.friendUsername, { color: c.textMuted }]}>{handle(f.username, f.is_remote, f.remote_instance)}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => addMember.mutate(f.id)}
                        disabled={addMember.isPending}
                        style={s.addBtn}
                      >
                        <Ionicons name="add-circle-outline" size={22} color={c.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function FriendListsScreen() {
  const c = useC()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedList, setSelectedList] = useState<FriendList | null>(null)

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['friend-lists'],
    queryFn: () => friendsApi.listFriendLists().then(r => r.data),
  })

  const lists: FriendList[] = data?.friend_groups || data?.groups || data?.lists || (Array.isArray(data) ? data : [])

  const createList = useMutation({
    mutationFn: (name: string) => friendsApi.createFriendList(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-lists'] })
      setNewName('')
      setShowCreate(false)
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not create list'),
  })

  const deleteList = useMutation({
    mutationFn: (groupId: string) => friendsApi.deleteFriendList(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friend-lists'] }),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not delete list'),
  })

  const confirmDelete = (list: FriendList) => {
    Alert.alert(
      'Delete list?',
      `Delete "${list.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteList.mutate(list.id) },
      ]
    )
  }

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    createList.mutate(trimmed)
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Friend Lists',
          headerBackTitle: 'Settings',
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.primary,
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowCreate(v => !v)} style={{ paddingRight: 4 }}>
              <Ionicons name={showCreate ? 'close' : 'add'} size={26} color={c.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Inline create row */}
      {showCreate && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[s.createRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
            <TextInput
              style={[s.createInput, { color: c.text, borderColor: c.border }]}
              placeholder="List name…"
              placeholderTextColor={c.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!newName.trim() || createList.isPending}
              style={[s.createBtn, { backgroundColor: c.primary }, (!newName.trim() || createList.isPending) && { opacity: 0.5 }]}
            >
              <Text style={s.createBtnText}>{createList.isPending ? 'Creating…' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item: FriendList) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No friend lists yet"
              subtitle="Tap + to create your first list"
            />
          }
          renderItem={({ item }: { item: FriendList }) => (
            <TouchableOpacity
              onPress={() => setSelectedList(item)}
              style={[s.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]}
            >
              <View style={[s.listIcon, { backgroundColor: c.primaryBg }]}>
                <Ionicons name="people-outline" size={20} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.listName, { color: c.text }]}>{item.name}</Text>
                {item.member_count !== undefined && (
                  <Text style={[s.listMeta, { color: c.textMuted }]}>
                    {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/list-feed/${item.id}`)}
                style={s.viewFeedBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[s.viewFeedText, { color: c.primary }]}>View feed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDelete(item)}
                style={s.deleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={c.red} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={16} color={c.textLight} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        />
      )}

      <MemberDetailModal
        visible={!!selectedList}
        list={selectedList}
        onClose={() => setSelectedList(null)}
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  createInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  createBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  createBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  listIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listName: { fontWeight: '600', fontSize: 15 },
  listMeta: { fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 4 },
  viewFeedBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  viewFeedText: { fontSize: 12, fontWeight: '600' },
  // Modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '600' },
  modalClose: { padding: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  friendName: { fontWeight: '600', fontSize: 15 },
  friendUsername: { fontSize: 13, marginTop: 1 },
  removeBtn: { padding: 4 },
  addBtn: { padding: 4 },
})
