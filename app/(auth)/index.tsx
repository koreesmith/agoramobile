import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { authApi } from '../../api'

export default function LoginScreen() {
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
    } finally {
      setLoading(false)
    }
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-gray-950"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          {/* Logo / title */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-indigo-600 items-center justify-center mb-4">
              <Text className="text-white text-3xl font-bold">A</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              {step === 'credentials' && instanceName ? instanceName : 'Agora'}
            </Text>
            <Text className="text-gray-500 mt-1 text-center">
              {step === 'instance' ? 'Enter your instance URL to get started' : `Sign in to ${instanceName}`}
            </Text>
          </View>

          {step === 'instance' ? (
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Instance URL</Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
                  placeholder="https://your-instance.social"
                  placeholderTextColor="#9ca3af"
                  value={instanceUrl}
                  onChangeText={setInstanceUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={checkInstance}
                />
              </View>
              <TouchableOpacity
                className={`rounded-xl py-3.5 items-center ${loading ? 'bg-indigo-400' : 'bg-indigo-600'}`}
                onPress={checkInstance}
                disabled={loading || !instanceUrl.trim()}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
                  placeholder="your_username"
                  placeholderTextColor="#9ca3af"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="go"
                  onSubmitEditing={login}
                />
              </View>
              <TouchableOpacity
                className={`rounded-xl py-3.5 items-center ${loading ? 'bg-indigo-400' : 'bg-indigo-600'}`}
                onPress={login}
                disabled={loading || !username.trim() || !password.trim()}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">Sign in</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep('instance')} className="items-center py-2">
                <Text className="text-indigo-600 text-sm">← Change instance</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
