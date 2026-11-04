import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Linking, BackHandler, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { Stack, router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { VideoView, useVideoPlayer } from 'expo-video'
import { useEventListener } from 'expo'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header } from '../components/ui'
import AutoGrowInput from '../components/AutoGrowInput'
import MentionSuggestions from '../components/MentionSuggestions'
import NetworkChip from '../components/NetworkChip'
import AudienceReach from '../components/AudienceReach'
import TrimBar from '../components/reels/TrimBar'
import CoverStrip from '../components/reels/CoverStrip'
import { friendsApi, instanceApi } from '../api'
import { useAuthStore } from '../store/auth'
import { useReelUploads } from '../store/reelUploads'
import { useC } from '../constants/ColorContext'
import { MAX_CLIP, Range, clampCover, initialRange, isTrimmed, limitText, stripTimes } from '../utils/trimRange'

// AGORA-443: make a reel. Record with the camera or choose a video, trim it and
// pick its cover frame, then add a caption and post. The trim and cover go with
// the upload (AGORA-439), so the server cuts the clip during its one transcode.
// Posting hands the work to store/reelUploads, which carries on after this
// screen closes and says by toast when the reel is up or has failed.

type Step = 'pick' | 'edit' | 'post'

const fmt = (t: number) => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

export default function NewReelScreen() {
  const c = useC()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  // The longest reel is the instance's own limit (AGORA-444), 2 minutes unless
  // an admin lowered it.
  const { data: info } = useQuery({ queryKey: ['instance-info'], queryFn: () => instanceApi.getInfo().then((r) => r.data), staleTime: 5 * 60_000 })
  const maxClip: number = info?.video_max_seconds ?? MAX_CLIP

  const [step, setStep] = useState<Step>('pick')
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)

  // Edit
  const [duration, setDuration] = useState(0)
  const [range, setRange] = useState<Range>({ start: 0, end: 0 })
  const [coverAt, setCoverAt] = useState(1)
  const [frames, setFrames] = useState<any[]>([])
  const [playing, setPlaying] = useState(true)
  const [soundOn, setSoundOn] = useState(false)

  // Post
  const [caption, setCaption] = useState('')
  const [showCW, setShowCW] = useState(false)
  const [cwLabel, setCwLabel] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'group'>('friends')
  const [friendListId, setFriendListId] = useState('')
  const [agoraEnabled, setAgoraEnabled] = useState(true)
  const [federateAP, setFederateAP] = useState(true)
  const [federateATProto, setFederateATProto] = useState(true)

  const apEnabled = (user as any)?.activitypub_enabled
  const atprotoEnabled = (user as any)?.atproto_enabled
  const { data: listsData } = useQuery({
    queryKey: ['friend-lists'],
    queryFn: () => friendsApi.listFriendLists().then((r) => r.data),
  })
  const friendLists: any[] = listsData?.groups || []
  const selectedList = visibility === 'group' ? friendLists.find((g) => g.id === friendListId) : null

  // ── Player: loops inside the kept part ────────────────────────────────────
  const player = useVideoPlayer(asset?.uri ?? null, (p) => {
    p.loop = false
    p.muted = true
    p.timeUpdateEventInterval = 0.1
  })
  const live = useRef({ step, range, duration })
  live.current = { step, range, duration }
  const durationSet = useRef(false)

  const settle = useCallback((d: number) => {
    if (durationSet.current || !(d > 0)) return
    durationSet.current = true
    const r = initialRange(d, maxClip)
    setDuration(d)
    setRange(r)
    setCoverAt(Math.min(1, (r.end - r.start) / 2))
    void refreshFrames(r)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, maxClip])

  useEventListener(player, 'sourceLoad', ({ duration: d }) => {
    settle(d)
    // Thumbnails can't be made until the video has loaded, so the first try,
    // made when the picker already knew the length, may have come up empty.
    void refreshFrames(live.current.range.end > 0 ? live.current.range : initialRange(d, maxClip))
  })
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const { step: st, range: r, duration: d } = live.current
    if (st !== 'edit' || !d) return
    if (currentTime >= r.end || currentTime < r.start - 0.3) player.currentTime = r.start
  })

  useEffect(() => { player.muted = !soundOn }, [player, soundOn])
  useEffect(() => {
    if (step === 'edit' && playing && duration > 0) player.play()
    else player.pause()
  }, [player, step, playing, duration])

  // ── Cover strip frames ────────────────────────────────────────────────────
  const reqId = useRef(0)
  async function refreshFrames(r: Range) {
    const id = ++reqId.current
    try {
      const thumbs = await player.generateThumbnailsAsync(stripTimes(r, 8), { maxWidth: 160, maxHeight: 160 })
      if (id === reqId.current) setFrames(thumbs)
    } catch {
      // Not every device can make them; the strip still works without.
      if (id === reqId.current) setFrames([])
    }
  }

  // ── Picking ───────────────────────────────────────────────────────────────
  const accept = (a: ImagePicker.ImagePickerAsset) => {
    durationSet.current = false
    setAsset(a)
    setDuration(0); setRange({ start: 0, end: 0 }); setFrames([]); setPlaying(true)
    setStep('edit')
    // The picker usually knows the length already (in milliseconds).
    if (a.duration && a.duration > 0) setTimeout(() => settle(a.duration! / 1000), 0)
  }

  const needsSettings = (what: string) =>
    Alert.alert(`${what} access needed`, `Allow it in your phone's Settings to continue.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ])

  const choose = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) { needsSettings('Camera'); return }
      }
      // A recording is held to the limit; a library video may be longer, since
      // it can be trimmed on the next step.
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['videos'], allowsEditing: false, ...(source === 'camera' ? { videoMaxDuration: maxClip } : {}) }
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
      if (!res.canceled && res.assets?.[0]) accept(res.assets[0])
    } catch (e: any) {
      if (/permission/i.test(String(e?.message))) needsSettings(source === 'camera' ? 'Camera' : 'Photo library')
      else Alert.alert('Error', 'Could not open that. Please try again.')
    }
  }

  // ── Trim and cover gestures ───────────────────────────────────────────────
  const seek = (t: number) => { try { player.currentTime = t } catch { /* not ready */ } }
  const onTrim = (r: Range) => {
    setPlaying(false)
    setCoverAt((cur) => clampCover(cur, r))
    seek(r.start !== range.start ? r.start : Math.max(r.start, r.end - 0.1))
    setRange(r)
  }
  const onTrimRelease = (r: Range) => { void refreshFrames(r); seek(r.start); setPlaying(true) }
  const onCover = (offset: number) => {
    const o = clampCover(offset, range)
    setPlaying(false)
    setCoverAt(o)
    seek(range.start + o)
  }

  // ── Leaving ───────────────────────────────────────────────────────────────
  const requestClose = useCallback(() => {
    if (!asset) { router.back(); return true }
    Alert.alert('Discard this reel?', 'Your video and the changes you made will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ])
    return true
  }, [asset])
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (asset ? requestClose() : false))
    return () => sub.remove()
  }, [asset, requestClose])

  // ── Posting ───────────────────────────────────────────────────────────────
  const validTargeting = visibility !== 'public' || agoraEnabled || federateAP || federateATProto
  const canPost = !!asset && validTargeting && (visibility !== 'group' || !!friendListId)

  const submit = () => {
    if (!asset || !canPost) return
    const usingDefaultTargeting = agoraEnabled && federateAP && federateATProto
    const targeting = visibility === 'public' && !usingDefaultTargeting
      ? { federate_activitypub: federateAP, federate_atproto: federateATProto, external_only: !agoraEnabled }
      : {}
    const trimmed = isTrimmed(range, duration)
    const started = useReelUploads.getState().start({
      file: { uri: asset.uri, name: asset.fileName || 'reel.mp4', type: asset.mimeType || 'video/mp4' },
      // Only sent when changed, so an untouched video is uploaded exactly as
      // chosen and the server does no extra work.
      ...(trimmed ? { trimStartMs: range.start * 1000, trimEndMs: range.end * 1000 } : {}),
      ...(duration > 0 ? { coverMs: coverAt * 1000 } : {}),
      post: {
        content: caption,
        visibility,
        group_id: visibility === 'group' ? friendListId : undefined,
        content_warning: showCW && cwLabel.trim() ? cwLabel.trim() : '',
        ...targeting,
      },
    }, qc)
    if (!started) {
      Alert.alert('One at a time', 'Another reel is still being posted. Wait for it to finish, then try again.')
      return
    }
    router.back()
  }

  const clipLen = Math.max(0, range.end - range.start)
  const title = step === 'pick' ? 'Make a reel' : step === 'edit' ? 'Trim and pick a cover' : 'Add details'

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity key={label} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: active }}
      style={[s.opt, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : 'transparent' }]}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: active ? c.primary : c.textMuted }}>{label}</Text>
    </TouchableOpacity>
  )

  return (
    <Screen>
      <Stack.Screen options={{ gestureEnabled: !asset }} />
      <Header
        title={title}
        left={
          <TouchableOpacity onPress={requestClose} style={s.headerBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={c.primary} />
          </TouchableOpacity>
        }
        right={step === 'edit'
          ? <TouchableOpacity onPress={() => setStep('post')} disabled={duration === 0} accessibilityRole="button"><Text style={[s.headerAction, { color: duration === 0 ? c.textLight : c.primary }]}>Next</Text></TouchableOpacity>
          : step === 'post'
            ? <TouchableOpacity onPress={submit} disabled={!canPost} accessibilityRole="button"><Text style={[s.headerAction, { color: canPost ? c.primary : c.textLight }]}>Post</Text></TouchableOpacity>
            : undefined}
      />

      {/* ── Pick ─────────────────────────────────────────────────────────── */}
      {step === 'pick' && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>
            Reels are short videos, up to {limitText(maxClip)}. A longer video from your library can be trimmed on the next step.
          </Text>
          <TouchableOpacity onPress={() => choose('camera')} style={[s.bigBtn, { borderColor: c.border, backgroundColor: c.card }]} accessibilityRole="button">
            <Ionicons name="videocam-outline" size={26} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[s.bigTitle, { color: c.text }]}>Record a video</Text>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>Use your camera, up to {limitText(maxClip)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => choose('library')} style={[s.bigBtn, { borderColor: c.border, backgroundColor: c.card }]} accessibilityRole="button">
            <Ionicons name="images-outline" size={26} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[s.bigTitle, { color: c.text }]}>Choose from your library</Text>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>Pick a video you already have</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Edit ─────────────────────────────────────────────────────────── */}
      {step === 'edit' && asset && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
          <View style={s.preview}>
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
            <View style={s.previewBtns}>
              <TouchableOpacity onPress={() => setPlaying((p) => !p)} style={s.round} accessibilityRole="button" accessibilityLabel={playing ? 'Pause preview' : 'Play preview'}>
                <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSoundOn((v) => !v)} style={s.round} accessibilityRole="button" accessibilityLabel={soundOn ? 'Mute preview' : 'Unmute preview'}>
                <Ionicons name={soundOn ? 'volume-high' : 'volume-mute'} size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {duration > 0 ? (
            <>
              <View style={{ gap: 6 }}>
                <View style={s.rowBetween}>
                  <Text style={[s.section, { color: c.text }]}>Trim</Text>
                  <Text style={{ color: c.textMuted, fontSize: 13 }}>Clip length {fmt(clipLen)}</Text>
                </View>
                <TrimBar duration={duration} maxClip={maxClip} range={range} onChange={onTrim} onRelease={onTrimRelease} color={c.primary} trackColor={c.border} />
                <View style={s.rowBetween}>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>{fmt(range.start)}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>{fmt(range.end)}</Text>
                </View>
                {duration > maxClip ? (
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    This video is {fmt(duration)} long. Reels are up to {limitText(maxClip)}, so the first {limitText(maxClip)} are selected. Drag the handles to choose another part.
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                <View style={s.rowBetween}>
                  <Text style={[s.section, { color: c.text }]}>Cover</Text>
                  <Text style={{ color: c.textMuted, fontSize: 13 }}>{fmt(coverAt)} into the clip</Text>
                </View>
                <CoverStrip length={clipLen} offset={coverAt} frames={frames} onChange={onCover} onRelease={onCover} color={c.primary} trackColor={c.border} />
                <Text style={{ color: c.textMuted, fontSize: 12 }}>Drag along the strip to choose the frame that represents your reel. The preview above shows it.</Text>
              </View>
            </>
          ) : (
            <Text style={{ color: c.textMuted }}>Loading video…</Text>
          )}

          <TouchableOpacity onPress={() => { setStep('pick'); setAsset(null) }} accessibilityRole="button">
            <Text style={{ color: c.primary, fontSize: 15 }}>Choose a different video</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Post ─────────────────────────────────────────────────────────── */}
      {step === 'post' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            <AutoGrowInput
              minHeight={96}
              maxHeight={260}
              style={[s.caption, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
              placeholder="Write a caption…"
              placeholderTextColor={c.textLight}
              value={caption}
              onChangeText={setCaption}
              autoFocus
            />
            <MentionSuggestions text={caption} onChangeText={setCaption} />

            <TouchableOpacity onPress={() => setShowCW((v) => !v)} style={s.row} accessibilityRole="checkbox" accessibilityState={{ checked: showCW }}>
              <Ionicons name={showCW ? 'checkbox' : 'square-outline'} size={22} color={showCW ? c.primary : c.textMuted} />
              <Text style={{ color: c.text, fontSize: 15 }}>Add a content warning</Text>
            </TouchableOpacity>
            {showCW ? (
              <TextInput value={cwLabel} onChangeText={setCwLabel} maxLength={100} placeholder="What should people know before watching?"
                placeholderTextColor={c.textLight} style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]} accessibilityLabel="Content warning" />
            ) : null}

            <View style={{ gap: 8 }}>
              <Text style={[s.section, { color: c.text }]}>Who can see it</Text>
              <View style={s.opts}>
                {chip('Public', visibility === 'public', () => setVisibility('public'))}
                {chip('Friends', visibility === 'friends', () => { setVisibility('friends'); setAgoraEnabled(true); setFederateAP(true); setFederateATProto(true) })}
                {chip('Friend list', visibility === 'group', () => { setVisibility('group'); setAgoraEnabled(true); setFederateAP(true); setFederateATProto(true) })}
              </View>
              {visibility === 'group' ? (
                friendLists.length > 0 ? (
                  <View style={s.opts}>{friendLists.map((g) => chip(g.name, friendListId === g.id, () => setFriendListId(g.id)))}</View>
                ) : (
                  <Text style={{ color: c.textMuted, fontSize: 13 }}>You don't have any friend lists yet. Create one from Connections.</Text>
                )
              ) : null}
              <AudienceReach list={selectedList} />
            </View>

            {visibility === 'public' && (apEnabled || atprotoEnabled) ? (
              <View style={{ gap: 8 }}>
                <Text style={[s.section, { color: c.text }]}>Post to</Text>
                <View style={s.opts}>
                  <NetworkChip label="Agora" active={agoraEnabled} onPress={() => setAgoraEnabled((v) => !v)} c={c} />
                  {apEnabled ? <NetworkChip label="Fediverse" active={federateAP} onPress={() => setFederateAP((v) => !v)} c={c} /> : null}
                  {atprotoEnabled ? <NetworkChip label="Bluesky" active={federateATProto} onPress={() => setFederateATProto((v) => !v)} c={c} /> : null}
                </View>
                {!validTargeting ? <Text style={{ color: c.red, fontSize: 13 }}>Pick at least one place for this reel to go.</Text> : null}
              </View>
            ) : null}

            <TouchableOpacity onPress={submit} disabled={!canPost} accessibilityRole="button"
              style={[s.primary, { backgroundColor: c.primary }, !canPost && { opacity: 0.5 }]}>
              <Text style={s.primaryText}>Post reel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('edit')} accessibilityRole="button" style={{ alignItems: 'center', padding: 6 }}>
              <Text style={{ color: c.primary, fontSize: 15 }}>Back</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  headerBtn:    { padding: 8 },
  headerAction: { fontSize: 17, fontWeight: '600', paddingHorizontal: 8 },
  bigBtn:       { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 14, padding: 16 },
  bigTitle:     { fontSize: 16, fontWeight: '600' },
  preview:      { height: 340, backgroundColor: '#000', borderRadius: 14, overflow: 'hidden' },
  previewBtns:  { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 },
  round:        { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  rowBetween:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section:      { fontSize: 15, fontWeight: '600' },
  caption:      { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, textAlignVertical: 'top' },
  input:        { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  opts:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt:          { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  primary:      { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryText:  { color: '#fff', fontSize: 17, fontWeight: '600' },
})
