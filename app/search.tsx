import { useState, useEffect } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, Avatar } from '../components/ui'
import PostCard from '../components/PostCard'
import { searchApi, pagesApi, imgUrl } from '../api'
import { useC } from '../constants/ColorContext'
import { handle } from '../utils/handle'

type Tab = 'users' | 'posts' | 'pages'

export default function SearchScreen() {
  const c = useC()
  const [inputValue, setInputValue] = useState('')
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('users')

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

  const users: any[] = usersData?.users || []
  const posts: any[] = postsData?.posts || []
  const pages: any[] = pagesData?.pages || []

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
          <Text style={[s.displayName, { color: c.text }]}>{item.display_name || item.username}</Text>
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

  const isLoading = activeTab === 'users' ? usersLoading : activeTab === 'posts' ? postsLoading : pagesLoading

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

    if (activeTab === 'users') {
      if (users.length === 0) {
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
          <FlatList
            data={users}
            keyExtractor={u => u.id}
            renderItem={renderUserRow}
            scrollEnabled={false}
          />
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

    // Posts tab
    if (posts.length === 0) {
      return (
        <View style={s.emptyState}>
          <Ionicons name="document-text-outline" size={40} color={c.textMuted} style={{ marginBottom: 10 }} />
          <Text style={[s.emptyTitle, { color: c.textMd }]}>No results for "{query}"</Text>
        </View>
      )
    }

    return (
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PostCard post={item} queryKey={['search-posts', query]} />}
        scrollEnabled={false}
      />
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

const s = StyleSheet.create({
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
