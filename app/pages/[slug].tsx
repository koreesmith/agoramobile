import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
  StyleSheet, Alert, RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState, Avatar } from '../../components/ui'
import PostCard from '../../components/PostCard'
import { pagesApi, imgUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useC } from '../../constants/ColorContext'

const PAGE_TYPE_LABELS: Record<string, string> = {
  band: 'Band',
  business: 'Business',
  organization: 'Organization',
  creator: 'Creator',
}

type Tab = 'posts' | 'about' | 'members'

const SCREEN_WIDTH = Dimensions.get('window').width
const COVER_HEIGHT = 140

export default function PageProfileScreen() {
  const c = useC()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('posts')
  const [feedPage, setFeedPage] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ['page', slug],
    queryFn: () => pagesApi.get(slug!).then(r => r.data),
    enabled: !!slug,
  })

  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ['page-feed', slug, feedPage],
    queryFn: () => pagesApi.getFeed(slug!, feedPage).then(r => r.data),
    enabled: !!slug && activeTab === 'posts',
  })

  const { data: membersData } = useQuery({
    queryKey: ['page-members', slug],
    queryFn: () => pagesApi.getMembers(slug!).then(r => r.data),
    enabled: !!slug && activeTab === 'members',
  })

  const page = pageData?.page || pageData
  const posts: any[] = feedData?.posts || []
  const members: any[] = membersData?.members || []

  const isOwner   = page?.is_owner || page?.owner_id === user?.id
  const isAdmin   = isOwner || page?.my_role === 'admin'
  const isEditor  = isAdmin || page?.my_role === 'editor'

  const subscribe = useMutation({
    mutationFn: () => page?.is_subscribed
      ? pagesApi.unsubscribe(slug!)
      : pagesApi.subscribe(slug!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['page', slug] }),
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await qc.invalidateQueries({ queryKey: ['page', slug] })
    await qc.invalidateQueries({ queryKey: ['page-feed', slug, feedPage] })
    setRefreshing(false)
  }

  if (pageLoading) return <Screen><Header title="" back /><Spinner /></Screen>
  if (!page) return <Screen><Header title="Not found" back /><EmptyState icon="alert-circle-outline" title="Page not found" /></Screen>

  const typeLabel = PAGE_TYPE_LABELS[page.page_type] || 'Page'
  const coverUri  = imgUrl(page.cover_url)
  const avatarUri = imgUrl(page.avatar_url)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'about', label: 'About' },
    ...(isEditor ? [{ key: 'members' as Tab, label: 'Members' }] : []),
  ]

  const renderPostsTab = () => (
    feedLoading
      ? <ActivityIndicator color={c.primary} style={{ marginTop: 32 }} />
      : posts.length === 0
        ? <EmptyState icon="document-text-outline" title="No posts yet" />
        : posts.map(p => <PostCard key={p.id} post={p} queryKey={['page-feed', slug, feedPage]} />)
  )

  const renderAboutTab = () => (
    <View style={{ padding: 20, gap: 14 }}>
      {page.bio ? (
        <View>
          <Text style={[s.aboutLabel, { color: c.textMuted }]}>Bio</Text>
          <Text style={[s.aboutValue, { color: c.text }]}>{page.bio}</Text>
        </View>
      ) : null}
      <View>
        <Text style={[s.aboutLabel, { color: c.textMuted }]}>Type</Text>
        <Text style={[s.aboutValue, { color: c.text }]}>{typeLabel}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 24 }}>
        <View>
          <Text style={[s.statNum, { color: c.text }]}>{page.subscriber_count ?? 0}</Text>
          <Text style={[s.statLabel, { color: c.textMuted }]}>Subscribers</Text>
        </View>
        <View>
          <Text style={[s.statNum, { color: c.text }]}>{page.post_count ?? 0}</Text>
          <Text style={[s.statLabel, { color: c.textMuted }]}>Posts</Text>
        </View>
      </View>
      {isOwner && (
        <TouchableOpacity
          style={[s.analyticsBtn, { borderColor: c.border }]}
          onPress={() => router.push(`/pages/analytics/${slug}` as any)}
        >
          <Ionicons name="bar-chart-outline" size={16} color={c.primary} />
          <Text style={[s.analyticsBtnText, { color: c.primary }]}>View Analytics</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  const renderMembersTab = () => (
    <View style={{ padding: 16, gap: 8 }}>
      {members.length === 0
        ? <EmptyState icon="people-outline" title="No members" subtitle="Invite someone to help manage this page." />
        : members.map((m: any) => (
          <View key={m.user_id} style={[s.memberRow, { borderColor: c.border, backgroundColor: c.card }]}>
            <Avatar url={imgUrl(m.avatar_url)} name={m.display_name} size={36} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[s.memberName, { color: c.text }]}>{m.display_name}</Text>
              <Text style={[s.memberRole, { color: c.textMuted }]}>{m.role}</Text>
            </View>
            {m.pending && (
              <View style={[s.pendingBadge, { backgroundColor: c.primaryBg }]}>
                <Text style={[s.pendingText, { color: c.primary }]}>Pending</Text>
              </View>
            )}
          </View>
        ))
      }
      {isAdmin && (
        <TouchableOpacity
          style={[s.inviteBtn, { borderColor: c.primary }]}
          onPress={() => router.push(`/pages/members/${slug}` as any)}
        >
          <Ionicons name="person-add-outline" size={16} color={c.primary} />
          <Text style={[s.inviteBtnText, { color: c.primary }]}>Manage Members</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  return (
    <Screen>
      <Header
        title=""
        back
        right={isAdmin
          ? <TouchableOpacity onPress={() => router.push(`/pages/edit/${slug}` as any)} style={{ padding: 8 }}>
              <Ionicons name="settings-outline" size={22} color={c.primary} />
            </TouchableOpacity>
          : undefined
        }
      />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover photo */}
        <View style={[s.coverContainer, { backgroundColor: c.primaryBg }]}>
          {coverUri
            ? <Image source={{ uri: coverUri }} style={s.cover} contentFit="cover" />
            : <View style={[s.cover, { backgroundColor: c.primaryBg }]} />
          }
        </View>

        {/* Avatar + identity */}
        <View style={[s.identityRow, { backgroundColor: c.card }]}>
          <View style={s.avatarWrap}>
            <Avatar url={avatarUri} name={page.display_name} size={72} />
          </View>
          <View style={{ flex: 1, marginLeft: 12, paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[s.displayName, { color: c.text }]}>{page.display_name}</Text>
              {page.is_verified && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
            </View>
            <View style={[s.typeBadge, { backgroundColor: c.primaryBg, alignSelf: 'flex-start', marginTop: 4 }]}>
              <Text style={[s.typeBadgeText, { color: c.primary }]}>{typeLabel}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => subscribe.mutate()}
            style={[
              s.subBtn,
              { borderColor: page.is_subscribed ? c.primary : c.border,
                backgroundColor: page.is_subscribed ? c.primaryBg : c.primary },
            ]}
          >
            <Text style={[s.subBtnText, { color: page.is_subscribed ? c.primary : '#fff' }]}>
              {page.is_subscribed ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={[s.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, activeTab === tab.key && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[s.tabText, { color: activeTab === tab.key ? c.primary : c.textMuted }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'posts'   && renderPostsTab()}
        {activeTab === 'about'   && renderAboutTab()}
        {activeTab === 'members' && renderMembersTab()}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  coverContainer: { height: COVER_HEIGHT },
  cover:          { width: '100%', height: COVER_HEIGHT },
  identityRow:    { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 14, marginTop: -24 },
  avatarWrap:     { borderRadius: 40, borderWidth: 3, borderColor: '#fff', overflow: 'hidden' },
  displayName:    { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  typeBadge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  typeBadgeText:  { fontSize: 12, fontWeight: '700' },
  subBtn:         { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', marginTop: 8 },
  subBtnText:     { fontSize: 15, fontWeight: '700' },
  tabBar:         { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab:            { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText:        { fontSize: 15, fontWeight: '600' },
  aboutLabel:     { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  aboutValue:     { fontSize: 16 },
  statNum:        { fontSize: 22, fontWeight: '700' },
  statLabel:      { fontSize: 13 },
  analyticsBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  analyticsBtnText:{ fontSize: 15, fontWeight: '600' },
  memberRow:      { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10 },
  memberName:     { fontSize: 16, fontWeight: '600' },
  memberRole:     { fontSize: 13, textTransform: 'capitalize' },
  pendingBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  pendingText:    { fontSize: 12, fontWeight: '600' },
  inviteBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  inviteBtnText:  { fontSize: 16, fontWeight: '600' },
})
