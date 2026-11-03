import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header } from '../../components/ui'
import CustomizeTabBarModal from '../../components/CustomizeTabBarModal'
import { useC } from '../../constants/ColorContext'
import { useDestinations } from '../../utils/useDestinations'
import { useUnreadCounts } from '../../utils/useUnreadCounts'

// AGORA-446: the More tab. Lists every destination that isn't in the bottom
// bar right now, each with its unread count, and the way into customizing the
// bar. The destinations are still screens in this tab group, so opening one
// here is the same as tapping it in the bar.
export default function MoreScreen() {
  const c = useC()
  const { destinations, bar } = useDestinations()
  const { unread, unreadMessages } = useUnreadCounts()
  const [customizeOpen, setCustomizeOpen] = useState(false)

  const hidden = destinations.filter((d) => !bar.includes(d.id))
  const badgeFor = (badge?: 'alerts' | 'messages') =>
    badge === 'alerts' ? unread : badge === 'messages' ? unreadMessages : 0

  return (
    <Screen>
      <Header title="More" />
      <ScrollView>
        {hidden.length === 0 && (
          <Text style={[s.empty, { color: c.textMuted }]}>Everything is in your bottom bar.</Text>
        )}

        {hidden.map((d) => {
          const count = badgeFor(d.badge)
          return (
            <TouchableOpacity
              key={d.id}
              onPress={() => router.navigate(`/(tabs)/${d.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={count > 0 ? `${d.title}, ${count} unread` : d.title}
              style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}
            >
              <View style={[s.icon, { backgroundColor: c.primaryBg }]}>
                <Ionicons name={d.icon} size={20} color={c.primary} />
              </View>
              <Text style={[s.label, { color: c.text }]}>{d.title}</Text>
              {count > 0 && (
                <View style={[s.badge, { backgroundColor: c.red }]}>
                  <Text style={s.badgeText}>{count > 99 ? '99+' : count}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={c.textLight} />
            </TouchableOpacity>
          )
        })}

        <TouchableOpacity
          onPress={() => setCustomizeOpen(true)}
          accessibilityRole="button"
          style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border, marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
        >
          <View style={[s.icon, { backgroundColor: c.primaryBg }]}>
            <Ionicons name="options-outline" size={20} color={c.primary} />
          </View>
          <Text style={[s.label, { color: c.text }]}>Customize bottom bar</Text>
          <Ionicons name="chevron-forward" size={16} color={c.textLight} />
        </TouchableOpacity>
      </ScrollView>

      <CustomizeTabBarModal visible={customizeOpen} onClose={() => setCustomizeOpen(false)} />
    </Screen>
  )
}

const s = StyleSheet.create({
  empty:     { fontSize: 15, padding: 16 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  icon:      { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label:     { flex: 1, fontSize: 16, fontWeight: '500' },
  badge:     { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
})
