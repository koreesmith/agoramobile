import React, { createContext, useContext } from 'react'
import { useColorScheme } from 'react-native'
import { light, dark } from './colors'
import { useThemeStore } from '../store/theme'

type ColorPalette = typeof light

const ColorContext = createContext<ColorPalette>(light)

export function ColorProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme()
  const { preference } = useThemeStore()

  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark')
  const palette = isDark ? dark : light

  return (
    <ColorContext.Provider value={palette}>
      {children}
    </ColorContext.Provider>
  )
}

export function useC() {
  return useContext(ColorContext)
}
