import type { ReactNode } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useC, useIsDark } from '../../constants/ColorContext'

// AMOBILE-202: building blocks shared by the getting started wizard's steps,
// the mobile counterpart of web's WizardParts.

export { useIsDark }

// A step's scrolling body. Its footer sits outside it, pinned to the bottom.
export function StepScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={p.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  )
}

export function StepHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: string; children?: ReactNode }) {
  const c = useC()
  return (
    <View style={{ gap: 8 }}>
      {eyebrow}
      <Text accessibilityRole="header" style={[p.title, { color: c.text }]}>{title}</Text>
      {children ? <Text style={[p.lead, { color: c.textMuted }]}>{children}</Text> : null}
    </View>
  )
}

export function SectionTitle({ title, children }: { title: string; children?: ReactNode }) {
  const c = useC()
  return (
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={[p.sectionTitle, { color: c.text }]}>{title}</Text>
      {children ? <Text style={[p.body, { color: c.textMuted }]}>{children}</Text> : null}
    </View>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost'

// 48pt tall, so every action in the wizard is an easy target.
export function WizButton({ label, onPress, variant = 'primary', icon, iconRight, disabled, accessibilityLabel, style }: {
  label: string
  onPress: () => void
  variant?: Variant
  icon?: string
  iconRight?: string
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  const c = useC()
  const fg = variant === 'primary' ? c.onPrimary : c.primary
  const bg = variant === 'primary' ? c.primary : variant === 'secondary' ? c.primaryBg : 'transparent'
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: !!disabled }}
      style={[p.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: c.border },
        variant === 'ghost' && { paddingHorizontal: 10 }, style]}>
      {icon && <Ionicons name={icon as any} size={18} color={fg} />}
      <Text style={[p.buttonText, { color: fg }]}>{label}</Text>
      {iconRight && <Ionicons name={iconRight as any} size={18} color={fg} />}
    </TouchableOpacity>
  )
}

export function StepFooter({ onBack, onSkip, onContinue, continueLabel = 'Continue', busy }: {
  onBack?: () => void
  onSkip?: () => void
  onContinue: () => void
  continueLabel?: string
  busy?: boolean
}) {
  const c = useC()
  const insets = useSafeAreaInsets()
  return (
    <View style={[p.footer, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      {onBack
        ? <WizButton variant="ghost" icon="chevron-back" label="Back" onPress={onBack} />
        : <View />}
      <View style={p.footerRight}>
        {onSkip && <WizButton variant="ghost" label="Skip" accessibilityLabel="Skip this step" onPress={onSkip} />}
        <WizButton label={busy ? 'Saving…' : continueLabel} iconRight={busy ? undefined : 'arrow-forward'}
          onPress={onContinue} disabled={busy} />
      </View>
    </View>
  )
}

// A titled setting with its control on the right, like a row in Settings.
export function SettingRow({ title, description, control, last, children }: {
  title: string
  description: ReactNode
  control: ReactNode
  last?: boolean
  children?: ReactNode
}) {
  const c = useC()
  return (
    <View style={[p.settingRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <View style={p.settingTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[p.settingTitle, { color: c.text }]}>{title}</Text>
          <Text style={[p.small, { color: c.textMuted }]}>{description}</Text>
        </View>
        {control}
      </View>
      {children}
    </View>
  )
}

// Same colors as the switches in Settings.
export function Toggle({ value, onValueChange, label, disabled }: {
  value: boolean
  onValueChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  const c = useC()
  return (
    <Switch value={value} onValueChange={onValueChange} disabled={disabled} accessibilityLabel={label}
      trackColor={{ false: c.border, true: c.primary }} />
  )
}

// Children are text: plain strings, or <Text> for bold runs and inline links.
export function Callout({ tone, children }: { tone: 'warning' | 'info'; children: ReactNode }) {
  const c = useC()
  const isDark = useIsDark()
  const warning = tone === 'warning'
  const colors = warning
    ? { bg: isDark ? 'rgba(245,158,11,0.14)' : '#fffbeb', border: isDark ? '#92400e' : '#fcd34d', text: isDark ? '#fde68a' : '#78350f' }
    : { bg: c.primaryBg, border: c.border, text: c.textMd }
  return (
    <View style={[p.callout, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Ionicons name={warning ? 'warning-outline' : 'information-circle-outline'} size={18} color={colors.text} style={{ marginTop: 1 }} />
      <Text style={[p.small, { flex: 1, color: colors.text }]}>{children}</Text>
    </View>
  )
}

// One choice of a few, like Settings' theme picker.
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  const c = useC()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}
      style={[p.segmented, { backgroundColor: c.bg, borderColor: c.border }]}>
      {options.map(o => {
        const selected = o.value === value
        return (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[p.segment, selected && { backgroundColor: c.primary }]}>
            <Text style={[p.segmentText, { color: selected ? c.onPrimary : c.textMuted }]}>{o.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useC()
  return <Text accessibilityRole="alert" style={[p.small, { color: c.red }]}>{children}</Text>
}

export const p = StyleSheet.create({
  scroll:       { padding: 20, paddingBottom: 32, gap: 24 },
  title:        { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  lead:         { fontSize: 17, lineHeight: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  body:         { fontSize: 16, lineHeight: 22 },
  small:        { fontSize: 15, lineHeight: 21 },
  button:       { minHeight: 48, borderRadius: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttonText:   { fontSize: 17, fontWeight: '600' },
  footer:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footerRight:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingRow:   { paddingVertical: 14, gap: 12 },
  settingTop:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingTitle: { fontSize: 17, fontWeight: '600' },
  callout:      { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  segmented:    { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segment:      { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentText:  { fontSize: 15, fontWeight: '600' },
  card:         { borderWidth: 1, borderRadius: 14, padding: 16 },
})
