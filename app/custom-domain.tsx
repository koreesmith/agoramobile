import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner } from '../components/ui'
import { customDomainApi } from '../api'
import { useC } from '../constants/ColorContext'

// AMOBILE-183, mirroring web's CustomDomainPanel (AGORA-284). The DNS record
// and well-known file contents are rendered from what the server sends
// rather than assembled here, same reasoning as web: the server is what will
// actually go looking for them.
export default function CustomDomainScreen() {
  const c = useC()
  const qc = useQueryClient()
  const [domain, setDomain] = useState('')
  const [err, setErr] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['custom-domain'],
    queryFn: () => customDomainApi.get().then(r => r.data),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['custom-domain'] })
  const fail = (e: any) => setErr(e.response?.data?.error || 'Something went wrong')

  const claim = useMutation({
    mutationFn: () => customDomainApi.claim(domain.trim()),
    onSuccess: () => { setDomain(''); setErr(''); refresh() },
    onError: fail,
  })

  const verify = useMutation({
    mutationFn: () => customDomainApi.verify(),
    onSuccess: () => { setErr(''); refresh() },
    onError: fail,
  })

  const release = useMutation({
    mutationFn: () => customDomainApi.release(),
    onSuccess: () => { setErr(''); refresh() },
    onError: fail,
  })

  const claimed = data?.claim
  const inst = data?.instructions

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true, headerTitle: 'Custom Domain', headerBackTitle: 'Settings',
        headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary,
      }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {isLoading ? <Spinner /> : data?.available === false ? (
          <View>
            <Text style={[s.title, { color: c.text }]}>Custom domain</Text>
            <Text style={[s.body, { color: c.textMuted, marginTop: 8 }]}>{data.unavailable_reason}</Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View>
              <Text style={[s.title, { color: c.text }]}>Custom domain</Text>
              <Text style={[s.body, { color: c.textMuted, marginTop: 6 }]}>
                Use a domain you own as your handle on Bluesky and the wider AT Protocol network, so people find you
                as @your-domain.example instead of @{data?.fallback_handle}. Your account, posts, and followers are
                unaffected either way; this only changes the name people see and search for.
              </Text>
            </View>

            <View style={[s.infoBox, { backgroundColor: c.bg }]}>
              <Ionicons name="globe-outline" size={16} color={c.textMuted} />
              <Text style={[s.body, { color: c.text }]}>
                Your handle right now: <Text style={{ fontWeight: '600' }}>{data?.current_handle}</Text>
              </Text>
            </View>

            {!!err && (
              <View style={[s.errorBox]}>
                <Text style={{ color: '#b91c1c', fontSize: 14 }}>{err}</Text>
              </View>
            )}

            {!claimed && (
              <View style={{ gap: 8 }}>
                <Text style={[s.label, { color: c.textMuted }]}>Domain</Text>
                <TextInput
                  style={[s.input, { backgroundColor: c.card, color: c.text, borderColor: c.border }]}
                  placeholder="example.com"
                  placeholderTextColor={c.textLight}
                  value={domain}
                  onChangeText={setDomain}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <TouchableOpacity
                  onPress={() => claim.mutate()}
                  disabled={claim.isPending || !domain.trim()}
                  style={[s.btn, { backgroundColor: (!domain.trim() || claim.isPending) ? c.primaryLt : c.primary }]}
                >
                  <Text style={s.btnText}>{claim.isPending ? 'Saving…' : 'Continue'}</Text>
                </TouchableOpacity>
                <Text style={[s.hint, { color: c.textLight }]}>
                  Enter the domain itself, not a URL. You'll get a record to add at your DNS provider on the next
                  step, nothing changes until you've added it and it verifies.
                </Text>
              </View>
            )}

            {claimed && (
              <View style={{ gap: 16 }}>
                <StatusBanner claim={claimed} approvalMode={data?.approval_mode} c={c} />

                {claimed.approval_status !== 'rejected' && inst && (
                  <View style={{ gap: 12 }}>
                    <Text style={[s.body, { color: c.textMuted }]}>
                      Add either one of these at your DNS provider or web host to prove you own {claimed.domain}. The
                      DNS record is the usual choice; the file is there for hosts that don't let you edit DNS. Long
                      press any value below to select and copy it.
                    </Text>

                    <View style={[s.recordCard, { borderColor: c.border }]}>
                      <Text style={[s.recordLabel, { color: c.textMuted }]}>OPTION 1 · DNS RECORD</Text>
                      <Field label="Type" value={inst.dns_record_type} c={c} />
                      <Field label="Name" value={inst.dns_record_name} c={c} />
                      <Field label="Value" value={inst.dns_record_value} c={c} />
                      <Text style={[s.hint, { color: c.textLight }]}>
                        Some providers append the domain to the name automatically, if yours does, enter just
                        _atproto. DNS changes can take a few minutes to an hour to spread.
                      </Text>
                    </View>

                    <View style={[s.recordCard, { borderColor: c.border }]}>
                      <Text style={[s.recordLabel, { color: c.textMuted }]}>OPTION 2 · FILE ON YOUR SITE</Text>
                      <Field label="URL" value={inst.well_known_url} c={c} />
                      <Field label="Contents" value={inst.well_known_content} c={c} />
                      <Text style={[s.hint, { color: c.textLight }]}>
                        Must be served over HTTPS, return the text above and nothing else, and not redirect anywhere.
                      </Text>
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  {claimed.approval_status !== 'rejected' && (
                    <TouchableOpacity
                      onPress={() => verify.mutate()}
                      disabled={verify.isPending}
                      style={[s.btn, { backgroundColor: c.primary, flex: 1 }]}
                    >
                      <Text style={s.btnText}>{verify.isPending ? 'Checking…' : 'Check verification'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => Alert.alert(
                      claimed.approval_status === 'rejected' ? 'Try a different domain?' : 'Remove domain?',
                      `Your handle goes back to ${data?.fallback_handle}.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => release.mutate() },
                      ],
                    )}
                    disabled={release.isPending}
                    style={[s.btn, { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, flex: 1 }]}
                  >
                    <Text style={{ color: c.textMd, fontWeight: '600', fontSize: 15 }}>
                      {claimed.approval_status === 'rejected' ? 'Try a different domain' : 'Remove domain'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

function Field({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <Text style={{ fontSize: 12, color: c.textMuted, width: 56 }}>{label}</Text>
      <Text selectable style={[s.code, { backgroundColor: c.bg, color: c.text }]}>{value}</Text>
    </View>
  )
}

function StatusBanner({ claim, approvalMode, c }: { claim: any; approvalMode?: string; c: any }) {
  const tones: Record<string, { bg: string; fg: string; icon: any }> = {
    ok:   { bg: '#dcfce7', fg: '#15803d', icon: 'checkmark-circle' },
    wait: { bg: '#fef3c7', fg: '#92400e', icon: 'time-outline' },
    bad:  { bg: '#fee2e2', fg: '#b91c1c', icon: 'alert-circle-outline' },
  }

  let tone: 'ok' | 'wait' | 'bad' = 'wait'
  let text = ''

  if (claim.live) {
    tone = 'ok'
    text = `${claim.domain} is verified and live, it's your handle on Bluesky now. ` +
      (claim.verification_method === 'well-known'
        ? 'Keep the file in place, we re-check it periodically.'
        : 'Keep the DNS record in place, we re-check it periodically.')
  } else if (claim.approval_status === 'rejected') {
    tone = 'bad'
    text = `Your request for ${claim.domain} was declined by an administrator.` +
      (claim.rejection_reason ? ` Reason: ${claim.rejection_reason}` : '')
  } else if (claim.verification_status === 'verified') {
    tone = 'wait'
    text = `${claim.domain} is verified and waiting for an administrator to approve it. ` +
      (approvalMode === 'manual' ? 'New domains on this instance are reviewed by hand. ' : '') +
      "You'll be notified either way."
  } else if (claim.verification_status === 'failed') {
    tone = 'bad'
    text = `We couldn't verify ${claim.domain} yet.` + (claim.last_error ? ` ${claim.last_error}` : '') +
      ' Add one of the records below, then check again, new DNS records often take a little while to spread.'
  } else {
    tone = 'wait'
    text = `${claim.domain} is claimed but not verified yet. Add one of the records below, then press Check verification.`
  }

  const t = tones[tone]
  return (
    <View style={[s.banner, { backgroundColor: t.bg }]}>
      <Ionicons name={t.icon} size={16} color={t.fg} style={{ marginTop: 1 }} />
      <Text style={{ color: t.fg, fontSize: 14, flex: 1, lineHeight: 19 }}>{text}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { fontSize: 12, lineHeight: 17 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600', fontSize: 15 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10 },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 10, padding: 10 },
  recordCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  recordLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  code: { flex: 1, fontSize: 12, fontFamily: 'monospace', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  banner: { flexDirection: 'row', gap: 8, borderRadius: 10, padding: 12 },
})
