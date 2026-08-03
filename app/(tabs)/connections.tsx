import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert, ScrollView, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState, Avatar, renderName, SearchIconButton } from '../../components/ui'
import FriendListPickerModal from '../../components/FriendListPickerModal'
import { friendsApi, usersApi, instanceApi, federationApi, atprotoApi } from '../../api'
import { useAuthStore } from '../../store/auth'

import { C } from '../../constants/colors'
import { useC } from '../../constants/ColorContext'

type Tab = 'friends' | 'requests' | 'discover' | 'fediverse' | 'bluesky'

// AGORA-196: a fediverse actor federated through Bridgy Fed's bsky.brid.gy
// (or any *.brid.gy) is a Bluesky account, not a real fediverse one.
function isBridgedBlueskyInstance(instance?: string): boolean {
  return !!instance && /(^|\.)brid\.gy$/i.test(instance)
}

interface FediversePreview {
  actor_url: string
  preferred_username: string
  name: string
  summary: string
  icon_url: string
  instance: string
}

interface FollowingEntry {
  id: string
  actor_url: string
  accepted: boolean
  notify: boolean
  show_in_feed: boolean
  user_id?: string
  username?: string
  display_name?: string
  avatar_url?: string
  instance?: string
  // AGORA-249: whether this account follows the caller back.
  follows_back?: boolean
  // AGORA-258: custom emoji (shortcode -> image URL) for display_name.
  emojis?: Record<string, string>
  // AGORA-306: the account approves follow requests by hand, which is why an
  // entry can sit un-Accepted indefinitely rather than momentarily.
  manually_approves_followers?: boolean
}

