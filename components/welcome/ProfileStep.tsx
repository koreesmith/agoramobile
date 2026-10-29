import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { usersApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useC } from '../../constants/ColorContext'
import { normalizeImageOrientation } from '../../utils/image'
import { Avatar } from '../ui'
import type { StepProps } from './types'
import { instanceNetworks } from './networks'
import { meQueryKey } from './useMe'
import { Callout, ErrorText, StepFooter, StepHeader, StepScroll, WizButton, p } from './parts'

// AMOBILE-203: photo, cover, display name, pronouns, and bio, with a live
// preview. Photos save as soon as they're picked, like Edit profile; Continue
// saves only the text fields that were edited, and Skip leaves them as they
// were.

type TextKey = 'display_name' | 'pronouns' | 'bio'

// Defined outside the step, like Edit profile's Field, so a re-render doesn't
// remount the input and drop the keyboard.
function Field({ label, optional, value, onChangeText, placeholder, multiline, maxLength, c }: {
  label: string; optional?: boolean; value: string; onChangeText: (t: string) => void
  placeholder?: string; multiline?: boolean; maxLength?: number; c: any
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[st.label, { color: c.textMd }]}>
        {label}{optional ? <Text style={{ fontWeight: '400', color: c.textLight }}> (optional)</Text> : null}
      </Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.textLight}
        multiline={multiline} maxLength={maxLength} accessibilityLabel={label}
        style={[st.input, { borderColor: c.border, color: c.text, backgroundColor: c.card }, multiline && st.multiline]} />
    </View>
  )
}

