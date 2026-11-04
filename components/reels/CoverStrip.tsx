import { useRef, useState } from 'react'
import { View, PanResponder, StyleSheet } from 'react-native'
import { Image } from 'expo-image'

// AGORA-443: choose the cover frame. A strip of frames from across the kept
// part with a marker on it; touch or drag anywhere on the strip to move the
// marker. The strip is only context: the chosen frame itself is shown in the
// preview above, which seeks to it, so a device that can't make the strip
// thumbnails still lets the person choose.

interface Props {
  length: number                 // seconds in the kept part
  offset: number                 // chosen frame, seconds into it
  frames: any[]                  // thumbnails, in order; may be empty
  onChange: (offset: number) => void
  onRelease: (offset: number) => void
  color: string
  trackColor: string
}

export default function CoverStrip({ length, offset, frames, onChange, onRelease, color, trackColor }: Props) {
  const [width, setWidth] = useState(0)
  const live = useRef({ length, width, onChange, onRelease, offset })
  live.current = { length, width, onChange, onRelease, offset }

  const at = (x: number) => {
    const { length: len, width: w } = live.current
    return w > 0 ? Math.min(len, Math.max(0, (x / w) * len)) : 0
  }
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => live.current.onChange(at(e.nativeEvent.locationX)),
    onPanResponderMove: (e) => live.current.onChange(at(e.nativeEvent.locationX)),
    onPanResponderRelease: (e) => live.current.onRelease(at(e.nativeEvent.locationX)),
    onPanResponderTerminate: () => live.current.onRelease(live.current.offset),
  })).current

  const markerX = length > 0 ? (offset / length) * width : 0

  return (
    <View style={[s.strip, { backgroundColor: trackColor }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      accessible accessibilityRole="adjustable" accessibilityLabel="Cover frame"
      accessibilityValue={{ text: `${offset.toFixed(1)} seconds into the clip` }}>
      <View style={s.frames} pointerEvents="none">
        {frames.map((f, i) => <Image key={i} source={f} style={s.frame} contentFit="cover" />)}
      </View>
      <View pointerEvents="none" style={[s.marker, { backgroundColor: color, left: Math.max(0, Math.min(width - 4, markerX - 2)) }]} />
    </View>
  )
}

const s = StyleSheet.create({
  strip:  { height: 64, borderRadius: 8, overflow: 'hidden', justifyContent: 'center' },
  frames: { flexDirection: 'row', height: '100%' },
  frame:  { flex: 1, height: '100%' },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 4, borderRadius: 2 },
})
