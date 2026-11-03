import { Pressable } from 'react-native'

// AGORA-446: the bottom bar's tab button. Same behaviour as the default one,
// plus a "Customize bottom bar" accessibility action, because a screen reader
// user can't long-press to open the customize dialog.
export default function TabBarButton({
  onCustomize, children, onPress, onLongPress, style,
  accessibilityRole, accessibilityState, accessibilityLabel, testID,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={onCustomize ? [{ name: 'customize', label: 'Customize bottom bar' }] : undefined}
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'customize') onCustomize?.() }}
      testID={testID}
      style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  )
}
