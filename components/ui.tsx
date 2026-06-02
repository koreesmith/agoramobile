import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { C } from '../constants/colors'
import { useC } from '../constants/ColorContext'
import { imgUrl } from '../api'

export function Avatar({ url, name, size = 40, online }: { url?: string; name?: string; size?: number; online?: boolean }) {
  const c = useC()
  const letter = (name || '?')[0].toUpperCase()
  const resolvedUrl = imgUrl(url)
  const dotSize = Math.round(size * 0.28)
  return (
    <View style={{ width: size, height: size }}>
      <View style={[lay.avatarWrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.primaryBg }]}>
        {resolvedUrl
          ? <Image source={{ uri: resolvedUrl }} style={{ width: size, height: size }} />
          : <Text style={[lay.avatarLetter, { fontSize: size * 0.4, color: c.primary }]}>{letter}</Text>}
      </View>
      {online && (
        <View style={[lay.statusDot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]} />
      )}
    </View>
  )
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

/** Renders a string with any http/https URLs as tappable links. */
export function LinkedText({ text, style, linkStyle }: { text: string; style?: object; linkStyle?: object }) {
  const parts: { text: string; isUrl: boolean }[] = []
  let last = 0
  let match: RegExpExecArray | null
  URL_REGEX.lastIndex = 0
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), isUrl: false })
    parts.push({ text: match[0], isUrl: true })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), isUrl: false })

  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.isUrl ? (
          <Text
            key={i}
            style={[{ color: '#3b82f6', textDecorationLine: 'underline' }, linkStyle]}
            onPress={() => Linking.openURL(part.text)}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        )
      )}
    </Text>
  )
}

export function Screen({ children }: { children: React.ReactNode }) {
  const c = useC()
  return <View style={[lay.screen, { backgroundColor: c.bg }]}>{children}</View>
}

export function Header({ title, right, back }: { title: string; right?: React.ReactNode; back?: boolean }) {
  const c = useC()
  const router = useRouter()
  return (
    <View style={[lay.header, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      {back
        ? <TouchableOpacity onPress={() => router.back()} style={lay.headerBack}>
            <Ionicons name="chevron-back" size={24} color={c.primary} />
          </TouchableOpacity>
        : null}
      <Text style={[lay.headerTitle, { color: c.text, flex: back ? 1 : undefined }]}>{title}</Text>
      {right && <View>{right}</View>}
    </View>
  )
}

export function Card({ children }: { children: React.ReactNode }) {
  const c = useC()
  return <View style={[lay.card, { backgroundColor: c.card }]}>{children}</View>
}

export function Button({ title, onPress, variant = 'primary', disabled = false, small = false }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean; small?: boolean
}) {
  const c = useC()
  const bg = disabled ? c.border : variant === 'primary' ? c.primary : variant === 'danger' ? c.red : c.primaryBg
  const color = disabled ? c.textLight : variant === 'primary' || variant === 'danger' ? c.white : c.primary
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}
      style={[lay.button, { backgroundColor: bg, paddingVertical: small ? 6 : 10, paddingHorizontal: small ? 12 : 16 }]}>
      <Text style={[lay.buttonText, { color }]}>{title}</Text>
    </TouchableOpacity>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  const c = useC()
  return (
    <View style={lay.emptyState}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>{icon}</Text>
      <Text style={[lay.emptyTitle, { color: c.textMd }]}>{title}</Text>
      {subtitle && <Text style={[lay.emptySubtitle, { color: c.textLight }]}>{subtitle}</Text>}
    </View>
  )
}

export function Spinner() {
  const c = useC()
  return <View style={lay.spinner}><ActivityIndicator color={c.primary} size="large" /></View>
}

export function UploadingModal({ visible }: { visible: boolean }) {
  const c = useC()
  if (!visible) return null
  return (
    <View style={lay.uploadOverlay}>
      <View style={[lay.uploadBox, { backgroundColor: c.card }]}>
        <ActivityIndicator color={c.primary} size="large" style={{ marginBottom: 12 }} />
        <Text style={[lay.uploadBoxTitle, { color: c.text }]}>Uploading Photos</Text>
        <Text style={[lay.uploadBoxSub, { color: c.textLight }]}>Please wait a moment while your photos are processed.</Text>
      </View>
    </View>
  )
}

export function Divider() {
  const c = useC()
  return <View style={[lay.divider, { backgroundColor: c.border }]} />
}

const lay = StyleSheet.create({
  avatarWrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarLetter: { fontWeight: 'bold' },
  statusDot: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#ffffff' },
  screen: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerBack: { marginRight: 8, marginLeft: -4 },
  card: { borderRadius: 16, marginHorizontal: 12, marginVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  button: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '600', fontSize: 15 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 64 },
  emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { textAlign: 'center', marginTop: 4, fontSize: 14 },
  spinner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginHorizontal: 16 },
  uploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  uploadBox: { borderRadius: 16, padding: 28, alignItems: 'center', marginHorizontal: 40, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  uploadBoxTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  uploadBoxSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
