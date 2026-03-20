import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { useAuthStore } from '../../store/auth'

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) router.replace('/(tabs)')
  }, [isAuthenticated])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
    </Stack>
  )
}
