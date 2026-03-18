import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { authApi } from '../../api'
import { useC } from '../../constants/ColorContext'

export default function LoginScreen() {
  const c = useC()
  const { setAuth } = useAuthStore()
  const [instanceUrl, setInstanceUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'instance' | 'credentials'>('instance')
  const [instanceName, setInstanceName] = useState('')

  const checkInstance = async () => {
    const url = instanceUrl.trim().replace(/\/$/, '')
    if (!url) return
    setLoading(true)
    try {
      const res = await authApi.instance(url)
      setInstanceName(res.data.instance_name || url)
      setInstanceUrl(url)
      setStep('credentials')
    } catch {
      Alert.alert('Cannot connect', 'Could not reach that instance. Check the URL and try again.')
    } finally { setLoading(false) }
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
      const msg = err?.response?.data?.error || 'Login failed. Check your credentials.'
      Alert.alert('Login failed', msg)
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f9fafb' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.container}>
          <View style={s.logoWrap}>
            <View style={s.logo}><Text style={s.logoText}>A</Text></View>
            <Text style={s.title}>{step === 'credentials' && instanceName ? instanceName : 'Agora'}</Text>
            <Text style={s.subtitle}>{step === 'instance' ? 'Enter your instance URL to get started' : `Sign in to ${instanceName}`}</Text>
          </View>

          {step === 'instance' ? (
            <View style={s.form}>
              <Text style={s.label}>Instance URL</Text>
              <TextInput style={s.input} placeholder="https://your-instance.social" placeholderTextColor="#9ca3af"
                value={instanceUrl} onChangeText={setInstanceUrl} autoCapitalize="none" autoCorrect={false}
                keyboardType="url" returnKeyType="go" onSubmitEditing={checkInstance} />
              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={checkInstance} disabled={loading || !instanceUrl.trim()}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Continue</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.form}>
              <Text style={s.label}>Username</Text>
              <TextInput style={s.input} placeholder="your_username" placeholderTextColor="#9ca3af"
                value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
              <Text style={[s.label, { marginTop: 12 }]}>Password</Text>
              <TextInput style={s.input} placeholder="••••••••" placeholderTextColor="#9ca3af"
                value={password} onChangeText={setPassword} secureTextEntry returnKeyType="go" onSubmitEditing={login} />
              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={login} disabled={loading || !username.trim() || !password.trim()}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Sign in</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep('instance')} style={s.backBtn}>
                <Text style={{ color: c.primary, fontSize: 14 }}>← Change instance</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#486581', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subtitle: { color: '#6b7280', marginTop: 4, textAlign: 'center', fontSize: 14 },
  form: { gap: 4 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827', backgroundColor: 'white', marginBottom: 4 },
  btn: { backgroundColor: '#486581', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#9fb3c8' },
  btnText: { color: 'white', fontWeight: '600', fontSize: 16 },
  backBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
})

