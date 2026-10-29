import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import axios from 'axios'
import { usersApi } from '../api'
import type { Account } from '../store/auth'

// AMOBILE-194 (Option B): the device only ever keeps its Expo push token
// registered with the CURRENTLY ACTIVE account. Every push the device
// receives therefore belongs to whoever is active; background accounts stay
// quiet until switched to. This avoids any server-side change for Phase 1.

// Register this device's Expo push token with the active account. Runs
// through the shared api instance, which is already pointed at the active
// account by the request interceptor.
export async function registerActivePush(activeAccountId: string | null): Promise<void> {
  if (!Device.isDevice || !activeAccountId) return
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      })
      finalStatus = status
    }
    if (finalStatus !== 'granted') return
    const token = (await Notifications.getExpoPushTokenAsync()).data
    await usersApi.updateProfile({ expo_push_token: token })
  } catch {}
}

// Best-effort: drop the token from an account we are leaving so its server
// stops pushing to this device. Talks to that account directly rather than
// through the shared api instance, which by now points at the new active
// account.
//
// NOTE: sends an empty string. If the backend rejects clearing the token
// this way, the fix is a one-line server change to accept "" / null on
// expo_push_token; do not add a recipient-identifier field here (that
// belongs with the deferred unified-notification work).
export async function clearPushForAccount(account: Account | null | undefined): Promise<void> {
  if (!account) return
  try {
    await axios.patch(
      `${account.instanceUrl}/api/users/me`,
      { expo_push_token: '' },
      { headers: { Authorization: `Bearer ${account.token}` } },
    )
  } catch {}
}
