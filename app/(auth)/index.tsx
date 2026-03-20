import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StyleSheet, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { authApi } from '../../api'
import { useC } from '../../constants/ColorContext'

const FEATURED_INSTANCES = [
  {
    url: 'https://ameth.social',
    name: 'Ameth Social',
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
                    <Text style={{ fontSize: 28 }}>{inst.emoji}</Text>
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
                    <Text style={{ color: '#829ab1', fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
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
              <TouchableOpacity onPress={() => { setStep('instance'); setShowCustomUrl(false) }} style={s.backBtn}>
                <Text style={{ color: '#486581', fontSize: 14 }}>← Change server</Text>
              </TouchableOpacity>
              {/* Sign up link */}
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(auth)/register', params: { instanceUrl, instanceName } })}
                style={{ alignItems: 'center', paddingVertical: 4 }}
              >
                <Text style={{ color: '#829ab1', fontSize: 14 }}>
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
  title:           { fontSize: 26, fontWeight: '800', color: '#102a43' },
  subtitle:        { color: '#829ab1', marginTop: 4, textAlign: 'center', fontSize: 14 },

  sectionLabel:    { fontSize: 11, fontWeight: '600', color: '#829ab1', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },

  instanceCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#d9e2ec', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  instanceEmoji:   { width: 52, height: 52, borderRadius: 14, backgroundColor: '#f0f4f8', alignItems: 'center', justifyContent: 'center' },
  instanceName:    { fontSize: 16, fontWeight: '700', color: '#102a43', marginBottom: 2 },
  instanceDesc:    { fontSize: 13, color: '#627d98', marginBottom: 2 },
  instanceUrl:     { fontSize: 11, color: '#9fb3c8' },

  divider:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: '#d9e2ec' },
  dividerText:     { fontSize: 13, color: '#9fb3c8', fontWeight: '500' },

  customBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#d9e2ec', backgroundColor: '#fff' },
  customBtnText:   { fontSize: 15, fontWeight: '600', color: '#486581' },
  customUrlWrap:   { gap: 4 },

  form:            { gap: 4 },
  label:           { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:           { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827', backgroundColor: 'white', marginBottom: 4 },
  btn:             { backgroundColor: '#486581', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled:     { backgroundColor: '#9fb3c8' },
  btnText:         { color: 'white', fontWeight: '600', fontSize: 16 },
  backBtn:         { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  signupBtn:       { borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  signupBtnText:   { fontSize: 15, fontWeight: '600', color: '#486581' },

  waitlistBanner:  { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 10, padding: 12, marginBottom: 12 },
  waitlistTitle:   { fontSize: 13, color: '#92400e', fontWeight: '600', marginBottom: 2 },
  waitlistBody:    { fontSize: 12, color: '#b45309', lineHeight: 18 },
})


