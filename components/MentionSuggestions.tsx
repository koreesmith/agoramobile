import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from './ui'
import { usersApi, atprotoApi, federationApi } from '../api'
import { useC } from '../constants/ColorContext'

// AGORA-418: @mention suggestions for any text box that takes a post or a
// comment.
//
// These used to live in the feed's new-post composer alone, so the Repost,
// edit and comment boxes offered nothing and an @name typed there stayed plain
// text. Same three sources the new-post composer always had (AMOBILE-153):
//   @name           local accounts (usersApi.mentionSearch) and Bluesky's
//                   live actor search, since a handle in progress can be either
//   @user@instance  fediverse accounts already followed, the fediverse having
//                   no directory to search
//
// Driven by the text itself: whatever @fragment ends it is the query, and
// picking a suggestion replaces that fragment and adds a space, which ends the
// match, so the list closes on its own.

// The @ has to start the text or follow whitespace or an opening bracket, so
// an email address being typed doesn't open the list.
const FEDI_FRAGMENT = /(^|[\s(])@([\w.-]*@[\w.-]*)$/
const PLAIN_FRAGMENT = /(^|[\s(])@([\w.-]*)$/

export default function MentionSuggestions({ text, onChangeText, max = 5, style }: {
  text: string
  onChangeText: (text: string) => void
  max?: number
  style?: object
}) {
  const c = useC()
  const fediMatch = text.match(FEDI_FRAGMENT)
  const plainMatch = fediMatch ? null : text.match(PLAIN_FRAGMENT)
  const fediverseQuery = fediMatch ? fediMatch[2] : null
  const query = plainMatch ? plainMatch[2] : null

  // Bluesky's search is a network call, so it waits for a pause in typing.
  const [bskyQuery, setBskyQuery] = useState<string | null>(null)
  useEffect(() => {
    if (query === null) { setBskyQuery(null); return }
    const t = setTimeout(() => setBskyQuery(query), 200)
    return () => clearTimeout(t)
  }, [query])

  const { data: localData } = useQuery({
    queryKey: ['mention-search', query],
    queryFn: () => usersApi.mentionSearch(query!).then(r => r.data),
    // Local usernames never contain dots, so a query with one can only ever
    // match Bluesky/fediverse handles.
    enabled: query !== null && query.length >= 1 && !query.includes('.'),
  })
  const { data: bskyData } = useQuery({
    queryKey: ['mention-search-bsky', bskyQuery],
    queryFn: () => atprotoApi.searchBlueskyActors(bskyQuery!).then(r => r.data),
    enabled: bskyQuery !== null && bskyQuery.length >= 2,
  })
  const { data: fediData } = useQuery({
    queryKey: ['fediverse-following'],
    queryFn: () => federationApi.listFollowing().then(r => r.data),
    enabled: fediverseQuery !== null,
  })

  // The match is computed from the whole text each time, so a suggestion
  // that arrives for a fragment the user has since moved past is not shown.
  const local: any[] = query !== null ? (localData?.users || []).slice(0, max) : []
  const bsky: any[] = query !== null && !bskyData?.disabled ? (bskyData?.actors || []).slice(0, max) : []
  const fedi: any[] = fediverseQuery !== null
    ? (fediData?.following || []).filter((f: any) =>
        f.username && f.instance && `${f.username}@${f.instance}`.toLowerCase().startsWith(fediverseQuery.toLowerCase())).slice(0, max)
    : []

  if (local.length === 0 && bsky.length === 0 && fedi.length === 0) return null

  const insert = (pattern: RegExp, mention: string) =>
    onChangeText(text.replace(pattern, (_m, lead) => `${lead}@${mention} `))

  const row = (key: string, avatar: string | undefined, name: string, sub: string, onPress: () => void) => (
    <TouchableOpacity key={key} onPress={onPress} style={[s.row, { borderBottomColor: c.border }]}>
      <Avatar url={avatar} name={name} size={28} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[s.name, { color: c.text }]}>{name}</Text>
        <Text numberOfLines={1} style={[s.sub, { color: c.textMuted }]}>{sub}</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={[s.list, { backgroundColor: c.card, borderColor: c.border }, style]}>
      {local.map(u => row(`l-${u.id}`, u.avatar_url, u.display_name || u.username, `@${u.username}`,
        () => insert(PLAIN_FRAGMENT, u.username)))}
      {bsky.map(a => row(`b-${a.did}`, a.avatar_url, a.display_name || a.handle, `@${a.handle} · Bluesky`,
        () => insert(PLAIN_FRAGMENT, a.handle)))}
      {fedi.map(f => row(`f-${f.id}`, f.avatar_url, f.display_name || f.username, `@${f.username}@${f.instance}`,
        () => insert(FEDI_FRAGMENT, `${f.username}@${f.instance}`)))}
    </View>
  )
}

const s = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 15, fontWeight: '600' },
  sub:  { fontSize: 12 },
})
