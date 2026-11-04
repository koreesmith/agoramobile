import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useC } from '../constants/ColorContext'

// AudienceReach says what will happen to the members of a limited audience
// whose servers cannot honour the limit, and says nothing otherwise
// (AMOBILE-175).
//
// Two levels, because the cases genuinely differ. A Bluesky account is not
// delivered to at all, which is the closest thing to a defect from the author's
// point of view. A fediverse account does receive it and their server does keep
// it unlisted, but there is no Close Friends concept there and it will not
// carry replies back to the rest of the list.
//
// Named rather than counted: "Dave will get this and their server will keep it
// unlisted" is something an author can act on, where "1 member has reduced
// functionality" is not. The reach data rides on the friend-lists response the
// picker above already fetched, so this costs no extra request and cannot lag
// behind the selection.
export default function AudienceReach({ list }: { list: any }) {
  const c = useC()
  if (!list) return null

  const bsky = (list.bluesky_count ?? 0) > 0
  const fedi = (list.fediverse_count ?? 0) > 0
  if (!bsky && !fedi) return null

  const names = (shown: string[] = [], total = 0) => {
    if (total > shown.length) {
      const others = total - shown.length
      return `${shown.join(', ')} and ${others} other${others === 1 ? '' : 's'}`
    }
    if (shown.length > 1) return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
    return shown[0] || ''
  }

  return (
    <View style={[st.reachNotice, { borderBottomColor: c.border, backgroundColor: c.card }]}>
      <Ionicons name="information-circle-outline" size={14} color={c.textMuted} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 3 }}>
        {bsky && (
          <Text style={[st.reachText, { color: c.textMuted }]}>
            <Text style={{ fontWeight: '600' }}>{names(list.bluesky_names, list.bluesky_count)}</Text>
            {(list.bluesky_count === 1 ? ' is' : ' are')} on Bluesky, which has no way to receive a post
            limited to a list, so they will not get this one.
          </Text>
        )}
        {fedi && (
          <Text style={[st.reachText, { color: c.textMuted }]}>
            <Text style={{ fontWeight: '600' }}>{names(list.fediverse_names, list.fediverse_count)}</Text>
            {' will get this and their server will keep it unlisted, but it has no concept of this list, '}
            so replies there will not reach the rest of it.
          </Text>
        )}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  // Deliberately quieter than the trigger-warning box: this is a delivery
  // estimate, not a security warning, and styling it as an alert would make an
  // ordinary limited post look broken.
  reachNotice: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  reachText: { fontSize: 12, lineHeight: 17 },
})