export default function ProfileStep({ instance, me, next, back }: StepProps) {
  const c = useC()
  const qc = useQueryClient()
  const { updateUser, activeAccountId } = useAuthStore()
  const [name, setName] = useState<string>(me.display_name || '')
  const [pronouns, setPronouns] = useState<string>(me.pronouns || '')
  const [bio, setBio] = useState<string>(me.bio || '')
  const [avatar, setAvatar] = useState<string>(me.avatar_url || '')
  const [cover, setCover] = useState<string>(me.cover_url || '')
  const [uploading, setUploading] = useState<'' | 'avatar' | 'cover'>('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const pick = async (kind: 'avatar' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8,
      ...(kind === 'avatar' ? { allowsEditing: true, aspect: [1, 1] as [number, number] } : {}),
    })
    if (result.canceled) return
    setUploading(kind); setErr('')
    try {
      const uri = await normalizeImageOrientation(result.assets[0].uri)
      const file = { uri, type: 'image/jpeg', name: `${kind}.jpg` } as any
      if (kind === 'avatar') {
        const { data } = await usersApi.uploadAvatar(file)
        setAvatar(data.avatar_url); updateUser({ avatar_url: data.avatar_url })
      } else {
        const { data } = await usersApi.uploadCover(file)
        setCover(data.cover_url); updateUser({ cover_url: data.cover_url })
      }
      qc.invalidateQueries({ queryKey: meQueryKey(activeAccountId) })
    } catch (e: any) {
      setErr(e.response?.data?.error || 'That upload didn\'t work. Try a different image.')
    } finally {
      setUploading('')
    }
  }

  // Only the fields actually edited are sent. Text saved elsewhere can carry
  // stray spaces or a blank line at either end, so trimmed is compared with
  // trimmed: an untouched Continue must not rewrite them (and push a profile
  // update to Bluesky and the Fediverse) just to strip that.
  const save = async () => {
    const changes: Partial<Record<TextKey, string>> = {}
    const typed: Record<TextKey, string> = { display_name: name, pronouns, bio }
    for (const key of Object.keys(typed) as TextKey[]) {
      if (typed[key].trim() !== (me[key] || '').trim()) changes[key] = typed[key].trim()
    }
    if (Object.keys(changes).length === 0) {
      next(); return
    }
    setSaving(true); setErr('')
    try {
      await usersApi.updateProfile(changes)
      updateUser(changes)
      qc.invalidateQueries({ queryKey: meQueryKey(activeAccountId) })
      next()
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Couldn\'t save your profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const networks = instanceNetworks(instance)
  const coverUri = imgUrl(cover)

  return (
    <>
      <StepScroll>
        <StepHeader title="Put a face to your name">
          This is what people see when they find you. All of it is optional, and you can change it anytime from your profile.
        </StepHeader>

        {err ? <ErrorText>{err}</ErrorText> : null}

        <View style={[st.preview, { backgroundColor: c.card, borderColor: c.border }]}>
          <TouchableOpacity onPress={() => pick('cover')} disabled={!!uploading} accessibilityRole="button"
            accessibilityLabel={cover ? 'Change cover photo' : 'Add a cover photo'}
            style={[st.cover, { backgroundColor: c.primaryBg }]}>
            {coverUri ? <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <View style={[st.coverBadge, { backgroundColor: c.card }]}>
              <Ionicons name="camera-outline" size={15} color={c.textMd} />
              <Text style={[st.coverBadgeText, { color: c.textMd }]}>
                {uploading === 'cover' ? 'Uploading…' : 'Cover photo'}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={st.previewBody}>
            <TouchableOpacity onPress={() => pick('avatar')} disabled={!!uploading} accessibilityRole="button"
              accessibilityLabel={avatar ? 'Change profile photo' : 'Add a profile photo'}
              style={[st.avatarRing, { borderColor: c.card, backgroundColor: c.card }]}>
              <Avatar url={avatar} name={name.trim() || me.username} size={72} />
            </TouchableOpacity>
            <Text style={[st.previewName, { color: c.text }]}>{name.trim() || me.username}</Text>
            <Text style={[p.small, { color: c.textMuted }]}>@{me.username}{pronouns.trim() ? ` · ${pronouns.trim()}` : ''}</Text>
            {bio.trim()
              ? <Text style={[p.small, { color: c.textMd, marginTop: 6 }]}>{bio.trim()}</Text>
              : <Text style={[p.small, { color: c.textLight, fontStyle: 'italic', marginTop: 6 }]}>Your bio will show here.</Text>}
          </View>
        </View>

        <WizButton variant="secondary" icon="camera-outline" disabled={!!uploading} onPress={() => pick('avatar')}
          label={uploading === 'avatar' ? 'Uploading…' : avatar ? 'Change photo' : 'Upload a photo'} />

        <View style={{ gap: 16 }}>
          <Field c={c} label="Display name" value={name} onChangeText={setName} />
          <Field c={c} label="Pronouns" optional value={pronouns} onChangeText={setPronouns} maxLength={50}
            placeholder="e.g. she/her, he/him, they/them" />
          <Field c={c} label="Bio" optional value={bio} onChangeText={setBio} multiline placeholder="A line or two about you" />
        </View>

        <Text style={[p.small, { color: c.textMuted }]}>
          Your username, <Text style={{ fontWeight: '700', color: c.textMd }}>@{me.username}</Text>, is permanent. Everything else here can change.
        </Text>

        {networks.length > 0 && (
          <Callout tone="info">
            Your name, photo, and bio are public. If you're on {networks.join(' or ')} (coming up next), people there see them too.
          </Callout>
        )}
      </StepScroll>
      <StepFooter onBack={back} onSkip={next} onContinue={save} busy={saving} />
    </>
  )
}

const st = StyleSheet.create({
  label:          { fontSize: 15, fontWeight: '600' },
  input:          { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, minHeight: 48 },
  multiline:      { minHeight: 96, textAlignVertical: 'top' },
  preview:        { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  cover:          { height: 112, alignItems: 'flex-end', justifyContent: 'flex-start', padding: 10 },
  coverBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, minHeight: 34, opacity: 0.94 },
  coverBadgeText: { fontSize: 13, fontWeight: '700' },
  previewBody:    { paddingHorizontal: 16, paddingBottom: 16 },
  avatarRing:     { marginTop: -40, alignSelf: 'flex-start', borderWidth: 4, borderRadius: 44, marginBottom: 6 },
  previewName:    { fontSize: 19, fontWeight: '700' },
})
