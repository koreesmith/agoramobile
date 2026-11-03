import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useC } from '../constants/ColorContext'
import { FLEX_SLOTS } from '../constants/tabDestinations'
import { useTabBarStore } from '../store/tabBar'
import { useDestinations } from '../utils/useDestinations'

// AGORA-446: choose which destinations sit in the bottom bar. Opened by a
// long-press on any tab except Profile (which opens the account switcher), by
// a row in More, and by a row in Settings. Unchecking a destination moves it
// to More. Feed and Profile are always in the bar.
export default function CustomizeTabBarModal({ visible, onClose }: {
  visible: boolean
  onClose: () => void
}) {
  const c = useC()
  const { destinations, bar } = useDestinations()
  const toggle = useTabBarStore((s) => s.toggle)
  const reset = useTabBarStore((s) => s.reset)
  const full = bar.length >= FLEX_SLOTS

  const fixed = (label: string, icon: any) => (
    <View style={[s.row, { borderBottomColor: c.border, opacity: 0.6 }]} accessible accessibilityLabel={`${label}, always in the bar`}>
      <Ionicons name="lock-closed-outline" size={20} color={c.textMuted} />
      <Ionicons name={icon} size={20} color={c.textMuted} style={{ marginLeft: 12 }} />
      <Text style={[s.label, { color: c.text }]}>{label}</Text>
      <Text style={[s.note, { color: c.textMuted }]}>Always in the bar</Text>
    </View>
  )

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: c.card }]}>
        <View style={[s.header, { borderBottomColor: c.border }]}>
          <Text style={[s.title, { color: c.text }]}>Customize bottom bar</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={[s.done, { color: c.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }}>
          <Text style={[s.intro, { color: c.textMuted }]}>
            Pick up to {FLEX_SLOTS}. Anything you leave out is in More.
            {full ? ' Uncheck one to add another.' : ''}
          </Text>

          {fixed('Feed', 'home-outline')}

          {destinations.map((d) => {
            const checked = bar.includes(d.id)
            const disabled = !checked && full
            return (
              <TouchableOpacity
                key={d.id}
                onPress={() => toggle(d.id)}
                disabled={disabled}
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled }}
                accessibilityLabel={d.title}
                style={[s.row, { borderBottomColor: c.border }, disabled && { opacity: 0.4 }]}
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={checked ? c.primary : c.textMuted}
                />
                <Ionicons name={d.icon} size={20} color={c.textMuted} style={{ marginLeft: 12 }} />
                <Text style={[s.label, { color: c.text }]}>{d.title}</Text>
              </TouchableOpacity>
            )
          })}

          {fixed('Profile', 'person-outline')}

          <TouchableOpacity onPress={reset} style={s.resetRow} accessibilityRole="button">
            <Text style={[s.resetText, { color: c.primary }]}>Reset to default</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title:     { fontSize: 19, fontWeight: '700', flexShrink: 1 },
  closeBtn:  { padding: 4 },
  done:      { fontSize: 17, fontWeight: '600' },
  intro:     { fontSize: 14, paddingHorizontal: 16, paddingVertical: 12 },
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  label:     { fontSize: 16, fontWeight: '500', marginLeft: 12, flex: 1 },
  note:      { fontSize: 13, marginLeft: 8 },
  resetRow:  { paddingHorizontal: 16, paddingVertical: 18, alignItems: 'center' },
  resetText: { fontSize: 16, fontWeight: '600' },
})
