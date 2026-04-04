import { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated'
import Animated from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Image } from 'expo-image'

interface ZoomableImageProps {
  uri: string
  width: number
  height: number
  onClose?: () => void
  onLongPress?: () => void
}

export default function ZoomableImage({ uri, width, height, onClose, onLongPress }: ZoomableImageProps) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const resetZoom = () => {
    'worklet'
    scale.value = withSpring(1)
    translateX.value = withSpring(0)
    translateY.value = withSpring(0)
    savedScale.value = 1
    savedTranslateX.value = 0
    savedTranslateY.value = 0
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5))
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        resetZoom()
      } else {
        savedScale.value = scale.value
      }
    })

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX
        translateY.value = savedTranslateY.value + e.translationY
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(resetZoom)

  const singleTap = Gesture.Tap()
    .onEnd(() => {
      if (scale.value <= 1 && onClose) {
        runOnJS(onClose)()
      }
    })

  const longPress = Gesture.LongPress()
    .minDuration(400)
    .onEnd((_e, success) => {
      if (success && onLongPress) runOnJS(onLongPress)()
    })

  const composed = Gesture.Simultaneous(
    Gesture.Simultaneous(pinch, pan),
    Gesture.Exclusive(doubleTap, singleTap),
    longPress
  )

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width, height }, animatedStyle]}>
        <Image source={{ uri }} style={{ width, height }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  )
}
