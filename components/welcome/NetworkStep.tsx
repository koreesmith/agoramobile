import { useState } from 'react'
import { View, Text, TouchableOpacity, Share, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { customDomainApi, usersApi } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useC } from '../../constants/ColorContext'
import type { StepProps } from './types'
import { meQueryKey } from './useMe'
import { Callout, ErrorText, SectionTitle, SettingRow, StepFooter, StepHeader, StepScroll, Toggle, WizButton, p, useIsDark } from './parts'

// AMOBILE-204: the Bluesky and Fediverse steps, the mobile counterpart of
// AGORA-390. Same shape for both: the account's handle there, an on/off
// choice, what crosses over and what never does, and the per-network
// notification switch. Every change saves at once, the same as Settings.

type Network = 'bluesky' | 'fediverse'

interface NetworkCopy {
  name: string
  icon: string
  enabledKey: 'atproto_enabled' | 'activitypub_enabled'
  notifyKey: 'atproto_notifications_enabled' | 'fediverse_notifications_enabled'
  title: string
  lead: string
  handleNote: string
  yes: string
  yesDesc: string
  no: string
  goes: string[]
  goodToKnow: string
  notifyTitle: string
  notifyDesc: string
  off: string
}

const COPY: Record<Network, NetworkCopy> = {
  bluesky: {
    name: 'Bluesky',
    icon: 'cloud-outline',
    enabledKey: 'atproto_enabled',
    notifyKey: 'atproto_notifications_enabled',
    title: 'You already have a Bluesky account',
    lead: 'Every Agora account is also a real Bluesky account, with no bridge and no second sign-up. Agora runs the same open technology Bluesky does (the AT Protocol), so your public posts can show up there directly.',
    handleNote: 'People on Bluesky can find you by searching for this.',
    yes: 'Yes, put me on Bluesky',
    yesDesc: 'People on Bluesky can follow you, see your public posts, and reply, like, and repost.',
    no: 'No, keep me off Bluesky',
    goes: ['Your public posts', 'Your replies, likes, reposts, and quotes of Bluesky posts', 'Your name, photo, and bio'],
    goodToKnow: 'Bluesky has a shorter length limit, so very long posts are trimmed there with a link back to the full post. Content warnings show up as a general warning label, without your wording.',
    notifyTitle: 'Bluesky post notifications',
    notifyDesc: "Lets you get notified when Bluesky accounts you follow post. You'll pick which accounts with the bell next to each one.",
    // AGORA-386: following a Bluesky account is a record in the account's
    // own repo, so it needs AT Proto on (following 404s otherwise).
    off: "Your posts stay on Agora, and you won't be able to follow Bluesky accounts while it's off. Turn it on anytime in Settings, under Bluesky.",
  },
  fediverse: {
    name: 'Fediverse',
    icon: 'at-outline',
    enabledKey: 'activitypub_enabled',
    notifyKey: 'fediverse_notifications_enabled',
    title: "You're on the Fediverse, too",
    lead: 'Agora speaks ActivityPub, the open protocol behind Mastodon, Pixelfed, and many other apps. That makes your Agora account a Fediverse account as well, so people there can follow you without leaving their app.',
    handleNote: 'Anyone on Mastodon or another Fediverse app can follow you with this.',
    yes: 'Yes, put me on the Fediverse',
    yesDesc: 'People on Mastodon and similar apps can follow you, see your public posts, and reply, boost, and quote.',
    no: 'No, keep me off the Fediverse',
    goes: ['Your public posts, including later edits and deletes', 'Your replies and quotes of Fediverse posts', 'Your name, photo, and bio'],
    goodToKnow: "Content warnings carry over with your own wording. You can also mention Fediverse people in a post, like @someone@mastodon.social, and they'll be notified on their own server.",
    notifyTitle: 'Fediverse post notifications',
    notifyDesc: "Lets you get notified when Fediverse accounts you follow post. You'll pick which accounts with the bell next to each one.",
    off: "Your posts stay on Agora, and people on Mastodon and similar apps won't see you. Turn it on anytime in Settings, under Fediverse.",
  },
}

const STAYS = ['Friends-only, friend list, and only-me posts', 'Your friendships and friend lists', 'Your direct messages']

