import { useQuery } from '@tanstack/react-query'
import { authApi } from '../../api'
import { useAuthStore } from '../../store/auth'

// AMOBILE-202: a fresh GET /auth/me for the active account, shared by the tab
// layout (the wizard redirect), the feed (holding What's New back while the
// wizard is pending), and the wizard itself. The stored account is whatever
// /auth/me said at sign-in, which can be long out of date. Keyed by account
// so a response can never be read as another account's.
export function meQueryKey(accountId: string | null) {
  return ['my-profile', accountId]
}

export function useMe({ staleTime = 60_000 }: { staleTime?: number } = {}) {
  const accountId = useAuthStore((s) => s.activeAccountId)
  return useQuery({
    queryKey: meQueryKey(accountId),
    queryFn: () => authApi.me().then(r => r.data),
    enabled: !!accountId,
    staleTime,
  })
}
