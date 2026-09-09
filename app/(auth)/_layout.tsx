import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { useAuthStore } from '../../store/auth'

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore()
  const addingAccount = useAuthStore((s) => s.addingAccount)

  // AMOBILE-191: when adding another account the user is already
  // authenticated, so the usual "bounce an authed user to the tabs" guard
  // has to stand down until that trip through the (auth) stack finishes.
  useEffect(() => {
    if (isAuthenticated && !addingAccount) router.replace('/(tabs)')
  }, [isAuthenticated, addingAccount])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
    </Stack>
  )
}
