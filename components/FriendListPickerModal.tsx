import { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Avatar, renderName } from './ui'
import { friendsApi } from '../api'
import { useC } from '../constants/ColorContext'

interface PickerFriend {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  emojis?: Record<string, string>
}

// AMOBILE-145: mobile parity for web's FriendListModal — previously the list
// icon on a Fediverse/Bluesky follow row just navigated to the standalone
// Friend Lists screen with no idea which account it was tapped for, so
// there was no way to actually add that specific account to a list from
// there. This is a per-account add/remove picker instead, mirroring web's
// shape (and its useQueries-based membership fetch, AGORA-261 — a
// hand-rolled effect+Promise.all here would be just as prone to the same
// "hangs on Loading forever" race if a background refetch of
// ['friend-groups'] lands mid-fetch).
export default function FriendListPickerModal({ friend, visible, onClose }: {
  friend: PickerFriend | null
  visible: boolean
  onClose: () => void
}) {
  const c = useC()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Membership as of when the modal opened, so Save can diff against it
  // (add newly-checked lists, remove newly-unchecked ones) instead of
  // blindly re-adding every currently-checked list every time.
  const [initialSelected, setInitialSelected] = useState<Set<string>>(new Set())
  const [seeded, setSeeded] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: listsData } = useQuery({
    queryKey: ['friend-groups'],
    queryFn: () => friendsApi.listFriendLists().then(r => r.data),
    enabled: visible,
  })
  const lists: any[] = listsData?.groups || []

  const membershipQueries = useQueries({
    queries: lists.map(list => ({
      queryKey: ['list-members', list.id],
      queryFn: () => friendsApi.getFriendListMembers(list.id).then(r => r.data),
      enabled: visible,
    })),
  })
  const membershipLoaded = lists.length === 0 || membershipQueries.every(q => q.isSuccess || q.isError)

  // Reset the one-time seed whenever the modal closes/reopens for a
  // (possibly different) account, then seed selected/initialSelected once
  // membership has resolved.
  useEffect(() => {
    if (!visible) { setSeeded(false); return }
  }, [visible, friend?.id])

  useEffect(() => {
    if (!visible || seeded || !membershipLoaded || !friend) return
    const memberOf = new Set<string>()
    lists.forEach((list, i) => {
      const members: any[] = membershipQueries[i]?.data?.members || []
      if (members.some((m: any) => m.id === friend.id)) memberOf.add(list.id)
    })
    setSelected(memberOf)
    setInitialSelected(memberOf)
    setSeeded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, seeded, membershipLoaded, friend?.id])

  const createList = useMutation({
    mutationFn: (name: string) => friendsApi.createFriendList(name),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['friend-groups'] })
      const newId = res.data?.id
      if (newId) setSelected(s => new Set([...s, newId]))
      setNewListName('')
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Could not create list'),
  })

  const toggle = (id: string) => {
    setSelected(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toAdd = [...selected].filter(id => !initialSelected.has(id))
  const toRemove = [...initialSelected].filter(id => !selected.has(id))
  const hasChanges = toAdd.length > 0 || toRemove.length > 0

  const handleSave = async () => {
    if (!friend) return
    if (!hasChanges) { onClose(); return }
    setSaving(true)
    try {
      await Promise.all([
        ...toAdd.map(listID => friendsApi.addFriendToList(listID, friend.id)),
        ...toRemove.map(listID => friendsApi.removeFriendFromList(listID, friend.id)),
      ])
      qc.invalidateQueries({ queryKey: ['friend-groups'] })
      for (const listID of [...toAdd, ...toRemove]) {
        qc.invalidateQueries({ queryKey: ['list-members', listID] })
      }
      onClose()
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Could not update lists — please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!friend) return null
  const displayName = friend.display_name || friend.username

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: c.card }]}>
        <View style={[s.header, { borderBottomColor: c.border }]}>
          <Text style={[s.title, { color: c.text }]}>Add to friend lists</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[s.friendRow, { borderBottomColor: c.border }]}>
          <Avatar url={friend.avatar_url} name={displayName} size={40} />
          <View style={{ marginLeft: 12 }}>
            <Text style={[s.friendName, { color: c.text }]}>{renderName(displayName, friend.emojis)}</Text>
            <Text style={[s.friendUsername, { color: c.textMuted }]}>@{friend.username}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }}>
          {lists.length === 0 ? (
            <Text style={[s.emptyText, { color: c.textMuted }]}>No lists yet — create one below</Text>
          ) : !membershipLoaded ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={c.primary} />
          ) : (
            lists.map((list: any) => {
              const isSelected = selected.has(list.id)
              return (
                <TouchableOpacity
                  key={list.id}
                  onPress={() => toggle(list.id)}
                  style={[s.listRow, { backgroundColor: isSelected ? c.primaryBg : 'transparent', borderBottomColor: c.border }]}
                >
                  <View style={[s.checkbox, { borderColor: isSelected ? c.primary : c.border, backgroundColor: isSelected ? c.primary : 'transparent' }]}>
                    {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={[s.listName, { color: c.text }]}>{list.name}</Text>
                  <Text style={[s.listMeta, { color: c.textMuted }]}>
                    {list.member_count} {list.member_count === 1 ? 'person' : 'people'}
                  </Text>
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>

        <View style={[s.createRow, { borderTopColor: c.border }]}>
          <TextInput
            style={[s.createInput, { color: c.text, borderColor: c.border }]}
            placeholder="New list name…"
            placeholderTextColor={c.textMuted}
            value={newListName}
            onChangeText={setNewListName}
            returnKeyType="done"
            onSubmitEditing={() => { const n = newListName.trim(); if (n) createList.mutate(n) }}
          />
          <TouchableOpacity
            onPress={() => { const n = newListName.trim(); if (n) createList.mutate(n) }}
            disabled={!newListName.trim() || createList.isPending}
            style={[s.addBtn, { backgroundColor: c.primary }, (!newListName.trim() || createList.isPending) && { opacity: 0.5 }]}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={[s.footer, { borderTopColor: c.border }]}>
          <TouchableOpacity onPress={onClose} style={[s.skipBtn, { borderColor: c.border }]}>
            <Text style={[s.skipText, { color: c.textMuted }]}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !membershipLoaded}
            style={[s.saveBtn, { backgroundColor: c.primary }, (saving || !membershipLoaded) && { opacity: 0.5 }]}
          >
            <Text style={s.saveText}>{saving ? 'Saving…' : hasChanges ? 'Save changes' : 'Done'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title:          { fontSize: 17, fontWeight: '700' },
  closeBtn:       { padding: 4 },
  friendRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  friendName:     { fontSize: 14, fontWeight: '600' },
  friendUsername: { fontSize: 12, marginTop: 1 },
  emptyText:      { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  listRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  checkbox:       { width: 18, height: 18, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listName:       { flex: 1, fontSize: 14, fontWeight: '500' },
  listMeta:       { fontSize: 12, flexShrink: 0 },
  createRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  createInput:    { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  addBtn:         { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footer:         { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  skipBtn:        { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  skipText:       { fontSize: 15, fontWeight: '600' },
  saveBtn:        { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText:       { color: '#fff', fontSize: 15, fontWeight: '700' },
})