export default function ConnectionsScreen() {
  const c = useC()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'friends')
  const [search, setSearch] = useState('')
  // AMOBILE-145: the list icon on a Fediverse/Bluesky follow row used to just
  // navigate to the standalone Friend Lists screen with no idea which
  // account it was tapped for — this opens a per-account add/remove picker
  // instead, mirroring web's FriendListModal.
  const [listPickerFriend, setListPickerFriend] = useState<{ id: string; username: string; display_name?: string; avatar_url?: string; emojis?: Record<string, string> } | null>(null)

  const { data: friendsData, isLoading: fl, refetch: rf, isRefetching: rfr } = useQuery({ queryKey: ['friends'], queryFn: () => friendsApi.listFriends().then(r => r.data) })
  const { data: reqData, refetch: rr } = useQuery({ queryKey: ['requests'], queryFn: () => friendsApi.listRequests().then(r => r.data) })
  const { data: discoverData, isLoading: dl, refetch: dr } = useQuery({ queryKey: ['discover'], queryFn: () => usersApi.discover().then(r => r.data), enabled: tab === 'discover' })
  const { data: instanceData } = useQuery({ queryKey: ['instance-info'], queryFn: () => instanceApi.getInfo().then(r => r.data), staleTime: 5 * 60_000 })
  const invitesEnabled = instanceData?.user_invites_enabled === 'true'

  const inv = () => { qc.invalidateQueries({ queryKey: ['friends'] }); qc.invalidateQueries({ queryKey: ['requests'] }) }
  const accept = useMutation({ mutationFn: (id: string) => friendsApi.acceptRequest(id), onSuccess: inv })
  const decline = useMutation({ mutationFn: (id: string) => friendsApi.declineRequest(id), onSuccess: inv })
  const unfriend = useMutation({ mutationFn: (id: string) => friendsApi.unfriend(id), onSuccess: inv })
  const sendReq = useMutation({ mutationFn: (id: string) => friendsApi.sendRequest(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['discover'] }) })

  const friends = friendsData?.friends || []
  const incoming = reqData?.incoming || []
  const outgoing = reqData?.outgoing || []
  const discover = discoverData?.users || []
  const pendingCount = incoming.length

  const filtered = friends.filter((f: any) => !search || f.username.toLowerCase().includes(search.toLowerCase()) || (f.display_name || '').toLowerCase().includes(search.toLowerCase()))

  // ── Fediverse follows (moved from the standalone Fediverse screen) ────────
  const [fediHandle, setFediHandle] = useState('')
  const [fediPreview, setFediPreview] = useState<FediversePreview | null>(null)
  const [fediSearchError, setFediSearchError] = useState('')

  const { data: followingData } = useQuery({
    queryKey: ['fediverse-following'],
    queryFn: () => federationApi.listFollowing().then(r => r.data),
    enabled: tab === 'fediverse',
  })
  const following: FollowingEntry[] = followingData?.following ?? []
  const fediNotificationsEnabled = (user as any)?.fediverse_notifications_enabled ?? true

  const resolveFediHandle = useMutation({
    mutationFn: (h: string) => federationApi.resolveFediverseHandle(h).then(r => r.data),
    onSuccess: (data) => { setFediPreview(data); setFediSearchError('') },
    onError: (e: any) => { setFediPreview(null); setFediSearchError(e.response?.data?.error || 'Could not resolve that handle.') },
  })
  const alreadyFollowingFedi = fediPreview && following.some(f => f.actor_url === fediPreview.actor_url)
  const followFedi = useMutation({
    mutationFn: (actorUrl: string) => federationApi.followFediverseAccount(actorUrl),
    onSuccess: () => {
      setFediPreview(null); setFediHandle('')
      qc.invalidateQueries({ queryKey: ['fediverse-following'] })
    },
    onError: (e: any) => setFediSearchError(e.response?.data?.error || 'Could not follow that account.'),
  })
  const unfollowFedi = useMutation({
    mutationFn: (id: string) => federationApi.unfollowFediverseAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fediverse-following'] }),
  })
  const toggleFediNotify = useMutation({
    mutationFn: ({ id, notify }: { id: string; notify: boolean }) => federationApi.toggleFollowNotify(id, notify),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fediverse-following'] }),
  })
  const toggleFediShowInFeed = useMutation({
    mutationFn: ({ id, showInFeed }: { id: string; showInFeed: boolean }) => federationApi.toggleShowInFeed(id, showInFeed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fediverse-following'] }),
  })
  const migrateBridged = useMutation({
    mutationFn: (id: string) => atprotoApi.migrateBridgedFollow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fediverse-following'] })
      qc.invalidateQueries({ queryKey: ['bluesky-following'] })
    },
    onError: (e: any) => Alert.alert('Could not migrate', e.response?.data?.error || 'Something went wrong.'),
  })
  const handleFediSearch = () => {
    const trimmed = fediHandle.trim()
    if (!trimmed) return
    setFediSearchError('')
    resolveFediHandle.mutate(trimmed)
  }

  // ── Bluesky follows (AGORA-195) ────────────────────────────────────────────
  const [bskyHandle, setBskyHandle] = useState('')
  const [bskyPreview, setBskyPreview] = useState<any>(null)
  const [bskySearchError, setBskySearchError] = useState('')

  const { data: bskyFollowingData } = useQuery({
    queryKey: ['bluesky-following'],
    queryFn: () => atprotoApi.listBlueskyFollowing().then(r => r.data),
    enabled: tab === 'bluesky',
  })
  const bskyFollowing: any[] = bskyFollowingData?.following ?? []
  const atprotoNotificationsEnabled = (user as any)?.atproto_notifications_enabled ?? true

  const resolveBskyHandle = useMutation({
    mutationFn: (h: string) => atprotoApi.resolveBlueskyHandle(h).then(r => r.data),
    onSuccess: (data) => { setBskyPreview(data); setBskySearchError('') },
    onError: (e: any) => { setBskyPreview(null); setBskySearchError(e.response?.data?.error || 'Could not resolve that handle.') },
  })
  const alreadyFollowingBsky = bskyPreview && bskyFollowing.some(f => f.did === bskyPreview.did)
  const followBsky = useMutation({
    mutationFn: (actor: string) => atprotoApi.followBlueskyAccount(actor),
    onSuccess: () => {
      setBskyPreview(null); setBskyHandle('')
      qc.invalidateQueries({ queryKey: ['bluesky-following'] })
    },
    onError: (e: any) => setBskySearchError(e.response?.data?.error || 'Could not follow that account.'),
  })
  const unfollowBsky = useMutation({
    mutationFn: (id: string) => atprotoApi.unfollowBlueskyAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bluesky-following'] }),
  })
  const toggleBskyNotify = useMutation({
    mutationFn: ({ id, notify }: { id: string; notify: boolean }) => atprotoApi.toggleFollowNotify(id, notify),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bluesky-following'] }),
  })
  const toggleBskyShowInFeed = useMutation({
    mutationFn: ({ id, showInFeed }: { id: string; showInFeed: boolean }) => atprotoApi.toggleShowInFeed(id, showInFeed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bluesky-following'] }),
  })
  const handleBskySearch = () => {
    const trimmed = bskyHandle.trim()
    if (!trimmed) return
    setBskySearchError('')
    resolveBskyHandle.mutate(trimmed)
  }

  const PersonRow = ({ user, right }: { user: any; right: React.ReactNode }) => (
    <TouchableOpacity onPress={() => router.push(`/profile/${user.username}`)} style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      <Avatar url={user.avatar_url} name={user.display_name || user.username} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={[s.name, { color: c.text }]}>{user.display_name ? renderName(user.display_name, user.emojis) : user.username}</Text>
        <Text style={[s.username, { color: c.textMuted }]}>@{user.username}</Text>
      </View>
      <View style={{ flexShrink: 0 }}>{right}</View>
    </TouchableOpacity>
  )

  return (
    <Screen>
      <Header title="Connections" right={<SearchIconButton />} />
      <View style={{ flex: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          {(['friends', 'requests', 'discover', 'fediverse', 'bluesky'] as Tab[]).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabItem, tab === t && { borderBottomColor: c.primary }]}>
              <Text style={[s.tabText, { color: c.textMuted }, tab === t && { color: c.primary }]}>
                {t === 'requests' && pendingCount > 0 ? `Requests (${pendingCount})` : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {tab === 'friends' && (
          <>
            <View style={[s.searchWrap, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <Ionicons name="search" size={15} color={c.textLight} />
              <TextInput style={[s.searchInput, { color: c.text }]} placeholder="Search friends…" placeholderTextColor={c.textLight} value={search} onChangeText={setSearch} />
            </View>
            {fl ? <Spinner /> : (
              <FlatList data={filtered} keyExtractor={(f: any) => f.id}
                refreshControl={<RefreshControl refreshing={rfr} onRefresh={rf} tintColor={c.primary} />}
                ListEmptyComponent={<EmptyState icon="👋" title="No friends yet" />}
                ListFooterComponent={invitesEnabled ? <View style={{ height: 88 }} /> : null}
                renderItem={({ item: f }) => <PersonRow user={f} right={
                  <TouchableOpacity onPress={() => Alert.alert('Unfriend?', `Remove ${f.display_name || f.username}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Unfriend', style: 'destructive', onPress: () => unfriend.mutate(f.id) },
                  ])} style={{ padding: 8 }}>
                    <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                } />}
              />
            )}
          </>
        )}

        {tab === 'requests' && (
          <FlatList
            data={[...incoming.map((f: any) => ({ ...f, _type: 'incoming' })), ...outgoing.map((f: any) => ({ ...f, _type: 'outgoing' }))]}
            keyExtractor={(f: any) => f.id}
            refreshControl={<RefreshControl refreshing={false} onRefresh={rr} tintColor={c.primary} />}
            ListEmptyComponent={<EmptyState icon="📬" title="No pending requests" />}
            ListFooterComponent={invitesEnabled ? <View style={{ height: 88 }} /> : null}
            renderItem={({ item: f }) => <PersonRow user={f} right={
              f._type === 'incoming' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => accept.mutate(f.id)} style={[s.acceptBtn, { backgroundColor: c.primary }]}><Text style={s.acceptBtnText}>Accept</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => decline.mutate(f.id)} style={[s.declineBtn, { backgroundColor: c.bg, borderColor: c.border }]}><Text style={[s.declineBtnText, { color: c.textMd }]}>Decline</Text></TouchableOpacity>
                </View>
              ) : <Text style={{ fontSize: 13, color: c.textMuted }}>Pending</Text>
            } />}
          />
        )}

        {tab === 'discover' && (
          dl ? <Spinner /> : (
            <FlatList data={discover} keyExtractor={(u: any) => u.id}
              refreshControl={<RefreshControl refreshing={false} onRefresh={dr} tintColor={c.primary} />}
              ListEmptyComponent={<EmptyState icon="🔍" title="No suggestions" />}
              ListFooterComponent={invitesEnabled ? <View style={{ height: 88 }} /> : null}
              renderItem={({ item: u }) => <PersonRow user={u} right={
                u.friend_status === 'pending' ? <Text style={{ fontSize: 13, color: c.textMuted }}>Sent</Text>
                : u.friend_status === 'accepted' ? <Text style={{ fontSize: 13, color: '#22c55e', fontWeight: '500' }}>Friends</Text>
                : <TouchableOpacity onPress={() => sendReq.mutate(u.id)} style={[s.acceptBtn, { backgroundColor: c.primary }]}><Text style={s.acceptBtnText}>Add</Text></TouchableOpacity>
              } />}
            />
          )
        )}

        {tab === 'fediverse' && (
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <View style={[s.card, { backgroundColor: c.card }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>Follow a fediverse account</Text>
              <Text style={[s.cardSubtitle, { color: c.textMuted, marginBottom: 12 }]}>
                Enter a full handle (e.g. user@mastodon.social) or a profile URL. There's no way to search the
                fediverse by name — like Mastodon's own remote search, you need the exact handle.
              </Text>
              <View style={s.searchRow}>
                <TextInput
                  style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                  value={fediHandle}
                  onChangeText={setFediHandle}
                  placeholder="user@instance.social"
                  placeholderTextColor={c.textLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="search"
                  onSubmitEditing={handleFediSearch}
                />
                <TouchableOpacity
                  onPress={handleFediSearch}
                  disabled={resolveFediHandle.isPending || !fediHandle.trim()}
                  style={[s.searchBtn, { backgroundColor: c.primaryBg }, (!fediHandle.trim() || resolveFediHandle.isPending) && { opacity: 0.5 }]}
                >
                  <Ionicons name="search" size={18} color={c.primary} />
                </TouchableOpacity>
              </View>

              {!!fediSearchError && <Text style={[s.error, { color: c.red }]}>{fediSearchError}</Text>}

              {/* AGORA-196: a Bluesky account bridged into the fediverse via
                  Bridgy Fed should be followed natively instead — no
                  "follow via bridge" option offered for it. */}
              {fediPreview && isBridgedBlueskyInstance(fediPreview.instance) && (
                <View style={[s.previewRow, { borderColor: c.border, backgroundColor: '#fef3c7' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.previewName, { color: '#92400e' }]}>This is a Bluesky account</Text>
                    <Text style={[s.previewSummary, { color: '#92400e', marginTop: 2 }]}>
                      @{fediPreview.preferred_username} is a Bluesky account bridged into the fediverse — follow it natively from the Bluesky tab instead.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setTab('bluesky'); setBskyHandle(fediPreview.preferred_username); setFediPreview(null); setFediHandle('') }}
                    style={[s.followBtn, { backgroundColor: c.primary }]}
                  >
                    <Text style={s.followBtnText}>Go to Bluesky</Text>
                  </TouchableOpacity>
                </View>
              )}
              {fediPreview && !isBridgedBlueskyInstance(fediPreview.instance) && (
                <View style={[s.previewRow, { borderColor: c.border }]}>
                  <Avatar url={fediPreview.icon_url} name={fediPreview.name || fediPreview.preferred_username} size={44} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.previewName, { color: c.text }]} numberOfLines={1}>
                      {fediPreview.name || fediPreview.preferred_username}
                    </Text>
                    <Text style={[s.previewHandle, { color: c.textMuted }]} numberOfLines={1}>
                      @{fediPreview.preferred_username}@{fediPreview.instance}
                    </Text>
                    {!!fediPreview.summary && (
                      <Text style={[s.previewSummary, { color: c.textMuted }]} numberOfLines={2}>{fediPreview.summary}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => followFedi.mutate(fediPreview.actor_url)}
                    disabled={followFedi.isPending || !!alreadyFollowingFedi}
                    style={[s.followBtn, { backgroundColor: alreadyFollowingFedi ? c.border : c.primary }]}
                  >
                    <Text style={[s.followBtnText, alreadyFollowingFedi && { color: c.textMuted }]}>
                      {alreadyFollowingFedi ? 'Following' : followFedi.isPending ? 'Following…' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={[s.card, { backgroundColor: c.card }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>Your follows</Text>
              {following.length > 0 && (
                <Text style={[s.cardSubtitle, { color: c.textMuted, marginTop: 2 }]}>
                  Add to a friend list, show in your main feed (off by default), or get notified on new posts.
                </Text>
              )}
              {following.length === 0 ? (
                <Text style={[s.emptyText, { color: c.textMuted, borderColor: c.border }]}>
                  You're not following anyone on the fediverse yet.
                </Text>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {following.map(f => (
                    <View key={f.id} style={[s.followRow, { borderBottomColor: c.border }]}>
                      <TouchableOpacity
                        style={s.followRowMain}
                        disabled={!f.username}
                        onPress={() => router.push(`/profile/${f.username}` as any)}
                      >
                        {/* AMOBILE-171: the lock marks why this row can sit
                            "Requested" indefinitely. Already-accepted is not a
                            state worth marking, hence the !f.accepted guard. */}
                        <Avatar
                          url={f.avatar_url}
                          name={f.display_name || f.username}
                          size={38}
                          locked={!!f.manually_approves_followers && !f.accepted && !f.follows_back}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[s.previewName, { color: c.text }]} numberOfLines={1}>
                            {f.display_name ? renderName(f.display_name, f.emojis) : (f.username || f.actor_url)}
                          </Text>
                          {!!f.username && (
                            <Text style={[s.previewHandle, { color: c.textMuted }]} numberOfLines={1}>
                              @{f.username}{f.instance ? `@${f.instance}` : ''}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                      {f.accepted && f.follows_back && (
                        <View style={s.pendingTag}>
                          <Ionicons name="person-circle-outline" size={13} color={c.primary} />
                          <Text style={[s.pendingText, { color: c.primary }]}>Follows you</Text>
                        </View>
                      )}
                      {!f.accepted && (
                        <View style={s.pendingTag}>
                          <Ionicons name="time-outline" size={13} color={c.textMuted} />
                          <Text style={[s.pendingText, { color: c.textMuted }]}>Requested</Text>
                        </View>
                      )}
                      {f.accepted && isBridgedBlueskyInstance(f.instance) && (
                        <TouchableOpacity
                          onPress={() => migrateBridged.mutate(f.id)}
                          disabled={migrateBridged.isPending}
                          style={s.iconBtn}
                        >
                          <Ionicons name="cloud-outline" size={18} color={c.primary} />
                        </TouchableOpacity>
                      )}
                      {f.accepted && f.user_id && (
                        <TouchableOpacity
                          onPress={() => setListPickerFriend({ id: f.user_id!, username: f.username!, display_name: f.display_name, avatar_url: f.avatar_url, emojis: f.emojis })}
                          style={s.iconBtn}
                        >
                          <Ionicons name="list-outline" size={18} color={c.textLight} />
                        </TouchableOpacity>
                      )}
                      {f.accepted && (
                        <TouchableOpacity
                          onPress={() => toggleFediShowInFeed.mutate({ id: f.id, showInFeed: !f.show_in_feed })}
                          disabled={toggleFediShowInFeed.isPending}
                          style={s.iconBtn}
                        >
                          <Ionicons
                            name={f.show_in_feed ? 'home' : 'home-outline'}
                            size={18}
                            color={f.show_in_feed ? c.primary : c.textLight}
                          />
                        </TouchableOpacity>
                      )}
                      {f.accepted && (
                        <TouchableOpacity
                          onPress={() => toggleFediNotify.mutate({ id: f.id, notify: !f.notify })}
                          disabled={toggleFediNotify.isPending || !fediNotificationsEnabled}
                          style={s.iconBtn}
                        >
                          <Ionicons
                            name={f.notify ? 'notifications' : 'notifications-off-outline'}
                            size={18}
                            color={f.notify && fediNotificationsEnabled ? c.primary : c.textLight}
                          />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => unfollowFedi.mutate(f.id)}
                        disabled={unfollowFedi.isPending}
                        style={s.iconBtn}
                      >
                        <Ionicons name="person-remove-outline" size={18} color={c.red} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              {!fediNotificationsEnabled && following.length > 0 && (
                <Text style={[s.hintText, { color: c.textMuted }]}>
                  Fediverse post notifications are off globally — turn them on in Settings → Fediverse to use per-account notify toggles.
                </Text>
              )}
            </View>

            <TouchableOpacity onPress={() => router.push('/settings?tab=fediverse' as any)}>
              <Text style={[s.hintLink, { color: c.textMuted }]}>
                Want to opt out of the fediverse entirely? That toggle lives in <Text style={{ textDecorationLine: 'underline' }}>Settings → Fediverse</Text>.
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {tab === 'bluesky' && (
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <View style={[s.card, { backgroundColor: c.card }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>Follow a Bluesky account</Text>
              <Text style={[s.cardSubtitle, { color: c.textMuted, marginBottom: 12 }]}>
                Enter a full handle (e.g. user.bsky.social) or a DID.
              </Text>
              <View style={s.searchRow}>
                <TextInput
                  style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                  value={bskyHandle}
                  onChangeText={setBskyHandle}
                  placeholder="user.bsky.social"
                  placeholderTextColor={c.textLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handleBskySearch}
                />
                <TouchableOpacity
                  onPress={handleBskySearch}
                  disabled={resolveBskyHandle.isPending || !bskyHandle.trim()}
                  style={[s.searchBtn, { backgroundColor: c.primaryBg }, (!bskyHandle.trim() || resolveBskyHandle.isPending) && { opacity: 0.5 }]}
                >
                  <Ionicons name="search" size={18} color={c.primary} />
                </TouchableOpacity>
              </View>

              {!!bskySearchError && <Text style={[s.error, { color: c.red }]}>{bskySearchError}</Text>}

              {bskyPreview && (
                <View style={[s.previewRow, { borderColor: c.border }]}>
                  <Avatar url={bskyPreview.avatar_url} name={bskyPreview.display_name || bskyPreview.handle} size={44} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.previewName, { color: c.text }]} numberOfLines={1}>
                      {bskyPreview.display_name || bskyPreview.handle}
                    </Text>
                    <Text style={[s.previewHandle, { color: c.textMuted }]} numberOfLines={1}>
                      @{bskyPreview.handle}
                    </Text>
                    {!!bskyPreview.description && (
                      <Text style={[s.previewSummary, { color: c.textMuted }]} numberOfLines={2}>{bskyPreview.description}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => followBsky.mutate(bskyPreview.did)}
                    disabled={followBsky.isPending || !!alreadyFollowingBsky}
                    style={[s.followBtn, { backgroundColor: alreadyFollowingBsky ? c.border : c.primary }]}
                  >
                    <Text style={[s.followBtnText, alreadyFollowingBsky && { color: c.textMuted }]}>
                      {alreadyFollowingBsky ? 'Following' : followBsky.isPending ? 'Following…' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={[s.card, { backgroundColor: c.card }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>Your follows</Text>
              {bskyFollowing.length === 0 ? (
                <Text style={[s.emptyText, { color: c.textMuted, borderColor: c.border }]}>
                  You're not following anyone on Bluesky yet.
                </Text>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {bskyFollowing.map(f => (
                    <View key={f.id} style={[s.followRow, { borderBottomColor: c.border }]}>
                      {/* AGORA-238: only navigable once the account has a local
                          cached row (populated on first ingested post) — same
                          conditional the fediverse tab's followRowMain uses. */}
                      <TouchableOpacity
                        style={s.followRowMain}
                        disabled={!f.username}
                        onPress={() => router.push(`/profile/${f.username}` as any)}
                      >
                        <Avatar url={f.avatar_url} name={f.display_name || f.handle} size={38} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[s.previewName, { color: c.text }]} numberOfLines={1}>
                            {f.display_name || f.handle}
                          </Text>
                          <Text style={[s.previewHandle, { color: c.textMuted }]} numberOfLines={1}>
                            @{f.handle}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {/* AGORA-249: whether this account follows the caller back. */}
                      {f.follows_back && (
                        <View style={s.pendingTag}>
                          <Ionicons name="person-circle-outline" size={13} color={c.primary} />
                          <Text style={[s.pendingText, { color: c.primary }]}>Follows you</Text>
                        </View>
                      )}
                      {f.user_id && (
                        <TouchableOpacity
                          onPress={() => setListPickerFriend({ id: f.user_id, username: f.username, display_name: f.display_name, avatar_url: f.avatar_url })}
                          style={s.iconBtn}
                        >
                          <Ionicons name="list-outline" size={18} color={c.textLight} />
                        </TouchableOpacity>
                      )}
                      {/* AGORA-236: per-follow main-feed opt-in, mirroring the
                          fediverse tab's show-in-feed toggle. */}
                      <TouchableOpacity
                        onPress={() => toggleBskyShowInFeed.mutate({ id: f.id, showInFeed: !f.show_in_feed })}
                        disabled={toggleBskyShowInFeed.isPending}
                        style={s.iconBtn}
                      >
                        <Ionicons
                          name={f.show_in_feed ? 'home' : 'home-outline'}
                          size={18}
                          color={f.show_in_feed ? c.primary : c.textLight}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => toggleBskyNotify.mutate({ id: f.id, notify: !f.notify })}
                        disabled={toggleBskyNotify.isPending || !atprotoNotificationsEnabled}
                        style={s.iconBtn}
                      >
                        <Ionicons
                          name={f.notify ? 'notifications' : 'notifications-off-outline'}
                          size={18}
                          color={f.notify && atprotoNotificationsEnabled ? c.primary : c.textLight}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => unfollowBsky.mutate(f.id)}
                        disabled={unfollowBsky.isPending}
                        style={s.iconBtn}
                      >
                        <Ionicons name="person-remove-outline" size={18} color={c.red} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              {!atprotoNotificationsEnabled && bskyFollowing.length > 0 && (
                <Text style={[s.hintText, { color: c.textMuted }]}>
                  Bluesky post notifications are off globally — turn them on in Settings → Bluesky to use per-account notify toggles.
                </Text>
              )}
            </View>

            <TouchableOpacity onPress={() => router.push('/settings?tab=bluesky' as any)}>
              <Text style={[s.hintLink, { color: c.textMuted }]}>
                Want to opt out of Bluesky entirely? That toggle lives in <Text style={{ textDecorationLine: 'underline' }}>Settings → Bluesky</Text>.
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Invite FAB */}
        {invitesEnabled && (tab === 'friends' || tab === 'requests' || tab === 'discover') && (
          <TouchableOpacity
            onPress={() => router.push('/invite-friend')}
            style={[s.fab, { backgroundColor: c.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="mail" size={20} color="white" />
            <Text style={s.fabText}>Invite a Friend</Text>
          </TouchableOpacity>
        )}
      </View>

      <FriendListPickerModal
        friend={listPickerFriend}
        visible={!!listPickerFriend}
        onClose={() => setListPickerFriend(null)}
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem:       { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:       { fontSize: 15, fontWeight: '500', textTransform: 'capitalize' },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput:   { flex: 1, fontSize: 16 },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  name:          { fontWeight: '600', fontSize: 16 },
  username:      { fontSize: 13 },
  acceptBtn:     { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
  declineBtn:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  declineBtnText:{ fontSize: 13, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { color: 'white', fontWeight: '700', fontSize: 17 },
  // ── Fediverse tab ──
  card: { borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 17 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  searchBtn: { width: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 15, marginTop: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14 },
  previewName: { fontSize: 16, fontWeight: '600' },
  previewHandle: { fontSize: 13, marginTop: 1 },
  previewSummary: { fontSize: 13, marginTop: 4 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginLeft: 8 },
  followBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
  emptyText: { fontSize: 15, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20, marginTop: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10 },
  followRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  followRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  pendingTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 4 },
  pendingText: { fontSize: 12 },
  iconBtn: { padding: 6, marginLeft: 2 },
  hintLink: { fontSize: 13, textAlign: 'center', marginTop: 4, lineHeight: 17 },
  hintText: { fontSize: 12, marginTop: 10, lineHeight: 15 },
})
