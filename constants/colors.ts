import { useColorScheme } from 'react-native'

// ── Light palette (matches web agora colors) ──────────────────────────────────
export const light = {
  primary:   '#486581',
  primaryDk: '#334e68',
  primaryLt: '#9fb3c8',
  primaryBg: '#f0f4f8',

  bg:        '#f0f4f8',
  card:      '#ffffff',
  border:    '#d9e2ec',
  borderMd:  '#bcccdc',

  text:      '#102a43',
  textMd:    '#334e68',
  textMuted: '#627d98',
  textLight: '#829ab1',

  red:       '#ef4444',
  green:     '#22c55e',
  amber:     '#f59e0b',
  white:     '#ffffff',
  gray100:   '#f3f4f6',
  gray200:   '#e5e7eb',
}

// ── Dark palette (matches web dark mode) ─────────────────────────────────────
export const dark = {
  primary:   '#9fb3c8',  // lighter blue for dark bg
  primaryDk: '#bcccdc',
  primaryLt: '#627d98',
  primaryBg: '#1a2837',

  bg:        '#0a1929',
  card:      '#102a43',
  border:    '#1e3a55',
  borderMd:  '#243b53',

  text:      '#f0f4f8',
  textMd:    '#d9e2ec',
  textMuted: '#9fb3c8',
  textLight: '#627d98',

  red:       '#f87171',
  green:     '#4ade80',
  amber:     '#fbbf24',
  white:     '#ffffff',
  gray100:   '#1e3a55',
  gray200:   '#243b53',
}

// ── C is always the current scheme's palette ─────────────────────────────────
// Use this in StyleSheet.create() via useColors() hook, not directly
export const C = light  // default export for non-hook contexts

// Hook for components
export function useColors() {
  const scheme = useColorScheme()
  return scheme === 'dark' ? dark : light
}