// Each network's own color, kept readable on both themes.
function useAccent(network: Network) {
  const isDark = useIsDark()
  return network === 'bluesky'
    ? { text: isDark ? '#93c5fd' : '#1d4ed8', bg: isDark ? 'rgba(59,130,246,0.16)' : '#eff6ff' }
    : { text: isDark ? '#c4b5fd' : '#6d28d9', bg: isDark ? 'rgba(139,92,246,0.18)' : '#f5f3ff' }
}

function NetworkStep({ network, steps, instance, me, notes, setNotes, next, back, goTo }: StepProps & { network: Network }) {
  const copy = COPY[network]
  const c = useC()
  const accent = useAccent(network)
  const qc = useQueryClient()
  const { updateUser, activeAccountId } = useAuthStore()
  const [on, setOn] = useState<boolean>(!!me[copy.enabledKey])
  const [notify, setNotify] = useState<boolean>(!!me[copy.notifyKey])
  const [err, setErr] = useState('')

  // A live custom domain replaces the instance handle on Bluesky (AGORA-278).
  const { data: domainData } = useQuery({
    queryKey: ['custom-domain'],
    queryFn: () => customDomainApi.get().then(r => r.data),
    enabled: network === 'bluesky',
  })
  const handle = network === 'bluesky'
    ? `@${domainData?.current_handle || `${me.username}.${instance.domain}`}`
    : `@${me.username}@${instance.domain}`
  const hasCustomDomain = !!domainData && domainData.current_handle !== domainData.fallback_handle
  const fediverseNext = network === 'bluesky' && steps.some(s => s.id === 'fediverse')
  const where = network === 'bluesky' ? 'Bluesky' : 'the Fediverse'

  const save = async (patch: Record<string, boolean>, undo: () => void) => {
    setErr('')
    try {
      await usersApi.updateProfile(patch)
      updateUser(patch as any)
      qc.invalidateQueries({ queryKey: meQueryKey(activeAccountId) })
    } catch (e: any) {
      undo()
      setErr(e.response?.data?.error || 'Couldn\'t save that change. Try again.')
    }
  }
  const choose = (v: boolean) => {
    if (v === on) return
    setOn(v)
    save({ [copy.enabledKey]: v }, () => setOn(!v))
  }

  // A plain render function rather than a component: one defined in here
  // would be a new type every render, remounting both choices each time.
  const choice = (value: boolean, title: string, desc: string, isDefault?: boolean) => {
    const selected = on === value
    return (
      <TouchableOpacity onPress={() => choose(value)} accessibilityRole="radio" accessibilityState={{ selected }}
        style={[st.choice, { backgroundColor: selected ? c.primaryBg : c.card, borderColor: selected ? c.primary : c.border }]}>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? c.primary : c.textLight} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={st.choiceTitleRow}>
            <Text style={[st.choiceTitle, { color: c.text }]}>{title}</Text>
            {isDefault && <Text style={[st.defaultBadge, { backgroundColor: c.border, color: c.textMd }]}>Default</Text>}
          </View>
          <Text style={[p.small, { color: c.textMuted }]}>{desc}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <>
      <StepScroll>
        <StepHeader title={copy.title} eyebrow={
          <View style={st.eyebrow}>
            <View style={[st.badge, { backgroundColor: accent.bg }]}>
              <Ionicons name={copy.icon as any} size={22} color={accent.text} />
            </View>
            <Text style={[st.eyebrowText, { color: accent.text }]}>{copy.name}</Text>
          </View>
        }>
          {copy.lead}{fediverseNext ? ' The Fediverse is a separate network; that\'s the next step.' : ''}
        </StepHeader>

        {me.profile_private && (
          <Callout tone="warning">
            <Text style={{ fontWeight: '700' }}>Your profile is private, so {where} can't see you right now.</Text>{' '}
            Even with this on, nobody there can find or follow you until your profile is public.{' '}
            <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }} accessibilityRole="link"
              onPress={() => goTo('privacy')}>Change it in Privacy</Text>
          </Callout>
        )}

        {err ? <ErrorText>{err}</ErrorText> : null}

        <View style={[st.handleBox, { backgroundColor: on ? accent.bg : c.card, borderColor: c.border }]}>
          <Text style={[st.handleLabel, { color: c.textMuted }]}>Your {copy.name} handle</Text>
          <Text selectable style={[st.handle, { color: on ? c.text : c.textLight }]}>{handle}</Text>
          <Text style={[p.small, { color: c.textMuted }]}>{on ? copy.handleNote : `Not in use while ${where} is off.`}</Text>
          <WizButton variant="secondary" icon="share-outline" label="Share" accessibilityLabel={`Share your ${copy.name} handle`}
            onPress={() => { Share.share({ message: handle }).catch(() => {}) }} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
        </View>

        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          <SectionTitle title={`Do you want your public posts on ${where}?`} />
          {choice(true, copy.yes, copy.yesDesc, true)}
          {choice(false, copy.no, `Nothing you post reaches ${where}. You can change your mind anytime in Settings.`)}
        </View>

        {on ? (
          <>
            <View style={[st.list, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[st.listTitle, { color: c.text }]}>Goes to {where}</Text>
              {copy.goes.map(g => (
                <View key={g} style={st.listItem}>
                  <Ionicons name="checkmark" size={18} color={accent.text} style={{ marginTop: 2 }} />
                  <Text style={[p.small, { flex: 1, color: c.textMd }]}>{g}</Text>
                </View>
              ))}
            </View>
            <View style={[st.list, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[st.listTitle, { color: c.text }]}>Always stays on Agora</Text>
              {STAYS.map(s => (
                <View key={s} style={st.listItem}>
                  <Ionicons name="lock-closed-outline" size={17} color={c.textMuted} style={{ marginTop: 2 }} />
                  <Text style={[p.small, { flex: 1, color: c.textMd }]}>{s}</Text>
                </View>
              ))}
            </View>

            <Callout tone="info">
              <Text style={{ fontWeight: '700' }}>Good to know:</Text> {copy.goodToKnow}
            </Callout>

            <View>
              <SectionTitle title="Optional extras" />
              <SettingRow title={copy.notifyTitle} description={copy.notifyDesc}
                last={network !== 'bluesky' || hasCustomDomain}
                control={<Toggle label={copy.notifyTitle} value={notify}
                  onValueChange={v => { setNotify(v); save({ [copy.notifyKey]: v }, () => setNotify(!v)) }} />} />
              {network === 'bluesky' && !hasCustomDomain && (
                <SettingRow title="Use your own domain as your handle" last
                  description={`Be @${me.username}.example.com, or any domain you own, instead. You'll need to add one DNS record, so it's easiest to do later.`}
                  control={null}>
                  {notes.domainReminder
                    ? <View style={st.saved}><Ionicons name="checkmark" size={18} color={c.primary} /><Text style={[st.savedText, { color: c.primary }]}>Reminder saved</Text></View>
                    : <WizButton variant="secondary" label="Remind me on the last step" onPress={() => setNotes({ domainReminder: true })}
                        style={{ alignSelf: 'flex-start' }} />}
                </SettingRow>
              )}
            </View>
          </>
        ) : (
          <Callout tone="info">
            <Text style={{ fontWeight: '700' }}>{network === 'bluesky' ? 'Bluesky is off.' : 'The Fediverse is off.'}</Text> {copy.off}
          </Callout>
        )}
      </StepScroll>
      <StepFooter onBack={back} onContinue={next} />
    </>
  )
}

export function BlueskyStep(props: StepProps) {
  return <NetworkStep {...props} network="bluesky" />
}

export function FediverseStep(props: StepProps) {
  return <NetworkStep {...props} network="fediverse" />
}

const st = StyleSheet.create({
  eyebrow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge:          { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrowText:    { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  handleBox:      { borderWidth: 1, borderRadius: 14, padding: 16, gap: 4 },
  handleLabel:    { fontSize: 13, fontWeight: '700' },
  handle:         { fontSize: 20, fontWeight: '700' },
  choice:         { flexDirection: 'row', gap: 12, borderWidth: 2, borderRadius: 14, padding: 14 },
  choiceTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  choiceTitle:    { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  defaultBadge:   { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  list:           { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  listTitle:      { fontSize: 16, fontWeight: '700' },
  listItem:       { flexDirection: 'row', gap: 10 },
  saved:          { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  savedText:      { fontSize: 16, fontWeight: '700' },
})
