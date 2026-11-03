import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'

// AGORA-446: everything the bottom bar can show. Feed and Profile are always
// in the bar; the rest compete for the remaining slots, and whatever doesn't
// get one lives in the More tab. Each id is the name of a screen in
// app/(tabs)/, so a destination stays a real route (and every existing link
// to it keeps working) whether or not it is currently in the bar.
export type TabDestinationId = 'notifications' | 'messages' | 'connections' | 'groups'

export interface TabDestination {
  id: TabDestinationId
  title: string
  icon: ComponentProps<typeof Ionicons>['name']
  // Which unread count belongs on this destination, if any.
  badge?: 'alerts' | 'messages'
}

// Canonical order, which is also the order they appear in the bar. Reels is
// added here (and to DEFAULT_BAR) when its screen exists (AGORA-442).
export const TAB_DESTINATIONS: TabDestination[] = [
  { id: 'notifications', title: 'Alerts',      icon: 'notifications-outline', badge: 'alerts' },
  { id: 'messages',      title: 'Messages',    icon: 'chatbubble-outline',    badge: 'messages' },
  { id: 'connections',   title: 'Connections', icon: 'person-add-outline' },
  { id: 'groups',        title: 'Groups',      icon: 'people-outline' },
]

// The bar is five slots plus More. Feed and Profile take two of the five.
export const FLEX_SLOTS = 3

export const DEFAULT_BAR: TabDestinationId[] = ['notifications', 'messages']

export const destinationById = (id: string) => TAB_DESTINATIONS.find((d) => d.id === id)
