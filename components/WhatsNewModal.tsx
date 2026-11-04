import { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import { useC } from '../constants/ColorContext'

// AGORA-448: moved on for 5.0.0 so anyone who dismissed the 4.1.0 list sees the
// new one once.
const WHATS_NEW_VERSION = '5.0.0'
const STORAGE_KEY = 'last_seen_whats_new'

const FEATURES: { icon: string; title: string; desc: string; link?: string; linkText?: string }[] = [
  {
    icon: 'play-circle-outline',
    title: 'Reels',
    desc: 'Watch short videos one after another. Following shows reels from the people you follow, and Discover shows reels from around the network. Videos you have already watched are skipped.',
    link: '/reels',
    linkText: 'Watch Reels →',
  },
  {
    icon: 'videocam-outline',
    title: 'Make a reel',
    desc: 'Record a video or choose one, trim it, pick the cover frame and post it. It uploads in the background while you keep using the app. Reels also reach the Fediverse.',
    link: '/new-reel',
    linkText: 'Make a reel →',
  },
  {
    icon: 'apps-outline',
    title: 'Customize the bottom bar',
    desc: 'Press and hold a tab to choose which places stay in the bar. The rest move to More. Home and Profile always stay.',
  },
  {
    icon: 'pin-outline',
    title: 'Pinned posts',
    desc: 'Pin up to three of your own posts to the top of your profile. Use the menu on a post to pin or unpin it.',
  },
  {
    icon: 'document-text-outline',
    title: 'Drafts',
    desc: 'Save a post to finish later. Tap the draft icon in the composer, then pick it from Drafts when you are ready. Drafts are kept for 90 days.',
  },
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
          <Text style={[s.title, { color: c.text }]}>What's New in 5.0</Text>
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
            <Text style={[s.gotItText, { color: c.onPrimary }]}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title:        { fontSize: 22, fontWeight: '700' },
  closeBtn:     { padding: 4 },
  featureCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderRadius: 12, padding: 14 },
  iconWrap:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureTitle: { fontSize: 17, fontWeight: '700', marginBottom: 3 },
  featureDesc:  { fontSize: 15, lineHeight: 18 },
  featureLink:  { fontSize: 15, fontWeight: '600', marginTop: 6 },
  footer:       { padding: 20, borderTopWidth: StyleSheet.hairlineWidth },
  gotItBtn:     { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  gotItText:    { color: '#fff', fontSize: 18, fontWeight: '700' },
})
