import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../components/ui'
import { moderationApi, rulesApi } from '../api'
import { useC } from '../constants/ColorContext'

const VIOLATION_TYPES = [
  { value: 'spam',            label: 'Spam',                    desc: 'Repetitive or commercial content' },
  { value: 'hate_speech',     label: 'Hate speech',             desc: 'Targeting people based on identity' },
  { value: 'harassment',      label: 'Harassment or bullying',  desc: 'Content intended to intimidate' },
  { value: 'illegal_content', label: 'Illegal content',         desc: 'May violate local or federal law' },
  { value: 'misinformation',  label: 'Misinformation',          desc: 'False or misleading information' },
  { value: 'sexual_content',  label: 'Explicit content',        desc: 'Pornographic or explicit material' },
  { value: 'violence',        label: 'Violence or threats',     desc: 'Threats or graphic violent content' },
  { value: 'rule_violation',  label: 'Server rule violation',   desc: 'Violates a specific instance rule' },
  { value: 'other',           label: 'Something else',          desc: "Doesn't fit the above categories" },
]

export default function ReportScreen() {
  const c = useC()
  const { postId, commentId, userId } = useLocalSearchParams<{ postId?: string; commentId?: string; userId?: string }>()
  const [step, setStep] = useState<'type'|'rule'|'details'>('type')
  const [violationType, setViolationType] = useState('')
  const [selectedRuleId, setSelectedRuleId] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { data: rulesData } = useQuery({
    queryKey: ['instance-rules'],
    queryFn: () => rulesApi.list().then(r => r.data),
  })
  const rules: any[] = rulesData?.rules ?? []

  const report = useMutation({
    mutationFn: () => moderationApi.createReport({
      reported_post_id:    postId,
      reported_comment_id: commentId,
      reported_user_id:    userId,
      violation_type:      violationType,
      rule_id:             selectedRuleId || undefined,
      details,
    }),
    onSuccess: () => setSubmitted(true),
    onError: () => Alert.alert('Error', 'Could not submit report. Please try again.'),
  })

  const targetLabel = commentId ? 'comment' : postId ? 'post' : 'user'

  if (submitted) return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Report', headerBackTitle: 'Back', headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, marginTop: 16, marginBottom: 8 }}>Report submitted</Text>
        <Text style={{ fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 }}>
          Thank you. Our moderators will review this shortly.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={[s.btn, { backgroundColor: c.primary, marginTop: 24 }]}>
          <Text style={s.btnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  )

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: `Report ${targetLabel}`,
        headerBackTitle: step === 'type' ? 'Cancel' : 'Back',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
        headerLeft: step !== 'type' ? () => (
          <TouchableOpacity onPress={() => setStep(step === 'details' && violationType === 'rule_violation' ? 'rule' : 'type')} style={{ paddingLeft: 4 }}>
            <Ionicons name="chevron-back" size={24} color={c.primary} />
          </TouchableOpacity>
        ) : undefined,
      }} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">

        {/* Step 1: Violation type */}
        {step === 'type' && (
          <>
            <Text style={[s.stepTitle, { color: c.text }]}>What's the issue?</Text>
            <Text style={[s.stepSub, { color: c.textMuted }]}>Select the best description for this {targetLabel}.</Text>
            {VIOLATION_TYPES.filter(v => v.value !== 'rule_violation' || rules.length > 0).map(v => (
              <TouchableOpacity key={v.value}
                onPress={() => {
                  setViolationType(v.value)
                  if (v.value === 'rule_violation') setStep('rule')
                  else setStep('details')
                }}
                style={[s.option, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionLabel, { color: c.text }]}>{v.label}</Text>
                  <Text style={[s.optionDesc, { color: c.textMuted }]}>{v.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textLight} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Step 2: Rule selection */}
        {step === 'rule' && (
          <>
            <Text style={[s.stepTitle, { color: c.text }]}>Which rule was violated?</Text>
            {rules.map((rule: any, i: number) => (
              <TouchableOpacity key={rule.id}
                onPress={() => setSelectedRuleId(rule.id)}
                style={[s.option, { backgroundColor: c.card, borderColor: selectedRuleId === rule.id ? c.primary : c.border, borderWidth: selectedRuleId === rule.id ? 2 : 1 }]}
              >
                <Text style={[s.ruleNum, { color: c.primary }]}>Rule {i+1}</Text>
                <Text style={[s.optionLabel, { color: c.text, flex: 1 }]}>{rule.text}</Text>
                {selectedRuleId === rule.id && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setStep('details')} disabled={!selectedRuleId}
              style={[s.btn, { backgroundColor: selectedRuleId ? c.primary : c.primaryLt, marginTop: 12 }]}>
              <Text style={s.btnText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Step 3: Details */}
        {step === 'details' && (
          <>
            <View style={[s.summary, { backgroundColor: c.primaryBg, borderColor: c.primaryLt }]}>
              <Text style={[s.summaryLabel, { color: c.textMuted }]}>Reporting for</Text>
              <Text style={[s.summaryValue, { color: c.primary }]}>
                {VIOLATION_TYPES.find(v => v.value === violationType)?.label}
              </Text>
              {selectedRuleId && rules.find((r: any) => r.id === selectedRuleId) && (
                <Text style={[s.summaryRule, { color: c.textMuted }]} numberOfLines={2}>
                  {rules.find((r: any) => r.id === selectedRuleId)?.text}
                </Text>
              )}
            </View>
            <Text style={[s.label, { color: c.textMd }]}>Additional details <Text style={{ color: c.textMuted, fontWeight: '400' }}>(optional)</Text></Text>
            <TextInput
              style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
              multiline
              numberOfLines={4}
              placeholder="Provide any context that might help our moderators…"
              placeholderTextColor={c.textLight}
              value={details}
              onChangeText={setDetails}
              textAlignVertical="top"
            />
            <TouchableOpacity onPress={() => report.mutate()} disabled={report.isPending}
              style={[s.btn, { backgroundColor: '#ef4444', marginTop: 8 }]}>
              {report.isPending ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Submit report</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  stepTitle:    { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  stepSub:      { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  option:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  optionLabel:  { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  optionDesc:   { fontSize: 12, lineHeight: 17 },
  ruleNum:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4, flexShrink: 0 },
  summary:      { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 20 },
  summaryLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryRule:  { fontSize: 13, marginTop: 4, lineHeight: 18 },
  label:        { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input:        { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 100, marginBottom: 12 },
  btn:          { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:      { color: 'white', fontWeight: '700', fontSize: 16 },
})
