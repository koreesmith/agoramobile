import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, Alert, StyleSheet } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Spinner, Avatar, LinkedText, renderName } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { usersApi, friendsApi, feedApi, dmApi, imgUrl, blockApi, moderationApi, albumsApi, federationApi, atprotoApi } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useBlockStore } from '../../store/blocks'
import { useC } from '../../constants/ColorContext'
import { handle } from '../../utils/handle'

export default function ProfileViewScreen() {
  const c = useC()
  const { username } = useLocalSearchParams<{ username: string }>()
  const { user: me } = useAuthStore()
  const { addBlock, removeBlock, isBlocked } = useBlockStore()
  const qc = useQueryClient()

  const { data: profile, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.getProfile(username!).then(r => r.data),
  })

  const isSelf = me?.username === username
  const status = profile?.friend_status
  const canSeeTimeline = isSelf || (!profile?.hide_timeline && (!profile?.profile_private || status === 'accepted'))

  const { data: postsData } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => feedApi.getUserPosts(username!).then(r => r.data),
    enabled: !!profile && canSeeTimeline,
  })

  const { data: albumsData } = useQuery({
    queryKey: ['user-albums', username],
    queryFn: () => {
      if (isSelf) return albumsApi.list().then(r => r.data)
      return albumsApi.getUserAlbums(username!).then(r => r.data)
    },
    enabled: !!profile,
  })
  const albumCount: number = albumsData?.albums?.length ?? albumsData?.length ?? 0
  const showAlbums = isSelf || albumCount > 0

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['profile', username] })
    qc.invalidateQueries({ queryKey: ['friends'] })
    qc.invalidateQueries({ queryKey: ['requests'] })
  }
  const sendReq  = useMutation({
    mutationFn: () => friendsApi.sendRequest(profile!.id),
    onSuccess: inv,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not send friend request'),
  })
  const accept   = useMutation({ mutationFn: () => friendsApi.acceptRequest(profile!.id), onSuccess: inv })
  const unfriend = useMutation({ mutationFn: () => friendsApi.unfriend(profile!.id), onSuccess: inv })
  const startDM  = useMutation({
    mutationFn: () => dmApi.startConversation(username!),
    onSuccess: (res) => router.push(`/conversation/${res.data.id}`)
  })

  // AGORA-167: fediverse accounts have no friending concept — follow/notify
  // (ap_following) is the equivalent, surfaced here instead of Add friend.
  const isFediverse = !!(profile as any)?.ap_actor_url
  const followFed = useMutation({
    mutationFn: () => federationApi.followFediverseAccount((profile as any).ap_actor_url),
    onSuccess: inv,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not follow this account'),
  })
  const unfollowFed = useMutation({
    mutationFn: () => federationApi.unfollowFediverseAccount((profile as any).follow_id),
    onSuccess: inv,
  })
  const toggleFedNotify = useMutation({
    mutationFn: () => federationApi.toggleFollowNotify((profile as any).follow_id, !(profile as any)?.follow_notify),
    onSuccess: inv,
  })

  // AGORA-234: native Bluesky accounts have no friending concept either —
  // follow/notify (at_following) is the equivalent, same as the fediverse
  // block above but against the AT Proto endpoints. profile.username is the
  // account's Bluesky handle for these rows (getOrCreateRemoteATUser stores
  // the handle as the username), so it doubles as the "actor" to follow.
  const isBluesky = (profile as any)?.remote_instance === 'bsky.app'
  const followBsky = useMutation({
    mutationFn: () => atprotoApi.followBlueskyAccount(username!),
    onSuccess: inv,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not follow this account'),
  })
  const unfollowBsky = useMutation({
    mutationFn: () => atprotoApi.unfollowBlueskyAccount((profile as any).follow_id),
    onSuccess: inv,
  })
  const toggleBskyNotify = useMutation({
    mutationFn: () => atprotoApi.toggleFollowNotify((profile as any).follow_id, !(profile as any)?.follow_notify),
    onSuccess: inv,
  })

  const notifying = !!(profile as any)?.notify
  const followNotif = useMutation({
    mutationFn: () => notifying
      ? usersApi.unfollowNotifications(username!)
      : usersApi.followNotifications(username!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', username] }),
    onError: () => Alert.alert('Error', 'Could not update notification settings'),
  })

  const blocked = profile ? isBlocked(profile.id) : false

  const blockUser = useMutation({
    mutationFn: async () => {
      await blockApi.blockUser(username)
      // Notify developer automatically per Apple guideline 1.2
      await moderationApi.createReport({
        reported_user_id: profile!.id,
        violation_type: 'harassment',
        details: 'User blocked by another user.',
      }).catch(() => {})
    },
    onSuccess: () => {
      addBlock(profile!.id)
      Alert.alert('User blocked', `@${username} has been blocked and removed from your feed.`)
      router.back()
    },
    onError: () => Alert.alert('Error', 'Could not block user. Please try again.'),
  })

  const unblockUser = useMutation({
    mutationFn: () => blockApi.unblockUser(username),
    onSuccess: () => {
      removeBlock(profile!.id)
      Alert.alert('Unblocked', `@${username} has been unblocked.`)
    },
    onError: () => Alert.alert('Error', 'Could not unblock user. Please try again.'),
  })

  const posts = postsData?.posts || []

  if (isLoading) return <Screen><Spinner /></Screen>
  if (!profile) return (
    <Screen>
      <Text style={{ textAlign: 'center', marginTop: 80, color: c.textMuted }}>User not found</Text>
    </Screen>
  )

  return (
    <Screen>
      <Stack.Screen options={{
        headerShown: true,
        headerTitle: profile.display_name || username,
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.primary,
      }} />
      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}>

        {/* Cover */}
        <View style={[s.cover, { backgroundColor: c.primaryBg }]}>
          {profile.cover_url
            ? <Image source={{ uri: imgUrl(profile.cover_url) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : null}
        </View>

        {/* Profile card */}
        <View style={[s.profileCard, { backgroundColor: c.card }]}>
          <View style={s.avatarRow}>
            <View style={[s.avatarBorder, { borderColor: c.card }]}>
              <Avatar url={profile.avatar_url} name={profile.display_name || profile.username} size={72} />
            </View>
            {!isSelf && (
              <View style={s.actions}>
                {isFediverse ? (
                  <>
                    <TouchableOpacity
                      onPress={() => (profile as any).following
                        ? Alert.alert('Unfollow?', `Unfollow ${profile.display_name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Unfollow', style: 'destructive', onPress: () => unfollowFed.mutate() },
                          ])
                        : followFed.mutate()}
                      disabled={followFed.isPending || unfollowFed.isPending}
                      style={[s.actionBtn, (profile as any).following
                        ? { borderColor: c.border }
                        : { borderColor: c.primary, backgroundColor: c.primary }]}
                    >
                      <Ionicons
                        name={(profile as any).following ? 'checkmark' : 'person-add-outline'}
                        size={15}
                        color={(profile as any).following ? c.textMd : 'white'}
                      />
                      <Text style={[s.actionBtnText, { color: (profile as any).following ? c.textMd : 'white' }]}>
                        {(profile as any).following ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                    {(profile as any).following && (
                      <TouchableOpacity
                        onPress={() => toggleFedNotify.mutate()}
                        disabled={toggleFedNotify.isPending}
                        style={[s.actionBtn, { borderColor: (profile as any).follow_notify ? c.primary : c.border, backgroundColor: (profile as any).follow_notify ? c.primaryBg : 'transparent' }]}
                      >
                        <Ionicons
                          name={(profile as any).follow_notify ? 'notifications' : 'notifications-outline'}
                          size={15}
                          color={(profile as any).follow_notify ? c.primary : c.textMuted}
                        />
                        <Text style={[s.actionBtnText, { color: (profile as any).follow_notify ? c.primary : c.textMuted }]}>
                          {(profile as any).follow_notify ? 'Notifying' : 'Notify'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : isBluesky ? (
                  <>
                    <TouchableOpacity
                      onPress={() => (profile as any).following
                        ? Alert.alert('Unfollow?', `Unfollow ${profile.display_name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Unfollow', style: 'destructive', onPress: () => unfollowBsky.mutate() },
                          ])
                        : followBsky.mutate()}
                      disabled={followBsky.isPending || unfollowBsky.isPending}
                      style={[s.actionBtn, (profile as any).following
                        ? { borderColor: c.border }
                        : { borderColor: c.primary, backgroundColor: c.primary }]}
                    >
                      <Ionicons
                        name={(profile as any).following ? 'checkmark' : 'person-add-outline'}
                        size={15}
                        color={(profile as any).following ? c.textMd : 'white'}
                      />
                      <Text style={[s.actionBtnText, { color: (profile as any).following ? c.textMd : 'white' }]}>
                        {(profile as any).following ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                    {(profile as any).following && (
                      <TouchableOpacity
                        onPress={() => toggleBskyNotify.mutate()}
                        disabled={toggleBskyNotify.isPending}
                        style={[s.actionBtn, { borderColor: (profile as any).follow_notify ? c.primary : c.border, backgroundColor: (profile as any).follow_notify ? c.primaryBg : 'transparent' }]}
                      >
                        <Ionicons
                          name={(profile as any).follow_notify ? 'notifications' : 'notifications-outline'}
                          size={15}
                          color={(profile as any).follow_notify ? c.primary : c.textMuted}
                        />
                        <Text style={[s.actionBtnText, { color: (profile as any).follow_notify ? c.primary : c.textMuted }]}>
                          {(profile as any).follow_notify ? 'Notifying' : 'Notify'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    {status === 'accepted' && (
                      <TouchableOpacity onPress={() => startDM.mutate()} style={[s.actionBtn, { borderColor: c.border }]}>
                        <Ionicons name="chatbubble-outline" size={15} color={c.primary} />
                        <Text style={[s.actionBtnText, { color: c.textMd }]}>Message</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => followNotif.mutate()}
                      disabled={followNotif.isPending}
                      style={[s.actionBtn, { borderColor: notifying ? c.primary : c.border, backgroundColor: notifying ? c.primaryBg : 'transparent' }]}
                    >
                      <Ionicons name={notifying ? 'notifications' : 'notifications-outline'} size={15} color={notifying ? c.primary : c.textMuted} />
                      <Text style={[s.actionBtnText, { color: notifying ? c.primary : c.textMuted }]}>{notifying ? 'Notifying' : 'Notify'}</Text>
                    </TouchableOpacity>
                    {!status && (
                      <TouchableOpacity onPress={() => sendReq.mutate()} disabled={sendReq.isPending}
                        style={[s.primaryBtn, { backgroundColor: c.primary }]}>
                        <Text style={s.primaryBtnText}>Add friend</Text>
                      </TouchableOpacity>
                    )}
                    {status === 'pending' && (
                      <View style={[s.actionBtn, { borderColor: c.border }]}>
                        <Text style={{ fontSize: 13, color: c.textMuted }}>Pending</Text>
                      </View>
                    )}
                    {status === 'pending_incoming' && (
                      <TouchableOpacity onPress={() => accept.mutate()}
                        style={[s.primaryBtn, { backgroundColor: c.primary }]}>
                        <Text style={s.primaryBtnText}>Accept</Text>
                      </TouchableOpacity>
                    )}
                    {status === 'accepted' && (
                      <TouchableOpacity onPress={() => Alert.alert('Unfriend?', undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Unfriend', style: 'destructive', onPress: () => unfriend.mutate() },
                      ])} style={[s.actionBtn, { borderColor: c.border }]}>
                        <Ionicons name="checkmark" size={15} color={c.green} />
                        <Text style={[s.actionBtnText, { color: c.textMd }]}>Friends</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                {blocked ? (
                  <TouchableOpacity
                    onPress={() => Alert.alert('Unblock user?', `@${username} will be able to appear in your feed again.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Unblock', onPress: () => unblockUser.mutate() },
                    ])}
                    disabled={unblockUser.isPending}
                    style={[s.actionBtn, { borderColor: c.border }]}
                  >
                    <Ionicons name="remove-circle-outline" size={15} color={c.textMuted} />
                    <Text style={[s.actionBtnText, { color: c.textMuted }]}>Unblock</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => Alert.alert('Block user?', `@${username} will be removed from your feed and won't be able to interact with you.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Block', style: 'destructive', onPress: () => blockUser.mutate() },
                    ])}
                    disabled={blockUser.isPending}
                    style={[s.actionBtn, { borderColor: c.border }]}
                  >
                    <Ionicons name="ban-outline" size={15} color={c.red} />
                    <Text style={[s.actionBtnText, { color: c.red }]}>Block</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <Text style={[s.name, { color: c.text }]}>{profile.display_name ? renderName(profile.display_name, profile.emojis) : profile.username}</Text>
            {profile.pronouns ? <Text style={{ fontSize: 13, color: c.textLight }}>({profile.pronouns})</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={[s.username, { color: c.textMuted }]}>{handle(profile.username, (profile as any).is_remote, (profile as any).remote_instance)}</Text>
            {/* AGORA-249: fediverse/Bluesky mutual-follow indicator — meaningful
                regardless of whether the viewer follows them back. */}
            {(isFediverse || isBluesky) && (profile as any).follows_back && (
              <View style={[s.followsYouTag, { backgroundColor: c.primaryBg }]}>
                <Ionicons name="person-circle-outline" size={12} color={c.primary} />
                <Text style={[s.followsYouText, { color: c.primary }]}>Follows you</Text>
              </View>
            )}
          </View>
          {profile.bio ? <LinkedText text={profile.bio} style={[s.bio, { color: c.textMd }]} emojis={profile.emojis} /> : null}
          {(profile as any).location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="location-outline" size={13} color={c.textMuted} />
              <Text style={{ fontSize: 13, color: c.textMuted }}>{(profile as any).location}</Text>
            </View>
          ) : null}
          {(profile as any).website ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="link-outline" size={13} color={c.primary} />
              <Text style={{ fontSize: 13, color: c.primary }}>{(profile as any).website}</Text>
            </View>
          ) : null}
          {/* AGORA-253: a remote account's own post/follower/following
              counts, same layout Bluesky itself shows on a profile — in
              place of "friends", which Agora has no concept of for an
              account it doesn't actually track the social graph of. */}
          {(isFediverse || isBluesky) && (profile as any).remote_follower_count != null ? (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
              <Text style={{ fontSize: 14, color: c.textMuted }}>
                <Text style={{ fontWeight: 'bold', color: c.text }}>{(profile as any).remote_post_count ?? 0}</Text> posts
              </Text>
              <Text style={{ fontSize: 14, color: c.textMuted }}>
                <Text style={{ fontWeight: 'bold', color: c.text }}>{(profile as any).remote_follower_count ?? 0}</Text> followers
              </Text>
              <Text style={{ fontSize: 14, color: c.textMuted }}>
                <Text style={{ fontWeight: 'bold', color: c.text }}>{(profile as any).remote_following_count ?? 0}</Text> following
              </Text>
            </View>
          ) : (
            <Text style={[s.friends, { color: c.textMuted }]}>
              <Text style={{ fontWeight: 'bold', color: c.text }}>{profile.friend_count || 0}</Text> friends
            </Text>
          )}
          {showAlbums && (
            <TouchableOpacity
              onPress={() => router.push(`/albums/${username}`)}
              style={[s.albumsRow, { borderTopColor: c.border }]}
            >
              <Ionicons name="images-outline" size={16} color={c.primary} />
              <Text style={[s.albumsText, { color: c.primary }]}>
                Albums{albumCount > 0 ? ` (${albumCount})` : ''}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={c.textLight} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}
        </View>

        {/* Timeline */}
        {!canSeeTimeline ? (
          <View style={[s.private, { backgroundColor: c.card, marginTop: 8 }]}>
            <Ionicons name="lock-closed" size={32} color={c.textLight} />
            {(profile as any).hide_timeline ? (
              <>
                <Text style={[s.privateTitle, { color: c.textMd }]}>Timeline hidden</Text>
                <Text style={[s.privateText, { color: c.textMuted }]}>
                  {profile.display_name} has hidden their post timeline.
                </Text>
              </>
            ) : (
              <>
                <Text style={[s.privateTitle, { color: c.textMd }]}>This profile is private</Text>
                <Text style={[s.privateText, { color: c.textMuted }]}>
                  Add {profile.display_name} as a friend to see their posts.
                </Text>
              </>
            )}
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            {posts.map((post: any) => (
              <PostCard key={post.id} post={post} queryKey={['user-posts', username]} />
            ))}
            {posts.length === 0 && (
              <Text style={[s.noPosts, { color: c.textLight }]}>No posts yet.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  cover:         { height: 100 },
  profileCard:   { paddingHorizontal: 16, paddingBottom: 16 },
  avatarRow:     { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -36, marginBottom: 12 },
  avatarBorder:  { borderWidth: 4, borderRadius: 40 },
  actions:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 36 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
  primaryBtn:    { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  primaryBtnText:{ color: 'white', fontWeight: '600', fontSize: 13 },
  name:          { fontSize: 20, fontWeight: 'bold' },
  username:      { fontSize: 14, marginTop: 2 },
  followsYouTag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  followsYouText:{ fontSize: 11, fontWeight: '500' },
  bio:           { fontSize: 14, marginTop: 6, lineHeight: 20 },
  friends:       { fontSize: 14, marginTop: 10 },
  albumsRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  albumsText:    { fontSize: 14, fontWeight: '500' },
  private:       { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, marginHorizontal: 12, borderRadius: 16 },
  privateTitle:  { fontSize: 16, fontWeight: '600', marginTop: 12 },
  privateText:   { fontSize: 14, textAlign: 'center', marginTop: 4 },
  noPosts:       { textAlign: 'center', fontSize: 14, paddingVertical: 48 },
})
