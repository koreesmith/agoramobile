import { View, Text, Image, TouchableOpacity, useColorScheme } from 'react-native'

// ── Avatar ────────────────────────────────────────────────────────────────────

export function Avatar({ url, name, size = 40 }: { url?: string; name?: string; size?: number }) {
  const letter = (name || '?')[0].toUpperCase()
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
      className="bg-indigo-100 items-center justify-center flex-shrink-0">
      {url
        ? <Image source={{ uri: url }} style={{ width: size, height: size }} />
        : <Text style={{ fontSize: size * 0.4 }} className="font-bold text-indigo-600">{letter}</Text>}
    </View>
  )
}

// ── Screen wrapper ────────────────────────────────────────────────────────────

export function Screen({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`flex-1 bg-gray-50 dark:bg-gray-950 ${className}`}>
      {children}
    </View>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

export function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 pt-14 pb-3 flex-row items-center justify-between">
      <Text className="text-xl font-bold text-gray-900 dark:text-white">{title}</Text>
      {right && <View>{right}</View>}
    </View>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`bg-white dark:bg-gray-900 rounded-2xl mx-3 my-1.5 shadow-sm ${className}`}>
      {children}
    </View>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────

export function Button({
  title, onPress, variant = 'primary', disabled = false, small = false,
}: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  small?: boolean
}) {
  const bg = disabled
    ? 'bg-gray-200 dark:bg-gray-700'
    : variant === 'primary'
      ? 'bg-indigo-600'
      : variant === 'danger'
        ? 'bg-red-500'
        : 'bg-gray-100 dark:bg-gray-800'

  const textColor = disabled
    ? 'text-gray-400'
    : variant === 'primary' || variant === 'danger'
      ? 'text-white'
      : 'text-gray-700 dark:text-gray-200'

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`${bg} rounded-xl items-center justify-center ${small ? 'px-3 py-1.5' : 'px-4 py-2.5'}`}
    >
      <Text className={`${textColor} font-semibold ${small ? 'text-sm' : 'text-base'}`}>{title}</Text>
    </TouchableOpacity>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-lg font-semibold text-gray-700 dark:text-gray-300 text-center">{title}</Text>
      {subtitle && <Text className="text-gray-400 text-center mt-1 text-sm">{subtitle}</Text>}
    </View>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-gray-400 text-sm">Loading…</Text>
    </View>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function Divider() {
  return <View className="h-px bg-gray-100 dark:bg-gray-800 mx-4" />
}
