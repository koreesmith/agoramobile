import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { feedApi } from '../api'
import { useC } from '../constants/ColorContext'
import { Avatar, renderName } from './ui'
import { Ionicons } from '@expo/vector-icons'
import { REACTIONS, reactionDisplay } from '../utils/reactions'

interface Props {
  postId: string
  visible: boolean
  onClose: () => void
  initialTab?: string
}

export default function ReactorsModal({ postId, visible, onClose, initialTab = 'all' }: Props) {
  const c = useC()
  const [activeTab, setActiveTab] = useState(initialTab)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reactions', postId],
    queryFn: () => feedApi.getReactions(postId).then(r => r.data),
    enabled: visible,
  })

  const reactors: Array<{ user_id: string; username: string; display_name: string; avatar_url: string; type: string; emojis?: Record<string, string> }> = data?.reactions ?? []

  const tabs = [
    { key: 'all', label: 'All' },
    ...REACTIONS.filter(r => reactors.some(rx => rx.type === r.type))
      .map(r => ({ key: r.type, label: r.emoji })),
  ]

  const filtered = activeTab === 'all' ? reactors : reactors.filter(rx => rx.type === activeTab)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[s.header, { borderBottomColor: c.border }]}>
            <Text style={[s.title, { color: c.text }]}>Reactions</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View style={[s.tabs, { borderBottomColor: c.border }]}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[s.tab, activeTab === tab.key && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
              >
                <Text style={[s.tabLabel, { color: activeTab === tab.key ? c.primary : c.textMuted }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
          ) : isError ? (
            <Text style={[s.empty, { color: c.textMuted }]}>Could not load reactions.</Text>
          ) : filtered.length === 0 ? (
            <Text style={[s.empty, { color: c.textMuted }]}>No reactions yet.</Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item, i) => `${item.user_id ?? i}-${item.type}`}
              renderItem={({ item }) => {
                const emoji = reactionDisplay(item.type).emoji
                return (
                  <TouchableOpacity
                    style={s.row}
                    onPress={() => { onClose(); router.push(`/profile/${item.username}`) }}
                  >
                    <Avatar url={item.avatar_url} name={item.display_name || item.username} size={38} />
                    <View style={s.userInfo}>
                      <Text style={[s.displayName, { color: c.text }]}>{item.display_name ? renderName(item.display_name, item.emojis) : item.username}</Text>
                      {item.username && (
                        <Text style={[s.username, { color: c.textMuted }]}>@{item.username}</Text>
                      )}
                    </View>
                    <Text style={s.emoji}>{emoji}</Text>
                  </TouchableOpacity>
                )
              }}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, maxHeight: '70%' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title:       { fontWeight: '700', fontSize: 19 },
  closeBtn:    { padding: 4 },
  tabs:        { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  tab:         { paddingHorizontal: 14, paddingVertical: 10, marginBottom: -StyleSheet.hairlineWidth },
  tabLabel:    { fontSize: 16, fontWeight: '600' },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  userInfo:    { flex: 1 },
  displayName: { fontWeight: '600', fontSize: 16 },
  username:    { fontSize: 13, marginTop: 1 },
  emoji:       { fontSize: 25 },
  empty:       { textAlign: 'center', marginTop: 40, fontSize: 16 },
})
