import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Spinner } from './ui'
import { useC } from '../constants/ColorContext'

/** Under a profile's posts: a spinner while the next page loads, a retry if it failed (AGORA-424). */
export default function ProfilePostsFooter({ loading, failed, onRetry }: { loading: boolean, failed: boolean, onRetry: () => void }) {
  const c = useC()
  if (loading) return <Spinner />
  if (!failed) return null
  return (
    <View style={s.wrap}>
      <Text style={{ color: c.red, fontSize: 13 }}>Could not load more posts.</Text>
      <TouchableOpacity onPress={onRetry} style={[s.btn, { borderColor: c.border }]} accessibilityRole="button">
        <Text style={{ color: c.textMd, fontWeight: '600', fontSize: 13 }}>Retry</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 14, gap: 8 },
  btn:  { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
})
