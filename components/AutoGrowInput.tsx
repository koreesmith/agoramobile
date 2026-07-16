import { useState } from 'react'
import { TextInput, TextInputProps } from 'react-native'

interface AutoGrowInputProps extends TextInputProps {
  minHeight: number
  maxHeight: number
}

/** A multiline TextInput that grows with its content between minHeight and
 * maxHeight, measured via native content size rather than line-counting, so
 * it doesn't jump/flicker as the user types. */
export default function AutoGrowInput({ minHeight, maxHeight, style, ...props }: AutoGrowInputProps) {
  const [height, setHeight] = useState(minHeight)

  return (
    <TextInput
      {...props}
      multiline
      style={[style, { height: Math.max(minHeight, Math.min(maxHeight, height)) }]}
      onContentSizeChange={e => setHeight(e.nativeEvent.contentSize.height)}
    />
  )
}
