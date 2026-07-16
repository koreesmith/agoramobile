import { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import { useC } from '../constants/ColorContext'

const WHATS_NEW_VERSION = '2.0.0'
const STORAGE_KEY = 'last_seen_whats_new'

const FEATURES: { icon: string; title: string; desc: string; link?: string; linkText?: string }[] = [
  {
    icon: 'planet',
    title: 'Fediverse (ActivityPub)',
    desc: "Your public posts are now discoverable and followable from Mastodon and other fediverse apps, and replies go both ways. Off by default for private posts, on by default for public ones — there's a toggle in Settings → Privacy if you'd rather opt out.",
    link: '/fediverse',
    linkText: 'Explore the Fediverse →',
  },
  { icon: 'bookmark', title: 'Pages', desc: 'Follow bands, businesses, and creators. Their posts now appear in your feed.' },
  { icon: 'videocam', title: 'Video Posts', desc: 'Share videos up to 2 minutes directly in your posts.' },
  { icon: 'sparkles', title: 'Smart Ranking', desc: "The algorithm is always your call, never ours. Your main feed stays chronological by default — create a custom feed with Smart Ranking on if you want one that learns what you love." },
  { icon: 'images', title: 'Up to 10 Photos', desc: 'Share more moments — attach up to 10 photos in a single post.' },
  { icon: 'people', title: 'Group Tagging', desc: 'Use +group-name in posts and comments to tag a group.' },
  { icon: 'chatbubble-ellipses', title: 'Quick Comments', desc: 'Comment on any post directly from your feed — no tap required.' },
]

export async function shouldShowWhatsNew(): Promise<boolean> {
  try {
    const seen = await SecureStore.getItemAsync(STORAGE_KEY)
    return seen !== WHATS_NEW_VERSION
  } catch {
    return false
  }
}

export async function markWhatsNewSeen() {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, WHATS_NEW_VERSION)
  } catch {}
}

export async function resetWhatsNew() {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY)
  } catch {}
}

export default function WhatsNewModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const c = useC()

  const handleDismiss = async () => {
    await markWhatsNewSeen()
    onDismiss()
  }

  const handleFeaturePress = async (link?: string) => {
    if (!link) return
    await markWhatsNewSeen()
    onDismiss()
    router.push(link as any)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleDismiss}>
      <View style={[s.container, { backgroundColor: c.card }]}>
        <View style={[s.header, { borderBottomColor: c.border }]}>
          <Text style={[s.title, { color: c.text }]}>What's New in 2.0</Text>
          <TouchableOpacity onPress={handleDismiss} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={c.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          {FEATURES.map((f, i) => {
            const Wrapper = f.link ? TouchableOpacity : View
            return (
              <Wrapper key={i} onPress={f.link ? () => handleFeaturePress(f.link) : undefined}
                style={[s.featureCard, { backgroundColor: c.bg, borderColor: c.border }]}>
                <View style={[s.iconWrap, { backgroundColor: c.primaryBg }]}>
                  <Ionicons name={f.icon as any} size={24} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.featureTitle, { color: c.text }]}>{f.title}</Text>
                  <Text style={[s.featureDesc, { color: c.textMuted }]}>{f.desc}</Text>
                  {f.link && f.linkText && (
                    <Text style={[s.featureLink, { color: c.primary }]}>{f.linkText}</Text>
                  )}
                </View>
              </Wrapper>
            )
          })}
        </ScrollView>
        <View style={[s.footer, { borderTopColor: c.border }]}>
          <TouchableOpacity style={[s.gotItBtn, { backgroundColor: c.primary }]} onPress={handleDismiss}>
            <Text style={s.gotItText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title:        { fontSize: 20, fontWeight: '700' },
  closeBtn:     { padding: 4 },
  featureCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderRadius: 12, padding: 14 },
  iconWrap:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  featureDesc:  { fontSize: 13, lineHeight: 18 },
  featureLink:  { fontSize: 13, fontWeight: '600', marginTop: 6 },
  footer:       { padding: 20, borderTopWidth: StyleSheet.hairlineWidth },
  gotItBtn:     { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  gotItText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
})
