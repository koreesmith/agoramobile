import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useC } from '../constants/ColorContext'

// Mastodon's limit, the same one the server caps descriptions at
// (alttext.MaxLen), so whatever is written here federates whole.
export const MAX_ALT_LEN = 1500

/**
 * Write or change one image's description (AMOBILE-224, mirroring web's
 * AltTextModal from AGORA-400). Used by the composers.
 */
export function AltTextModal({ imageUri, initial, visible, onSave, onClose }: {
  imageUri?: string
  initial: string
  visible: boolean
  onSave: (alt: string) => void
  onClose: () => void
}) {
  const c = useC()
  const [text, setText] = useState(initial)
  // The modal stays mounted between images, so pick up each one's own text
  // whenever it opens.
  useEffect(() => { if (visible) setText(initial) }, [visible, initial])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.dialog, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[s.header, { borderBottomColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: c.text }]}>Describe this image</Text>
              <Text style={[s.subtitle, { color: c.textMuted }]}>For people who use screen readers or can't see the image</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={[s.preview, { backgroundColor: c.bg }]} contentFit="contain" />
            ) : null}
            <TextInput
              value={text}
              onChangeText={t => setText(t.slice(0, MAX_ALT_LEN))}
              placeholder="What's in the image? Mention anything that matters to the post, like text in it."
              placeholderTextColor={c.textLight}
              multiline
              autoFocus
              maxLength={MAX_ALT_LEN}
              accessibilityLabel="Image description"
              style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
            />
            <Text style={[s.counter, { color: c.textLight }]}>{text.length}/{MAX_ALT_LEN}</Text>
          </ScrollView>
          <View style={s.actions}>
            <TouchableOpacity onPress={onClose} style={[s.btn, { borderColor: c.border, borderWidth: 1 }]}>
              <Text style={[s.btnText, { color: c.textMd }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onSave(text.trim()); onClose() }} style={[s.btn, { backgroundColor: c.primary }]}>
              <Text style={[s.btnText, { color: c.onPrimary }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/**
 * The composer's per-image button: "+ ALT" to add a description, "ALT ✓"
 * once there is one. Sits over the image preview's bottom-left corner.
 */
export function AltEditButton({ hasAlt, onPress }: { hasAlt: boolean, onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={s.badge}
      accessibilityRole="button"
      accessibilityLabel={hasAlt ? 'Edit image description' : 'Add image description'}
    >
      <Text style={s.badgeText}>{hasAlt ? 'ALT ✓' : '+ ALT'}</Text>
    </TouchableOpacity>
  )
}

/**
 * An "ALT" badge for an image that has a description (AMOBILE-224). The
 * description is already the image's accessibility label for screen
 * readers; the badge is for everyone else, the way Mastodon and Bluesky show
 * it. Tapping it shows the text over the image without opening the lightbox.
 *
 * Renders nothing without a description. Place it inside a container that
 * wraps the image, as a sibling of whatever opens the image.
 */
export function AltBadge({ alt }: { alt?: string }) {
  const [open, setOpen] = useState(false)
  if (!alt) return null
  return (
    <>
      {open && (
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={s.altPanel}>
          <ScrollView style={{ maxHeight: 180 }}>
            <Text style={s.altText}>{alt}</Text>
          </ScrollView>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        style={s.badge}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide image description' : 'Show image description'}
      >
        <Text style={s.badgeText}>ALT</Text>
      </TouchableOpacity>
    </>
  )
}

const s = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  dialog:    { borderRadius: 18, borderWidth: 1, maxHeight: '90%' },
  header:    { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title:     { fontWeight: '700', fontSize: 17 },
  subtitle:  { fontSize: 12, marginTop: 2 },
  closeBtn:  { padding: 4, marginLeft: 8 },
  body:      { padding: 16, gap: 10 },
  preview:   { width: '100%', height: 160, borderRadius: 10 },
  input:     { minHeight: 110, maxHeight: 220, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15, textAlignVertical: 'top' },
  counter:   { fontSize: 12, textAlign: 'right' },
  actions:   { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  btn:       { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnText:   { fontWeight: '600', fontSize: 15 },
  badge:     { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  altPanel:  { position: 'absolute', left: 8, right: 8, bottom: 36, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 10, padding: 10 },
  altText:   { color: 'white', fontSize: 13, lineHeight: 18 },
})
