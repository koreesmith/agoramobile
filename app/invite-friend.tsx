import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { Stack } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../components/ui'
import { inviteApi } from '../api'
import { useC } from '../constants/ColorContext'

export default function InviteFriendScreen() {
  const c = useC()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string[]>([])

  const send = useMutation({
    mutationFn: () => inviteApi.send(email.trim()),
    onSuccess: () => {
      setSent(s => [...s, email.trim()])
      setEmail('')
    },
    onError: (e: any) => {
      Alert.alert('Could not send invite', e.response?.data?.error || 'Please try again.')
    },
  })

  const handleSend = () => {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.')
      return
    }
    send.mutate()
  }

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: 'Invite a Friend',
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

        {/* Icon + heading */}
        <View style={[s.iconWrap, { backgroundColor: c.primaryBg }]}>
          <Ionicons name="mail" size={32} color={c.primary} />
        </View>
        <Text style={[s.heading, { color: c.text }]}>Invite someone you know</Text>
        <Text style={[s.subheading, { color: c.textMuted }]}>
          We'll send them a personalised invitation with your name on it.
        </Text>

        {/* Input */}
        <Text style={[s.label, { color: c.textMd }]}>Friend's email address</Text>
        <TextInput
          style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
          placeholder="friend@example.com"
          placeholderTextColor={c.textLight}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        <TouchableOpacity
          style={[s.btn, { backgroundColor: !email.trim() || send.isPending ? c.primaryLt : c.primary }]}
          onPress={handleSend}
          disabled={!email.trim() || send.isPending}
        >
          {send.isPending
            ? <ActivityIndicator color="white" />
            : <>
                <Ionicons name="send" size={16} color="white" />
                <Text style={s.btnText}>Send invitation</Text>
              </>
          }
        </TouchableOpacity>

        {/* Sent list */}
        {sent.length > 0 && (
          <View style={[s.sentBox, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[s.sentTitle, { color: c.primary }]}>Invitations sent ✓</Text>
            {sent.map(e => (
              <View key={e} style={s.sentRow}>
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={[s.sentEmail, { color: c.textMd }]}>{e}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={[s.disclaimer, { backgroundColor: c.bg, borderColor: c.border }]}>
          <Text style={[s.disclaimerText, { color: c.textMuted }]}>
            Your friend will receive an email letting them know you invited them. They can choose to sign up or ignore it — no account will be created without their action.
          </Text>
        </View>

      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  iconWrap:       { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  heading:        { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subheading:     { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  label:          { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input:          { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 14 },
  btn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginBottom: 20 },
  btnText:        { color: 'white', fontWeight: '600', fontSize: 16 },
  sentBox:        { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16, gap: 8 },
  sentTitle:      { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  sentRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sentEmail:      { fontSize: 13 },
  disclaimer:     { borderWidth: 1, borderRadius: 12, padding: 14 },
  disclaimerText: { fontSize: 12, lineHeight: 18 },
})
