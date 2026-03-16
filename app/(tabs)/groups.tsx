import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  RefreshControl, Image,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Header, Spinner, EmptyState, Avatar, Button } from '../../components/ui'
import { groupsApi } from '../../api'

export default function GroupsScreen() {
  const qc = useQueryClient()
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list().then(r => r.data),
  })

  const groups = data?.groups || []
  const myGroups = groups.filter((g: any) => g.is_member)
  const discover = groups.filter((g: any) => !g.is_member)

  const join = useMutation({
    mutationFn: (slug: string) => groupsApi.join(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })

  const GroupRow = ({ group }: { group: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/group/${group.slug}`)}
      className="flex-row items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800"
    >
      <View className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 overflow-hidden items-center justify-center flex-shrink-0">
        {group.avatar_url
          ? <Image source={{ uri: group.avatar_url }} style={{ width: 48, height: 48 }} />
          : <Text className="text-indigo-600 font-bold text-lg">{group.name[0]}</Text>}
      </View>
      <View className="flex-1 min-w-0">
        <Text className="font-semibold text-gray-900 dark:text-white text-sm">{group.name}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {group.member_count} {group.member_count === 1 ? 'member' : 'members'} · {group.privacy}
        </Text>
        {group.description ? (
          <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>{group.description}</Text>
        ) : null}
      </View>
      {!group.is_member && (
        <TouchableOpacity
          onPress={() => join.mutate(group.slug)}
          className="bg-indigo-600 rounded-lg px-3 py-1.5"
        >
          <Text className="text-white text-xs font-semibold">Join</Text>
        </TouchableOpacity>
      )}
      {group.is_member && (
        <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
      )}
    </TouchableOpacity>
  )

  if (isLoading) return <Screen><Header title="Groups" /><Spinner /></Screen>

  return (
    <Screen>
      <Header title="Groups" />
      <FlatList
        data={[...myGroups, ...discover]}
        keyExtractor={(g: any) => g.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />}
        ListEmptyComponent={<EmptyState icon="👥" title="No groups yet" subtitle="Join a group to see posts from its members" />}
        ListHeaderComponent={
          myGroups.length > 0 && discover.length > 0 ? (
            <View>
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 pb-1">My groups</Text>
              {myGroups.map((g: any) => <GroupRow key={g.id} group={g} />)}
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 pb-1">Discover</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          myGroups.length > 0 && discover.length > 0 && myGroups.includes(item) ? null : <GroupRow group={item} />
        }
      />
    </Screen>
  )
}
