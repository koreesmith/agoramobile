import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Alert, TextInput,
  Modal, ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, Avatar } from '../../../components/ui'
import { pagesApi, imgUrl } from '../../../api'
import { useAuthStore } from '../../../store/auth'
import { useC } from '../../../constants/ColorContext'

const ROLES = ['admin', 'editor'] as const

export default function PageMembersScreen() {
  const c = useC()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['page-members', slug],
    queryFn: () => pagesApi.getMembers(slug).then(r => r.data),
    enabled: !!slug,
  })
  const members: any[] = data?.members || []
  const myMember = members.find((m: any) => m.user_id === user?.id || m.id === user?.id)
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin'

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor'>('editor')

  const invite = useMutation({
    mutationFn: () => pagesApi.inviteMember(slug, { username: inviteUsername.trim(), role: inviteRole }),
    onSuccess: () => {
      setShowInvite(false)
      setInviteUsername('')
      setInviteRole('editor')
      qc.invalidateQueries({ queryKey: ['page-members', slug] })
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not invite member'),
  })

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      pagesApi.setMemberRole(slug, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['page-members', slug] }),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not change role'),
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => pagesApi.removeMember(slug, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['page-members', slug] }),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not remove member'),
  })

  const handleRoleChange = (member: any) => {
    const currentRole = member.role
    const nextRole = currentRole === 'admin' ? 'editor' : 'admin'
    Alert.alert(
      'Change role',
      `Change ${member.display_name}'s role to ${nextRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Set as ${nextRole}`, onPress: () => changeRole.mutate({ userId: member.user_id || member.id, role: nextRole }) },
      ]
    )
  }

  const handleRemove = (member: any) => {
    Alert.alert(
      'Remove member',
      `Remove ${member.display_name} from this page?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeMember.mutate(member.user_id || member.id) },
      ]
    )
  }

  if (isLoading) return <Screen><Spinner /></Screen>

  return (
    <Screen>
      <Header
        title="Team Members"
        left={
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={22} color={c.primary} />
          </TouchableOpacity>
        }
        right={
          isAdmin ? (
            <TouchableOpacity onPress={() => setShowInvite(true)} style={{ padding: 4 }}>
              <Ionicons name="person-add-outline" size={22} color={c.primary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
      >
        {members.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={40} color={c.textLight} />
            <Text style={[s.emptyText, { color: c.textMuted }]}>No members yet</Text>
          </View>
        ) : (
          members.map((member: any) => {
            const isPending = member.status === 'pending'
            const isOwner = member.role === 'owner'
            return (
              <View key={member.user_id || member.id} style={[s.memberRow, { borderBottomColor: c.border, backgroundColor: c.card }]}>
                <Avatar url={imgUrl(member.avatar_url)} name={member.display_name} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.memberName, { color: c.text }]}>{member.display_name}</Text>
                  <Text style={[s.memberUsername, { color: c.textMuted }]}>@{member.username}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {isPending && (
                    <View style={[s.chip, { backgroundColor: '#fef9c3', borderColor: '#fde047' }]}>
                      <Text style={[s.chipText, { color: '#a16207' }]}>Pending</Text>
                    </View>
                  )}
                  {!isPending && (
                    <View style={[s.chip, {
                      backgroundColor: isOwner ? c.primaryBg : member.role === 'admin' ? '#f0fdf4' : c.bg,
                      borderColor: isOwner ? c.primary : member.role === 'admin' ? '#86efac' : c.border,
                    }]}>
                      <Text style={[s.chipText, { color: isOwner ? c.primary : member.role === 'admin' ? '#15803d' : c.textMuted }]}>
                        {member.role}
                      </Text>
                    </View>
                  )}
                  {isAdmin && !isOwner && !isPending && (
                    <>
                      <TouchableOpacity onPress={() => handleRoleChange(member)} style={{ padding: 4 }}>
                        <Ionicons name="swap-horizontal-outline" size={18} color={c.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleRemove(member)} style={{ padding: 4 }}>
                        <Ionicons name="close-circle-outline" size={18} color={c.red} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Invite modal */}
      <Modal visible={showInvite} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInvite(false)}>
        <View style={[s.inviteModal, { backgroundColor: c.card }]}>
          <View style={[s.inviteHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={() => setShowInvite(false)}>
              <Text style={{ color: c.textMuted, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[s.inviteTitle, { color: c.text }]}>Invite member</Text>
            <TouchableOpacity
              onPress={() => invite.mutate()}
              disabled={!inviteUsername.trim() || invite.isPending}
            >
              {invite.isPending
                ? <ActivityIndicator size="small" color={c.primary} />
                : <Text style={{ color: !inviteUsername.trim() ? c.textLight : c.primary, fontSize: 16, fontWeight: '600' }}>Send</Text>
              }
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={[s.inviteLabel, { color: c.textMd }]}>Username</Text>
              <TextInput
                style={[s.inviteInput, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
                placeholder="@username"
                placeholderTextColor={c.textLight}
                value={inviteUsername}
                onChangeText={t => setInviteUsername(t.replace(/^@/, ''))}
                autoCapitalize="none"
                autoFocus
              />
            </View>
            <View>
              <Text style={[s.inviteLabel, { color: c.textMd }]}>Role</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setInviteRole(r)}
                    style={[s.roleBtn, {
                      borderColor: inviteRole === r ? c.primary : c.border,
                      backgroundColor: inviteRole === r ? c.primaryBg : 'transparent',
                    }]}
                  >
                    <Text style={[s.roleBtnText, { color: inviteRole === r ? c.primary : c.textMuted }]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.roleDesc, { color: c.textMuted }]}>
                {inviteRole === 'admin' ? 'Can post, edit settings, and manage the team.' : 'Can create posts on behalf of this page.'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const s = StyleSheet.create({
  memberRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  memberName:   { fontSize: 14, fontWeight: '600' },
  memberUsername:{ fontSize: 12 },
  chip:         { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipText:     { fontSize: 11, fontWeight: '600' },
  empty:        { alignItems: 'center', padding: 60, gap: 10 },
  emptyText:    { fontSize: 14 },
  inviteModal:  { flex: 1 },
  inviteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  inviteTitle:  { fontSize: 16, fontWeight: '700' },
  inviteLabel:  { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inviteInput:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  roleBtn:      { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  roleBtnText:  { fontSize: 14, fontWeight: '600' },
  roleDesc:     { fontSize: 12, marginTop: 8 },
})
