import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StyleSheet, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { authApi } from '../../api'
import { useC } from '../../constants/ColorContext'

const FEATURED_INSTANCES = [
  {
    url: 'https://agorasocial.online',
    name: 'Agora Social',
    description: 'The original Agora instance',
    emoji: '🏛️',
  },
  // Add more instances here as the network grows
]

export default function LoginScreen() {
  const c = useC()
  const { setAuth } = useAuthStore()
  const [instanceUrl, setInstanceUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'instance' | 'credentials'>('instance')
  const [instanceName, setInstanceName] = useState('')
  const [regMode, setRegMode] = useState('')
  const [showCustomUrl, setShowCustomUrl] = useState(false)

  // AMOBILE-184: forgot/reset password. 'request' collects an email and
  // calls forgot-password; 'reset' collects the emailed token (or the full
  // link, since there's no in-app link handoff yet) plus a new password.
  const [authMode, setAuthMode] = useState<'credentials' | 'forgot-request' | 'forgot-sent' | 'forgot-reset'>('credentials')
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetPassword, setResetPassword] = useState('')

  const selectInstance = async (url: string) => {
    setInstanceUrl(url)
    setLoading(true)
    try {
      const res = await authApi.instance(url)
      setInstanceName(res.data.instance_name || url)
      setRegMode(res.data.registration_mode || 'open')
      setStep('credentials')
    } catch {
      Alert.alert('Cannot connect', 'Could not reach that instance. Check the URL and try again.')
    } finally { setLoading(false) }
  }

  const checkInstance = async () => {
    const url = instanceUrl.trim().replace(/\/$/, '')
    if (!url) return
    const normalized = url.startsWith('http') ? url : `https://${url}`
    await selectInstance(normalized)
  }

  const login = async () => {
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    try {
      const res = await authApi.login(instanceUrl, username.trim(), password)
      const me = await authApi.meWithUrl(instanceUrl, res.data.token)
      await setAuth(me.data, res.data.token, instanceUrl)
      router.replace('/(tabs)')
    } catch (err: any) {
      const raw = err?.response?.data?.error || 'Login failed. Check your credentials.'
      const msg = raw.startsWith('waitlist')
        ? "Your account is on the waitlist and hasn't been approved yet. You'll receive an email with a login link when you're approved."
        : raw
      Alert.alert('Login failed', msg)
    } finally { setLoading(false) }
  }

  const sendResetEmail = async () => {
    const email = forgotEmail.trim()
    if (!email) return
    setLoading(true)
    try {
      await authApi.forgotPasswordWithUrl(instanceUrl, email)
    } catch {
      // Same message either way - the endpoint never reveals whether the
      // email is registered.
    } finally {
      setLoading(false)
      setAuthMode('forgot-sent')
    }
  }

  const submitReset = async () => {
    const raw = resetToken.trim()
    if (!raw || resetPassword.length < 8) return
    // Accept either the bare token or the full emailed link.
    const token = raw.includes('token=') ? raw.split('token=').pop()!.split('&')[0] : raw
    setLoading(true)
    try {
      await authApi.resetPasswordWithUrl(instanceUrl, token, resetPassword)
      Alert.alert('Password reset', 'Your password has been reset. Sign in with your new password.')
      setAuthMode('credentials')
      setForgotEmail(''); setResetToken(''); setResetPassword('')
    } catch (err: any) {
      Alert.alert('Reset failed', err?.response?.data?.error || 'That reset link is invalid or has expired.')
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f0f4f8' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.container}>

          {/* Logo */}
          <View style={s.logoWrap}>
            <Image source={require('../../assets/icon.png')} style={s.logo} resizeMode="contain" />
            <Text style={s.title}>
              {step === 'credentials' && instanceName ? instanceName : 'Agora'}
            </Text>
            <Text style={s.subtitle}>
              {step === 'instance'
                ? 'Choose your community to get started'
                : authMode === 'forgot-request' ? 'Enter your email to get a reset link'
                : authMode === 'forgot-sent' ? 'Check your email'
                : authMode === 'forgot-reset' ? 'Set a new password'
                : `Sign in to ${instanceName}`}
            </Text>
          </View>

          {step === 'instance' ? (
            <View>
              {/* Featured instances */}
              <Text style={s.sectionLabel}>Communities</Text>
              {FEATURED_INSTANCES.map(inst => (
                <TouchableOpacity
                  key={inst.url}
                  style={s.instanceCard}
                  onPress={() => selectInstance(inst.url)}
                  disabled={loading}
                  activeOpacity={0.75}
                >
                  <View style={s.instanceEmoji}>
                    <Text style={{ fontSize: 31 }}>{inst.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.instanceName}>{inst.name}</Text>
                    <Text style={s.instanceDesc}>{inst.description}</Text>
                    <Text style={s.instanceUrl}>{inst.url.replace('https://', '')}</Text>
                  </View>
                  {loading
                    ? <ActivityIndicator size="small" color="#486581" />
                    : <Ionicons name="chevron-forward" size={18} color="#9fb3c8" />
                  }
                </TouchableOpacity>
              ))}

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>

              {/* Custom URL toggle */}
              {!showCustomUrl ? (
                <TouchableOpacity
                  style={s.customBtn}
                  onPress={() => setShowCustomUrl(true)}
                >
                  <Ionicons name="globe-outline" size={18} color="#486581" />
                  <Text style={s.customBtnText}>Use a different server</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.customUrlWrap}>
                  <Text style={s.label}>Server URL</Text>
                  <TextInput
                    style={s.input}
                    placeholder="your-instance.social"
                    placeholderTextColor="#9ca3af"
                    value={instanceUrl}
                    onChangeText={setInstanceUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="go"
                    onSubmitEditing={checkInstance}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[s.btn, (loading || !instanceUrl.trim()) && s.btnDisabled]}
                    onPress={checkInstance}
                    disabled={loading || !instanceUrl.trim()}
                  >
                    {loading
                      ? <ActivityIndicator color="white" />
                      : <Text style={s.btnText}>Continue</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowCustomUrl(false); setInstanceUrl('') }} style={s.backBtn}>
                    <Text style={{ color: '#829ab1', fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : authMode === 'credentials' ? (
            <View style={s.form}>
              {regMode === 'waitlist' && (
                <View style={s.waitlistBanner}>
                  <Text style={s.waitlistTitle}>⏳ This instance uses a waitlist</Text>
                  <Text style={s.waitlistBody}>New accounts must be approved before you can sign in. Check your email for an approval link.</Text>
                </View>
              )}
              <Text style={s.label}>Username</Text>
              <TextInput style={s.input} placeholder="your_username" placeholderTextColor="#9ca3af"
                value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
              <Text style={[s.label, { marginTop: 12 }]}>Password</Text>
              <TextInput style={s.input} placeholder="••••••••" placeholderTextColor="#9ca3af"
                value={password} onChangeText={setPassword} secureTextEntry returnKeyType="go" onSubmitEditing={login} />
              <TouchableOpacity
                style={[s.btn, (loading || !username.trim() || !password.trim()) && s.btnDisabled]}
                onPress={login}
                disabled={loading || !username.trim() || !password.trim()}
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Sign in</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAuthMode('forgot-request')} style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: '#486581', fontSize: 16 }}>Forgot password?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/explore', params: { instanceUrl, instanceName } })}
                style={{ alignItems: 'center', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              >
                <Ionicons name="compass-outline" size={16} color="#486581" />
                <Text style={{ color: '#486581', fontSize: 16, fontWeight: '600' }}>Explore public posts</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setStep('instance'); setShowCustomUrl(false) }} style={s.backBtn}>
                <Text style={{ color: '#486581', fontSize: 16 }}>← Change server</Text>
              </TouchableOpacity>
              {/* Sign up link */}
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(auth)/register', params: { instanceUrl, instanceName } })}
                style={{ alignItems: 'center', paddingVertical: 4 }}
              >
                <Text style={{ color: '#829ab1', fontSize: 16 }}>
                  Don't have an account?{' '}
                  <Text style={{ color: '#486581', fontWeight: '600' }}>Sign up</Text>
                </Text>
              </TouchableOpacity>
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>
              <TouchableOpacity
                style={s.signupBtn}
                onPress={() => router.push({ pathname: '/(auth)/register', params: { instanceUrl, instanceName } })}
              >
                <Text style={s.signupBtnText}>Create an account</Text>
              </TouchableOpacity>
            </View>
          ) : authMode === 'forgot-request' ? (
            <View style={s.form}>
              <Text style={s.label}>Email address</Text>
              <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor="#9ca3af"
                value={forgotEmail} onChangeText={setForgotEmail} autoCapitalize="none" autoCorrect={false}
                keyboardType="email-address" returnKeyType="go" onSubmitEditing={sendResetEmail} autoFocus />
              <TouchableOpacity
                style={[s.btn, (loading || !forgotEmail.trim()) && s.btnDisabled]}
                onPress={sendResetEmail}
                disabled={loading || !forgotEmail.trim()}
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Send reset link</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAuthMode('forgot-reset')} style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: '#486581', fontSize: 16 }}>Already have a reset link?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAuthMode('credentials')} style={s.backBtn}>
                <Text style={{ color: '#486581', fontSize: 16 }}>← Back to sign in</Text>
              </TouchableOpacity>
            </View>
          ) : authMode === 'forgot-sent' ? (
            <View style={s.form}>
              <Text style={{ fontSize: 16, color: '#374151', lineHeight: 22 }}>
                If that email is registered, a reset link has been sent to it. Open the
                link in a browser on this device, then come back and paste it below.
              </Text>
              <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={() => setAuthMode('forgot-reset')}>
                <Text style={s.btnText}>I have the link</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAuthMode('credentials')} style={s.backBtn}>
                <Text style={{ color: '#486581', fontSize: 16 }}>← Back to sign in</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.form}>
              <Text style={s.label}>Reset link or code</Text>
              <TextInput style={s.input} placeholder="Paste the link or code from your email" placeholderTextColor="#9ca3af"
                value={resetToken} onChangeText={setResetToken} autoCapitalize="none" autoCorrect={false} />
              <Text style={[s.label, { marginTop: 12 }]}>New password</Text>
              <TextInput style={s.input} placeholder="At least 8 characters" placeholderTextColor="#9ca3af"
                value={resetPassword} onChangeText={setResetPassword} secureTextEntry returnKeyType="go" onSubmitEditing={submitReset} />
              <TouchableOpacity
                style={[s.btn, (loading || !resetToken.trim() || resetPassword.length < 8) && s.btnDisabled]}
                onPress={submitReset}
                disabled={loading || !resetToken.trim() || resetPassword.length < 8}
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Reset password</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAuthMode('credentials')} style={s.backBtn}>
                <Text style={{ color: '#486581', fontSize: 16 }}>← Back to sign in</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 56 },
  logoWrap:        { alignItems: 'center', marginBottom: 36 },
  logo:            { width: 72, height: 72, borderRadius: 18, marginBottom: 16 },
  title:           { fontSize: 29, fontWeight: '800', color: '#102a43' },
  subtitle:        { color: '#829ab1', marginTop: 4, textAlign: 'center', fontSize: 16 },

  sectionLabel:    { fontSize: 12, fontWeight: '600', color: '#829ab1', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },

  instanceCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#d9e2ec', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  instanceEmoji:   { width: 52, height: 52, borderRadius: 14, backgroundColor: '#f0f4f8', alignItems: 'center', justifyContent: 'center' },
  instanceName:    { fontSize: 18, fontWeight: '700', color: '#102a43', marginBottom: 2 },
  instanceDesc:    { fontSize: 15, color: '#627d98', marginBottom: 2 },
  instanceUrl:     { fontSize: 12, color: '#9fb3c8' },

  divider:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: '#d9e2ec' },
  dividerText:     { fontSize: 15, color: '#9fb3c8', fontWeight: '500' },

  customBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#d9e2ec', backgroundColor: '#fff' },
  customBtnText:   { fontSize: 17, fontWeight: '600', color: '#486581' },
  customUrlWrap:   { gap: 4 },

  form:            { gap: 4 },
  label:           { fontSize: 16, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:           { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 18, color: '#111827', backgroundColor: 'white', marginBottom: 4 },
  btn:             { backgroundColor: '#486581', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled:     { backgroundColor: '#9fb3c8' },
  btnText:         { color: 'white', fontWeight: '600', fontSize: 18 },
  backBtn:         { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  signupBtn:       { borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  signupBtnText:   { fontSize: 17, fontWeight: '600', color: '#486581' },

  waitlistBanner:  { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 10, padding: 12, marginBottom: 12 },
  waitlistTitle:   { fontSize: 15, color: '#92400e', fontWeight: '600', marginBottom: 2 },
  waitlistBody:    { fontSize: 13, color: '#b45309', lineHeight: 18 },
})


