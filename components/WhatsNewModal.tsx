import { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import { useC } from '../constants/ColorContext'

const WHATS_NEW_VERSION = '4.0.0'
const STORAGE_KEY = 'last_seen_whats_new'

const FEATURES: { icon: string; title: string; desc: string; link?: string; linkText?: string }[] = [
  {
    icon: 'git-network-outline',
    title: 'Friends across Agora instances',
    desc: "Friend requests, friends-only posts, and their replies and reactions now reach your friends even when they're on a different Agora instance, not just your own.",
    link: '/connections',
    linkText: 'See your friends →',
  },
  {
    icon: 'mail-outline',
    title: 'Direct messages across instances',
    desc: 'Send and receive DMs with friends on other Agora instances, not just your own.',
    link: '/messages',
    linkText: 'Open Messages →',
  },
  {
    icon: 'pin-outline',
    title: 'Pinned feed pills',
    desc: 'Pin your favorite feeds to the top of your feed bar, with an overflow sheet for the rest.',
    link: '/',
    linkText: 'Try it →',
  },
  { icon: 'happy-outline', title: 'Refreshed reactions', desc: 'A realigned reaction set, shared consistently between posts and Messages.' },
  {
    icon: 'eye-outline',
    title: 'See your followers',
    desc: 'View your fediverse and Bluesky follower and following lists, now with a dedicated Followers segment in each tab.',
    link: '/connections?tab=fediverse&sub=followers',
    linkText: 'Check your followers →',
  },
  { icon: 'eye-off-outline', title: 'Hide a post', desc: 'Remove a post from your own timeline without deleting it.' },
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
          <Text style={[s.title, { color: c.text }]}>What's New in 4.0</Text>
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
