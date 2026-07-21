import { useState, useEffect } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, Avatar, renderName } from '../components/ui'
import PostCard from '../components/PostCard'
import { searchApi, pagesApi, atprotoApi, imgUrl } from '../api'
import { useC } from '../constants/ColorContext'
import { handle } from '../utils/handle'
import { formatDistanceToNow } from 'date-fns'

type Tab = 'users' | 'posts' | 'pages'

export default function SearchScreen() {
  const c = useC()
  // AGORA-217: a hashtag tap elsewhere (LinkedText) navigates here as
  // /search?tab=posts&q=%23tag — pre-fill from route params on mount.
  const params = useLocalSearchParams<{ tab?: string; q?: string }>()
  const [inputValue, setInputValue] = useState(params.q || '')
  const [query, setQuery] = useState(params.q || '')
  const [activeTab, setActiveTab] = useState<Tab>(
    params.tab === 'posts' || params.tab === 'pages' ? (params.tab as Tab) : 'users'
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputValue.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const isFederated = query.includes('@') && query.includes('.')

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['search-users', query],
    queryFn: () => searchApi.searchUsers(query).then(r => r.data),
    enabled: query.length >= 2,
  })

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['search-posts', query],
    queryFn: () => searchApi.searchPosts(query).then(r => r.data),
    enabled: query.length >= 2,
  })

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['search-pages', query],
    queryFn: () => pagesApi.search(query).then(r => r.data),
    enabled: query.length >= 2,
  })

  // AGORA-215/216: real, live, network-wide Bluesky results — kept separate
  // from searchApi's own Agora+cached-remote rows so the UI can label
  // coverage honestly per source (AGORA-217).
  const { data: bskyActorsData, isLoading: bskyActorsLoading } = useQuery({
    queryKey: ['search-bsky-actors', query],
    queryFn: () => atprotoApi.searchBlueskyActors(query).then(r => r.data),
    enabled: query.length >= 2,
  })
  const { data: bskyPostsData, isLoading: bskyPostsLoading } = useQuery({
    queryKey: ['search-bsky-posts', query],
    queryFn: () => atprotoApi.searchBlueskyPosts(query).then(r => r.data),
    enabled: query.length >= 2,
  })
  const followBluesky = useMutation({
    mutationFn: (actor: string) => atprotoApi.followBlueskyAccount(actor),
  })

  const users: any[] = usersData?.users || []
  const posts: any[] = postsData?.posts || []
  const pages: any[] = pagesData?.pages || []

  // 'bsky.app' is the remote_instance marker AGORA-197's own ingestion
  // stamps on Bluesky-origin rows (never used by fediverse ingestion), so it
  // cleanly separates "on the fediverse" from "on Bluesky" within the same
  // already-cached users/posts result sets.
  const agoraUsers = users.filter(u => !u.is_remote)
  const fediverseUsers = users.filter(u => u.is_remote && u.remote_instance !== 'bsky.app')
  const bskyActors: any[] = bskyActorsData?.disabled ? [] : (bskyActorsData?.actors || [])

  const agoraPosts = posts.filter(p => !p.is_remote)
  const fediversePosts = posts.filter(p => p.is_remote && p.remote_instance !== 'bsky.app')
  const cachedBskyPosts = posts.filter(p => p.is_remote && p.remote_instance === 'bsky.app')
  const liveBskyPosts: any[] = bskyPostsData?.disabled ? [] : (bskyPostsData?.posts || [])

  const friendStatusLabel = (status: string | undefined) => {
    if (!status || status === 'none') return null
    if (status === 'accepted') return 'Friends'
    if (status === 'pending') return 'Pending'
    if (status === 'sent') return 'Requested'
    return null
  }

  const renderUserRow = ({ item }: { item: any }) => {
    const label = friendStatusLabel(item.friend_status)
    return (
      <TouchableOpacity
        style={[s.userRow, { borderBottomColor: c.border, backgroundColor: c.card }]}
        onPress={() => router.push(`/profile/${item.username}`)}
        activeOpacity={0.7}
      >
        <Avatar url={item.avatar_url} name={item.display_name || item.username} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[s.displayName, { color: c.text }]}>{item.display_name ? renderName(item.display_name, item.emojis) : item.username}</Text>
          <Text style={[s.username, { color: c.textMuted }]}>{handle(item.username, item.is_remote, item.remote_instance)}</Text>
        </View>
        {label && (
          <View style={[s.badge, { backgroundColor: c.primaryBg, borderColor: c.primaryLt }]}>
            <Text style={[s.badgeText, { color: c.primary }]}>{label}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    )
  }

  const isLoading = activeTab === 'users' ? (usersLoading || bskyActorsLoading)
    : activeTab === 'posts' ? (postsLoading || bskyPostsLoading)
    : pagesLoading

  const renderContent = () => {
    if (!query) {
      return (
        <View style={s.emptyState}>
          <Ionicons name="search-outline" size={48} color={c.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[s.emptyTitle, { color: c.textMd }]}>Search for people, posts, or pages</Text>
          <Text style={[s.emptySub, { color: c.textLight }]}>Type at least 2 characters to search</Text>
        </View>
      )
    }

    if (query.length < 2) {
      return (
        <View style={s.emptyState}>
          <Text style={[s.emptySub, { color: c.textLight }]}>Type at least 2 characters to search</Text>
        </View>
      )
    }

    if (isLoading) return <Spinner />

    // Users tab — grouped by source so coverage isn't oversold: the
    // fediverse group is only ever accounts already known to this instance,
    // while the Bluesky group is a real, live, network-wide search
    // (AGORA-215/216/217).
    if (activeTab === 'users') {
      if (agoraUsers.length === 0 && fediverseUsers.length === 0 && bskyActors.length === 0) {
        return (
          <View style={s.emptyState}>
            {isFederated && (
              <View style={[s.federatedHint, { backgroundColor: c.primaryBg, borderColor: c.primaryLt }]}>
                <Ionicons name="globe-outline" size={16} color={c.primary} style={{ marginRight: 6 }} />
                <Text style={[s.federatedText, { color: c.primary }]}>
                  Try searching for federated users by their handle
                </Text>
              </View>
            )}
            <Ionicons name="person-outline" size={40} color={c.textMuted} style={{ marginBottom: 10 }} />
            <Text style={[s.emptyTitle, { color: c.textMd }]}>No results for "{query}"</Text>
          </View>
        )
      }
      return (
        <>
          {isFederated && (
            <View style={[s.federatedHint, { backgroundColor: c.primaryBg, borderColor: c.primaryLt, margin: 12 }]}>
              <Ionicons name="globe-outline" size={16} color={c.primary} style={{ marginRight: 6 }} />
              <Text style={[s.federatedText, { color: c.primary }]}>
                Try searching for federated users by their handle
              </Text>
            </View>
          )}
          <ResultGroup title="On Agora" count={agoraUsers.length} c={c}>
            <FlatList data={agoraUsers} keyExtractor={u => u.id} renderItem={renderUserRow} scrollEnabled={false} />
          </ResultGroup>
          <ResultGroup title="On the Fediverse (already known to this instance)" count={fediverseUsers.length} c={c}>
            <FlatList data={fediverseUsers} keyExtractor={u => u.id} renderItem={renderUserRow} scrollEnabled={false} />
          </ResultGroup>
          <ResultGroup title="On Bluesky" count={bskyActors.length} c={c}>
            <FlatList
              data={bskyActors}
              keyExtractor={a => a.did}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <BlueskyActorRow actor={item} c={c}
                  onFollow={() => followBluesky.mutate(item.did)} followPending={followBluesky.isPending} />
              )}
            />
          </ResultGroup>
        </>
      )
    }

    // Pages tab
    if (activeTab === 'pages') {
      if (pages.length === 0) {
        return (
          <View style={s.emptyState}>
            <Ionicons name="bookmark-outline" size={40} color={c.textMuted} style={{ marginBottom: 10 }} />
            <Text style={[s.emptyTitle, { color: c.textMd }]}>No pages found for "{query}"</Text>
          </View>
        )
      }
      return (
        <FlatList
          data={pages}
          keyExtractor={p => p.slug || p.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.userRow, { borderBottomColor: c.border, backgroundColor: c.card }]}
              onPress={() => router.push(`/pages/${item.slug}` as any)}
              activeOpacity={0.7}
            >
              <Avatar url={imgUrl(item.avatar_url)} name={item.display_name} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.displayName, { color: c.text }]}>{item.display_name}</Text>
                <Text style={[s.username, { color: c.textMuted }]}>@{item.slug}</Text>
              </View>
              {item.page_type && (
                <View style={[s.badge, { backgroundColor: c.primaryBg, borderColor: c.primaryLt, marginRight: 6 }]}>
                  <Text style={[s.badgeText, { color: c.primary }]}>
                    {item.page_type.charAt(0).toUpperCase() + item.page_type.slice(1)}
                  </Text>
                </View>
              )}
              {item.subscriber_count !== undefined && (
                <View style={[s.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
                  <Ionicons name="people-outline" size={11} color={c.textMuted} />
                  <Text style={[s.badgeText, { color: c.textMuted, marginLeft: 2 }]}>{item.subscriber_count}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}
        />
      )
    }

    // Posts tab — same source grouping as Users. The Bluesky group mixes
    // already-cached rows (this instance's own posts table, AGORA-214) with
    // live network results (AGORA-216); both are genuinely "on Bluesky",
    // unlike the fediverse group which is explicitly scoped to what's
    // already cached.
    if (agoraPosts.length === 0 && fediversePosts.length === 0 && cachedBskyPosts.length === 0 && liveBskyPosts.length === 0) {
      return (
        <View style={s.emptyState}>
          <Ionicons name="document-text-outline" size={40} color={c.textMuted} style={{ marginBottom: 10 }} />
          <Text style={[s.emptyTitle, { color: c.textMd }]}>No results for "{query}"</Text>
        </View>
      )
    }

    return (
      <>
        <ResultGroup title="On Agora" count={agoraPosts.length} c={c}>
          <FlatList data={agoraPosts} keyExtractor={p => p.id} scrollEnabled={false}
            renderItem={({ item }) => <PostCard post={item} queryKey={['search-posts', query]} />} />
        </ResultGroup>
        <ResultGroup title="On the Fediverse (already known to this instance)" count={fediversePosts.length} c={c}>
          <FlatList data={fediversePosts} keyExtractor={p => p.id} scrollEnabled={false}
            renderItem={({ item }) => <PostCard post={item} queryKey={['search-posts', query]} />} />
        </ResultGroup>
        <ResultGroup title="On Bluesky" count={cachedBskyPosts.length + liveBskyPosts.length} c={c}>
          <FlatList data={cachedBskyPosts} keyExtractor={p => p.id} scrollEnabled={false}
            renderItem={({ item }) => <PostCard post={item} queryKey={['search-posts', query]} />} />
          <FlatList data={liveBskyPosts} keyExtractor={p => p.uri} scrollEnabled={false}
            renderItem={({ item }) => <BlueskyPostRow post={item} c={c} />} />
        </ResultGroup>
      </>
    )
  }

  return (
    <Screen>
      <Header title="Search" back />
      <View style={[s.inputWrap, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <Ionicons name="search-outline" size={18} color={c.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={[s.input, { color: c.text }]}
          placeholder="Search people, posts, or pages..."
          placeholderTextColor={c.textLight}
          value={inputValue}
          onChangeText={setInputValue}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {inputValue.length > 0 && (
          <TouchableOpacity onPress={() => { setInputValue(''); setQuery('') }}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[s.tabs, { borderBottomColor: c.border }]}>
        {(['users', 'posts', 'pages'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[s.tab, activeTab === tab && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
          >
            <Text style={[s.tabText, { color: activeTab === tab ? c.primary : c.textMuted }]}>
              {tab === 'users' ? 'Users' : tab === 'posts' ? 'Posts' : 'Pages'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={renderContent()}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
      />
    </Screen>
  )
}

// ── Result group wrapper (AGORA-217) — hides itself when empty rather than
// rendering an empty labeled section for a source with no matches.
function ResultGroup({ title, count, c, children }: { title: string, count: number, c: any, children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[s.groupTitle, { color: c.textMuted }]}>{title}</Text>
      {children}
    </View>
  )
}

// ── Bluesky actor row (AGORA-215/217) ───────────────────────────────────────
// Real, live, network-wide — unlike renderUserRow's Agora/fediverse rows,
// this never came from this instance's own users table, so it opens
// bsky.app rather than an in-app /profile/:username route, and its only
// action is Follow (AGORA-195's existing followBlueskyAccount), no
// friend-request flow.
function BlueskyActorRow({ actor: a, c, onFollow, followPending }: {
  actor: any, c: any, onFollow: () => void, followPending: boolean
}) {
  const [followed, setFollowed] = useState(false)
  const handleFollow = () => { setFollowed(true); onFollow() }

  return (
    <TouchableOpacity
      style={[s.userRow, { borderBottomColor: c.border, backgroundColor: c.card }]}
      onPress={() => Linking.openURL(`https://bsky.app/profile/${a.handle}`)}
      activeOpacity={0.7}
    >
      <Avatar url={a.avatar_url} name={a.display_name || a.handle} size={44} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[s.displayName, { color: c.text }]}>{a.display_name || a.handle}</Text>
        <Text style={[s.username, { color: c.textMuted }]}>@{a.handle} · Bluesky</Text>
      </View>
      <TouchableOpacity
        disabled={followPending || followed}
        onPress={handleFollow}
        style={[s.followBtn, { backgroundColor: c.primary, opacity: followPending || followed ? 0.6 : 1 }]}
      >
        <Text style={s.followBtnText}>{followed ? 'Following' : 'Follow'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

// ── Bluesky post row (AGORA-216/217) ────────────────────────────────────────
// Never ingested into the local posts table (the ticket's own explicit
// read-only constraint), so there's no local post to hand to PostCard —
// opens the real bsky.app post instead.
function BlueskyPostRow({ post: p, c }: { post: any, c: any }) {
  // at://did/app.bsky.feed.post/rkey — bsky.app's own web URL takes the
  // handle (not the DID) plus that trailing rkey.
  const rkey = p.uri.split('/').pop()
  const url = `https://bsky.app/profile/${p.author_handle}/post/${rkey}`

  return (
    <TouchableOpacity
      style={[s.bskyPost, { borderBottomColor: c.border, backgroundColor: c.card }]}
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Avatar url={p.author_avatar_url} name={p.author_display_name || p.author_handle} size={28} />
        <Text style={[s.displayName, { color: c.text, marginLeft: 8, fontSize: 14 }]}>
          {p.author_display_name || p.author_handle}
        </Text>
        <Text style={[s.username, { color: c.textMuted, marginLeft: 4 }]}>@{p.author_handle}</Text>
        <Text style={[s.username, { color: c.textMuted, marginLeft: 'auto' }]}>
          {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
        </Text>
      </View>
      <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={3}>{p.text}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <Ionicons name="heart-outline" size={14} color={c.textMuted} />
        <Text style={[s.username, { color: c.textMuted, marginLeft: 4, marginRight: 12 }]}>{p.like_count}</Text>
        <Ionicons name="open-outline" size={14} color={c.textMuted} />
        <Text style={[s.username, { color: c.textMuted, marginLeft: 4 }]}>Bluesky</Text>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  followBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bskyPost: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    fontSize: 13,
    marginTop: 1,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
  },
  federatedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  federatedText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
})
