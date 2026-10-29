import { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
// shape.
export default function FriendListPickerModal({ friend, visible, onClose }: {
  friend: PickerFriend | null
  visible: boolean
  onClose: () => void
}) {
  // AMOBILE-216: mounted fresh for each opening, so the selection and the
  // membership fetch always start clean instead of carrying over from the
  // last time, or the last account, it was opened for.
  if (!visible || !friend) return null
  return <Picker key={friend.id} friend={friend} onClose={onClose} />
}

// AMOBILE-216: the picker used to learn membership by fetching every list's
// full member list, one request per list, all at once, and to save with one
// add or remove per changed list, also all at once. When some of those were
// refused (a burst over the API rate limit was enough), a list that failed to
// load just looked unticked, Save diffed against that guess, and whichever
// writes got through were applied while the rest were silently lost.
//
// The server now answers both in a single request (AGORA-395), and the save is
// all or nothing. This app can be signed in to an Agora server older than that,
// which answers 404, so both fall back to the per-list endpoints, one request
// at a time so a long set of lists is not one burst.

type Membership = { ids: string[], perList: boolean }

async function loadMembership(friendID: string, lists: any[]): Promise<Membership> {
  try {
    const r = await friendsApi.getFriendListMemberships(friendID)
    return { ids: r.data.group_ids, perList: false }
  } catch (e: any) {
    if (e?.response?.status !== 404) throw e
  }
  // Any list failing fails the whole load, rather than leaving that list
  // looking unticked.
  const ids: string[] = []
  for (const list of lists) {
    const r = await friendsApi.getFriendListMembers(list.id)
    if ((r.data?.members || []).some((m: any) => m.id === friendID)) ids.push(list.id)
  }
  return { ids, perList: true }
}

// Returns the IDs of lists whose change failed, which only the per-list
// fallback can leave behind. A refusal of the all-or-nothing request throws,
// with nothing applied.
async function saveMembership(friendID: string, add: string[], remove: string[], perList: boolean): Promise<string[]> {
  if (!perList) {
    try {
      await friendsApi.setFriendListMemberships(friendID, { add, remove })
      return []
    } catch (e: any) {
      if (e?.response?.status !== 404) throw e
    }
  }
  const failed: string[] = []
  for (const id of add) {
    try { await friendsApi.addFriendToList(id, friendID) } catch { failed.push(id) }
  }
  for (const id of remove) {
    try { await friendsApi.removeFriendFromList(id, friendID) } catch { failed.push(id) }
  }
  return failed
}

function Picker({ friend, onClose }: { friend: PickerFriend, onClose: () => void }) {
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

  const listsQuery = useQuery({
    queryKey: ['friend-groups'],
    queryFn: () => friendsApi.listFriendLists().then(r => r.data),
  })
  const lists: any[] = listsQuery.data?.groups || []

  // gcTime 0 so each opening fetches fresh instead of reusing an earlier
  // opening's answer. Waits for the lists, which the per-list fallback needs.
  const membershipQuery = useQuery({
    queryKey: ['friend-list-memberships', friend.id],
    queryFn: () => loadMembership(friend.id, lists),
    enabled: !!listsQuery.data,
    gcTime: 0,
    retry: 2,
  })

  // Lists that loaded earlier are good enough even if a background refetch of
  // them has since failed; membership is matched by list ID, not position.
  const loadFailed = !seeded && ((listsQuery.isError && !listsQuery.data) || membershipQuery.isError)
  const retrying = listsQuery.isFetching || membershipQuery.isFetching
  const retryLoad = () => {
    if (listsQuery.isError) listsQuery.refetch()
    if (membershipQuery.isError) membershipQuery.refetch()
  }

  useEffect(() => {
    if (seeded || !listsQuery.data || !membershipQuery.isSuccess) return
    const memberOf = new Set<string>(membershipQuery.data.ids)
    setSelected(memberOf)
    setInitialSelected(memberOf)
    setSeeded(true)
  }, [seeded, listsQuery.data, membershipQuery.isSuccess, membershipQuery.data])

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
    if (!seeded || !membershipQuery.data) return
    if (!hasChanges) { onClose(); return }
    setSaving(true)
    try {
      const failed = await saveMembership(friend.id, toAdd, toRemove, membershipQuery.data.perList)
      qc.invalidateQueries({ queryKey: ['friend-groups'] })
      for (const listID of [...toAdd, ...toRemove]) {
        qc.invalidateQueries({ queryKey: ['list-members', listID] })
      }
      if (failed.length === 0) { onClose(); return }
      // Per-list fallback only. What went through becomes the new baseline,
      // so Save again resends just the changes that failed.
      setInitialSelected(prev => {
        const next = new Set(prev)
        for (const id of toAdd) if (!failed.includes(id)) next.add(id)
        for (const id of toRemove) if (!failed.includes(id)) next.delete(id)
        return next
      })
      const names = failed.map(id => lists.find((l: any) => l.id === id)?.name || 'a deleted list')
      Alert.alert("Some changes weren't saved", `Couldn't update ${names.join(', ')}. Your other changes were saved. Tap Save to try again.`)
    } catch (err: any) {
      // The selection is kept so Save can simply be tapped again: adding to a
      // list the account is already on, or removing from one it isn't, is a
      // no-op, so a retry is safe whatever happened to this attempt.
      const msg: string | undefined = err.response?.data?.error
      if (err.response?.status === 409) {
        // A list was deleted elsewhere while this was open. Drop it from the
        // selection so tapping Save again sends only lists that still exist.
        await qc.refetchQueries({ queryKey: ['friend-groups'] })
        const current = new Set<string>((qc.getQueryData<any>(['friend-groups'])?.groups || []).map((l: any) => l.id))
        setSelected(s => new Set([...s].filter(id => current.has(id))))
        setInitialSelected(s => new Set([...s].filter(id => current.has(id))))
        Alert.alert('Nothing was saved', 'One of those lists was just deleted, so none of your changes were saved. Tap Save again to apply the rest.')
      } else if (msg) {
        Alert.alert('Nothing was saved', `${msg[0].toUpperCase()}${msg.slice(1)}. None of your changes were saved.`)
      } else if (err.response?.status === 429) {
        Alert.alert('Nothing was saved', 'Too many requests right now. None of your changes were saved, so try again in a moment.')
      } else {
        Alert.alert('Error', "Couldn't save your changes. Try again.")
      }
    } finally {
      setSaving(false)
    }
  }

  const displayName = friend.display_name || friend.username

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
          {loadFailed ? (
            <View style={s.loadError}>
              <Text style={[s.loadErrorText, { color: c.red }]}>Couldn't load this account's current lists.</Text>
              <TouchableOpacity
                onPress={retryLoad}
                disabled={retrying}
                style={[s.retryBtn, { borderColor: c.border }, retrying && { opacity: 0.5 }]}
              >
                <Text style={[s.retryText, { color: c.text }]}>{retrying ? 'Trying again…' : 'Try again'}</Text>
              </TouchableOpacity>
            </View>
          ) : !seeded ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={c.primary} />
          ) : lists.length === 0 ? (
            <Text style={[s.emptyText, { color: c.textMuted }]}>No lists yet. Create one below.</Text>
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
                    {isSelected && <Ionicons name="checkmark" size={12} color={c.onPrimary} />}
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
            onSubmitEditing={() => { const n = newListName.trim(); if (n && seeded) createList.mutate(n) }}
            editable={seeded}
          />
          <TouchableOpacity
            onPress={() => { const n = newListName.trim(); if (n) createList.mutate(n) }}
            disabled={!seeded || !newListName.trim() || createList.isPending}
            style={[s.addBtn, { backgroundColor: c.primary }, (!seeded || !newListName.trim() || createList.isPending) && { opacity: 0.5 }]}
          >
            <Ionicons name="add" size={18} color={c.onPrimary} />
          </TouchableOpacity>
        </View>

        <View style={[s.footer, { borderTopColor: c.border }]}>
          <TouchableOpacity onPress={onClose} style={[s.skipBtn, { borderColor: c.border }]}>
            <Text style={[s.skipText, { color: c.textMuted }]}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !seeded}
            style={[s.saveBtn, { backgroundColor: c.primary }, (saving || !seeded) && { opacity: 0.5 }]}
          >
            <Text style={[s.saveText, { color: c.onPrimary }]}>{saving ? 'Saving…' : hasChanges ? 'Save changes' : 'Done'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title:          { fontSize: 19, fontWeight: '700' },
  closeBtn:       { padding: 4 },
  friendRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  friendName:     { fontSize: 16, fontWeight: '600' },
  friendUsername: { fontSize: 13, marginTop: 1 },
  emptyText:      { fontSize: 16, textAlign: 'center', paddingVertical: 24 },
  loadError:      { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, gap: 12 },
  loadErrorText:  { fontSize: 16, textAlign: 'center' },
  retryBtn:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  retryText:      { fontSize: 15, fontWeight: '600' },
  listRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  checkbox:       { width: 18, height: 18, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listName:       { flex: 1, fontSize: 16, fontWeight: '500' },
  listMeta:       { fontSize: 13, flexShrink: 0 },
  createRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  createInput:    { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
  addBtn:         { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footer:         { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  skipBtn:        { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  skipText:       { fontSize: 17, fontWeight: '600' },
  saveBtn:        { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText:       { color: '#fff', fontSize: 17, fontWeight: '700' },
})
