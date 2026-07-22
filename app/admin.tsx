import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet, Switch, ActivityIndicator, Share } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner } from '../components/ui'
import { moderationApi, adminApi, waitlistApi, pagesApi, adminPagesApi } from '../api'
import { useAuthStore } from '../store/auth'
import { useC } from '../constants/ColorContext'

type Tab = 'overview' | 'reports' | 'moderation' | 'users' | 'waitlist' | 'fediverse' | 'bluesky' | 'federation' | 'relays' | 'invites' | 'rules' | 'settings' | 'audit' | 'pages' | 'media'

// GetSettings (internal/admin/admin.go) serializes every instance_settings
// value as a string ("true"/"false", not a JSON boolean), so `typeof value
// === 'boolean'` never fires. Listing the known boolean-shaped keys
// explicitly lets the generic settings list render a real Switch for them
// instead of a raw text input the admin has to type true/false into.
// activitypub_enabled is deliberately excluded — it lives on the Fediverse
// tab instead, alongside instance bans (parity with the web admin panel's
// AGORA-178 consolidation).
const BOOLEAN_SETTING_KEYS = new Set(['federation_enabled', 'smtp_enabled', 'user_invites_enabled'])

export default function AdminScreen() {
  const c = useC()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ tab?: string }>()
  const initialTab = (params.tab as Tab) || 'overview'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [reportStatus, setReportStatus] = useState('pending')
  const [suspendForms, setSuspendForms] = useState<Record<string,{days:string,reason:string,notes:string}>>({})
  const [banForms, setBanForms] = useState<Record<string,{reason:string,notes:string}>>({})
  const [expandedReport, setExpandedReport] = useState<string|null>(null)
  const [expandedUser, setExpandedUser] = useState<string|null>(null)
  const [userSuspendForms, setUserSuspendForms] = useState<Record<string,{days:string,reason:string,notes:string}>>({})
  const [userBanForms, setUserBanForms] = useState<Record<string,{reason:string,notes:string}>>({})
  const [instanceBanForm, setInstanceBanForm] = useState({ domain: '', reason: '' })
  const [pdsBanForm, setPdsBanForm] = useState({ instance: '', reason: '' })
  const [didBlockForm, setDidBlockForm] = useState({ did: '', reason: '' })
  const [newRuleForm, setNewRuleForm] = useState({ title: '', description: '' })
  const [editingRule, setEditingRule] = useState<{ id: string; title: string; description: string } | null>(null)
  const [newInviteCreated, setNewInviteCreated] = useState<string | null>(null)
  const [auditPage, setAuditPage] = useState(0)
  const [fedDomain, setFedDomain] = useState('')
  const [relayInboxUrl, setRelayInboxUrl] = useState('')
  const [orphanScan, setOrphanScan] = useState<{ count: number; total_bytes: number; orphans: { path: string; size: number; mod_time: string }[] } | null>(null)
  const [orphanScanning, setOrphanScanning] = useState(false)

  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title="Admin" back />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.textMuted }}>Access denied</Text>
        </View>
      </Screen>
    )
  }

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then(r => r.data),
    enabled: tab === 'overview',
  })

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
    enabled: tab === 'fediverse' || tab === 'bluesky',
  })

  const { data: blockedDidsData, isLoading: blockedDidsLoading } = useQuery({
    queryKey: ['blocked-dids'],
    queryFn: () => moderationApi.listBlockedDIDs().then(r => r.data),
    enabled: tab === 'bluesky',
  })

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings().then(r => r.data),
    enabled: tab === 'settings' || tab === 'fediverse' || tab === 'bluesky',
  })

  const { data: fedData, isLoading: fedLoading } = useQuery({
    queryKey: ['admin-fed'],
    queryFn: () => adminApi.listInstances().then(r => r.data),
    enabled: tab === 'federation',
  })

  const { data: relaysData, isLoading: relaysLoading } = useQuery({
    queryKey: ['admin-relays'],
    queryFn: () => adminApi.listRelays().then(r => r.data),
    enabled: tab === 'relays',
  })

  const { data: adminPagesData, isLoading: adminPagesLoading } = useQuery({
    queryKey: ['admin-pages'],
    queryFn: () => pagesApi.list().then(r => r.data),
    enabled: tab === 'pages',
  })

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['admin-rules'],
    queryFn: () => adminApi.listRules().then(r => r.data),
    enabled: tab === 'rules',
  })

  const { data: invitesData, isLoading: invitesLoading } = useQuery({
    queryKey: ['admin-invites'],
    queryFn: () => adminApi.listInvites().then(r => r.data),
    enabled: tab === 'invites',
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit', auditPage],
    queryFn: () => adminApi.getAuditLog(auditPage).then(r => r.data),
    enabled: tab === 'audit',
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

  const banPds = useMutation({
    mutationFn: (data: any) => moderationApi.banInstance(data),
    onSuccess: () => {
      setPdsBanForm({ instance: '', reason: '' })
      qc.invalidateQueries({ queryKey: ['instance-bans'] })
    },
  })

  const blockDid = useMutation({
    mutationFn: (data: any) => moderationApi.blockDID(data),
    onSuccess: () => {
      setDidBlockForm({ did: '', reason: '' })
      qc.invalidateQueries({ queryKey: ['blocked-dids'] })
    },
  })

  const unblockDid = useMutation({
    mutationFn: (id: string) => moderationApi.unblockDID(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked-dids'] }),
  })

  const updateSettings = useMutation({
    mutationFn: (data: any) => adminApi.updateSettings(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-settings'] }); Alert.alert('Saved') },
    onError: () => Alert.alert('Error', 'Could not save settings'),
  })

  const createRule = useMutation({
    mutationFn: () => adminApi.createRule({ title: newRuleForm.title.trim(), description: newRuleForm.description.trim() || undefined }),
    onSuccess: () => { setNewRuleForm({ title: '', description: '' }); qc.invalidateQueries({ queryKey: ['admin-rules'] }) },
    onError: () => Alert.alert('Error', 'Could not create rule'),
  })

  const updateRule = useMutation({
    mutationFn: () => editingRule ? adminApi.updateRule(editingRule.id, { title: editingRule.title, description: editingRule.description }) : Promise.resolve(),
    onSuccess: () => { setEditingRule(null); qc.invalidateQueries({ queryKey: ['admin-rules'] }) },
    onError: () => Alert.alert('Error', 'Could not update rule'),
  })

  const deleteRule = useMutation({
    mutationFn: (id: string) => adminApi.deleteRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-rules'] }),
    onError: () => Alert.alert('Error', 'Could not delete rule'),
  })

  const addInstance = useMutation({
    mutationFn: (domain: string) => adminApi.addInstance(domain),
    onSuccess: () => { setFedDomain(''); qc.invalidateQueries({ queryKey: ['admin-fed'] }) },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not add instance'),
  })

  const blockInstance = useMutation({
    mutationFn: (id: string) => adminApi.blockInstance(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-fed'] }),
  })

  const unblockInstance = useMutation({
    mutationFn: (id: string) => adminApi.unblockInstance(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-fed'] }),
  })

  const addRelay = useMutation({
    mutationFn: (inboxUrl: string) => adminApi.addRelay(inboxUrl),
    onSuccess: () => { setRelayInboxUrl(''); qc.invalidateQueries({ queryKey: ['admin-relays'] }) },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not add relay'),
  })

  const enableRelay = useMutation({
    mutationFn: (id: string) => adminApi.enableRelay(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-relays'] }),
  })

  const disableRelay = useMutation({
    mutationFn: (id: string) => adminApi.disableRelay(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-relays'] }),
  })

  const deleteRelay = useMutation({
    mutationFn: (id: string) => adminApi.deleteRelay(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-relays'] }),
  })

  const verifyPage = useMutation({
    mutationFn: ({ slug, v }: { slug: string; v: boolean }) => adminPagesApi.verify(slug, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-pages'] }),
    onError: () => Alert.alert('Error', 'Could not update verification'),
  })

  const featurePage = useMutation({
    mutationFn: ({ slug, v }: { slug: string; v: boolean }) => adminPagesApi.feature(slug, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-pages'] }),
    onError: () => Alert.alert('Error', 'Could not update featured status'),
  })

  const deleteOrphans = useMutation({
    mutationFn: () => adminApi.deleteOrphans(),
    onSuccess: (res) => { Alert.alert('Done', `Deleted ${res.data.count} file(s)`); setOrphanScan(null) },
    onError: () => Alert.alert('Error', 'Could not delete orphaned files'),
  })

  const scanOrphans = async () => {
    setOrphanScanning(true)
    try {
      const res = await adminApi.scanOrphans()
      setOrphanScan(res.data)
    } catch {
      Alert.alert('Error', 'Scan failed')
    } finally {
      setOrphanScanning(false)
    }
  }

  const moveRule = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => adminApi.moveRule(id, direction),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-rules'] }),
  })

  const createInvite = useMutation({
    mutationFn: () => adminApi.createInvite(),
    onSuccess: (res) => { setNewInviteCreated(res.data.code || res.data.token || res.data.invite?.code); qc.invalidateQueries({ queryKey: ['admin-invites'] }) },
    onError: () => Alert.alert('Error', 'Could not create invite'),
  })

  const revokeInvite = useMutation({
    mutationFn: (id: string) => adminApi.deleteInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invites'] }),
    onError: () => Alert.alert('Error', 'Could not revoke invite'),
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
  const blockedDids: any[] = blockedDidsData?.blocks || []
  const rules: any[] = rulesData?.rules || []
  const invites: any[] = invitesData?.invites || []
  const auditEntries: any[] = auditData?.entries || auditData?.logs || []
  const auditHasMore: boolean = auditData?.has_more ?? false
  const settings: any = settingsData || {}
  const stats: any = statsData || {}
  const fedInstances: any[] = fedData?.instances || []
  const relays: any[] = relaysData?.relays || []
  const adminPages: any[] = adminPagesData?.pages || []

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Admin Panel" back />

      {/* Tab bar — scrollable to fit all tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[s.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}
        contentContainerStyle={{ flexDirection: 'row' }}>
        {(['overview', 'reports', 'moderation', 'users', 'waitlist', 'fediverse', 'bluesky', 'federation', 'relays', 'invites', 'rules', 'settings', 'audit', 'pages', 'media'] as Tab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[s.tabItem, tab === t && { borderBottomColor: c.primary }]}>
            <Text style={[s.tabText, { color: tab === t ? c.primary : c.textMuted }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Overview tab: instance stats dashboard, parity with web AdminPage.tsx's overview tab */}
      {tab === 'overview' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {statsLoading ? <Spinner /> : (
            <View style={s.statsGrid}>
              {([
                ['Total Users', stats.total_users],
                ['Posts Today', stats.posts_today],
                ['Active (7d)', stats.active_users_7d],
                ['Pending Reports', stats.pending_reports],
              ] as [string, number][]).map(([label, value]) => (
                <View key={label} style={[s.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Text style={[s.statValue, { color: c.text }]}>{value ?? 0}</Text>
                  <Text style={[s.statLabel, { color: c.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

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

      {/* Fediverse tab (AGORA-178 parity): instance-wide ActivityPub toggle
          + instance bans, the single enforced way to block a fediverse
          instance (AGORA-177) — consolidated here instead of splitting the
          toggle off into Settings. */}
      {tab === 'fediverse' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {settingsLoading ? <Spinner /> : (
            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border, marginBottom: 16 }]}>
              <Text style={[s.actionSectionTitle, { color: c.textMuted, marginBottom: 6 }]}>Fediverse (ActivityPub)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: c.textMd, fontSize: 12, flex: 1, marginRight: 8 }}>
                  Let Mastodon and other fediverse apps discover, follow, and interact with users on this instance.
                  Separate from Agora-to-Agora federation in Settings; users can also opt out individually in their own Settings.
                </Text>
                <Switch
                  value={settings.activitypub_enabled !== 'false'}
                  onValueChange={v => updateSettings.mutate({ activitypub_enabled: v ? 'true' : 'false' })}
                  trackColor={{ false: c.border, true: c.primary }}
                />
              </View>
            </View>
          )}

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

      {/* Bluesky tab (AGORA-193 parity): instance-wide AT Proto toggle,
          independent of the ActivityPub toggle above. */}
      {tab === 'bluesky' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {settingsLoading ? <Spinner /> : (
            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border, marginBottom: 16 }]}>
              <Text style={[s.actionSectionTitle, { color: c.textMuted, marginBottom: 6 }]}>Bluesky (AT Protocol)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: c.textMd, fontSize: 12, flex: 1, marginRight: 8 }}>
                  Let this instance act as a Bluesky PDS — federating public posts over AT Protocol and being
                  discoverable/followable from Bluesky. Independent of the Fediverse toggle; users can also opt out
                  individually in their own Settings.
                </Text>
                <Switch
                  value={settings.atproto_enabled === 'true'}
                  onValueChange={v => updateSettings.mutate({ atproto_enabled: v ? 'true' : 'false' })}
                  trackColor={{ false: c.border, true: c.primary }}
                />
              </View>
            </View>
          )}

          {/* AGORA-205: DID-scoped block list — checked from every inbound
              Bluesky path (ingested posts, replies, likes/reposts). */}
          <View style={[s.actionSection, { borderColor: c.border, marginBottom: 16 }]}>
            <Text style={[s.actionSectionTitle, { color: c.textMuted }]}>Block a Bluesky DID</Text>
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="DID (e.g. did:plc:abc123…)" placeholderTextColor={c.textLight}
              autoCapitalize="none"
              value={didBlockForm.did}
              onChangeText={t => setDidBlockForm(f => ({ ...f, did: t }))} />
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="Reason" placeholderTextColor={c.textLight}
              value={didBlockForm.reason}
              onChangeText={t => setDidBlockForm(f => ({ ...f, reason: t }))} />
            <TouchableOpacity
              disabled={!didBlockForm.did || !didBlockForm.reason || blockDid.isPending}
              onPress={() => blockDid.mutate({ did: didBlockForm.did, reason: didBlockForm.reason })}
              style={[s.actionBtn, { backgroundColor: '#ef4444', opacity: (!didBlockForm.did || !didBlockForm.reason) ? 0.5 : 1 }]}>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Block DID</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Blocked DIDs</Text>
          {blockedDidsLoading ? <Spinner /> : blockedDids.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No blocked DIDs.</Text>
          ) : blockedDids.map((b: any) => (
            <View key={b.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{b.did}</Text>
                  {b.reason && <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>Reason: {b.reason}</Text>}
                </View>
                <TouchableOpacity onPress={() => unblockDid.mutate(b.id)}
                  style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                  <Text style={{ fontSize: 12, color: c.textMd }}>Unblock</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* PDS-host block scope reuses instance_bans as-is — same list the
              Fediverse tab's Instance Bans manage. */}
          <View style={[s.actionSection, { borderColor: c.border, marginTop: 16, marginBottom: 16 }]}>
            <Text style={[s.actionSectionTitle, { color: c.textMuted }]}>Ban a PDS domain</Text>
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="PDS domain (e.g. bad-pds.example.com)" placeholderTextColor={c.textLight}
              autoCapitalize="none" keyboardType="url"
              value={pdsBanForm.instance}
              onChangeText={t => setPdsBanForm(f => ({ ...f, instance: t }))} />
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="Reason" placeholderTextColor={c.textLight}
              value={pdsBanForm.reason}
              onChangeText={t => setPdsBanForm(f => ({ ...f, reason: t }))} />
            <TouchableOpacity
              disabled={!pdsBanForm.instance || !pdsBanForm.reason || banPds.isPending}
              onPress={() => banPds.mutate({ instance: pdsBanForm.instance, reason: pdsBanForm.reason })}
              style={[s.actionBtn, { backgroundColor: '#ef4444', opacity: (!pdsBanForm.instance || !pdsBanForm.reason) ? 0.5 : 1 }]}>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Ban domain</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
      {/* Federation tab: Agora-to-Agora peer instance management, distinct
          from the Fediverse tab's Mastodon/AP instance bans above. */}
      {tab === 'federation' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          <View style={[s.actionSection, { borderColor: c.border, marginBottom: 16 }]}>
            <Text style={[s.actionSectionTitle, { color: c.textMuted }]}>Add Federated Instance</Text>
            <Text style={{ color: c.textMd, fontSize: 12 }}>
              Enter the domain of another Agora instance to federate with. Both instances must have federation
              enabled. This is specifically for the Agora-to-Agora protocol — to block a Mastodon or other standard
              fediverse instance, use the Fediverse tab's Instance Bans instead.
            </Text>
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="social.example.com" placeholderTextColor={c.textLight}
              autoCapitalize="none" keyboardType="url"
              value={fedDomain} onChangeText={setFedDomain} />
            <TouchableOpacity
              disabled={!fedDomain.trim() || addInstance.isPending}
              onPress={() => addInstance.mutate(fedDomain.trim())}
              style={[s.actionBtn, { backgroundColor: c.primary, opacity: !fedDomain.trim() ? 0.5 : 1 }]}>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                {addInstance.isPending ? 'Connecting…' : 'Add Instance'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Federated Instances</Text>
          {fedLoading ? <Spinner /> : fedInstances.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No federated instances yet.</Text>
          ) : fedInstances.map((inst: any) => (
            <View key={inst.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border, opacity: inst.status === 'blocked' ? 0.6 : 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{inst.name || inst.domain}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={{ fontSize: 12, color: c.textMuted }}>{inst.domain}</Text>
                    <View style={[s.violationBadge, { backgroundColor: inst.status === 'active' ? '#dcfce7' : '#fee2e2' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: inst.status === 'active' ? '#15803d' : '#dc2626' }}>
                        {inst.status}
                      </Text>
                    </View>
                  </View>
                </View>
                {inst.status === 'active'
                  ? <TouchableOpacity onPress={() => blockInstance.mutate(inst.id)}
                      style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                      <Text style={{ fontSize: 12, color: c.red }}>Block</Text>
                    </TouchableOpacity>
                  : <TouchableOpacity onPress={() => unblockInstance.mutate(inst.id)}
                      style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                      <Text style={{ fontSize: 12, color: c.textMd }}>Unblock</Text>
                    </TouchableOpacity>}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Relays tab (AMOBILE-134): mirrors Mastodon's own admin Relays
          screen and web's parallel implementation (AGORA-223) — a relay is
          entered by its inbox URL directly, matching the AGORA-220 backend
          design (no client-side actor resolution). */}
      {tab === 'relays' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          <View style={[s.actionSection, { borderColor: c.border, marginBottom: 16 }]}>
            <Text style={[s.actionSectionTitle, { color: c.textMuted }]}>Add new relay</Text>
            <Text style={{ color: c.textMd, fontSize: 12 }}>
              A federation relay is an intermediary server that exchanges large volumes of public posts between
              servers that subscribe and publish to it. It can help small and medium servers discover content
              from the fediverse, which would otherwise require local users manually following other people on
              remote servers.
            </Text>
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="https://relay.example.com/inbox" placeholderTextColor={c.textLight}
              autoCapitalize="none" keyboardType="url"
              value={relayInboxUrl} onChangeText={setRelayInboxUrl} />
            <TouchableOpacity
              disabled={!relayInboxUrl.trim() || addRelay.isPending}
              onPress={() => addRelay.mutate(relayInboxUrl.trim())}
              style={[s.actionBtn, { backgroundColor: c.primary, opacity: !relayInboxUrl.trim() ? 0.5 : 1 }]}>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                {addRelay.isPending ? 'Requesting…' : 'Add new relay'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Relays</Text>
          {relaysLoading ? <Spinner /> : relays.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No relays yet.</Text>
          ) : relays.map((relay: any) => {
            const statusLabel: Record<string, string> = {
              enabled: '✓ Enabled', pending: '⏳ Pending', disabled: 'Disabled', rejected: 'Rejected',
            }
            const statusColor: Record<string, string> = {
              enabled: '#15803d', pending: '#a16207', disabled: c.textMuted, rejected: '#dc2626',
            }
            const statusBg: Record<string, string> = {
              enabled: '#dcfce7', pending: '#fef9c3', disabled: c.bg, rejected: '#fee2e2',
            }
            return (
              <View key={relay.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border, opacity: relay.status === 'enabled' ? 1 : 0.7 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'monospace', color: c.text }} numberOfLines={1}>{relay.inbox_url}</Text>
                    <View style={[s.violationBadge, { backgroundColor: statusBg[relay.status] || c.bg, marginTop: 4 }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor[relay.status] || c.textMuted }}>
                        {statusLabel[relay.status] || relay.status}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  {relay.status === 'enabled'
                    ? <TouchableOpacity onPress={() => disableRelay.mutate(relay.id)}
                        style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                        <Text style={{ fontSize: 12, color: c.textMd }}>Disable</Text>
                      </TouchableOpacity>
                    : <TouchableOpacity onPress={() => enableRelay.mutate(relay.id)}
                        style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                        <Text style={{ fontSize: 12, color: '#15803d' }}>Enable</Text>
                      </TouchableOpacity>}
                  <TouchableOpacity
                    onPress={() => Alert.alert('Remove relay?', relay.inbox_url, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteRelay.mutate(relay.id) },
                    ])}
                    style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                    <Text style={{ fontSize: 12, color: c.red }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* Invites tab (AMOBILE-69) */}
      {tab === 'invites' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          <TouchableOpacity onPress={() => createInvite.mutate()} disabled={createInvite.isPending}
            style={[s.actionBtn, { backgroundColor: c.primary, marginBottom: 16 }]}>
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
              {createInvite.isPending ? 'Creating…' : '+ Create Invite Code'}
            </Text>
          </TouchableOpacity>
          {newInviteCreated && (
            <View style={[s.actionSection, { borderColor: '#22c55e', backgroundColor: '#f0fdf4', marginBottom: 12 }]}>
              <Text style={[s.actionSectionTitle, { color: '#15803d' }]}>New invite code created</Text>
              <Text style={{ fontFamily: 'monospace', fontSize: 15, color: '#15803d', marginTop: 4 }}>{newInviteCreated}</Text>
              <TouchableOpacity onPress={() => Share.share({ message: newInviteCreated })} style={{ marginTop: 8 }}>
                <Text style={{ color: c.primary, fontSize: 13 }}>Share code →</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Active Invites</Text>
          {invitesLoading ? <Spinner /> : invites.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No active invite codes.</Text>
          ) : invites.map((inv: any) => (
            <View key={inv.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: '600', color: c.text }}>{inv.code || inv.token || inv.id}</Text>
                  {inv.created_by_username && <Text style={{ fontSize: 12, color: c.textMuted }}>By @{inv.created_by_username}</Text>}
                  {inv.uses !== undefined && <Text style={{ fontSize: 12, color: c.textMuted }}>Uses: {inv.uses}</Text>}
                  {inv.created_at && <Text style={{ fontSize: 11, color: c.textMuted }}>{new Date(inv.created_at).toLocaleDateString()}</Text>}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => Share.share({ message: inv.code || inv.token })}
                    style={[s.smallBtn, { borderColor: c.primary, backgroundColor: c.primaryBg }]}>
                    <Ionicons name="share-outline" size={14} color={c.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Alert.alert('Revoke invite?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Revoke', style: 'destructive', onPress: () => revokeInvite.mutate(inv.id) },
                  ])} style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                    <Text style={{ fontSize: 12, color: c.red }}>Revoke</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Rules tab (AMOBILE-68) */}
      {tab === 'rules' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {/* New rule form */}
          <View style={[s.actionSection, { borderColor: c.border, marginBottom: 16 }]}>
            <Text style={[s.actionSectionTitle, { color: c.textMuted }]}>New Rule</Text>
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="Rule title" placeholderTextColor={c.textLight}
              value={newRuleForm.title} onChangeText={t => setNewRuleForm(f => ({ ...f, title: t }))} />
            <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
              placeholder="Description (optional)" placeholderTextColor={c.textLight}
              value={newRuleForm.description} onChangeText={t => setNewRuleForm(f => ({ ...f, description: t }))}
              multiline />
            <TouchableOpacity disabled={!newRuleForm.title.trim() || createRule.isPending}
              onPress={() => createRule.mutate()}
              style={[s.actionBtn, { backgroundColor: c.primary, opacity: !newRuleForm.title.trim() ? 0.5 : 1 }]}>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Add rule</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Instance Rules</Text>
          {rulesLoading ? <Spinner /> : rules.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No rules yet.</Text>
          ) : rules.map((rule: any, idx: number) => (
            <View key={rule.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              {editingRule?.id === rule.id ? (
                <View style={{ gap: 8 }}>
                  <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                    value={editingRule.title} onChangeText={t => setEditingRule(e => e ? { ...e, title: t } : null)} />
                  <TextInput style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                    value={editingRule.description} onChangeText={t => setEditingRule(e => e ? { ...e, description: t } : null)}
                    placeholder="Description" placeholderTextColor={c.textLight} multiline />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => updateRule.mutate()} disabled={updateRule.isPending}
                      style={[s.actionBtn, { backgroundColor: c.primary, flex: 1 }]}>
                      <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingRule(null)}
                      style={[s.actionBtn, { borderWidth: 1, borderColor: c.border, flex: 1 }]}>
                      <Text style={{ color: c.textMd, fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{idx + 1}. {rule.title}</Text>
                    {rule.description ? <Text style={{ fontSize: 13, color: c.textMd, marginTop: 3 }}>{rule.description}</Text> : null}
                  </View>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity onPress={() => moveRule.mutate({ id: rule.id, direction: 'up' })} disabled={idx === 0}
                        style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg, opacity: idx === 0 ? 0.4 : 1 }]}>
                        <Ionicons name="chevron-up" size={14} color={c.textMd} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => moveRule.mutate({ id: rule.id, direction: 'down' })} disabled={idx === rules.length - 1}
                        style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg, opacity: idx === rules.length - 1 ? 0.4 : 1 }]}>
                        <Ionicons name="chevron-down" size={14} color={c.textMd} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setEditingRule({ id: rule.id, title: rule.title, description: rule.description || '' })}
                      style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                      <Ionicons name="pencil-outline" size={14} color={c.textMd} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Delete rule?', rule.title, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteRule.mutate(rule.id) },
                    ])} style={[s.smallBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                      <Ionicons name="trash-outline" size={14} color={c.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Settings tab (AMOBILE-68) */}
      {tab === 'settings' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {settingsLoading ? <Spinner /> : (
            <View style={{ gap: 12 }}>
              <Text style={[s.sectionTitle, { color: c.textMuted }]}>Instance Settings</Text>
              {Object.entries(settings).filter(([key]) => key !== 'activitypub_enabled').map(([key, value]: [string, any]) => (
                <View key={key} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Text style={[s.actionSectionTitle, { color: c.textMuted, marginBottom: 6 }]}>{key.replace(/_/g, ' ')}</Text>
                  {BOOLEAN_SETTING_KEYS.has(key) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: c.text, fontSize: 14 }}>{value === 'true' ? 'Enabled' : 'Disabled'}</Text>
                      <Switch value={value === 'true'}
                        onValueChange={v => updateSettings.mutate({ [key]: v ? 'true' : 'false' })}
                        trackColor={{ false: c.border, true: c.primary }} />
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput
                        style={[s.miniInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg, flex: 1 }]}
                        defaultValue={String(value ?? '')}
                        onEndEditing={e => updateSettings.mutate({ [key]: e.nativeEvent.text })}
                        returnKeyType="done"
                      />
                    </View>
                  )}
                </View>
              ))}
              {Object.keys(settings).length === 0 && (
                <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No settings available.</Text>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Audit log tab (AMOBILE-70) */}
      {tab === 'audit' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Audit Log</Text>
          {auditLoading ? <Spinner /> : auditEntries.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No audit log entries.</Text>
          ) : (
            <>
              {auditEntries.map((entry: any, i: number) => (
                <View key={entry.id || i} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>
                        {entry.action?.replace(/_/g, ' ') || 'Unknown action'}
                      </Text>
                      {entry.admin_username && <Text style={{ fontSize: 12, color: c.textMuted }}>By @{entry.admin_username}</Text>}
                      {entry.target_username && <Text style={{ fontSize: 12, color: c.textMuted }}>Target: @{entry.target_username}</Text>}
                      {entry.details && <Text style={{ fontSize: 12, color: c.textMd, marginTop: 3 }}>{entry.details}</Text>}
                    </View>
                    {entry.created_at && (
                      <Text style={{ fontSize: 11, color: c.textMuted, flexShrink: 0 }}>
                        {new Date(entry.created_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {auditPage > 0 && (
                  <TouchableOpacity onPress={() => setAuditPage(p => Math.max(0, p - 1))}
                    style={[s.actionBtn, { borderWidth: 1, borderColor: c.border, flex: 1 }]}>
                    <Text style={{ color: c.textMd, fontSize: 13 }}>← Previous</Text>
                  </TouchableOpacity>
                )}
                {auditHasMore && (
                  <TouchableOpacity onPress={() => setAuditPage(p => p + 1)}
                    style={[s.actionBtn, { borderWidth: 1, borderColor: c.border, flex: 1 }]}>
                    <Text style={{ color: c.textMd, fontSize: 13 }}>Next →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Storage/Media tab: orphaned media scan/cleanup */}
      {tab === 'media' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[s.actionSectionTitle, { color: c.textMuted, marginBottom: 6 }]}>Orphaned Media</Text>
            <Text style={{ color: c.textMd, fontSize: 12, marginBottom: 10 }}>
              Scan the uploads directory for files no longer referenced by any post, album, profile, or page.
            </Text>
            <TouchableOpacity
              disabled={orphanScanning}
              onPress={scanOrphans}
              style={[s.actionBtn, { borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }]}>
              <Text style={{ color: c.textMd, fontSize: 13, fontWeight: '600' }}>
                {orphanScanning ? 'Scanning…' : 'Scan for orphaned files'}
              </Text>
            </TouchableOpacity>

            {orphanScan && (
              <View style={{ marginTop: 14, gap: 10 }}>
                <Text style={{ color: c.text, fontSize: 13 }}>
                  Found <Text style={{ fontWeight: '700' }}>{orphanScan.count}</Text> orphaned file{orphanScan.count !== 1 ? 's' : ''}
                  {orphanScan.count > 0 && (
                    <Text style={{ color: c.textMuted }}> · {(orphanScan.total_bytes / 1024 / 1024).toFixed(1)} MB</Text>
                  )}
                </Text>

                {orphanScan.count > 0 && (
                  <TouchableOpacity
                    disabled={deleteOrphans.isPending}
                    onPress={() => Alert.alert(
                      'Delete orphaned files?',
                      `Permanently delete ${orphanScan.count} orphaned file(s)?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteOrphans.mutate() },
                      ]
                    )}
                    style={[s.actionBtn, { backgroundColor: '#ef4444' }]}>
                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                      {deleteOrphans.isPending ? 'Deleting…' : `Delete all ${orphanScan.count} file(s)`}
                    </Text>
                  </TouchableOpacity>
                )}

                {orphanScan.count === 0 && (
                  <Text style={{ color: c.textMuted, fontStyle: 'italic', fontSize: 13 }}>No orphaned files found.</Text>
                )}

                {orphanScan.orphans.length > 0 && (
                  <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, overflow: 'hidden' }}>
                    {orphanScan.orphans.map((f, i) => (
                      <View key={f.path} style={{
                        flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8,
                        borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border,
                      }}>
                        <Text style={{ fontSize: 11, color: c.textMuted, flex: 1 }} numberOfLines={1}>{f.path}</Text>
                        <Text style={{ fontSize: 11, color: c.textLight, flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Pages tab (AGORA-114): verify/feature moderation for pages */}
      {tab === 'pages' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          <Text style={{ color: c.textMd, fontSize: 12, marginBottom: 12 }}>
            Verify notable pages and feature them in the discovery section. Verified and featured status survive
            owner edits.
          </Text>
          {adminPagesLoading ? <Spinner /> : adminPages.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20 }}>No pages yet.</Text>
          ) : adminPages.map((p: any) => (
            <View key={p.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{p.display_name}</Text>
                    <Text style={{ fontSize: 12, color: c.textMuted }}>@{p.slug}</Text>
                    {p.is_verified && (
                      <View style={[s.violationBadge, { backgroundColor: '#dbeafe' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563eb' }}>✓ Verified</Text>
                      </View>
                    )}
                    {p.is_featured && (
                      <View style={[s.violationBadge, { backgroundColor: '#fef3c7' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400e' }}>★ Featured</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 3 }}>
                    {p.subscriber_count ?? 0} subscribers · {p.post_count ?? 0} posts
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  disabled={verifyPage.isPending}
                  onPress={() => verifyPage.mutate({ slug: p.slug, v: !p.is_verified })}
                  style={[s.smallBtn, { flex: 1, alignItems: 'center', borderColor: c.border, backgroundColor: p.is_verified ? '#dbeafe' : c.bg }]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: p.is_verified ? '#2563eb' : c.textMd }}>
                    {p.is_verified ? '✓ Verified' : 'Verify'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={featurePage.isPending}
                  onPress={() => featurePage.mutate({ slug: p.slug, v: !p.is_featured })}
                  style={[s.smallBtn, { flex: 1, alignItems: 'center', borderColor: c.border, backgroundColor: p.is_featured ? '#fef3c7' : c.bg }]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: p.is_featured ? '#92400e' : c.textMd }}>
                    {p.is_featured ? '★ Featured' : '☆ Feature'}
                  </Text>
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
  tabBar:           { borderBottomWidth: 1 },
  tabItem:          { paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
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
  statsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:         { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 14 },
  statValue:        { fontSize: 24, fontWeight: '700' },
  statLabel:        { fontSize: 13, marginTop: 4 },
})
