import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { router, Stack } from 'expo-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Avatar, Spinner } from '../components/ui'
import { dmApi, friendsApi } from '../api'
import { C } from '../constants/colors'
import { useC } from '../constants/ColorContext'

export default function NewConversationScreen() {
  const c = useC()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Server-side friend search when querying; full list when blank
  const { data: searchData, isLoading: sl } = useQuery({
    queryKey: ['dm-friend-search', debouncedSearch],
    queryFn: () => dmApi.friendSearch(debouncedSearch).then(r => r.data),
    enabled: debouncedSearch.length >= 1,
  })
  const { data: friendsData, isLoading: fl } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.listFriends().then(r => r.data),
    enabled: debouncedSearch.length === 0,
  })

  const isLoading = debouncedSearch.length >= 1 ? sl : fl
  const results = debouncedSearch.length >= 1
    ? (searchData?.users || searchData?.friends || [])
    : (friendsData?.friends || [])

  const start = useMutation({
    mutationFn: (username: string) => dmApi.startConversation(username),
    onSuccess: (res) => router.replace(`/conversation/${res.data.id}`),
  })

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'New Message', headerBackTitle: 'Messages', headerStyle: { backgroundColor: c.card }, headerTintColor: c.primary }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={c.textLight} />
          <TextInput style={s.searchInput} placeholder="Search friends…" placeholderTextColor={c.textLight} value={search} onChangeText={setSearch} autoFocus />
        </View>
        {isLoading ? <Spinner /> : (
          <FlatList data={results} keyExtractor={(f: any) => f.id}
            ListEmptyComponent={<View style={s.empty}><Text style={{ color: c.textLight }}>{search ? 'No friends match' : 'No friends yet'}</Text></View>}
            renderItem={({ item: f }) => (
              <TouchableOpacity onPress={() => start.mutate(f.username)} disabled={start.isPending} style={s.row}>
                <Avatar url={f.avatar_url} name={f.display_name || f.username} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{f.display_name || f.username}</Text>
                  <Text style={s.username}>@{f.username}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textLight} />
              </TouchableOpacity>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: C.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.bg },
  name: { fontWeight: '600', color: C.text, fontSize: 15 },
  username: { fontSize: 13, color: C.textMuted },
  empty: { paddingVertical: 48, alignItems: 'center' },
})
