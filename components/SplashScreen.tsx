import { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet, Image } from 'react-native'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const iconScale   = useRef(new Animated.Value(0.72)).current
  const iconOpacity = useRef(new Animated.Value(0)).current
  const textOpacity = useRef(new Animated.Value(0)).current
  const subOpacity  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      // Icon springs in
      Animated.parallel([
        Animated.timing(iconOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(iconScale,   { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
      ]),
      Animated.delay(120),
      // "Agora" fades in
      Animated.timing(textOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.delay(80),
      // "Social" fades in
      Animated.timing(subOpacity,  { toValue: 1, duration: 320, useNativeDriver: true }),
      // Hold before handing off
      Animated.delay(680),
    ]).start(() => onFinish())
  }, [])

  return (
    <View style={s.container}>
      <Animated.View style={{ opacity: iconOpacity, transform: [{ scale: iconScale }], marginBottom: 32 }}>
        <Image
          source={require('../assets/icon.png')}
          style={s.icon}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.Text style={[s.title, { opacity: textOpacity }]}>
        Agora
      </Animated.Text>

      <Animated.Text style={[s.subtitle, { opacity: subOpacity }]}>
        Social
      </Animated.Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#102a43',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 100,
    height: 100,
    borderRadius: 22,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '300',
    color: '#9fb3c8',
    letterSpacing: 7,
    textTransform: 'uppercase',
  },
})

