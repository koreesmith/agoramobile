import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Alert,
  StyleSheet, ScrollView, Share, Modal, Switch,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner, Avatar } from '../../../components/ui'
import { groupsApi } from '../../../api'
import { useAuthStore } from '../../../store/auth'
import { C } from '../../../constants/colors'
import { useC } from '../../../constants/ColorContext'

type Section = 'settings' | 'members' | 'invites' | 'requests'

export default function ManageGroupScreen() {
  const c = useC()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [section, setSection] = useState<Section>('settings')

  // Settings state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public')
  const [settingsReady, setSettingsReady] = useState(false)

  // Members state
  const [memberSearch, setMemberSearch] = useState('')
  const [addUsername, setAddUsername] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)

  const { data: groupData, isLoading: groupLoading } = useQuery({
    queryKey: ['group', slug],
    queryFn: () => groupsApi.get(slug!).then(r => {
      const g = r.data?.group || r.data
      if (!settingsReady) {
        setName(g.name || '')
        setDescription(g.description || '')
        setPrivacy(g.privacy || 'public')
        setSettingsReady(true)
      }
      return r.data
    }),
  })

  const { data: membersData, isLoading: membersLoading, refetch: refetchMembers } = useQuery({
    queryKey: ['group-members', slug],
    queryFn: () => groupsApi.getMembers(slug!).then(r => r.data),
    enabled: section === 'members',
  })

  const { data: invitesData, isLoading: invitesLoading, refetch: refetchInvites } = useQuery({
    queryKey: ['group-invites', slug],
    queryFn: () => groupsApi.getInvites(slug!).then(r => r.data),
    enabled: section === 'invites',
  })

  const { data: requestsData, isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['group-requests', slug],
    queryFn: () => groupsApi.getRequests(slug!).then(r => r.data),
    enabled: section === 'requests',
  })

  const group = groupData?.group || groupData

  const updateGroup = useMutation({
    mutationFn: () => groupsApi.update(slug!, { name, description, privacy }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', slug] })
      qc.invalidateQueries({ queryKey: ['groups'] })
      Alert.alert('Saved', 'Group settings updated.')
    },
    onError: () => Alert.alert('Error', 'Failed to save settings.'),
  })

  const deleteGroup = useMutation({
    mutationFn: () => groupsApi.delete(slug!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      router.replace('/(tabs)/groups')
    },
    onError: () => Alert.alert('Error', 'Failed to delete group.'),
  })

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      groupsApi.setMemberRole(slug!, userId, role),
    onSuccess: () => refetchMembers(),
    onError: () => Alert.alert('Error', 'Failed to update role.'),
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(slug!, userId),
    onSuccess: () => refetchMembers(),
    onError: () => Alert.alert('Error', 'Failed to remove member.'),
  })

  const addMember = useMutation({
    mutationFn: () => groupsApi.addMember(slug!, addUsername.trim()),
    onSuccess: () => {
      setAddUsername('')
      setShowAddMember(false)
      refetchMembers()
    },
    onError: () => Alert.alert('Error', 'Could not add user. Check the username.'),
  })

  const createInvite = useMutation({
    mutationFn: () => groupsApi.createInvite(slug!),
    onSuccess: () => refetchInvites(),
    onError: () => Alert.alert('Error', 'Failed to create invite link.'),
  })

  const revokeInvite = useMutation({
    mutationFn: (token: string) => groupsApi.deleteInvite(slug!, token),
    onSuccess: () => refetchInvites(),
    onError: () => Alert.alert('Error', 'Failed to revoke invite.'),
  })

  const approveRequest = useMutation({
    mutationFn: (requestId: string) => groupsApi.approveRequest(slug!, requestId),
    onSuccess: () => refetchRequests(),
    onError: () => Alert.alert('Error', 'Failed to approve request.'),
  })

  const rejectRequest = useMutation({
    mutationFn: (requestId: string) => groupsApi.rejectRequest(slug!, requestId),
    onSuccess: () => refetchRequests(),
    onError: () => Alert.alert('Error', 'Failed to reject request.'),
  })

  if (groupLoading || !group) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, headerTitle: 'Manage Group', headerTintColor: c.primary, headerStyle: { backgroundColor: c.card } }} />
        <Spinner />
      </Screen>
    )
  }

  const members: any[] = membersData?.members || []
  const filteredMembers = memberSearch.trim()
    ? members.filter(m =>
        m.username?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.display_name?.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : members

  const invites: any[] = invitesData?.invites || []
  const requests: any[] = requestsData?.requests || []
  const isPrivate = group.privacy === 'private'

  const tabs: { key: Section; label: string }[] = [
    { key: 'settings', label: 'Settings' },
    { key: 'members', label: 'Members' },
    { key: 'invites', label: 'Invites' },
    ...(isPrivate ? [{ key: 'requests' as Section, label: 'Requests' }] : []),
  ]

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteGroup.mutate() },
      ]
    )
  }

  const handleCopyToken = async (token: string) => {
    const instanceUrl = require('../../../store/auth').useAuthStore.getState().instanceUrl || ''
    const link = `${instanceUrl}/invite/group/${token}`
    await Share.share({ message: link })
  }

  const renderSettings = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.settingsContent}>
      <Text style={[s.label, { color: c.textMuted }]}>Group Name</Text>
      <TextInput
        style={[s.input, { backgroundColor: c.card, color: c.text, borderColor: c.border }]}
        value={name}
        onChangeText={setName}
        placeholder="Group name"
        placeholderTextColor={c.textLight}
      />

      <Text style={[s.label, { color: c.textMuted }]}>Description</Text>
      <TextInput
        style={[s.input, s.multiline, { backgroundColor: c.card, color: c.text, borderColor: c.border }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional description"
        placeholderTextColor={c.textLight}
        multiline
        numberOfLines={3}
      />

      <Text style={[s.label, { color: c.textMuted }]}>Privacy</Text>
      <View style={[s.privacyRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.privacyTitle, { color: c.text }]}>Private Group</Text>
          <Text style={[s.privacySubtitle, { color: c.textMuted }]}>
            {privacy === 'private' ? 'Only invited/approved members can join' : 'Anyone can join this group'}
          </Text>
        </View>
        <Switch
          value={privacy === 'private'}
          onValueChange={v => setPrivacy(v ? 'private' : 'public')}
          trackColor={{ false: c.border, true: c.primary }}
          thumbColor={c.white}
        />
      </View>

      <TouchableOpacity
        onPress={() => updateGroup.mutate()}
        disabled={updateGroup.isPending || !name.trim()}
        style={[s.saveBtn, { backgroundColor: (!name.trim() || updateGroup.isPending) ? c.primaryLt : c.primary }]}
      >
        <Text style={s.saveBtnText}>{updateGroup.isPending ? 'Saving…' : 'Save Changes'}</Text>
      </TouchableOpacity>

      <View style={[s.divider, { backgroundColor: c.border }]} />

      <TouchableOpacity onPress={handleDeleteGroup} style={[s.deleteBtn, { borderColor: c.red }]}>
        <Ionicons name="trash-outline" size={16} color={c.red} />
        <Text style={[s.deleteBtnText, { color: c.red }]}>Delete Group</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  const renderMembers = () => (
    <View style={{ flex: 1 }}>
      <View style={[s.searchBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <Ionicons name="search" size={16} color={c.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          style={[s.searchInput, { color: c.text }]}
          placeholder="Search members…"
          placeholderTextColor={c.textMuted}
          value={memberSearch}
          onChangeText={setMemberSearch}
        />
        {memberSearch.length > 0 && (
          <TouchableOpacity onPress={() => setMemberSearch('')}>
            <Ionicons name="close-circle" size={16} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        onPress={() => setShowAddMember(true)}
        style={[s.addMemberBtn, { backgroundColor: c.primaryBg, borderColor: c.border }]}
      >
        <Ionicons name="person-add-outline" size={16} color={c.primary} />
        <Text style={[s.addMemberText, { color: c.primary }]}>Add by username</Text>
      </TouchableOpacity>
      {membersLoading ? <Spinner /> : (
        <FlatList
          data={filteredMembers}
          keyExtractor={m => m.user_id}
          renderItem={({ item: m }) => (
            <View style={[s.memberRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <Avatar url={m.avatar_url} name={m.display_name || m.username} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={[s.memberName, { color: c.text }]}>{m.display_name || m.username}</Text>
                <Text style={[s.memberMeta, { color: c.textMuted }]}>@{m.username}</Text>
              </View>
              <View style={[s.roleBadge, { backgroundColor: m.role === 'admin' ? c.primaryBg : c.gray100 }]}>
                <Text style={[s.roleBadgeText, { color: m.role === 'admin' ? c.primary : c.textMuted }]}>{m.role}</Text>
              </View>
              {m.user_id !== user?.id && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setRole.mutate({ userId: m.user_id, role: m.role === 'admin' ? 'member' : 'admin' })}
                    style={[s.actionBtn, { borderColor: c.border }]}
                  >
                    <Ionicons name={m.role === 'admin' ? 'arrow-down-outline' : 'arrow-up-outline'} size={14} color={c.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Alert.alert('Remove member?', `Remove @${m.username} from the group?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeMember.mutate(m.user_id) },
                    ])}
                    style={[s.actionBtn, { borderColor: c.border }]}
                  >
                    <Ionicons name="close" size={14} color={c.red} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textLight }]}>No members found.</Text>}
        />
      )}

      <Modal visible={showAddMember} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Add Member</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.bg, color: c.text, borderColor: c.border }]}
              placeholder="Username"
              placeholderTextColor={c.textLight}
              value={addUsername}
              onChangeText={setAddUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => { setShowAddMember(false); setAddUsername('') }}
                style={[s.modalBtn, { borderColor: c.border }]}
              >
                <Text style={{ color: c.textMd }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => addMember.mutate()}
                disabled={!addUsername.trim() || addMember.isPending}
                style={[s.modalBtn, { backgroundColor: c.primary, borderColor: c.primary }]}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>{addMember.isPending ? '…' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )

  const renderInvites = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={() => createInvite.mutate()}
        disabled={createInvite.isPending}
        style={[s.addMemberBtn, { backgroundColor: c.primaryBg, borderColor: c.border }]}
      >
        <Ionicons name="add-circle-outline" size={16} color={c.primary} />
        <Text style={[s.addMemberText, { color: c.primary }]}>{createInvite.isPending ? 'Creating…' : 'Create invite link'}</Text>
      </TouchableOpacity>
      {invitesLoading ? <Spinner /> : (
        <FlatList
          data={invites}
          keyExtractor={i => i.token}
          renderItem={({ item: inv }) => (
            <View style={[s.inviteRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.inviteToken, { color: c.text }]} numberOfLines={1}>{inv.token}</Text>
                <Text style={[s.inviteMeta, { color: c.textMuted }]}>{inv.uses ?? 0} uses</Text>
              </View>
              <TouchableOpacity onPress={() => handleCopyToken(inv.token)} style={[s.actionBtn, { borderColor: c.border }]}>
                <Ionicons name="share-outline" size={16} color={c.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('Revoke invite?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Revoke', style: 'destructive', onPress: () => revokeInvite.mutate(inv.token) },
                ])}
                style={[s.actionBtn, { borderColor: c.border }]}
              >
                <Ionicons name="trash-outline" size={16} color={c.red} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textLight }]}>No invite links yet.</Text>}
        />
      )}
    </View>
  )

  const renderRequests = () => (
    <View style={{ flex: 1 }}>
      {requestsLoading ? <Spinner /> : (
        <FlatList
          data={requests}
          keyExtractor={r => r.id}
          renderItem={({ item: req }) => (
            <View style={[s.memberRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <Avatar url={req.avatar_url} name={req.display_name || req.username} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={[s.memberName, { color: c.text }]}>{req.display_name || req.username}</Text>
                <Text style={[s.memberMeta, { color: c.textMuted }]}>@{req.username}</Text>
              </View>
              <TouchableOpacity
                onPress={() => approveRequest.mutate(req.id)}
                style={[s.actionBtn, { borderColor: c.border, backgroundColor: c.primaryBg }]}
              >
                <Ionicons name="checkmark" size={16} color={c.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => rejectRequest.mutate(req.id)}
                style={[s.actionBtn, { borderColor: c.border }]}
              >
                <Ionicons name="close" size={16} color={c.red} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textLight }]}>No pending requests.</Text>}
        />
      )}
    </View>
  )

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: `Manage: ${group.name}`,
        headerTintColor: c.primary,
        headerStyle: { backgroundColor: c.card },
      }} />

      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setSection(tab.key)}
            style={[s.tab, section === tab.key && { borderBottomColor: c.primary }]}
          >
            <Text style={[s.tabText, { color: section === tab.key ? c.primary : c.textMuted }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {section === 'settings' && renderSettings()}
      {section === 'members' && renderMembers()}
      {section === 'invites' && renderInvites()}
      {section === 'requests' && renderRequests()}
    </Screen>
  )
}

const s = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 15, fontWeight: '600' },

  settingsContent: { padding: 16, gap: 4 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 4 },
  privacyTitle: { fontSize: 16, fontWeight: '600' },
  privacySubtitle: { fontSize: 13, marginTop: 2 },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: 'white', fontWeight: '600', fontSize: 17 },
  divider: { height: 1, marginVertical: 24 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 12 },
  deleteBtnText: { fontWeight: '600', fontSize: 17 },

  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },

  addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  addMemberText: { fontWeight: '600', fontSize: 16 },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  memberName: { fontSize: 16, fontWeight: '600' },
  memberMeta: { fontSize: 13, marginTop: 1 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  actionBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  inviteToken: { fontSize: 15, fontFamily: 'monospace' },
  inviteMeta: { fontSize: 13, marginTop: 2 },

  empty: { textAlign: 'center', fontSize: 16, paddingVertical: 32 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 19, fontWeight: '700' },
  modalBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
})
