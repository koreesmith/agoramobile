import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { authApi } from '../../api'
import { useC } from '../../constants/ColorContext'

export default function RegisterScreen() {
  const c = useC()
  const { instanceUrl, instanceName } = useLocalSearchParams<{ instanceUrl: string; instanceName: string }>()

  const [username, setUsername]       = useState('')
  const [email, setEmail]             = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword]       = useState('')
  const [password2, setPassword2]     = useState('')
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState<'verify' | 'waitlist' | null>(null)

  const submit = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all required fields.'); return
    }
    if (password !== password2) {
      Alert.alert('Passwords do not match'); return
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.'); return
    }
    setLoading(true)
    try {
      const res = await authApi.registerWithUrl(instanceUrl, {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName.trim() || username.trim(),
      })
      if (res.data?.message === 'waitlist') {
        setDone('waitlist')
      } else {
        setDone('verify')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Registration failed. Please try again.'
      Alert.alert('Registration failed', msg)
    } finally { setLoading(false) }
  }

  // Success — waitlist state
  if (done === 'waitlist') return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={styles.successBox}>
        <Text style={styles.successIcon}>⏳</Text>
        <Text style={[styles.successTitle, { color: c.text }]}>You're on the waitlist!</Text>
        <Text style={[styles.successBody, { color: c.textMuted }]}>
          Your account on <Text style={{ fontWeight: '600' }}>{instanceName}</Text> has been created and is waiting for approval.{'\n\n'}
          We've sent you a confirmation email. Once an admin approves your account, you'll receive an invite link to complete your sign-in.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)')}>
          <Text style={styles.btnText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  // Success — email verification state
  if (done === 'verify') return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={styles.successBox}>
        <Text style={styles.successIcon}>📬</Text>
        <Text style={[styles.successTitle, { color: c.text }]}>Check your email!</Text>
        <Text style={[styles.successBody, { color: c.textMuted }]}>
          We sent a verification link to <Text style={{ fontWeight: '600' }}>{email}</Text>.{'\n\n'}
          Click the link in the email to activate your account, then come back here to sign in.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)')}>
          <Text style={styles.btnText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={{ color: c.primary, fontSize: 16 }}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: c.text }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              Joining <Text style={{ fontWeight: '600', color: c.primary }}>{instanceName}</Text>
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={[styles.label, { color: c.textMd }]}>Username <Text style={{ color: c.red }}>*</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              placeholder="your_username"
              placeholderTextColor={c.textLight}
              value={username}
              onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <Text style={[styles.hint, { color: c.textLight }]}>Letters, numbers, underscores, hyphens only</Text>

            <Text style={[styles.label, { color: c.textMd, marginTop: 14 }]}>Display name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              placeholder="Your Name"
              placeholderTextColor={c.textLight}
              value={displayName}
              onChangeText={setDisplayName}
              returnKeyType="next"
            />

            <Text style={[styles.label, { color: c.textMd, marginTop: 14 }]}>Email <Text style={{ color: c.red }}>*</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              placeholder="you@example.com"
              placeholderTextColor={c.textLight}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
            />

            <Text style={[styles.label, { color: c.textMd, marginTop: 14 }]}>Password <Text style={{ color: c.red }}>*</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              placeholder="At least 8 characters"
              placeholderTextColor={c.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
            />

            <Text style={[styles.label, { color: c.textMd, marginTop: 14 }]}>Confirm password <Text style={{ color: c.red }}>*</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              placeholder="Repeat your password"
              placeholderTextColor={c.textLight}
              value={password2}
              onChangeText={setPassword2}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <TouchableOpacity
              style={[styles.btn, (loading || !username.trim() || !email.trim() || !password.trim()) && { backgroundColor: c.primaryLt }]}
              onPress={submit}
              disabled={loading || !username.trim() || !email.trim() || !password.trim()}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.btnText}>Create account</Text>
              }
            </TouchableOpacity>

            <Text style={[styles.legal, { color: c.textLight }]}>
              By creating an account you agree to the{' '}
              <Text style={{ color: c.primary }}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={{ color: c.primary }}>Privacy Policy</Text>
              {' '}of {instanceName}.
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, paddingHorizontal: 24, paddingVertical: 48 },
  header:       { marginBottom: 32 },
  backBtn:      { marginBottom: 16 },
  title:        { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle:     { fontSize: 15 },
  form:         { gap: 2 },
  label:        { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  hint:         { fontSize: 12, marginTop: 4, marginBottom: 2 },
  input:        { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16 },
  btn:          { backgroundColor: '#486581', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnText:      { color: 'white', fontWeight: '700', fontSize: 16 },
  legal:        { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  successBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successIcon:  { fontSize: 56, marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  successBody:  { fontSize: 15, lineHeight: 24, textAlign: 'center', marginBottom: 32 },
})
