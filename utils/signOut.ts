import { Alert } from 'react-native'
import { useAuthStore } from '../store/auth'
import { clearPushForAccount } from './push'

// AMOBILE-193: the shared "Sign out" prompt used by the Profile header and
// Settings. With one account it is the plain confirm it always was; with
// several it offers signing out of just the active account or all of them.
export function promptSignOut() {
  const { accounts, activeAccountId, signOutActive, logout } = useAuthStore.getState()
  const active = accounts.find((a) => a.id === activeAccountId)

  if (accounts.length <= 1) {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { if (active) clearPushForAccount(active); logout() } },
    ])
    return
  }

  Alert.alert('Sign out', undefined, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: `Sign out of @${active?.user.username}`,
      style: 'destructive',
      onPress: () => { if (active) clearPushForAccount(active); signOutActive() },
    },
    {
      text: 'Sign out of all accounts',
      style: 'destructive',
      onPress: () => { accounts.forEach(clearPushForAccount); logout() },
    },
  ])
}
