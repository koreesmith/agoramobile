import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, AppState, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useFocusEffect } from 'expo-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { reelsApi } from '../../api'
import { useReelsSupport } from '../../utils/useDestinations'
import ReelPage from '../../components/reels/ReelPage'

// AGORA-442: Reels. One video per screen, paged vertically. Only the reel on
// screen plays (ReelPage decides what mounts a player); this screen works out
// which that is, pages more in ahead of the viewer, and tells the server what
// was watched so the same clips don't come back.

type Tab = 'following' | 'discover'
type Row =
  | { kind: 'post'; key: string; post: any }
  | { kind: 'loading' | 'error' | 'empty' | 'end'; key: string }

export default function ReelsScreen() {
  const insets = useSafeAreaInsets()
  const { discoverOn } = useReelsSupport()
  const [tab, setTab] = useState<Tab>('following')
  const activeTab: Tab = tab === 'discover' && discoverOn ? 'discover' : 'following'
  const [includeViewed, setIncludeViewed] = useState(false)
  useEffect(() => { setIncludeViewed(false) }, [activeTab])

  const q = useInfiniteQuery({
    queryKey: ['reels', activeTab, includeViewed],
    queryFn: ({ pageParam }) =>
      reelsApi.list({ tab: activeTab, cursor: pageParam || undefined, include_viewed: includeViewed || undefined }).then(r => r.data),
    initialPageParam: '',
    getNextPageParam: (last: any) => last.next_cursor || undefined,
    // The list shifts as the viewer watches (watched videos drop out), so it
    // is never refetched behind their back, and it isn't kept once they leave:
    // coming back starts again from what is still unwatched.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnReconnect: false,
  })

  // Reels hidden or blocked this session stay out of the list.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [removedAuthors, setRemovedAuthors] = useState<Set<string>>(new Set())
  const posts: any[] = useMemo(() => {
    const seen = new Set<string>()
    return (q.data?.pages ?? []).flatMap((p: any) => p.posts ?? []).filter((p: any) => {
      if (seen.has(p.id) || removedIds.has(p.id) || removedAuthors.has(p.author_id)) return false
      seen.add(p.id)
      return true
    })
  }, [q.data, removedIds, removedAuthors])
  const onRemove = useCallback((id: string, blockedAuthorId?: string) => {
    setRemovedIds((s) => new Set(s).add(id))
    if (blockedAuthorId) setRemovedAuthors((s) => new Set(s).add(blockedAuthorId))
  }, [])

  // ── Playing only while this screen is in front ────────────────────────────
  const [focused, setFocused] = useState(false)
  useFocusEffect(useCallback(() => {
    setFocused(true)
    return () => setFocused(false)
  }, []))
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'))
    return () => sub.remove()
  }, [])
  const playAllowed = focused && appActive

  // ── Which reel is on screen ───────────────────────────────────────────────
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [active, setActive] = useState(0)
  const onViewable = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null; item: Row }> }) => {
    const first = viewableItems.find((v) => v.item.kind === 'post' && v.index != null)
    if (first && first.index != null) setActive(first.index)
  }).current
  const viewability = useRef({ itemVisiblePercentThreshold: 60 }).current
  useEffect(() => { setActive(0) }, [activeTab, includeViewed])

  // Page in before the viewer reaches the end.
  useEffect(() => {
    if (active >= posts.length - 3 && q.hasNextPage && !q.isFetchingNextPage && !q.isError) q.fetchNextPage()
  }, [active, posts.length, q.hasNextPage, q.isFetchingNextPage, q.isError])

  // ── Watched ───────────────────────────────────────────────────────────────
  const marked = useRef<Set<string>>(new Set())
  const onViewed = useCallback((id: string) => {
    if (marked.current.has(id)) return
    marked.current.add(id)
    reelsApi.viewed(id).catch(() => { marked.current.delete(id) })
  }, [])

  const rows: Row[] = useMemo(() => {
    const out: Row[] = posts.map((post) => ({ kind: 'post', key: post.id, post }))
    if (q.isLoading) out.push({ kind: 'loading', key: 'loading' })
    else if (q.isError && !q.data) out.push({ kind: 'error', key: 'error' })
    else if (posts.length === 0) out.push({ kind: 'empty', key: 'empty' })
    else if (!q.hasNextPage) out.push({ kind: 'end', key: 'end' })
    return out
  }, [posts, q.isLoading, q.isError, q.data, q.hasNextPage])

  const tabBtn = (t: Tab, label: string) => (
    <TouchableOpacity key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: activeTab === t }}
      style={[s.tab, activeTab === t && s.tabOn]}>
      <Text style={[s.tabText, activeTab === t && { color: '#000' }]}>{label}</Text>
    </TouchableOpacity>
  )

  const renderStatus = (kind: Row['kind']) => (
    <View style={[s.status, { width: box.w, height: box.h }]}>
      <Ionicons name="film-outline" size={38} color="rgba(255,255,255,0.6)" />
      {kind === 'loading' ? <Text style={s.statusBody}>Loading reels…</Text> : null}
      {kind === 'error' ? (
        <>
          <Text style={s.statusTitle}>Couldn't load reels</Text>
          <TouchableOpacity onPress={() => q.refetch()} style={s.statusBtn}><Text style={s.statusBtnText}>Try again</Text></TouchableOpacity>
        </>
      ) : null}
      {kind === 'empty' ? (
        <>
          <Text style={s.statusTitle}>{activeTab === 'following' ? 'No reels from the people you follow yet' : 'No public reels to show right now'}</Text>
          <Text style={s.statusBody}>
            {activeTab === 'following' ? 'Videos from your friends and the accounts you follow show up here.' : 'Public videos from this instance and its peers show up here.'}
          </Text>
          {activeTab === 'following' && discoverOn ? (
            <TouchableOpacity onPress={() => setTab('discover')} style={s.statusBtn}><Text style={s.statusBtnText}>See what's on Discover</Text></TouchableOpacity>
          ) : null}
          {!includeViewed ? (
            <TouchableOpacity onPress={() => setIncludeViewed(true)}><Text style={s.statusLink}>Show videos I've already watched</Text></TouchableOpacity>
          ) : null}
        </>
      ) : null}
      {kind === 'end' ? (
        <>
          <Text style={s.statusTitle}>You're all caught up</Text>
          <Text style={s.statusBody}>That's every reel for now. Check back later.</Text>
          {!includeViewed ? (
            <TouchableOpacity onPress={() => setIncludeViewed(true)} style={s.statusBtn}><Text style={s.statusBtnText}>Watch older videos</Text></TouchableOpacity>
          ) : null}
          {activeTab === 'following' && discoverOn ? (
            <TouchableOpacity onPress={() => setTab('discover')}><Text style={s.statusLink}>Look at Discover</Text></TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </View>
  )

  return (
    <View style={s.root} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {focused ? <StatusBar style="light" /> : null}

      {box.h > 0 ? (
        <FlatList
          key={`${activeTab}-${includeViewed}`}
          data={rows}
          keyExtractor={(r) => r.key}
          getItemLayout={(_, index) => ({ length: box.h, offset: box.h * index, index })}
          renderItem={({ item, index }) => item.kind === 'post' ? (
            <ReelPage
              post={item.post}
              width={box.w}
              height={box.h}
              active={index === active}
              // Players are released while another tab is in front, so Reels
              // doesn't hold three native decoders while someone reads the feed.
              near={focused && Math.abs(index - active) <= 1}
              playAllowed={playAllowed}
              onViewed={onViewed}
              onRemove={onRemove}
            />
          ) : renderStatus(item.kind)}
          pagingEnabled
          snapToInterval={box.h}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewability}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={3}
          // Android clips off-screen children by default, which can leave a
          // video surface blank when it scrolls back; the window already
          // keeps only three pages alive.
          removeClippedSubviews={false}
        />
      ) : null}

      {/* Tabs float over the video, below the status bar */}
      <View style={[s.tabs, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={s.tabPill}>
          {tabBtn('following', 'Following')}
          {discoverOn ? tabBtn('discover', 'Discover') : null}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#000' },
  tabs:          { position: 'absolute', left: 12, right: 12, flexDirection: 'row' },
  tabPill:       { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 18, padding: 3, gap: 2 },
  tab:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  tabOn:         { backgroundColor: '#fff' },
  tabText:       { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  status:        { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  statusTitle:   { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  statusBody:    { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  statusBtn:     { marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  statusBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  statusLink:    { color: 'rgba(255,255,255,0.7)', fontSize: 13, textDecorationLine: 'underline', marginTop: 4 },
})
