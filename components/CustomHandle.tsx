import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useIsDark } from '../constants/ColorContext'

/**
 * A user's verified custom domain, shown as their handle on Bluesky and the
 * wider AT Protocol network (AMOBILE-160, mirroring web's AGORA-288).
 *
 * Shown *alongside* @username rather than replacing it. Within Agora,
 * @username is the identity mentions resolve against and profile links are
 * built from, so swapping it out would make the name people see stop matching
 * the name they can type. The domain is the extra fact, the one that carries
 * a verification claim, so it gets the badge.
 *
 * Renders nothing without a domain, which is the common case, so it can be
 * dropped in wherever a name appears.
 */
export default function CustomHandle({ domain, size = 'sm' }: { domain?: string | null, size?: 'sm' | 'md' }) {
  // Web's sky-600 and sky-400: the same blue on both platforms.
  const color = useIsDark() ? '#38bdf8' : '#0284c7'
  if (!domain) return null
  const md = size === 'md'
  return (
    <View
      style={s.row}
      accessible
      accessibilityLabel={`${domain}, a domain this account has verified it controls`}
    >
      <Ionicons name="checkmark-circle" size={md ? 14 : 12} color={color} />
      <Text style={[s.text, { color, fontSize: md ? 15 : 13 }]} numberOfLines={1}>{domain}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1, minWidth: 0 },
  text: { flexShrink: 1 },
})
