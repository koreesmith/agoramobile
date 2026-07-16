import { useEffect, useRef, useState } from 'react'
import { Animated, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToastStore } from '../store/toast'
import { useC } from '../constants/ColorContext'

export default function Toast() {
  const { message, type } = useToastStore()
  const c = useC()
  const insets = useSafeAreaInsets()
  const opacity = useRef(new Animated.Value(0)).current
  const [displayMessage, setDisplayMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (message) {
      setDisplayMessage({ text: message, type })
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setDisplayMessage(null)
      })
    }
  }, [message])

  if (!displayMessage) return null

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.container,
        { bottom: insets.bottom + 70, opacity, backgroundColor: displayMessage.type === 'error' ? c.red : c.text },
      ]}
    >
      <Text style={[s.text, { color: c.card }]} numberOfLines={2}>{displayMessage.text}</Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  text: { fontSize: 14, fontWeight: '600' },
})
