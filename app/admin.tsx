import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet, Switch, ActivityIndicator } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner } from '../components/ui'
import { moderationApi, adminApi, waitlistApi } from '../api'
import { useAuthStore } from '../store/auth'
import { useC } from '../constants/ColorContext'

type Tab = 'reports' | 'moderation' | 'users' | 'waitlist' | 'instances'

export default function AdminScreen() {
  const c = useC()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ tab?: string }>()
  const initialTab = (params.tab as Tab) || 'reports'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [reportStatus, setReportStatus] = useState('pending')
  const [suspendForms, setSuspendForms] = useState<Record<string,{days:string,reason:string,notes:string}>>({})
  const [banForms, setBanForms] = useState<Record<string,{reason:string,notes:string}>>({})
  const [expandedReport, setExpandedReport] = useState<string|null>(null)
  const [expandedUser, setExpandedUser] = useState<string|null>(null)
  const [userSuspendForms, setUserSuspendForms] = useState<Record<string,{days:string,reason:string,notes:string}>>({})
  const [userBanForms, setUserBanForms] = useState<Record<string,{reason:string,notes:string}>>({})
  const [instanceBanForm, setInstanceBanForm] = useState({ domain: '', reason: '' })

  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, headerTitle: 'Admin', headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.textMuted }}>Access denied</Text>
        </View>
      </Screen>
    )
  }

  const { data: repsData, isLoading: repsLoading } = useQuery({
    queryKey: ['admin-reports', reportStatus],
    queryFn: () => moderationApi.listReports(reportStatus).then(r => r.data),
    enabled: tab === 'reports',
  })

  const { data: modData, isLoading: modLoading } = useQuery({
    queryKey: ['mod-users'],
    queryFn: () => moderationApi.listModeratedUsers().then(r => r.data),
    enabled: tab === 'moderation',
  })

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers().then(r => r.data),
    enabled: tab === 'users',
  })

  const { data: waitlistData, isLoading: waitlistLoading } = useQuery({
    queryKey: ['admin-waitlist'],
    queryFn: () => waitlistApi.list().then(r => r.data),
    enabled: tab === 'waitlist',
  })

  const { data: instanceBansData, isLoading: instanceBansLoading } = useQuery({
    queryKey: ['instance-bans'],
    queryFn: () => moderationApi.listInstanceBans().then(r => r.data),
    enabled: tab === 'instances',
  })

  const reviewRep = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: string; notes?: string }) =>
      moderationApi.reviewReport(id, { action, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports', reportStatus] }),
  })

  const suspendUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => moderationApi.suspendUser(id, data),
    onSuccess: () => {
      Alert.alert('Done', 'User suspended')
      qc.invalidateQueries({ queryKey: ['admin-reports', reportStatus] })
      qc.invalidateQueries({ queryKey: ['mod-users'] })
    },
  })

  const unsuspend = useMutation({
    mutationFn: (id: string) => moderationApi.unsuspendUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-users'] }),
  })

  const banUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => moderationApi.banUser(id, data),
    onSuccess: () => {
      Alert.alert('Done', 'User banned')
      qc.invalidateQueries({ queryKey: ['admin-reports', reportStatus] })
      qc.invalidateQueries({ queryKey: ['mod-users'] })
    },
  })

  const unban = useMutation({
    mutationFn: (id: string) => moderationApi.unbanUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-users'] }),
  })

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.setRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const approveWaitlist = useMutation({
    mutationFn: (id: string) => waitlistApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-waitlist'] }),
  })

  const rejectWaitlist = useMutation({
    mutationFn: (id: string) => waitlistApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-waitlist'] }),
  })

  const banInstance = useMutation({
    mutationFn: (data: any) => moderationApi.banInstance(data),
    onSuccess: () => {
      setInstanceBanForm({ domain: '', reason: '' })
      qc.invalidateQueries({ queryKey: ['instance-bans'] })
    },
  })

  const unbanInstance = useMutation({
    mutationFn: (id: string) => moderationApi.unbanInstance(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instance-bans'] }),
  })

  const suspendUserDirect = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => moderationApi.suspendUser(id, data),
    onSuccess: () => {
      Alert.alert('Done', 'User suspended')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['mod-users'] })
    },
  })

  const banUserDirect = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => moderationApi.banUser(id, data),
    onSuccess: () => {
      Alert.alert('Done', 'User banned')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['mod-users'] })
    },
  })

  const unsuspendDirect = useMutation({
    mutationFn: (id: string) => moderationApi.unsuspendUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['mod-users'] })
    },
  })

  const unbanDirect = useMutation({
    mutationFn: (id: string) => moderationApi.unbanUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['mod-users'] })
    },
  })

  const reports: any[] = repsData?.reports || []
  const modUsers: any[] = modData?.users || []
  const users: any[] = usersData?.users || []
  const waitlistUsers: any[] = waitlistData?.users || []
  const instanceBans: any[] = instanceBansData?.instance_bans || []

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true, headerTitle: 'Admin Panel',
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary,
      }} />

      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {(['reports', 'moderation', 'users', 'waitlist', 'instances'] as Tab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[s.tabItem, tab === t && { borderBottomColor: c.primary }]}>
            <Text style={[s.tabText, { color: tab === t ? c.primary : c.textMuted }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reports tab */}
      {tab === 'reports' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {/* Status filter */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {['pending', 'actioned', 'dismissed'].map(st => (
              <TouchableOpacity key={st} onPress={() => setReportStatus(st)}
                style={[s.statusChip, { borderColor: reportStatus === st ? c.primary : c.border, backgroundColor: reportStatus === st ? c.primaryBg : 'transparent' }]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: reportStatus === st ? c.primary : c.textMuted }}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {repsLoading ? <Spinner /> : reports.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 32 }}>No {reportStatus} reports.</Text>
          ) : reports.map((r: any) => {
            const isExpanded = expandedReport === r.id
            const sf = suspendForms[r.id] || { days: '1', reason: '', notes: '' }
            const bf = banForms[r.id] || { reason: '', notes: '' }
            return (
              <View key={r.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <TouchableOpacity onPress={() => setExpandedReport(isExpanded ? null : r.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <View style={[s.violationBadge, { backgroundColor: '#fee2e2' }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {r.violation_type?.replace(/_/g, ' ') || 'Unknown'}
                        </Text>
                      </View>
                      <Text style={[s.reportMeta, { color: c.textMuted }]}>
                        by @{r.reporter_username}
                        {r.reported_user_username ? ` → @${r.reported_user_username}` : ''}
                        {r.reported_post_id ? ' (post)' : ''}
                        {r.reported_comment_id ? ' (comment)' : ''}
                      </Text>
                      {r.rule_text && <Text style={{ fontSize: 11, color: c.textMuted, fontStyle: 'italic', marginTop: 2 }}>Rule: {r.rule_text}</Text>}
                      {r.details ? <Text style={{ fontSize: 13, color: c.textMd, marginTop: 4 }} numberOfLines={isExpanded ? undefined : 2}>{r.details}</Text> : null}
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.textMuted} />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {/* Quick actions */}
                    {reportStatus === 'pending' && (
                      <>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={() => reviewRep.mutate({ id: r.id, action: 'actioned' })}
                            style={[s.actionBtn, { backgroundColor: c.primary, flex: 1 }]}>
                            <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Mark actioned</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => reviewRep.mutate({ id: r.id, action: 'dismissed' })}
                            style={[s.actionBtn, { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, flex: 1 }]}>
                            <Text style={{ color: c.textMd, fontSize: 13, fontWeight: '600' }}>Dismiss</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Suspend section */}
                        {r.reported_user_username && !r.is_banned && (
                          <View style={[s.actionSection, { borderColor: c.border }]}>
                            <Text style={[s.actionSectionTitle, { color: c.textMuted }]}>Suspend @{r.reported_user_username}</Text>
                            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                              placeholder="Reason" placeholderTextColor={c.textLight}
                              value={sf.reason} onChangeText={t => setSuspendForms(f => ({ ...f, [r.id]: { ...sf, reason: t } }))} />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg, flex: 1 }]}
                                placeholder="Admin notes" placeholderTextColor={c.textLight}
                                value={sf.notes} onChangeText={t => setSuspendForms(f => ({ ...f, [r.id]: { ...sf, notes: t } }))} />
                              <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg, width: 60 }]}
                                placeholder="Days" placeholderTextColor={c.textLight} keyboardType="number-pad"
                                value={sf.days} onChangeText={t => setSuspendForms(f => ({ ...f, [r.id]: { ...sf, days: t } }))} />
                            </View>
                            <TouchableOpacity
                              disabled={!sf.reason || suspendUser.isPending}
                              onPress={() => suspendUser.mutate({ id: r.reported_user_id, data: { reason: sf.reason, notes: sf.notes, days: parseInt(sf.days) || 0 } })}
                              style={[s.actionBtn, { backgroundColor: '#f59e0b', opacity: !sf.reason ? 0.5 : 1 }]}>
                              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                                ⏸ Suspend {sf.days && sf.days !== '0' ? `for ${sf.days}d` : 'indefinitely'}
                              </Text>
                            </TouchableOpacity>

                            {/* Ban section */}
                            <Text style={[s.actionSectionTitle, { color: c.textMuted, marginTop: 8 }]}>Ban @{r.reported_user_username}</Text>
                            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                              placeholder="Ban reason" placeholderTextColor={c.textLight}
                              value={bf.reason} onChangeText={t => setBanForms(f => ({ ...f, [r.id]: { ...bf, reason: t } }))} />
                            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                              placeholder="Admin notes" placeholderTextColor={c.textLight}
                              value={bf.notes} onChangeText={t => setBanForms(f => ({ ...f, [r.id]: { ...bf, notes: t } }))} />
                            <TouchableOpacity
                              disabled={!bf.reason || banUser.isPending}
                              onPress={() => Alert.alert('Ban user?', `This will permanently ban @${r.reported_user_username}.`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Ban', style: 'destructive', onPress: () => banUser.mutate({ id: r.reported_user_id, data: { reason: bf.reason, notes: bf.notes } }) },
                              ])}
                              style={[s.actionBtn, { backgroundColor: '#ef4444', opacity: !bf.reason ? 0.5 : 1 }]}>
                              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>🚫 Ban user</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* Moderation tab */}
      {tab === 'moderation' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Suspended & Banned Users</Text>
          {modLoading ? <Spinner /> : modUsers.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No suspended or banned users.</Text>
          ) : modUsers.map((u: any) => (
            <View key={u.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>@{u.username}</Text>
                  {u.is_suspended && !u.banned_at && (
                    <View style={[s.violationBadge, { backgroundColor: '#fef3c7', marginTop: 4 }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400e' }}>
                        SUSPENDED{u.suspension_expires_at ? ` until ${new Date(u.suspension_expires_at).toLocaleDateString()}` : ' (indefinite)'}
                      </Text>
                    </View>
                  )}
                  {u.banned_at && (
                    <View style={[s.violationBadge, { backgroundColor: '#fee2e2', marginTop: 4 }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>BANNED</Text>
                    </View>
                  )}
                  {(u.suspension_reason || u.ban_reason) && (
                    <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>
                      Reason: {u.suspension_reason || u.ban_reason}
                    </Text>
                  )}
                  {(u.suspension_notes || u.ban_notes) && (
                    <Text style={{ fontSize: 11, color: c.textMuted, fontStyle: 'italic', marginTop: 2 }}>
                      Notes: {u.suspension_notes || u.ban_notes}
                    </Text>
                  )}
                  {u.is_remote && <Text style={{ fontSize: 11, color: c.textMuted }}>{u.remote_instance}</Text>}
                </View>
                <View style={{ gap: 6 }}>
                  {u.is_suspended && !u.banned_at && (
                    <TouchableOpacity onPress={() => unsuspend.mutate(u.id)}
                      style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                      <Text style={{ fontSize: 12, color: c.textMd }}>Unsuspend</Text>
                    </TouchableOpacity>
                  )}
                  {u.banned_at && (
                    <TouchableOpacity onPress={() => unban.mutate(u.id)}
                      style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                      <Text style={{ fontSize: 12, color: c.textMd }}>Unban</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {usersLoading ? <Spinner /> : users.map((u: any) => {
            const isExpanded = expandedUser === u.id
            const sf = userSuspendForms[u.id] || { days: '1', reason: '', notes: '' }
            const bf = userBanForms[u.id] || { reason: '', notes: '' }
            return (
              <View key={u.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <TouchableOpacity onPress={() => setExpandedUser(isExpanded ? null : u.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>@{u.username}</Text>
                      <Text style={{ fontSize: 12, color: c.textMuted }}>{u.email} · {u.role}</Text>
                      {u.is_suspended && !u.banned_at && <Text style={{ fontSize: 11, color: '#f59e0b' }}>Suspended</Text>}
                      {u.banned_at && <Text style={{ fontSize: 11, color: '#ef4444' }}>Banned</Text>}
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.textMuted} />
                  </View>
                </TouchableOpacity>

                {isExpanded && u.id !== user?.id && (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {/* Role */}
                    <TouchableOpacity
                      onPress={() => Alert.alert('Set role', undefined, [
                        { text: 'User',      onPress: () => setRole.mutate({ id: u.id, role: 'user' }) },
                        { text: 'Moderator', onPress: () => setRole.mutate({ id: u.id, role: 'moderator' }) },
                        { text: 'Admin',     onPress: () => setRole.mutate({ id: u.id, role: 'admin' }) },
                        { text: 'Cancel', style: 'cancel' },
                      ])}
                      style={[s.actionBtn, { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }]}>
                      <Text style={{ color: c.textMd, fontSize: 13, fontWeight: '600' }}>Change role</Text>
                    </TouchableOpacity>

                    {/* Unsuspend / Unban quick actions */}
                    {u.is_suspended && !u.banned_at && (
                      <TouchableOpacity onPress={() => unsuspendDirect.mutate(u.id)}
                        style={[s.actionBtn, { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d' }]}>
                        <Text style={{ color: '#92400e', fontSize: 13, fontWeight: '600' }}>Lift suspension</Text>
                      </TouchableOpacity>
                    )}
                    {u.banned_at && (
                      <TouchableOpacity onPress={() => unbanDirect.mutate(u.id)}
                        style={[s.actionBtn, { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' }]}>
                        <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '600' }}>Unban</Text>
                      </TouchableOpacity>
                    )}

                    {/* Suspend form */}
                    {!u.banned_at && (
                      <View style={[s.actionSection, { borderColor: c.border }]}>
                        <Text style={[s.actionSectionTitle, { color: c.textMuted }]}>Suspend @{u.username}</Text>
                        <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                          placeholder="Reason" placeholderTextColor={c.textLight}
                          value={sf.reason} onChangeText={t => setUserSuspendForms(f => ({ ...f, [u.id]: { ...sf, reason: t } }))} />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg, flex: 1 }]}
                            placeholder="Admin notes" placeholderTextColor={c.textLight}
                            value={sf.notes} onChangeText={t => setUserSuspendForms(f => ({ ...f, [u.id]: { ...sf, notes: t } }))} />
                          <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg, width: 60 }]}
                            placeholder="Days" placeholderTextColor={c.textLight} keyboardType="number-pad"
                            value={sf.days} onChangeText={t => setUserSuspendForms(f => ({ ...f, [u.id]: { ...sf, days: t } }))} />
                        </View>
                        <TouchableOpacity
                          disabled={!sf.reason || suspendUserDirect.isPending}
                          onPress={() => suspendUserDirect.mutate({ id: u.id, data: { reason: sf.reason, notes: sf.notes, days: parseInt(sf.days) || 0 } })}
                          style={[s.actionBtn, { backgroundColor: '#f59e0b', opacity: !sf.reason ? 0.5 : 1 }]}>
                          <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                            Suspend {sf.days && sf.days !== '0' ? `for ${sf.days}d` : 'indefinitely'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Ban form */}
                    {!u.banned_at && (
                      <View style={[s.actionSection, { borderColor: c.border }]}>
                        <Text style={[s.actionSectionTitle, { color: c.textMuted }]}>Ban @{u.username}</Text>
                        <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                          placeholder="Ban reason" placeholderTextColor={c.textLight}
                          value={bf.reason} onChangeText={t => setUserBanForms(f => ({ ...f, [u.id]: { ...bf, reason: t } }))} />
                        <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                          placeholder="Admin notes" placeholderTextColor={c.textLight}
                          value={bf.notes} onChangeText={t => setUserBanForms(f => ({ ...f, [u.id]: { ...bf, notes: t } }))} />
                        <TouchableOpacity
                          disabled={!bf.reason || banUserDirect.isPending}
                          onPress={() => Alert.alert('Ban user?', `This will permanently ban @${u.username}.`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Ban', style: 'destructive', onPress: () => banUserDirect.mutate({ id: u.id, data: { reason: bf.reason, notes: bf.notes } }) },
                          ])}
                          style={[s.actionBtn, { backgroundColor: '#ef4444', opacity: !bf.reason ? 0.5 : 1 }]}>
                          <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Ban user</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* Waitlist tab */}
      {tab === 'waitlist' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Pending Waitlist</Text>
          {waitlistLoading ? <Spinner /> : waitlistUsers.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No users on the waitlist.</Text>
          ) : waitlistUsers.map((u: any) => (
            <View key={u.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{u.display_name || u.username}</Text>
                  <Text style={{ fontSize: 12, color: c.textMuted }}>@{u.username}</Text>
                  <Text style={{ fontSize: 12, color: c.textMuted }}>{u.email}</Text>
                  {u.created_at && (
                    <Text style={{ fontSize: 11, color: c.textLight, marginTop: 2 }}>
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    disabled={approveWaitlist.isPending}
                    onPress={() => approveWaitlist.mutate(u.id)}
                    style={[s.smallBtn, { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }]}>
                    <Text style={{ fontSize: 12, color: '#15803d', fontWeight: '600' }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={rejectWaitlist.isPending}
                    onPress={() => Alert.alert('Reject user?', `This will reject @${u.username} from the waitlist.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reject', style: 'destructive', onPress: () => rejectWaitlist.mutate(u.id) },
                    ])}
                    style={[s.smallBtn, { borderColor: '#ef4444', backgroundColor: '#fef2f2' }]}>
                    <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: '600' }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Instances tab */}
      {tab === 'instances' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {/* Ban new instance form */}
          <View style={[s.actionSection, { borderColor: c.border, marginBottom: 16 }]}>
            <Text style={[s.actionSectionTitle, { color: c.textMuted }]}>Ban instance</Text>
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="Domain (e.g. bad-instance.social)" placeholderTextColor={c.textLight}
              autoCapitalize="none" keyboardType="url"
              value={instanceBanForm.domain}
              onChangeText={t => setInstanceBanForm(f => ({ ...f, domain: t }))} />
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="Reason" placeholderTextColor={c.textLight}
              value={instanceBanForm.reason}
              onChangeText={t => setInstanceBanForm(f => ({ ...f, reason: t }))} />
            <TouchableOpacity
              disabled={!instanceBanForm.domain || !instanceBanForm.reason || banInstance.isPending}
              onPress={() => banInstance.mutate({ domain: instanceBanForm.domain, reason: instanceBanForm.reason })}
              style={[s.actionBtn, { backgroundColor: '#ef4444', opacity: (!instanceBanForm.domain || !instanceBanForm.reason) ? 0.5 : 1 }]}>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Ban instance</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Banned Instances</Text>
          {instanceBansLoading ? <Spinner /> : instanceBans.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No banned instances.</Text>
          ) : instanceBans.map((ib: any) => (
            <View key={ib.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{ib.domain}</Text>
                  {ib.reason && <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>Reason: {ib.reason}</Text>}
                  {ib.created_at && <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>{new Date(ib.created_at).toLocaleDateString()}</Text>}
                </View>
                <TouchableOpacity onPress={() => unbanInstance.mutate(ib.id)}
                  style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                  <Text style={{ fontSize: 12, color: c.textMd }}>Unban</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  tabBar:           { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem:          { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:          { fontSize: 13, fontWeight: '600' },
  statusChip:       { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  card:             { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  violationBadge:   { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  reportMeta:       { fontSize: 12, marginTop: 4 },
  actionBtn:        { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionSection:    { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8, marginTop: 4 },
  actionSectionTitle:{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  miniInput:        { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  sectionTitle:     { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  smallBtn:         { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
})
