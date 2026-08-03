import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { C } from '../constants/colors'
import { useC } from '../constants/ColorContext'
import { imgUrl } from '../api'

/**
 * `locked` (AMOBILE-171) marks a fediverse account that approves follow
 * requests by hand, and only while the viewer isn't through that gate yet.
 * It rides on the same bottom-right slot the presence dot uses: the outer
 * View is deliberately not clipped, so a badge can sit over the circle's edge
 * without the avatar's own `overflow: 'hidden'` cropping it away.
 *
 * Fediverse only. AT Proto has no follow-approval mechanism at all (a follow
 * is a public repo write with no Accept to wait on), so a Bluesky account can
 * never be locked and callers should never pass one.
 */
export function Avatar({ url, name, size = 40, online, locked }: { url?: string; name?: string; size?: number; online?: boolean; locked?: boolean }) {
  const c = useC()
  const letter = (name || '?')[0].toUpperCase()
  const resolvedUrl = imgUrl(url)
  const dotSize = Math.round(size * 0.28)
  // Slightly larger than the presence dot, which only has to be seen, where
  // this has to be read as a specific glyph. Floored so the lock stays legible
  // on the smallest avatars a caller might pass.
  const lockSize = Math.max(16, Math.round(size * 0.34))
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
      {locked && (
        <View
          accessibilityRole="image"
          accessibilityLabel="Requires follow approval"
          style={[lay.lockBadge, {
            width: lockSize, height: lockSize, borderRadius: lockSize / 2,
            backgroundColor: c.primary, borderColor: c.card,
          }]}
        >
          <Ionicons name="lock-closed" size={Math.round(lockSize * 0.6)} color="white" />
        </View>
      )}
    </View>
  )
}

// Matches URLs, fediverse mentions (@handle@instance.tld), a single-@ dotted
// handle typed as one token (@alice.bsky.social — AGORA-276/AMOBILE-154),
// local @mentions, and +group-slug tags -- ports web's renderContent()
// (AMOBILE-99), so mobile matches web's link handling instead of only
// linkifying URLs. The dotted alternatives must come before the bare-local
// one so a full remote handle is captured as one token rather than just its
// @handle portion (AGORA-163 hit the equivalent ordering bug server-side).
const LINK_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+|@[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+|@[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+|@[a-zA-Z0-9_-]+|\+[a-zA-Z0-9_-]+|#[a-zA-Z0-9_]+|:[a-zA-Z0-9_]+:)/g
const MENTION_RE = /^@[a-zA-Z0-9_-]+$|^@[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+$|^@[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+$/
const GROUP_TAG_RE = /^\+[a-zA-Z0-9_-]+$/
const HASHTAG_RE = /^#[a-zA-Z0-9_]+$/
const URL_PART_RE = /^https?:\/\//i
const EMOJI_RE = /^:[a-zA-Z0-9_]+:$/

// AGORA-258: Mastodon custom emoji — a shortcode like ":stl_blues:" in a
// display name/bio/post only resolves to an image via a map fetched
// alongside the text it appears in (never derivable from the text itself).
export type EmojiMap = Record<string, string> | null | undefined

// emojiImg renders one recognized shortcode as a small inline image — RN's
// Text supports an Image child as an inline glyph, same idea as web's
// inline <img> sized to sit on the text baseline.
function emojiImg(shortcode: string, url: string, key: string | number) {
  return (
    <Image key={key} source={{ uri: url }}
      style={{ width: 16, height: 16 }} contentFit="contain" />
  )
}

/** Renders a string with URLs, @mentions, +group-slug tags as tappable
 * links, and (AGORA-258) recognized :shortcode: custom emoji as inline
 * images -- URLs open externally; mentions and group tags navigate in-app. */
export function LinkedText({ text, style, linkStyle, emojis, numberOfLines }: { text: string; style?: object; linkStyle?: object; emojis?: EmojiMap; numberOfLines?: number }) {
  const router = useRouter()
  const parts = text.split(LINK_REGEX)

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (MENTION_RE.test(part)) {
          return (
            <Text key={i} style={[{ color: '#3b82f6', fontWeight: '600' }, linkStyle]}
              onPress={() => router.push(`/profile/${part.slice(1)}` as any)}>
              {part}
            </Text>
          )
        }
        if (GROUP_TAG_RE.test(part)) {
          return (
            <Text key={i} style={[{ color: '#3b82f6', fontWeight: '600' }, linkStyle]}
              onPress={() => router.push(`/group/${part.slice(1)}` as any)}>
              {part}
            </Text>
          )
        }
        // AGORA-217: #hashtag jumps into the unified search screen, posts
        // tab, pre-filled with the tag — mirrors web's renderContent().
        if (HASHTAG_RE.test(part)) {
          return (
            <Text key={i} style={[{ color: '#3b82f6', fontWeight: '600' }, linkStyle]}
              onPress={() => router.push(`/search?tab=posts&q=${encodeURIComponent(part)}` as any)}>
              {part}
            </Text>
          )
        }
        // AGORA-258: only substitute a shortcode this specific post/comment's
        // own emoji map actually resolves — anything else matching the
        // pattern stays as plain text, same as it always has.
        if (emojis && EMOJI_RE.test(part) && emojis[part]) {
          return emojiImg(part, emojis[part], i)
        }
        if (URL_PART_RE.test(part)) {
          return (
            <Text key={i} style={[{ color: '#3b82f6', textDecorationLine: 'underline' }, linkStyle]}
              onPress={() => Linking.openURL(part)}>
              {part}
            </Text>
          )
        }
        return <Text key={i}>{part}</Text>
      })}
    </Text>
  )
}

