import { useEffect, useState } from 'react'
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { atprotoApi, federationApi, friendsApi, groupsApi, imgUrl, onboardingApi, searchApi } from '../../api'
import { useC } from '../../constants/ColorContext'
import { Avatar } from '../ui'
import type { StepProps } from './types'
import { Callout, ErrorText, SectionTitle, StepFooter, StepHeader, StepScroll, WizButton, p } from './parts'

// AMOBILE-205: the mobile counterpart of AGORA-391's Find people. Friends on
// this instance (whoever invited them first, then recent members, or a
// search), follows on Bluesky or the Fediverse by handle, and a few popular
// public groups. Everything here is optional.

interface Person {
  id: string
  username: string
  display_name: string
  avatar_url: string
  // '' | 'pending' (sent) | 'pending_incoming' | 'friends', or the search
  // endpoint's 'accepted' / 'self'.
  friend_status: string
  note: string
}

// A Fediverse actor federated through Bridgy Fed is a Bluesky account, as on
// Connections (AGORA-196).
const isBridgedBluesky = (instance?: string) => !!instance && /(^|\.)brid\.gy$/i.test(instance)

export default function FindPeopleStep({ instance, me, setNotes, next, back }: StepProps) {
  const c = useC()
  const qc = useQueryClient()
  const [status, setStatus] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')
  const [err, setErr] = useState('')

  // ── People on this instance ──────────────────────────────────────────────
  const { data: suggestions } = useQuery({
    queryKey: ['onboarding-suggestions'],
    queryFn: () => onboardingApi.suggestions().then(r => r.data),
  })
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])
  const { data: results, isFetching: searching } = useQuery({
    queryKey: ['onboarding-search', debounced],
    queryFn: () => searchApi.searchUsers(debounced).then(r => (r.data.users ?? []) as any[]),
    enabled: debounced.length >= 2,
  })

  const suggested: Person[] = [
    ...(suggestions?.inviter ? [{ ...suggestions.inviter, note: 'Invited you to Agora' }] : []),
    ...(suggestions?.people ?? []).map((u: any) => ({ ...u, note: 'Joined recently' })),
  ]
  const found: Person[] = (results ?? [])
    .filter(u => !u.is_remote && u.friendship_status !== 'self')
    .slice(0, 6)
    .map(u => ({ ...u, friend_status: u.friendship_status, note: '' }))
  const showingSearch = debounced.length >= 2
  const people = showingSearch ? found : suggested

  const befriend = async (person: Person) => {
    const current = status[person.id] ?? person.friend_status
    setBusyId(person.id); setErr('')
    try {
      if (current === 'pending_incoming') {
        await friendsApi.acceptRequest(person.id)
        setStatus(s => ({ ...s, [person.id]: 'friends' }))
      } else {
        await friendsApi.sendRequest(person.id)
        setStatus(s => ({ ...s, [person.id]: 'pending' }))
        setNotes(n => ({ requestsSent: n.requestsSent + 1 }))
      }
      qc.invalidateQueries({ queryKey: ['friends'] })
      qc.invalidateQueries({ queryKey: ['requests'] })
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Couldn\'t send that friend request.')
    } finally {
      setBusyId('')
    }
  }

  // ── Follow by handle ─────────────────────────────────────────────────────
  // Following on Bluesky comes from the account's own Bluesky identity, so it
  // needs AT Proto on for the account as well as the instance. Fediverse
  // follows only need the instance to speak ActivityPub.
  const canBluesky = !!instance.atproto_enabled && !!me.atproto_enabled
  const canFediverse = !!instance.activitypub_enabled
  const [handle, setHandle] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [looking, setLooking] = useState(false)
  const [following, setFollowing] = useState(false)
  const [followErr, setFollowErr] = useState('')

  const lookUp = async (raw = handle) => {
    const h = raw.trim().replace(/^@/, '')
    if (!h) return
    const fediverse = h.includes('@') || /^https?:\/\//i.test(h)
    setPreview(null); setFollowing(false); setFollowErr('')
    if (fediverse && !canFediverse) { setFollowErr('This instance doesn\'t connect to the Fediverse.'); return }
    if (!fediverse && !canBluesky) {
      setFollowErr(instance.atproto_enabled
        ? 'Bluesky is off for your account, so you can\'t follow Bluesky accounts. You can turn it back on in the Bluesky step.'
        : 'This instance doesn\'t connect to Bluesky.')
      return
    }
    setLooking(true)
    try {
      const { data } = fediverse
        ? await federationApi.resolveFediverseHandle(h)
        : await atprotoApi.resolveBlueskyHandle(h)
      setPreview({ ...data, network: fediverse ? 'fediverse' : 'bluesky' })
    } catch (e: any) {
      setFollowErr(e.response?.data?.error || 'Couldn\'t find that account. Check the handle and try again.')
    } finally {
      setLooking(false)
    }
  }
  const follow = async () => {
    if (!preview) return
    setLooking(true); setFollowErr('')
    try {
      if (preview.network === 'fediverse') {
        await federationApi.followFediverseAccount(preview.actor_url)
        qc.invalidateQueries({ queryKey: ['fediverse-following'] })
      } else {
        await atprotoApi.followBlueskyAccount(preview.did)
        qc.invalidateQueries({ queryKey: ['bluesky-following'] })
      }
      setFollowing(true)
      setNotes(n => ({ follows: n.follows + 1 }))
    } catch (e: any) {
      setFollowErr(e.response?.data?.error || 'Couldn\'t follow that account.')
    } finally {
      setLooking(false)
    }
  }
  const bridged = preview?.network === 'fediverse' && isBridgedBluesky(preview.instance)

  // ── Groups ───────────────────────────────────────────────────────────────
  const { data: groupsData } = useQuery({
    queryKey: ['onboarding-groups'],
    queryFn: () => groupsApi.list().then(r => r.data),
  })
  const groups: any[] = [...(groupsData?.friend_groups ?? []), ...(groupsData?.popular_groups ?? [])]
    .filter((g: any, i, all) => g.privacy === 'public' && !g.is_member && all.findIndex((o: any) => o.id === g.id) === i)
    .slice(0, 3)
  const [joined, setJoined] = useState<Record<string, boolean>>({})
  const join = async (slug: string) => {
    setBusyId(slug); setErr('')
    try {
      await groupsApi.join(slug)
      setJoined(j => ({ ...j, [slug]: true }))
      setNotes(n => ({ groupsJoined: n.groupsJoined + 1 }))
      qc.invalidateQueries({ queryKey: ['groups'] })
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Couldn\'t join that group.')
    } finally {
      setBusyId('')
    }
  }

  const where = instance.domain || instance.instance_name || 'Agora'

  return (
    <>
      <StepScroll>
        <StepHeader title="Find your people">
          Agora is better with friends. Add a few now, or skip this and do it later from Connections.
        </StepHeader>

        {err ? <ErrorText>{err}</ErrorText> : null}

        <View style={{ gap: 12 }}>
          <SectionTitle title={`People on ${where}`}>
            Friendships are mutual: once they accept, you'll each see the other's friends-only posts.
          </SectionTitle>
          <View style={[st.search, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="search-outline" size={18} color={c.textLight} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search by name or username" placeholderTextColor={c.textLight}
              autoCapitalize="none" autoCorrect={false} returnKeyType="search" accessibilityLabel={`Search people on ${where}`}
              style={[st.searchInput, { color: c.text }]} />
          </View>

          {people.length > 0 ? (
            <View style={[st.list, { backgroundColor: c.card, borderColor: c.border }]}>
              {people.map((person, i) => {
                const rel = status[person.id] ?? person.friend_status
                const isFriend = rel === 'friends' || rel === 'accepted'
                const name = person.display_name || person.username
                return (
                  <View key={person.id} style={[st.person, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
                    <Avatar url={person.avatar_url} name={name} size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[st.personName, { color: c.text }]}>{name}</Text>
                      <Text numberOfLines={1} style={[p.small, { color: c.textMuted }]}>
                        @{person.username}{person.note ? ` · ${person.note}` : ''}
                      </Text>
                    </View>
                    {isFriend ? (
                      <View style={st.state}><Ionicons name="checkmark" size={16} color={c.primary} /><Text style={[st.stateText, { color: c.primary }]}>Friends</Text></View>
                    ) : rel === 'pending' ? (
                      <View style={st.state}><Ionicons name="checkmark" size={16} color={c.textMuted} /><Text style={[st.stateText, { color: c.textMuted }]}>Sent</Text></View>
                    ) : (
                      <WizButton label={rel === 'pending_incoming' ? 'Accept' : 'Add'} icon="person-add-outline"
                        accessibilityLabel={`${rel === 'pending_incoming' ? 'Accept friend request from' : 'Add friend'} ${name}`}
                        onPress={() => befriend(person)} disabled={busyId === person.id} style={st.smallButton} />
                    )}
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={[p.small, { color: c.textMuted }]}>
              {showingSearch
                ? (searching ? 'Searching…' : `No one here matches "${debounced}".`)
                : 'No one else has joined yet. Invite someone, or come back later.'}
            </Text>
          )}

          {instance.user_invites_enabled === 'true' && (
            <WizButton variant="ghost" icon="mail-outline" label="Invite someone by email"
              onPress={() => router.push('/invite-friend')} style={{ alignSelf: 'flex-start' }} />
          )}
        </View>

        {(canBluesky || canFediverse) && (
          <View style={{ gap: 12 }}>
            <SectionTitle title={`Know people on ${canBluesky && canFediverse ? 'Bluesky or the Fediverse' : canBluesky ? 'Bluesky' : 'the Fediverse'}?`}>
              Follow anyone by their handle. A follow isn't a friendship: you'll see their public posts, and they won't see your friends-only ones.
            </SectionTitle>
            <TextInput value={handle} accessibilityLabel="Handle to follow"
              onChangeText={t => { setHandle(t); setPreview(null); setFollowErr('') }}
              onSubmitEditing={() => lookUp()} returnKeyType="search" autoCapitalize="none" autoCorrect={false}
              placeholder={canBluesky && canFediverse ? 'alex.bsky.social or alex@mastodon.social' : canBluesky ? 'alex.bsky.social' : 'alex@mastodon.social'}
              placeholderTextColor={c.textLight}
              style={[st.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            <WizButton variant="secondary" label={looking && !preview ? 'Looking…' : 'Look up'}
              onPress={() => lookUp()} disabled={looking || !handle.trim()} />

            {followErr ? <ErrorText>{followErr}</ErrorText> : null}

            {preview && bridged && canBluesky && (
              <Callout tone="info">
                @{preview.preferred_username} is a Bluesky account bridged into the Fediverse.{' '}
                <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }} accessibilityRole="link"
                  onPress={() => { setHandle(preview.preferred_username); lookUp(preview.preferred_username) }}>
                  Follow it on Bluesky instead
                </Text>
              </Callout>
            )}

            {preview && !(bridged && canBluesky) && (
              <View style={[st.person, st.previewCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Avatar
                  name={preview.network === 'bluesky' ? (preview.display_name || preview.handle || '') : (preview.name || preview.preferred_username || '')}
                  url={preview.network === 'bluesky' ? preview.avatar_url : preview.icon_url} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[st.personName, { color: c.text }]}>
                    {preview.network === 'bluesky' ? (preview.display_name || preview.handle) : (preview.name || preview.preferred_username)}
                  </Text>
                  <Text numberOfLines={1} style={[p.small, { color: c.textMuted }]}>
                    {preview.network === 'bluesky' ? `@${preview.handle} · Bluesky` : `@${preview.preferred_username}@${preview.instance} · Fediverse`}
                  </Text>
                </View>
                {following
                  ? <View style={st.state}><Ionicons name="checkmark" size={16} color={c.primary} /><Text style={[st.stateText, { color: c.primary }]}>Following</Text></View>
                  : looking
                    ? <ActivityIndicator color={c.primary} />
                    : <WizButton label="Follow" onPress={follow} style={st.smallButton} />}
              </View>
            )}

            <Text style={[p.small, { color: c.textMuted }]}>
              Their posts won't crowd your main feed unless you choose to add them. You can also build a feed just for them in My Feeds.
            </Text>
          </View>
        )}

        {groups.length > 0 && (
          <View style={{ gap: 12 }}>
            <SectionTitle title="Join a group">
              Groups are communities around a shared interest. Here are a few popular ones here.
            </SectionTitle>
            {groups.map((g: any) => {
              const icon = imgUrl(g.avatar_url)
              return (
                <View key={g.id} style={[st.person, st.previewCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={[st.groupIcon, { backgroundColor: c.primaryBg }]}>
                    {icon ? <Image source={{ uri: icon }} style={st.groupImage} /> : <Ionicons name="people-outline" size={20} color={c.primary} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[st.personName, { color: c.text }]}>{g.name}</Text>
                    <Text style={[p.small, { color: c.textMuted }]}>
                      Public · {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                  {joined[g.slug]
                    ? <View style={st.state}><Ionicons name="checkmark" size={16} color={c.primary} /><Text style={[st.stateText, { color: c.primary }]}>Joined</Text></View>
                    : <WizButton variant="secondary" label="Join" accessibilityLabel={`Join ${g.name}`}
                        onPress={() => join(g.slug)} disabled={busyId === g.slug} style={st.smallButton} />}
                </View>
              )
            })}
          </View>
        )}
      </StepScroll>
      <StepFooter onBack={back} onSkip={next} onContinue={next} />
    </>
  )
}

const st = StyleSheet.create({
  search:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 17, paddingVertical: 10 },
  input:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, minHeight: 48 },
  list:        { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  person:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  previewCard: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  personName:  { fontSize: 16, fontWeight: '700' },
  state:       { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 4 },
  stateText:   { fontSize: 15, fontWeight: '700' },
  smallButton: { minHeight: 44, paddingHorizontal: 14 },
  groupIcon:   { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  groupImage:  { width: 44, height: 44 },
})
