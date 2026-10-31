import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import axios from 'axios'
import { usersApi } from '../api'
import type { Account } from '../store/auth'

// AMOBILE-194 (Option B): the device only ever keeps its Expo push token
// registered with the CURRENTLY ACTIVE account. Every push the device
// receives therefore belongs to whoever is active; background accounts stay
// quiet until switched to. This avoids any server-side change for Phase 1.

// AGORA-420: the token this device last registered, so leaving an account can
// unregister this device alone rather than every device on that account.
const PUSH_TOKEN_KEY = 'agora_push_token'

// AGORA-420: Android only shows a heads-up banner for a channel of high
// importance, and the channel a push lands on when it names none is "default".
// Left for the system to create, it came up at default importance, which files
// a notification away silently: the "banners only sometimes" half of the bug
// on Android. Must exist before the permission prompt on Android 13+.
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notifications',
    importance: Notifications.AndroidImportance.HIGH,
    showBadge: true,
  })
}

// Register this device's Expo push token with the active account. Runs
// through the shared api instance, which is already pointed at the active
// account by the request interceptor.
export async function registerActivePush(activeAccountId: string | null): Promise<void> {
  if (!Device.isDevice || !activeAccountId) return
  try {
    await ensureAndroidChannel()
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
    SecureStore.setItem(PUSH_TOKEN_KEY, token)
  } catch {}
}

// AGORA-420: the device token the push token listener last heard.
let lastDeviceToken: string | null = null

// Called by the push token listener. Only a token that actually changed is
// re-registered. The listener can't tell a rotation from an echo: on iOS every
// getExpoPushTokenAsync() asks APNs for the device token again and the answer
// fires the listener too, so re-registering on every event made each
// registration start the next one. On a real phone that loop ran nonstop and
// got the phone rate limited by the server, so nothing in the app loaded. The
// first event is one of our own registrations, already in progress.
export function devicePushTokenChanged(deviceToken: string, activeAccountId: string | null): void {
  if (deviceToken === lastDeviceToken) return
  const first = lastDeviceToken === null
  lastDeviceToken = deviceToken
  if (!first) registerActivePush(activeAccountId)
}

// Best-effort: drop this device's token from an account we are leaving so its
// server stops pushing to this device. Talks to that account directly rather
// than through the shared api instance, which by now points at the new active
// account.
//
// AGORA-420: a server that keeps a token per device is told which token, and
// removes only that one, so the account's other phones keep their pushes. An
// older server, with one token per account, answers 404 or 405 and gets the
// empty-token clear it has always understood.
export async function clearPushForAccount(account: Account | null | undefined): Promise<void> {
  if (!account) return
  const headers = { Authorization: `Bearer ${account.token}` }
  const token = SecureStore.getItem(PUSH_TOKEN_KEY)
  if (token) {
    try {
      await axios.delete(`${account.instanceUrl}/api/users/me/push-token`, { headers, data: { token } })
      return
    } catch (err: any) {
      const status = err?.response?.status
      if (status !== 404 && status !== 405) return
    }
  }
  try {
    await axios.patch(`${account.instanceUrl}/api/users/me`, { expo_push_token: '' }, { headers })
  } catch {}
}