// renderName (AGORA-258) substitutes recognized :shortcode: custom emoji in
// a display name — deliberately simpler than LinkedText: a name is never
// user-composed rich text, so no @mention/#hashtag/URL handling applies,
// just the literal name with any emoji shortcodes swapped for images. Must
// be used inside a <Text> (returns an array of Text/Image nodes, not its
// own wrapping element), so callers compose it the same way they'd
// interpolate a plain string today.
export function renderName(name: string, emojis?: EmojiMap) {
  if (!emojis || Object.keys(emojis).length === 0) return name
  const parts = name.split(/(:[a-zA-Z0-9_]+:)/g)
  return parts.map((part, i) => (emojis[part] ? emojiImg(part, emojis[part], i) : part))
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

// AMOBILE-169: web put search in a bar that sits on every screen, so search has
// to be reachable from every tab here too. The feed gets a full field above its
// pills; everywhere else this icon is the equivalent that doesn't spend a row of
// vertical space on a screen that has its own content to show.
export function SearchIconButton() {
  const c = useC()
  const router = useRouter()
  return (
    <TouchableOpacity
      onPress={() => router.push('/search')}
      accessibilityRole="button"
      accessibilityLabel="Search"
      style={{ padding: 4 }}
    >
      <Ionicons name="search-outline" size={22} color={c.primary} />
    </TouchableOpacity>
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
      <Text style={{ fontSize: 54, marginBottom: 12 }}>{icon}</Text>
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
  // Colours come from the theme at render time (see Avatar) rather than being
  // baked in here the way statusDot's green is, so the ring keeps matching the
  // card behind it in dark mode instead of punching a white hole in it.
  lockBadge:  { position: 'absolute', bottom: -1, right: -1, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  screen: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  headerBack: { marginRight: 8, marginLeft: -4 },
  card: { borderRadius: 16, marginHorizontal: 12, marginVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  button: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '600', fontSize: 17 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 64 },
  emptyTitle: { fontSize: 19, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { textAlign: 'center', marginTop: 4, fontSize: 16 },
  spinner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginHorizontal: 16 },
  uploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  uploadBox: { borderRadius: 16, padding: 28, alignItems: 'center', marginHorizontal: 40, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  uploadBoxTitle: { fontSize: 19, fontWeight: '600', marginBottom: 6 },
  uploadBoxSub: { fontSize: 16, textAlign: 'center', lineHeight: 20 },
})
