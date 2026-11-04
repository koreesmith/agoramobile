import { Text, TouchableOpacity } from 'react-native'

// One toggle in the per-post network targeting control (AMOBILE-173). Shared by
// the new-post composer and the reel composer (AGORA-443).
export default function NetworkChip({ label, active, onPress, c }: { label: string; active: boolean; onPress: () => void; c: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
        borderColor: active ? c.primary : c.border,
        backgroundColor: active ? c.primaryBg : 'transparent',
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '500', color: active ? c.primary : c.textMuted }}>{label}</Text>
    </TouchableOpacity>
  )
}
