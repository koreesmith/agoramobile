import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner } from '../../../components/ui'
import { pagesApi } from '../../../api'
import { useC } from '../../../constants/ColorContext'

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  const c = useC()
  return (
    <View style={[s.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[s.statIcon, { backgroundColor: c.primaryBg }]}>
        <Ionicons name={icon as any} size={24} color={c.primary} />
      </View>
      <Text style={[s.statValue, { color: c.text }]}>{value ?? '—'}</Text>
      <Text style={[s.statLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  )
}

export default function PageAnalyticsScreen() {
  const c = useC()
  const { slug } = useLocalSearchParams<{ slug: string }>()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['page-analytics', slug],
    queryFn: () => pagesApi.getAnalytics(slug).then(r => r.data),
    enabled: !!slug,
  })
  const analytics = data?.analytics || data || {}

  if (isLoading) return <Screen><Spinner /></Screen>

  return (
    <Screen>
      <Header
        title="Page Analytics"
        left={
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={22} color={c.primary} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
      >
        <View style={s.grid}>
          <StatCard icon="people" label="Subscribers" value={analytics.subscriber_count ?? analytics.subscribers ?? 0} />
          <StatCard icon="document-text" label="Posts" value={analytics.post_count ?? analytics.posts ?? 0} />
          {analytics.total_reactions !== undefined && (
            <StatCard icon="heart" label="Total reactions" value={analytics.total_reactions} />
          )}
          {analytics.total_comments !== undefined && (
            <StatCard icon="chatbubble" label="Total comments" value={analytics.total_comments} />
          )}
          {analytics.views !== undefined && (
            <StatCard icon="eye" label="Post views (30d)" value={analytics.views} />
          )}
          {analytics.new_subscribers_7d !== undefined && (
            <StatCard icon="trending-up" label="New subscribers (7d)" value={analytics.new_subscribers_7d} />
          )}
        </View>

        <View style={[s.note, { backgroundColor: c.bg, borderColor: c.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={c.textMuted} />
          <Text style={[s.noteText, { color: c.textMuted }]}>Data updates daily. Counts reflect the past 30 days where applicable.</Text>
        </View>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  body:      { padding: 20, gap: 20 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard:  { width: '47%', borderWidth: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8 },
  statIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, textAlign: 'center' },
  note:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  noteText:  { fontSize: 13, lineHeight: 18, flex: 1 },
})
