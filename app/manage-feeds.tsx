import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Modal, ScrollView,
  Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState } from '../components/ui'
import { feedsApi, friendsApi, groupsApi } from '../api'
import { useC } from '../constants/ColorContext'

type FilterType = 'friend_group' | 'community_group' | 'exclude_friend' | 'exclude_group'

interface FilterRule {
  type: FilterType
  value: string
}

interface CustomFeed {
  id: string
  name: string
  filters: FilterRule[]
}

export default function ManageFeedsScreen() {
  const c = useC()
  const qc = useQueryClient()
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedName, setFeedName] = useState('')
  const [selectedFilters, setSelectedFilters] = useState<FilterRule[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['custom-feeds'],
    queryFn: () => feedsApi.list().then(r => r.data),
  })
  const feeds: CustomFeed[] = data?.feeds || []

  const { data: friendListsData } = useQuery({
    queryKey: ['friend-lists'],
    queryFn: () => friendsApi.listFriendLists().then(r => r.data),
    enabled: showEditor,
  })
  const friendLists: any[] = friendListsData?.groups || []

  const { data: joinedGroupsData } = useQuery({
    queryKey: ['groups', 'joined'],
    queryFn: () => groupsApi.listFilter('joined').then(r => r.data),
    enabled: showEditor,
  })
  const joinedGroups: any[] = joinedGroupsData?.groups || []

  const { data: friendsData } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.listFriends().then(r => r.data),
    enabled: showEditor,
  })
  const friends: any[] = friendsData?.friends || []

  const openCreate = () => {
    setEditingId(null)
    setFeedName('')
    setSelectedFilters([])
    setShowEditor(true)
  }

  const openEdit = (feed: CustomFeed) => {
    setEditingId(feed.id)
    setFeedName(feed.name)
    setSelectedFilters(feed.filters || [])
    setShowEditor(true)
  }

  const toggleFilter = (rule: FilterRule) => {
    setSelectedFilters(prev => {
      const exists = prev.find(r => r.type === rule.type && r.value === rule.value)
      return exists
        ? prev.filter(r => !(r.type === rule.type && r.value === rule.value))
        : [...prev, rule]
    })
  }

  const isSelected = (type: FilterType, value: string) =>
    selectedFilters.some(r => r.type === type && r.value === value)

  const saveFeed = useMutation({
    mutationFn: () => {
      const payload = { name: feedName.trim(), filters: selectedFilters }
      return editingId ? feedsApi.update(editingId, payload) : feedsApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-feeds'] })
      setShowEditor(false)
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not save feed'),
  })

  const deleteFeed = useMutation({
    mutationFn: (id: string) => feedsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-feeds'] }),
    onError: () => Alert.alert('Error', 'Could not delete feed'),
  })

  const confirmDelete = (feed: CustomFeed) => {
    Alert.alert('Delete Feed', `Delete "${feed.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFeed.mutate(feed.id) },
    ])
  }

  const canSave = feedName.trim().length > 0 && selectedFilters.length > 0

  const FilterSection = ({ title, items, type, labelKey }: { title: string; items: any[]; type: FilterType; labelKey: string }) => {
    if (items.length === 0) return null
    return (
      <View style={[s.section, { borderColor: c.border }]}>
        <Text style={[s.sectionTitle, { color: c.textMuted }]}>{title}</Text>
        {items.map((item: any) => {
          const value = item.id
          const label = item[labelKey] || item.display_name || item.username || item.name
          const checked = isSelected(type, value)
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => toggleFilter({ type, value })}
              style={[s.filterRow, { borderBottomColor: c.border }]}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={20}
                color={checked ? c.primary : c.border}
              />
              <Text style={[s.filterLabel, { color: c.text }]}>{label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    )
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Manage Feeds" />

      {isLoading ? <Spinner /> : (
        <FlatList
          data={feeds}
          keyExtractor={f => f.id}
          renderItem={({ item }) => (
            <View style={[s.feedRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(item)}>
                <Text style={[s.feedName, { color: c.text }]}>{item.name}</Text>
                <Text style={[s.feedMeta, { color: c.textMuted }]}>
                  {item.filters?.length || 0} filter{(item.filters?.length || 0) !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item)} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState icon="🗂️" title="No custom feeds" subtitle="Create a feed to filter your timeline" />
          }
          ListFooterComponent={
            <TouchableOpacity onPress={openCreate} style={[s.createBtn, { backgroundColor: c.primary }]}>
              <Ionicons name="add" size={18} color="white" />
              <Text style={s.createBtnText}>New Feed</Text>
            </TouchableOpacity>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet">
        <View style={[s.editorContainer, { backgroundColor: c.card }]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[s.editorHeader, { borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setShowEditor(false)}>
                <Text style={[s.cancelText, { color: c.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[s.editorTitle, { color: c.text }]}>{editingId ? 'Edit Feed' : 'New Feed'}</Text>
              <TouchableOpacity onPress={() => saveFeed.mutate()} disabled={!canSave || saveFeed.isPending}>
                <Text style={[s.saveText, { color: canSave ? c.primary : c.textMuted }]}>
                  {saveFeed.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <View style={[s.nameWrap, { borderColor: c.border, backgroundColor: c.bg }]}>
                <TextInput
                  style={[s.nameInput, { color: c.text }]}
                  placeholder="Feed name"
                  placeholderTextColor={c.textLight}
                  value={feedName}
                  onChangeText={setFeedName}
                  maxLength={50}
                  returnKeyType="done"
                  autoFocus
                />
              </View>

              {selectedFilters.length === 0 && (
                <Text style={[s.hint, { color: c.textMuted }]}>Select at least one filter below to save this feed.</Text>
              )}

              <FilterSection title="INCLUDE FROM FRIEND LISTS" items={friendLists} type="friend_group" labelKey="name" />
              <FilterSection title="INCLUDE FROM COMMUNITIES" items={joinedGroups} type="community_group" labelKey="name" />
              <FilterSection title="EXCLUDE FRIENDS" items={friends} type="exclude_friend" labelKey="display_name" />
              <FilterSection title="EXCLUDE COMMUNITIES" items={joinedGroups} type="exclude_group" labelKey="name" />

              {showEditor && friendLists.length === 0 && joinedGroups.length === 0 && friends.length === 0 && (
                <Text style={[s.hint, { color: c.textMuted }]}>
                  Join some communities or add friends to create filters.
                </Text>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Screen>
  )
}

const s = StyleSheet.create({
  feedRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  feedName: { fontSize: 15, fontWeight: '600' },
  feedMeta: { fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 8 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, margin: 16, paddingVertical: 14, borderRadius: 12 },
  createBtnText: { color: 'white', fontWeight: '600', fontSize: 15 },
  editorContainer: { flex: 1 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1 },
  cancelText: { fontSize: 16 },
  editorTitle: { fontWeight: '600', fontSize: 16 },
  saveText: { fontSize: 16, fontWeight: '600' },
  nameWrap: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  nameInput: { fontSize: 16 },
  hint: { fontSize: 13, marginBottom: 16, textAlign: 'center', lineHeight: 18 },
  section: { borderWidth: 1, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  sectionTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  filterLabel: { fontSize: 14 },
})
