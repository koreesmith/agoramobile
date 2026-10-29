import { useState, type ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useC } from '../../constants/ColorContext'
import type { StepProps } from './types'
import { instanceNetworks } from './networks'
import { meQueryKey } from './useMe'
import { Callout, ErrorText, SectionTitle, Segmented, SettingRow, StepFooter, StepHeader, StepScroll, Toggle, p } from './parts'

// AMOBILE-203: how post audiences work, then the profile-wide privacy
// settings. Each setting saves as soon as it changes, like Settings. These
// are the server's own field names (dm_privacy, wall_approval_required).

type DmPrivacy = 'everyone' | 'friends' | 'nobody'

const DM_OPTIONS: { value: DmPrivacy; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends',  label: 'Friends only' },
  { value: 'nobody',   label: 'Nobody' },
]

function Audience({ icon, title, children, last }: { icon: string; title: string; children: ReactNode; last?: boolean }) {
  const c = useC()
  return (
    <View style={[st.audience, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <Ionicons name={icon as any} size={22} color={c.primary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[st.audienceTitle, { color: c.text }]}>{title}</Text>
        <Text style={[p.small, { color: c.textMuted }]}>{children}</Text>
      </View>
    </View>
  )
}

export default function PrivacyStep({ instance, me, next, back }: StepProps) {
  const c = useC()
  const qc = useQueryClient()
  const { updateUser, activeAccountId } = useAuthStore()
  const [priv, setPriv] = useState<boolean>(!!me.profile_private)
  const [wall, setWall] = useState<boolean>(!!me.wall_approval_required)
  const [dm, setDm] = useState<DmPrivacy>(me.dm_privacy || 'everyone')
  const [err, setErr] = useState('')
  const networks = instanceNetworks(instance)

  // Optimistic: flip the control now, put it back if the save fails.
  const save = async (patch: Record<string, unknown>, undo: () => void) => {
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

  return (
    <>
      <StepScroll>
        <StepHeader title="Decide who sees what">
          You're in control at two levels: each post you write, and your profile as a whole.
        </StepHeader>

        <View style={{ gap: 12 }}>
          <SectionTitle title="Every post picks its own audience">
            You choose one each time you post, right in the composer.
          </SectionTitle>
          <View style={[st.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Audience icon="globe-outline" title="Public">
              Anyone{networks.length > 0 ? `, including ${networks.join(' and ')} if you're on them` : ' who visits'}.
            </Audience>
            <Audience icon="people-outline" title="Friends">
              Only people you're friends with.{networks.length > 0 ? ' Never leaves Agora.' : ''}
            </Audience>
            <Audience icon="list-outline" title="A friend list">
              Just one list you've made, like Family or Book club.
            </Audience>
            <Audience icon="lock-closed-outline" title="Only me" last>
              Nobody else. Handy for notes to yourself.
            </Audience>
          </View>
        </View>

        <View>
          <SectionTitle title="Your profile" />
          {err ? <View style={{ marginTop: 8 }}><ErrorText>{err}</ErrorText></View> : null}

          <SettingRow title="Private profile" description="Only friends can see your profile page and timeline."
            control={<Toggle label="Private profile" value={priv}
              onValueChange={v => { setPriv(v); save({ profile_private: v }, () => setPriv(!v)) }} />}>
            {priv && networks.length > 0 && (
              <Callout tone="warning">
                <Text style={{ fontWeight: '700' }}>This also hides you from {networks.join(' and ')}.</Text>{' '}
                People there won't be able to find or follow you, even if you turn {networks.length > 1 ? 'them' : 'it'} on
                in the next {networks.length > 1 ? 'two steps' : 'step'}.
              </Callout>
            )}
          </SettingRow>

          <View style={[st.dmRow, { borderBottomColor: c.border }]}>
            <View style={{ gap: 2 }}>
              <Text style={[st.rowTitle, { color: c.text }]}>Who can message you</Text>
              <Text style={[p.small, { color: c.textMuted }]}>Direct messages are always private between the people in them.</Text>
            </View>
            <Segmented label="Who can message you" options={DM_OPTIONS} value={dm}
              onChange={v => {
                if (v === dm) return
                const prev = dm
                setDm(v)
                save({ dm_privacy: v }, () => setDm(prev))
              }} />
          </View>

          <SettingRow title="Approve wall posts" last description="Review what friends post on your wall before it appears."
            control={<Toggle label="Approve wall posts" value={wall}
              onValueChange={v => { setWall(v); save({ wall_approval_required: v }, () => setWall(!v)) }} />} />

          <Text style={[p.small, { color: c.textMuted, marginTop: 4 }]}>
            More options, like hiding your timeline or blocking people, are in{' '}
            <Text style={{ fontWeight: '700', color: c.primary }} accessibilityRole="link"
              onPress={() => router.push('/settings')}>Settings</Text>.
          </Text>
        </View>
      </StepScroll>
      <StepFooter onBack={back} onContinue={next} />
    </>
  )
}

const st = StyleSheet.create({
  card:          { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  audience:      { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  audienceTitle: { fontSize: 16, fontWeight: '700' },
  dmRow:         { paddingVertical: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTitle:      { fontSize: 17, fontWeight: '600' },
})
