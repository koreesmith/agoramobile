import { useRef, useState } from 'react'
import { View, PanResponder, StyleSheet } from 'react-native'
import { moveEnd, moveStart, Range } from '../../utils/trimRange'

// AGORA-443: a track with a handle at each end of the part to keep. Dragging a
// handle moves it under the finger; the rules (never under half a second, never
// over 2 minutes, one handle drags the other along at the limit) are in
// utils/trimRange. The handles are bigger to touch than to see.

const HANDLE = 24

interface Props {
  duration: number
  range: Range
  onChange: (r: Range) => void
  onRelease: (r: Range) => void
  color: string
  trackColor: string
}

export default function TrimBar({ duration, range, onChange, onRelease, color, trackColor }: Props) {
  const [width, setWidth] = useState(0)
  // The gesture handlers are created once; these keep them reading the latest.
  const live = useRef({ duration, range, onChange, onRelease, width })
  live.current = { duration, range, onChange, onRelease, width }
  const grabbed = useRef<Range>(range)

  const make = (which: 'start' | 'end') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { grabbed.current = live.current.range },
    onPanResponderMove: (_e, g) => {
      const { duration: d, width: w, onChange: change } = live.current
      if (!w || !d) return
      const delta = (g.dx / w) * d
      change(which === 'start'
        ? moveStart(grabbed.current, grabbed.current.start + delta, d)
        : moveEnd(grabbed.current, grabbed.current.end + delta, d))
    },
    onPanResponderRelease: () => live.current.onRelease(live.current.range),
    onPanResponderTerminate: () => live.current.onRelease(live.current.range),
  })
  const startPan = useRef(make('start')).current
  const endPan = useRef(make('end')).current

  const x = (t: number) => (duration > 0 ? (t / duration) * width : 0)

  return (
    <View style={s.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible accessibilityRole="adjustable" accessibilityLabel="Trim"
      accessibilityValue={{ text: `From ${range.start.toFixed(1)} to ${range.end.toFixed(1)} seconds` }}>
      <View style={[s.track, { backgroundColor: trackColor }]} />
      <View style={[s.kept, { backgroundColor: color, left: x(range.start), width: Math.max(0, x(range.end) - x(range.start)) }]} />
      <View {...startPan.panHandlers} style={[s.hit, { left: x(range.start) - HANDLE }]} hitSlop={{ top: 12, bottom: 12 }}>
        <View style={[s.handle, { backgroundColor: color }]} />
      </View>
      <View {...endPan.panHandlers} style={[s.hit, { left: x(range.end) }]} hitSlop={{ top: 12, bottom: 12 }}>
        <View style={[s.handle, { backgroundColor: color }]} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:   { height: 48, justifyContent: 'center', marginHorizontal: HANDLE },
  track:  { height: 6, borderRadius: 3 },
  kept:   { position: 'absolute', height: 6, borderRadius: 3 },
  // 44pt wide touch target that holds the visible handle against the kept edge.
  hit:    { position: 'absolute', width: HANDLE, height: 48, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 10, height: 32, borderRadius: 5 },
})
