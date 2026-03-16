# Agora Mobile

React Native + Expo mobile app for Agora Social.

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Apple Developer account (for iOS builds)
- Google Play Developer account (for Android builds)

## Setup

```bash
cd agora-mobile
npm install
```

## Development

```bash
# Start Expo dev server (scan QR with Expo Go app)
npm start

# iOS simulator (requires Xcode on macOS)
npm run ios

# Android emulator (requires Android Studio)
npm run android
```

## EAS Build Setup (one-time)

1. Log in to Expo:
   ```bash
   eas login
   ```

2. Configure your project:
   ```bash
   eas build:configure
   ```

3. Update `app.json`:
   - Set `expo.extra.eas.projectId` to your EAS project ID
   - Update `expo.ios.bundleIdentifier` if needed (currently `social.agora.app`)
   - Update `expo.android.package` if needed (currently `social.agora.app`)

4. Replace placeholder assets in `assets/` with real images:
   - `icon.png` — 1024×1024 app icon
   - `splash.png` — 1284×2778 splash screen
   - `adaptive-icon.png` — 1024×1024 Android adaptive icon foreground
   - `notification-icon.png` — 96×96 white-on-transparent Android notification icon

## Building

```bash
# Internal test build (TestFlight / APK)
npm run build:preview

# Production build (App Store / Google Play)
npm run build:production
```

## Submitting

```bash
# Submit to App Store + Google Play
npm run submit
```

You'll need to configure `eas.json` submit section with your credentials.
See: https://docs.expo.dev/submit/introduction/

## Push Notifications

The app automatically registers for push notifications after login and sends
the Expo push token to the backend (`PATCH /api/users/me` with `expo_push_token`).

The backend sends pushes via Expo's Push API (`https://exp.host/--/api/v2/push/send`)
for all notification types.

## Architecture

- **Expo Router** — file-based navigation (like Next.js but for React Native)
- **NativeWind** — Tailwind CSS for React Native
- **TanStack Query** — data fetching + caching
- **Zustand** — auth state (token + user stored in SecureStore)
- **Axios** — HTTP client (reads instanceUrl + token from store at request time)

## Screens

| Route | Screen |
|-------|--------|
| `/(auth)` | Login (instance URL + credentials) |
| `/(tabs)` | Feed, Notifications, Groups, Friends, Messages, Profile |
| `/post/[id]` | Post detail + comments |
| `/profile/[username]` | User profile |
| `/conversation/[id]` | DM thread |
| `/group/[slug]` | Group detail + feed |
| `/new-conversation` | Start new DM |
| `/edit-profile` | Edit profile |
| `/settings` | Settings + change password |
