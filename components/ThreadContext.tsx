import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Avatar, LinkedText, renderName } from './ui'
import { federationApi } from '../api'
import { handle, timeAgo } from '../utils/handle'
import { useC } from '../constants/ColorContext'

// AGORA-419: the conversation above a fediverse post that was a reply.
//
// A boosted reply arrives on its own, so without this the post screen showed it
// with nothing it was answering. The backend walks its inReplyTo chain (storing
// each ancestor, so it is fetched once); this lists them oldest first, each
// opening its own post, directly above the post itself.
export default function ThreadContext({ post }: { post: any }) {
  const c = useC()
  const eligible = !!post?.is_remote && post.remote_instance !== 'bsky.app'
  const { data } = useQuery({
    queryKey: ['thread-context', post?.id],
    queryFn: () => federationApi.threadContext(post.id).then(r => r.data),
    enabled: eligible,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const ancestors: any[] = data?.ancestors || []
  if (!eligible || (ancestors.length === 0 && !data?.more)) return null

  // When the chain couldn't be followed all the way up, the conversation's own
  // server still has it.
  const earlierURL: string | undefined = ancestors[0]?.url || data?.url

  return (
    <View style={s.wrap}>
      <View style={s.labelRow}>
        <Ionicons name="return-up-back-outline" size={13} color={c.textMuted} />
        <Text style={[s.label, { color: c.textMuted }]}>In reply to</Text>
      </View>
      {data?.more && earlierURL ? (
        <TouchableOpacity onPress={() => Linking.openURL(earlierURL)} style={s.labelRow}>
          <Ionicons name="open-outline" size={12} color={c.primary} />
          <Text style={[s.earlier, { color: c.primary }]}>Earlier posts in this conversation are on its original server</Text>
        </TouchableOpacity>
      ) : null}
      <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
        {ancestors.map((a, i) => (
          <TouchableOpacity key={a.id} activeOpacity={0.7}
            onPress={() => router.push(`/post/${a.id}` as any)}
            style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
            <Avatar url={a.avatar_url} name={a.display_name || a.username} size={30} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text numberOfLines={1} style={[s.meta, { color: c.textMuted }]}>
                <Text style={[s.name, { color: c.text }]}>
                  {a.display_name ? renderName(a.display_name, a.author_emojis) : a.username}
                </Text>
                {'  '}{handle(a.username, a.is_remote, a.remote_instance)}
                {a.published_at ? ` · ${timeAgo(a.published_at)}` : ''}
              </Text>
              {a.content_warning ? (
                <Text style={[s.cw, { color: c.textMuted }]}>CW: {a.content_warning}</Text>
              ) : a.content ? (
                <LinkedText text={a.content} style={[s.content, { color: c.textMd }]} numberOfLines={6} />
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:     { paddingHorizontal: 12, paddingTop: 12, gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  label:    { fontSize: 12, fontWeight: '600' },
  earlier:  { fontSize: 12, flexShrink: 1 },
  card:     { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row:      { flexDirection: 'row', padding: 10 },
  name:     { fontSize: 14, fontWeight: '600' },
  meta:     { fontSize: 12 },
  cw:       { fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  content:  { fontSize: 14, lineHeight: 19, marginTop: 2 },
})
