import { useQuery } from '@tanstack/react-query'
import { instanceApi } from '../api'
import { TAB_DESTINATIONS, TabDestination } from '../constants/tabDestinations'
import { useBar } from '../store/tabBar'

// AGORA-442: what the connected server can do about Reels. A server that
// predates Reels doesn't send reels_discover_enabled on /instance, and has no
// /reels either, so Reels is left out of the bar and the menus instead of
// showing a screen that can only fail. While the answer is still loading (or
// the request failed) Reels is assumed to be there, so the bar doesn't jump.
export function useReelsSupport() {
  const { data } = useQuery({
    queryKey: ['instance-info'],
    queryFn: () => instanceApi.getInfo().then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const supported = data ? typeof data.reels_discover_enabled === 'boolean' : true
  // On unless an admin turned the Discover tab off.
  const discoverOn = data?.reels_discover_enabled !== false
  return { supported, discoverOn }
}

// The destinations this server offers, and the ones of them that are in the
// bottom bar. Everything that draws the bar or the More list goes through this
// so a missing Reels is missing everywhere at once.
export function useDestinations(): { destinations: TabDestination[]; bar: string[] } {
  const { supported } = useReelsSupport()
  const savedBar = useBar()
  const destinations = TAB_DESTINATIONS.filter((d) => d.id !== 'reels' || supported)
  const bar = savedBar.filter((id) => destinations.some((d) => d.id === id))
  return { destinations, bar }
}
