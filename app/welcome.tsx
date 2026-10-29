import { useEffect, useMemo, useState } from 'react'
import { View, Text, BackHandler, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { instanceApi, onboardingApi, imgUrl } from '../api'
import { useAuthStore } from '../store/auth'
import { useWelcomeStore } from '../store/welcome'
import { markWhatsNewSeen } from '../components/WhatsNewModal'
import { useC } from '../constants/ColorContext'
import { ALL_STEPS } from '../components/welcome/steps'
import { meQueryKey, useMe } from '../components/welcome/useMe'
import { WizButton } from '../components/welcome/parts'
import type { FinishTo, InstanceInfo, StepId, StepProps, WizardNotes } from '../components/welcome/types'

// AMOBILE-202: the getting started wizard (AMOBILE-201), the mobile
// counterpart of web's WelcomePage. The tab layout opens it once per launch
// for an account the server says hasn't finished or skipped it; anyone can
// replay it from Settings. ?step= opens it at a given step.

const EMPTY_NOTES: WizardNotes = { domainReminder: false, requestsSent: 0, follows: 0, groupsJoined: 0 }

export default function WelcomeScreen() {
  const c = useC()
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const accountId = useAuthStore((s) => s.activeAccountId)
  const params = useLocalSearchParams<{ step?: string }>()
  const [current, setCurrent] = useState<StepId>((params.step as StepId) || 'welcome')
  const [notes, setNotesState] = useState<WizardNotes>(EMPTY_NOTES)
  const [finishing, setFinishing] = useState(false)

  // A replay counts too, so the tabs don't open it again behind this one.
  useEffect(() => {
    if (accountId) useWelcomeStore.getState().markShown(accountId)
  }, [accountId])

  const { data: instance, isError: instanceFailed, refetch: refetchInstance } = useQuery<InstanceInfo>({
    queryKey: ['instance-info'],
    queryFn: () => instanceApi.getInfo().then(r => r.data),
    staleTime: 5 * 60_000,
  })
  // Every step starts from what's saved right now.
  const { data: me, isError: meFailed, refetch: refetchMe } = useMe({ staleTime: 0 })

  // A network the admin has turned off for the whole instance has nothing
  // to set up, so its step isn't shown or counted.
  const steps = useMemo(() => ALL_STEPS.filter(s =>
    (s.id !== 'bluesky' || instance?.atproto_enabled) &&
    (s.id !== 'fediverse' || instance?.activitypub_enabled)
  ), [instance])
  const index = Math.max(0, steps.findIndex(s => s.id === current))
  const step = steps[index]

  const goTo = (id: StepId) => setCurrent(id)
  const next = () => { if (index < steps.length - 1) setCurrent(steps[index + 1].id) }
  const back = () => { if (index > 0) setCurrent(steps[index - 1].id) }

  // Android's back button walks back through the steps. On the first one it
  // closes the screen like anywhere else, and the wizard comes back on the
  // next launch.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false
      setCurrent(steps[index - 1].id)
      return true
    })
    return () => sub.remove()
  }, [index, steps])

  const setNotes: StepProps['setNotes'] = (update) =>
    setNotesState(n => ({ ...n, ...(typeof update === 'function' ? update(n) : update) }))

  // Back to the tabs whatever led here (the launch redirect or Settings),
  // then on to the feed, or to the custom domain screen over it.
  const leave = (to: FinishTo) => {
    if (router.canDismiss()) router.dismissAll()
    if (to === 'custom-domain') router.push('/custom-domain')
    else router.navigate('/')
  }

  const finish = async (to: FinishTo = 'feed') => {
    setFinishing(true)
    // Leave even if this fails: the account then just sees the wizard again
    // on a later launch, which beats trapping it here now.
    try { await onboardingApi.complete() } catch { /* see above */ }
    // For a brand-new account What's New would only repeat the wizard, but a
    // returning member (AGORA-393) hasn't seen what changed, so theirs still
    // shows on the feed afterwards. Both of these have to land before the
    // cache update below, which is what releases the feed's What's New
    // check: it waits for a requested composer to close.
    if (!me?.onboarding_returning) await markWhatsNewSeen()
    if (to === 'compose') useWelcomeStore.getState().requestCompose()
    qc.setQueryData(meQueryKey(accountId), (old: any) => old && { ...old, onboarding_completed: true })
    leave(to)
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))

  if (!instance || !me) return (
    <View style={[s.center, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {instanceFailed || meFailed ? (
        <>
          <Text style={[s.loadError, { color: c.textMd }]}>
            Couldn't load the getting started tour. Check your connection and try again.
          </Text>
          <WizButton label="Try again" onPress={() => { refetchInstance(); refetchMe() }} />
          <WizButton variant="ghost" label="Not now" onPress={close} />
        </>
      ) : <ActivityIndicator color={c.primary} size="large" />}
    </View>
  )

  const instanceName = instance.instance_name || 'Agora'
  const logo = imgUrl(instance.logo_url)
  const Step = step.Component
  const stepProps: StepProps = {
    current: step.id,
    steps: steps.map(({ id, label }) => ({ id, label })),
    instance, me, notes, setNotes, next, back, goTo, finish, finishing,
  }

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: c.card, borderBottomColor: c.border }]}>
        <View style={s.headerRow}>
          <View style={s.brand}>
            <View style={[s.logo, { backgroundColor: c.primary }]}>
              {logo
                ? <Image source={{ uri: logo }} style={s.logoImage} />
                : <Text style={[s.logoLetter, { color: c.onPrimary }]}>{instanceName[0]?.toUpperCase()}</Text>}
            </View>
            <Text numberOfLines={1} style={[s.brandName, { color: c.text }]}>{instanceName}</Text>
          </View>
          {step.id !== 'done' && (
            <WizButton variant="ghost" label="Skip setup" onPress={() => finish('feed')} disabled={finishing} />
          )}
        </View>
        {index > 0 && (
          <View style={s.progress}>
            <Text style={[s.progressLabel, { color: c.textMuted }]}>
              Step {index + 1} of {steps.length} · {step.label}
            </Text>
            <View style={[s.track, { backgroundColor: c.border }]} accessibilityRole="progressbar"
              accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}>
              <View style={[s.fill, { backgroundColor: c.primary, width: `${Math.round((index / (steps.length - 1)) * 100)}%` }]} />
            </View>
          </View>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Step key={step.id} {...stepProps} />
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:        { flex: 1 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  loadError:     { fontSize: 17, lineHeight: 24, textAlign: 'center', marginBottom: 8 },
  header:        { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  // Held at the Skip button's height, so the header doesn't shrink on the
  // last step, where that button isn't shown.
  headerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  brand:         { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  logo:          { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage:     { width: 34, height: 34 },
  logoLetter:    { fontSize: 17, fontWeight: '700' },
  brandName:     { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  progress:      { gap: 6, paddingBottom: 2 },
  progressLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  track:         { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill:          { height: 6, borderRadius: 3 },
})
