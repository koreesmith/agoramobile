import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, EmptyState, Avatar } from '../../components/ui'
import { pagesApi, imgUrl } from '../../api'
import { useC } from '../../constants/ColorContext'

const PAGE_TYPE_LABELS: Record<string, string> = {
  band: 'Band',
  business: 'Business',
  organization: 'Organization',
  creator: 'Creator',
}

function PageRow({ page, onToggle }: { page: any; onToggle: () => void }) {
  const c = useC()
  const typeLabel = PAGE_TYPE_LABELS[page.page_type] || 'Page'

  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: c.card, borderBottomColor: c.border }]}
      onPress={() => router.push(`/pages/${page.slug}` as any)}
      activeOpacity={0.75}
    >
      <Avatar url={imgUrl(page.avatar_url)} name={page.display_name} size={48} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{page.display_name}</Text>
          {page.is_verified && <Ionicons name="checkmark-circle" size={14} color={c.primary} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <View style={[s.typeBadge, { backgroundColor: c.primaryBg }]}>
            <Text style={[s.typeBadgeText, { color: c.primary }]}>{typeLabel}</Text>
          </View>
          <Text style={[s.meta, { color: c.textMuted }]}>
            {page.subscriber_count ?? 0} {page.subscriber_count === 1 ? 'subscriber' : 'subscribers'}
          </Text>
        </View>
        {page.bio ? (
          <Text style={[s.bio, { color: c.textMuted }]} numberOfLines={1}>{page.bio}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onToggle}
        style={[
          s.subBtn,
          { borderColor: page.is_subscribed ? c.primary : c.border,
            backgroundColor: page.is_subscribed ? c.primaryBg : 'transparent' },
        ]}
      >
        <Text style={[s.subBtnText, { color: page.is_subscribed ? c.primary : c.textMuted }]}>
          {page.is_subscribed ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

export default function PagesDiscoveryScreen() {
  const c = useC()
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data: featuredData, isLoading: featuredLoading } = useQuery({
    queryKey: ['pages', 'featured'],
    queryFn: () => pagesApi.list(true).then(r => r.data),
  })

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['pages', 'all'],
    queryFn: () => pagesApi.list().then(r => r.data),
  })

  const featured: any[] = featuredData?.pages || []
  const all: any[] = allData?.pages || []

  // Deduplicate: remove featured from all list
  const featuredSlugs = new Set(featured.map((p: any) => p.slug))
  const discover = all.filter((p: any) => !featuredSlugs.has(p.slug))

  const toggleSubscribe = useMutation({
    mutationFn: (page: any) =>
      page.is_subscribed ? pagesApi.unsubscribe(page.slug) : pagesApi.subscribe(page.slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages'] })
    },
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await qc.invalidateQueries({ queryKey: ['pages'] })
    setRefreshing(false)
  }

  const sections = [
    ...(featured.length > 0 ? [{ type: 'header', label: '⭐ Featured' }, ...featured.map(p => ({ type: 'page', ...p }))] : []),
    ...(discover.length > 0 ? [{ type: 'header', label: 'Discover' }, ...discover.map(p => ({ type: 'page', ...p }))] : []),
  ]

  if (allLoading && featuredLoading) {
    return (
      <Screen>
        <Header title="Pages" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <Header
        title="Pages"
        right={
          <TouchableOpacity onPress={() => router.push('/pages/create' as any)} style={{ padding: 8 }}>
            <Ionicons name="add" size={24} color={c.primary} />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={sections}
        keyExtractor={(item, idx) => item.type === 'header' ? `h-${idx}` : item.slug}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <EmptyState icon="bookmark-outline" title="No pages yet" subtitle="Be the first to create one!" />
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <Text style={[s.sectionHeader, { color: c.textMuted, backgroundColor: c.bg }]}>
                {item.label}
              </Text>
            )
          }
          return (
            <PageRow
              page={item}
              onToggle={() => toggleSubscribe.mutate(item)}
            />
          )
        }}
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  name:         { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  meta:         { fontSize: 12 },
  bio:          { fontSize: 12, marginTop: 2 },
  typeBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  typeBadgeText:{ fontSize: 11, fontWeight: '600' },
  subBtn:       { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  subBtnText:   { fontSize: 12, fontWeight: '600' },
  sectionHeader:{ fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 16, paddingVertical: 8 },
})
