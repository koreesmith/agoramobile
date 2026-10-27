import type { ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useC } from '../../constants/ColorContext'
import type { StepProps } from './types'
import { instanceNetworks } from './networks'
import { StepScroll, WizButton, p } from './parts'

// AMOBILE-203: the first step, with no footer: what Agora is, and what the
// rest of the wizard covers. An account that predates the wizard (AGORA-393)
// gets it once as a re-introduction, so it's greeted as a returning member
// and told nothing changes unless it changes it.

function Pillar({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  const c = useC()
  return (
    <View style={[p.card, { backgroundColor: c.card, borderColor: c.border, gap: 8 }]}>
      <View style={[st.pillarIcon, { backgroundColor: c.primaryBg }]}>
        <Ionicons name={icon as any} size={22} color={c.primary} />
      </View>
      <Text style={[st.pillarTitle, { color: c.text }]}>{title}</Text>
      <Text style={[p.small, { color: c.textMuted }]}>{children}</Text>
    </View>
  )
}

export default function WelcomeStep({ instance, me, steps, next, finish, finishing }: StepProps) {
  const c = useC()
  const insets = useSafeAreaInsets()
  const instanceName = instance.instance_name || 'Agora'
  const firstName = (me.display_name || '').trim().split(/\s+/)[0] || me.username
  const ahead = steps.filter(s => s.id !== 'welcome' && s.id !== 'done')
  const networks = instanceNetworks(instance)
  const accountKinds = networks.map(n => n === 'Bluesky' ? 'a Bluesky account' : 'a Fediverse account').join(' and ')
  const reach = networks.map(n => n === 'Bluesky' ? 'Bluesky' : 'Mastodon').join(' and ')
  const returning = !!me.onboarding_returning

  return (
    <StepScroll>
      <View style={{ gap: 12 }}>
        {(returning || !!instance.domain) && (
          <Text style={[st.eyebrow, { color: c.textMuted }]}>
            {returning ? 'A quick re-introduction' : `Welcome to ${instance.domain}`}
          </Text>
        )}
        <Text accessibilityRole="header" style={[st.hero, { color: c.text }]}>
          Hi {firstName}, welcome {returning ? 'back ' : ''}to {instanceName}
        </Text>
        <Text style={[p.lead, { color: c.textMd }]}>
          {instanceName} is a social network for the people you actually know.{' '}
          {instanceName === 'Agora'
            ? "It's open source and privacy-first"
            : 'It runs on Agora, which is open source and privacy-first'}
          {instance.domain ? `, and it's run by the people behind ${instance.domain} rather than a big company` : ''}.
          {' '}{returning ? "Here's a refresher on what makes it different." : "Here's what makes it different."}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Pillar icon="people-outline" title="Friends, not followers">
          Friendships here are mutual. You both say yes before either of you sees the other's friends-only posts.
        </Pillar>
        <Pillar icon="eye-outline" title="You pick who sees each post">
          Any post can be public, friends-only, for one of your friend lists, or just for you.
          {networks.length > 0 ? ' Only public posts ever leave Agora.' : ''}
        </Pillar>
        {networks.length > 0 ? (
          <Pillar icon="globe-outline" title={networks.length === 2 ? 'One account, three networks' : 'One account, two networks'}>
            Your account is also {accountKinds}, so your public posts can reach people on {reach} too.
            Whether they do is up to you.
          </Pillar>
        ) : (
          <Pillar icon="people-circle-outline" title="Groups and Pages">
            Join communities around what you care about, and follow pages for local spots, creators, and projects.
          </Pillar>
        )}
      </View>

      <View style={[p.card, { backgroundColor: c.card, borderColor: c.border, gap: 12 }]}>
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={[p.sectionTitle, { color: c.text }]}>
            {returning ? "Here's what we'll go over" : "Here's what we'll set up"}
          </Text>
          <Text style={[p.small, { color: c.textMuted }]}>
            {returning
              ? 'About 3 minutes. Each step starts from your current settings, and nothing changes unless you change it.'
              : 'About 3 minutes. Everything can be changed later in Settings.'}
          </Text>
        </View>
        <View style={st.chips}>
          {ahead.map((s, i) => (
            <View key={s.id} style={[st.chip, { backgroundColor: c.bg, borderColor: c.border }]}>
              <View style={[st.chipNumber, { backgroundColor: c.card, borderColor: c.borderMd }]}>
                <Text style={[st.chipNumberText, { color: c.textMd }]}>{i + 1}</Text>
              </View>
              <Text style={[st.chipText, { color: c.textMd }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 4, paddingBottom: insets.bottom }}>
        <WizButton label="Let's get started" iconRight="arrow-forward" onPress={next} />
        <WizButton variant="ghost" label="Skip for now and go to my feed" onPress={() => finish('feed')} disabled={finishing} />
      </View>
    </StepScroll>
  )
}

const st = StyleSheet.create({
  eyebrow:        { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  hero:           { fontSize: 30, fontWeight: '800', lineHeight: 36 },
  pillarIcon:     { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pillarTitle:    { fontSize: 17, fontWeight: '700' },
  chips:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 12 },
  chipNumber:     { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chipNumberText: { fontSize: 12, fontWeight: '700' },
  chipText:       { fontSize: 15, fontWeight: '600' },
})
