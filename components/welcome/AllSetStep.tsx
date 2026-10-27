import { useState, type ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { customDomainApi, notificationsApi } from '../../api'
import { useThemeStore, type ThemePreference } from '../../store/theme'
import { useC } from '../../constants/ColorContext'
import type { StepId, StepProps } from './types'
import { ErrorText, SectionTitle, Segmented, SettingRow, StepHeader, StepScroll, Toggle, WizButton, p, useIsDark } from './parts'

// AMOBILE-205: the last step, the mobile counterpart of AGORA-391's All set.
// A recap of what the account has now (read back from /auth/me, not from what
// was tapped), where things live in the app, and two last preferences. Every
// way out completes onboarding.

const DM_LABELS: Record<string, string> = {
  everyone: 'Anyone can message you',
  friends:  'Only friends can message you',
  nobody:   'Nobody can message you',
}

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light',  label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark',   label: 'Dark' },
]

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function Place({ icon, name, children, last }: { icon: string; name: string; children: ReactNode; last?: boolean }) {
  const c = useC()
  return (
    <View style={[st.place, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <View style={[st.placeIcon, { backgroundColor: c.primaryBg }]}>
        <Ionicons name={icon as any} size={18} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[st.placeName, { color: c.text }]}>{name}</Text>
        <Text style={[p.small, { color: c.textMuted }]}>{children}</Text>
      </View>
    </View>
  )
}

export default function AllSetStep({ steps, instance, me, notes, goTo, back, finish, finishing }: StepProps) {
  const c = useC()
  const isDark = useIsDark()
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const has = (id: StepId) => steps.some(s => s.id === id)
  const firstName = (me.display_name || '').trim().split(/\s+/)[0] || me.username
  const returning = !!me.onboarding_returning

  const { data: domainData } = useQuery({
    queryKey: ['custom-domain'],
    queryFn: () => customDomainApi.get().then(r => r.data),
    enabled: has('bluesky'),
  })
  const blueskyHandle = `@${domainData?.current_handle || `${me.username}.${instance.domain}`}`

  const profileParts = [me.avatar_url && 'photo', me.display_name && 'name', me.bio && 'bio'].filter(Boolean) as string[]
  const profileSummary = profileParts.length
    ? `${profileParts.join(', ').replace(/, ([^,]*)$/, ' and $1').replace(/^./, ch => ch.toUpperCase())} added`
    : 'Nothing added yet'
  const peopleParts = [
    notes.requestsSent > 0 && count(notes.requestsSent, 'friend request sent', 'friend requests sent'),
    notes.follows > 0 && count(notes.follows, 'account followed', 'accounts followed'),
    notes.groupsJoined > 0 && count(notes.groupsJoined, 'group joined', 'groups joined'),
  ].filter(Boolean) as string[]

  const rows: { id: StepId; label: string; value: string }[] = [
    { id: 'profile', label: 'Profile', value: profileSummary },
    { id: 'privacy', label: 'Privacy', value: `${me.profile_private ? 'Private' : 'Public'} profile · ${DM_LABELS[me.dm_privacy] || DM_LABELS.everyone}` },
    ...(has('bluesky') ? [{ id: 'bluesky' as StepId, label: 'Bluesky', value: me.atproto_enabled ? `On, as ${blueskyHandle}` : 'Off' }] : []),
    ...(has('fediverse') ? [{ id: 'fediverse' as StepId, label: 'Fediverse', value: me.activitypub_enabled ? `On, as @${me.username}@${instance.domain}` : 'Off' }] : []),
    { id: 'people', label: 'People', value: peopleParts.join(' · ') || 'No one added yet' },
  ]

  // ── Preferences ──────────────────────────────────────────────────────────
  const { data: emailPrefs } = useQuery({
    queryKey: ['email-prefs'],
    queryFn: () => notificationsApi.getEmailPrefs().then(r => r.data),
  })
  const [emailOverride, setEmailOverride] = useState<boolean | null>(null)
  const emailOn = emailOverride ?? emailPrefs?.email_notifications_enabled ?? true
  const { preference, setPreference } = useThemeStore()
  const [err, setErr] = useState('')

  const setEmail = async (v: boolean) => {
    setEmailOverride(v); setErr('')
    try {
      await notificationsApi.updateEmailPrefs(v)
      qc.setQueryData(['email-prefs'], { email_notifications_enabled: v })
    } catch (e: any) {
      setEmailOverride(!v)
      setErr(e.response?.data?.error || 'Couldn\'t save that change. Try again.')
    }
  }

  return (
    <StepScroll>
      <View style={{ gap: 12 }}>
        <View style={[st.check, { backgroundColor: c.primary }]}>
          <Ionicons name="checkmark" size={28} color={isDark ? c.bg : c.white} />
        </View>
        <StepHeader title={`You're all set, ${firstName}`}>
          Here's a quick recap. Anything here can be changed later in Settings.
        </StepHeader>
      </View>

      <View style={{ gap: 12 }}>
        <View style={[st.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {rows.map((r, i) => (
            <View key={r.id} style={[st.recapRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[st.recapLabel, { color: c.textMuted }]}>{r.label}</Text>
                <Text style={[p.small, { color: c.text }]}>{r.value}</Text>
              </View>
              <TouchableOpacity onPress={() => goTo(r.id)} accessibilityRole="button" accessibilityLabel={`Change ${r.label}`}
                style={st.change}>
                <Text style={[st.changeText, { color: c.primary }]}>Change</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        {notes.domainReminder && me.atproto_enabled && has('bluesky') && (
          <View style={[st.reminder, { backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : '#eff6ff' }]}>
            <Text style={[p.small, { color: c.text }]}>
              <Text style={{ fontWeight: '700' }}>Saved for later:</Text> use your own domain as your Bluesky handle.
            </Text>
            <WizButton variant="ghost" label="Set it up now" onPress={() => finish('custom-domain')} disabled={finishing}
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          </View>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <SectionTitle title="Where things live" />
        <View style={[st.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Place icon="home-outline" name="Feed">Posts from your friends, groups, and pages.</Place>
          <Place icon="notifications-outline" name="Alerts">Likes, comments, friend requests, and mentions.</Place>
          <Place icon="people-outline" name="Groups">Communities around shared interests, public or private.</Place>
          <Place icon="person-add-outline" name="Connections">
            Friends, requests{has('bluesky') || has('fediverse') ? ', and your Bluesky and Fediverse follows' : ', and friend lists'}.
          </Place>
          <Place icon="chatbubble-outline" name="Messages">Private, real-time conversations.</Place>
          <Place icon="person-outline" name="Profile" last>Your profile, Settings, and other accounts.</Place>
        </View>
      </View>

      <View>
        <SectionTitle title="Two last preferences" />
        {err ? <View style={{ marginTop: 8 }}><ErrorText>{err}</ErrorText></View> : null}
        <SettingRow title="Email notifications" description="Likes, comments, and friend requests."
          control={<Toggle label="Email notifications" value={emailOn} onValueChange={setEmail} />} />
        <SettingRow title="Theme" last description="Also in Settings, under Appearance." control={null}>
          <Segmented label="Theme" options={THEMES} value={preference} onChange={setPreference} />
        </SettingRow>
      </View>

      <View style={{ gap: 8, paddingBottom: insets.bottom }}>
        <WizButton label={returning ? 'Write a post' : 'Write your first post'} icon="create-outline"
          onPress={() => finish('compose')} disabled={finishing} />
        <WizButton variant="secondary" label="Go to my feed" onPress={() => finish('feed')} disabled={finishing} />
        <View style={st.endRow}>
          <WizButton variant="ghost" icon="chevron-back" label="Back" onPress={back} />
        </View>
        <Text style={[p.small, { color: c.textMuted }]}>
          Want a refresher later? Replay this tour from Settings, under Help.
        </Text>
      </View>
    </StepScroll>
  )
}

const st = StyleSheet.create({
  check:      { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  card:       { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  recapRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  recapLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  change:     { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  changeText: { fontSize: 16, fontWeight: '700' },
  reminder:   { borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, gap: 2 },
  place:      { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  placeIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  placeName:  { fontSize: 16, fontWeight: '700' },
  endRow:     { flexDirection: 'row' },
})
