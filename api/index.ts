import axios from 'axios'
import { useAuthStore } from '../store/auth'

// Create a dynamic axios instance that reads instanceUrl from store at call time
const api = axios.create()

api.interceptors.request.use((config) => {
  const { token, instanceUrl } = useAuthStore.getState()
  if (instanceUrl) config.baseURL = `${instanceUrl}/api`
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  }
)

export default api

// ── Image URL helper ──────────────────────────────────────────────────────────
// Converts relative /uploads/... paths to full https:// URLs
export function imgUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const { instanceUrl } = useAuthStore.getState()
  if (!instanceUrl) return url
  return `${instanceUrl}${url}`
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:      (instanceUrl: string, username: string, password: string) =>
    axios.post(`${instanceUrl}/api/auth/login`, { username_or_email: username, password }),
  register:          (data: any)              => api.post('/auth/register', data),
  registerWithUrl:   (url: string, data: any) => axios.post(`${url}/api/auth/register`, data),
  me:         ()                 => api.get('/auth/me'),
  meWithUrl:  (instanceUrl: string, token: string) =>
    axios.get(`${instanceUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
  instance:   (baseUrl: string)  => axios.get(`${baseUrl}/api/instance`),
  changePassword: (data: any)    => api.post('/auth/change-password', data),
  changeEmail:    (data: any)    => api.post('/auth/change-email', data),
}

// ── Feed ──────────────────────────────────────────────────────────────────────
export const feedsApi = {
  list:   ()                      => api.get('/feeds'),
  create: (data: any)             => api.post('/feeds', data),
  get:    (id: string)            => api.get(`/feeds/${id}`),
  update: (id: string, data: any) => api.put(`/feeds/${id}`, data),
  delete: (id: string)            => api.delete(`/feeds/${id}`),
  setPinned:   (id: string, pinned: boolean) => api.put(`/feeds/${id}/pin`, { pinned }),
  reorderPins: (feed_ids: string[])          => api.put('/feeds/pins/order', { feed_ids }),
}

export const feedApi = {
  getFeed:      (offset = 0, customFeedId?: string, listId?: string) =>
    api.get('/feed', { params: { offset, ...(customFeedId ? { custom_feed_id: customFeedId } : {}), ...(listId ? { list_id: listId } : {}) } }),
  getPost:      (id: string)         => api.get(`/posts/${id}`),
  createPost:   (data: any)          => api.post('/posts', data),
  deletePost:   (id: string)         => api.delete(`/posts/${id}`),
  editPost:     (id: string, data: { content?: string; content_warning?: string; visibility?: string; group_id?: string }) => api.patch(`/posts/${id}`, data),
  likePost:     (id: string)         => api.post(`/posts/${id}/like`),
  unlikePost:   (id: string)         => api.delete(`/posts/${id}/like`),
  reactPost:    (id: string, type: string) => api.post(`/posts/${id}/react`, { type }),
  unreactPost:  (id: string)         => api.delete(`/posts/${id}/react`),
  getReactions: (id: string)         => api.get(`/posts/${id}/reactions`),
  reactComment:   (_postId: string, commentId: string, type: string) => api.post(`/posts/${commentId}/react`, { type }),
  unreactComment: (_postId: string, commentId: string)               => api.delete(`/posts/${commentId}/react`),
  repostPost:   (id: string, data?: any) => api.post(`/posts/${id}/repost`, data || {}),
  pollVote:     (id: string, optionId: string) => api.post(`/posts/${id}/poll/vote`, { option_id: optionId }),
  pollUnvote:   (id: string) => api.delete(`/posts/${id}/poll/vote`),
  pollAddOption:(id: string, text: string) => api.post(`/posts/${id}/poll/options`, { text }),
  getComments:  (id: string)         => api.get(`/posts/${id}/comments`),
  createComment:(id: string, data: any) => api.post(`/posts/${id}/comments`, data),
  deleteComment:(postId: string, commentId: string) => api.delete(`/posts/${postId}/comments/${commentId}`),
  editComment:  (postId: string, commentId: string, content: string) => api.patch(`/posts/${postId}/comments/${commentId}`, { content }),
  getUserPosts: (username: string)   => api.get(`/users/${username}/posts`),
  uploadMedia:  (file: any, category = 'posts') => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/media/upload?category=${category}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  previewUrl:   (url: string)        => api.get('/preview', { params: { url } }),
  // Guest-reachable — unauthenticated, so it bypasses the `api` instance
  // (which always attaches whatever token/instanceUrl auth store currently
  // holds) and hits the given instance directly, same as authApi.instance.
  getPublicFeedWithUrl: (baseUrl: string, offset = 0) =>
    axios.get(`${baseUrl}/api/feed/public`, { params: { offset } }),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getProfile:      (username: string) => api.get(`/users/${username}`),
  updateProfile:   (data: any)        => api.patch('/users/me', data),
  uploadAvatar:    (file: any)        => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadCover:     (file: any)        => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/users/me/cover', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  discover:        ()                 => api.get('/users/discover'),
  mentionSearch:   (q: string)        => api.get('/users/mention-search', { params: { q } }),
  followNotifications:   (username: string) => api.post(`/users/${username}/notify`),
  unfollowNotifications: (username: string) => api.delete(`/users/${username}/notify`),
  exportData:      ()                 => api.get('/users/me/export', { responseType: 'blob' }),
  requestDeletion: ()                 => api.post('/users/me/request-deletion'),
  cancelDeletion:  ()                 => api.delete('/users/me/request-deletion'),
}

// ── Friends ───────────────────────────────────────────────────────────────────
export const friendsApi = {
  listFriends:    ()               => api.get('/friends'),
  listRequests:   ()               => api.get('/friends/requests'),
  sendRequest:    (id: string)     => api.post(`/friends/request/${id}`),
  acceptRequest:  (id: string)     => api.post(`/friends/accept/${id}`),
  declineRequest: (id: string)     => api.post(`/friends/decline/${id}`),
  // AMOBILE-174: withdraw a request you sent. For a remote addressee the
  // backend also sends the Undo(Follow) that clears it on their side.
  cancelRequest:  (id: string)     => api.delete(`/friends/request/${id}`),
  unfriend:       (id: string)     => api.delete(`/friends/${id}`),
  listFriendLists:    ()                                => api.get('/friend-groups'),
  createFriendList:   (name: string)                    => api.post('/friend-groups', { name }),
  deleteFriendList:   (groupId: string)                 => api.delete(`/friend-groups/${groupId}`),
  getFriendListMembers: (groupId: string)               => api.get(`/friend-groups/${groupId}/members`),
  addFriendToList:    (groupId: string, friendId: string) => api.post(`/friend-groups/${groupId}/members/${friendId}`),
  removeFriendFromList: (groupId: string, friendId: string) => api.delete(`/friend-groups/${groupId}/members/${friendId}`),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list:            ()                   => api.get('/notifications'),
  unreadCount:     ()                   => api.get('/notifications/unread-count'),
  markRead:        (id: string)         => api.post(`/notifications/${id}/read`),
  markManyRead:    (ids: string[])      => api.post('/notifications/read-many', { ids }),
  markAllRead:     ()                   => api.post('/notifications/read-all'),
  getEmailPrefs:   ()                   => api.get('/notifications/email-preferences'),
  updateEmailPrefs:(enabled: boolean)   => api.put('/notifications/email-preferences', { email_notifications_enabled: enabled }),
}

// ── Groups ────────────────────────────────────────────────────────────────────
export const groupsApi = {
  list:           ()               => api.get('/groups'),
  listFilter:     (filter: string) => api.get('/groups', { params: { filter } }),
  get:            (slug: string)   => api.get(`/groups/${slug}`),
  getFeed:        (slug: string, page = 0) => api.get(`/groups/${slug}/feed`, { params: { page } }),
  join:           (slug: string)   => api.post(`/groups/${slug}/join`),
  leave:          (slug: string)   => api.delete(`/groups/${slug}/leave`),
  createPost:     (slug: string, data: any) => api.post(`/groups/${slug}/posts`, data),
  create:         (data: any)      => api.post('/groups', data),
  update:         (slug: string, data: any)          => api.patch(`/groups/${slug}`, data),
  delete:         (slug: string)                     => api.delete(`/groups/${slug}`),
  getMembers:     (slug: string)                     => api.get(`/groups/${slug}/members`),
  searchMembers:  (slug: string, q: string)          => api.get(`/groups/${slug}/member-search`, { params: { q } }),
  setMemberRole:  (slug: string, userId: string, role: string) => api.patch(`/groups/${slug}/members/${userId}/role`, { role }),
  removeMember:   (slug: string, userId: string)     => api.delete(`/groups/${slug}/members/${userId}`),
  addMember:      (slug: string, username: string)   => api.post(`/groups/${slug}/members/add`, { username }),
  getInvites:     (slug: string)                     => api.get(`/groups/${slug}/invites`),
  createInvite:   (slug: string)                     => api.post(`/groups/${slug}/invites`),
  deleteInvite:   (slug: string, token: string)      => api.delete(`/groups/${slug}/invites/${token}`),
  requestJoin:    (slug: string)                     => api.post(`/groups/${slug}/request`),
  getRequests:    (slug: string)                     => api.get(`/groups/${slug}/requests`),
  approveRequest: (slug: string, requestId: string)  => api.post(`/groups/${slug}/requests/${requestId}/approve`),
  rejectRequest:  (slug: string, requestId: string)  => api.post(`/groups/${slug}/requests/${requestId}/reject`),
}

// ── DMs ───────────────────────────────────────────────────────────────────────
export const dmApi = {
  listConversations:  ()                    => api.get('/conversations'),
  startConversation:  (username: string, message?: string) => api.post('/conversations', { username, message }),
  getConversation:    (id: string)          => api.get(`/conversations/${id}`),
  getMessages:        (id: string)          => api.get(`/conversations/${id}/messages`),
  sendMessage:        (id: string, content: string, image_url?: string) => api.post(`/conversations/${id}/messages`, { content, image_url }),
  editMessage:        (id: string, content: string) => api.patch(`/messages/${id}`, { content }),
  deleteMessage:      (id: string)          => api.delete(`/messages/${id}`),
  markRead:           (id: string)          => api.post(`/conversations/${id}/read`),
  acceptRequest:      (id: string)          => api.post(`/conversations/${id}/accept`),
  leaveConversation:  (id: string)          => api.delete(`/conversations/${id}`),
  friendSearch:       (q: string)           => api.get('/conversations/friend-search', { params: { q } }),
  reactMessage:       (msgId: string, emoji: string) => api.post(`/messages/${msgId}/react`, { reaction: emoji }),
  unreactMessage:     (msgId: string)       => api.delete(`/messages/${msgId}/react`),
}

// ── Search ────────────────────────────────────────────────────────────────────
export const searchApi = {
  searchUsers: (q: string) => api.get('/search/users', { params: { q } }),
  searchPosts: (q: string) => api.get('/search/posts', { params: { q } }),
}

// ── Invites ───────────────────────────────────────────────────────────────────
export const inviteApi = {
  send: (email: string) => api.post('/invites/send', { email }),
}

// ── Instance ──────────────────────────────────────────────────────────────────
export const instanceApi = {
  getInfo: () => api.get('/instance'),
}

// ── Moderation (AGORA-74) ────────────────────────────────────────────────────
export const moderationApi = {
  createReport:       (data: any)             => api.post('/reports', data),
  listReports:        (status?: string)       => api.get('/moderation/reports', { params: { status } }),
  reviewReport:       (id: string, data: any) => api.post(`/moderation/reports/${id}/review`, data),
  listModeratedUsers: (filter?: string)       => api.get('/moderation/users', { params: { filter } }),
  suspendUser:        (id: string, data: any) => api.post(`/moderation/users/${id}/suspend`, data),
  unsuspendUser:      (id: string)            => api.post(`/moderation/users/${id}/unsuspend`, {}),
  banUser:            (id: string, data: any) => api.post(`/moderation/users/${id}/ban`, data),
  unbanUser:          (id: string)            => api.post(`/moderation/users/${id}/unban`, {}),
  listInstanceBans:   ()                      => api.get('/moderation/instance-bans'),
  banInstance:        (data: any)             => api.post('/moderation/instance-bans', data),
  unbanInstance:      (id: string)            => api.delete(`/moderation/instance-bans/${id}`),
  listBlockedDIDs:    ()                      => api.get('/moderation/blocked-dids'),
  blockDID:           (data: any)             => api.post('/moderation/blocked-dids', data),
  unblockDID:         (id: string)            => api.delete(`/moderation/blocked-dids/${id}`),
}

// ── Fediverse (ActivityPub) ──────────────────────────────────────────────────
// AGORA-146: resolve a fediverse handle/URL to a preview (search), follow/
// unfollow a remote account, and list current follows. Distinct from the
// native Agora-to-Agora protocol's /federation/lookup (see AMOBILE-118) —
// this only talks to real fediverse software (Mastodon/Pleroma/etc.).
export const federationApi = {
  // AMOBILE-118: native Agora-to-Agora lookup — resolves a user@instance
  // handle via the custom Ed25519-signed protocol, distinct from
  // resolveFediverseHandle's ActivityPub ap-lookup below.
  lookupUser:               (handle: string)   => api.get('/federation/lookup', { params: { handle } }),
  resolveFediverseHandle:   (handle: string)   => api.get('/federation/ap-lookup', { params: { handle } }),
  followFediverseAccount:   (actorUrl: string) => api.post('/federation/follow', { actor_url: actorUrl }),
  unfollowFediverseAccount: (id: string)       => api.delete(`/federation/follow/${id}`),
  listFollowing:            ()                 => api.get('/federation/following'),
  // AGORA-348: the caller's own inbound followers, self-scoped only.
  listFollowers:            ()                 => api.get('/federation/followers'),
  toggleFollowNotify:       (id: string, notify: boolean) => api.put(`/federation/follow/${id}/notify`, { notify }),
  toggleShowInFeed:         (id: string, showInFeed: boolean) => api.put(`/federation/follow/${id}/show-in-feed`, { show_in_feed: showInFeed }),
}

// ── AT Proto / Bluesky ─────────────────────────────────────────────────────
export const atprotoApi = {
  resolveBlueskyHandle:   (handle: string) => api.get('/atproto/lookup', { params: { handle } }),
  followBlueskyAccount:   (actor: string)  => api.post('/atproto/follow', { actor }),
  unfollowBlueskyAccount: (id: string)     => api.delete(`/atproto/follow/${id}`),
  listBlueskyFollowing:   ()               => api.get('/atproto/following'),
  // AGORA-348: the caller's own inbound followers, self-scoped only.
  listBlueskyFollowers:   ()               => api.get('/atproto/followers'),
  toggleFollowNotify:     (id: string, notify: boolean) => api.put(`/atproto/follow/${id}/notify`, { notify }),
  // AGORA-236: per-follow main-feed opt-in, mirroring federationApi's own toggleShowInFeed.
  toggleShowInFeed:       (id: string, showInFeed: boolean) => api.put(`/atproto/follow/${id}/show-in-feed`, { show_in_feed: showInFeed }),
  migrateBridgedFollow:   (apFollowingId: string) => api.post(`/atproto/bridged-follows/${apFollowingId}/migrate`),
  // AGORA-215/216: fuzzy, network-wide search — distinct from lookup's exact
  // handle/DID resolve, and from searchApi's own Agora+cached-remote search.
  searchBlueskyActors: (q: string) => api.get('/atproto/search/actors', { params: { q } }),
  searchBlueskyPosts:  (q: string) => api.get('/atproto/search/posts', { params: { q } }),
}

// ── Instance rules ────────────────────────────────────────────────────────────
export const rulesApi = {
  list: () => api.get('/instance/rules'),
}

// ── Blocking ──────────────────────────────────────────────────────────────────
// AGORA-309: per-user, per-post timeline hiding. A client of one: it changes
// nothing for anybody else and notifies no one.
export const hiddenPostsApi = {
  list:   ()               => api.get('/hidden-posts'),
  hide:   (postId: string) => api.post(`/posts/${postId}/hide`),
  unhide: (postId: string) => api.delete(`/posts/${postId}/hide`),
}

export const blockApi = {
  blockUser:   (username: string) => api.post(`/blocks/${username}`),
  unblockUser: (username: string) => api.delete(`/blocks/${username}`),
  listBlocked: ()                 => api.get('/blocks'),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats:       ()                             => api.get('/admin/stats'),
  listUsers:      (q?: string)                   => api.get('/admin/users', { params: { q } }),
  setRole:        (userID: string, role: string) => api.patch(`/admin/users/${userID}/role`, { role }),
  // Settings
  getSettings:    ()                             => api.get('/admin/settings'),
  updateSettings: (data: any)                    => api.patch('/admin/settings', data),
  // Rules
  listRules:      ()                             => api.get('/admin/rules'),
  createRule:     (data: { title: string; description?: string }) => api.post('/admin/rules', data),
  updateRule:     (id: string, data: any)        => api.patch(`/admin/rules/${id}`, data),
  deleteRule:     (id: string)                   => api.delete(`/admin/rules/${id}`),
  moveRule:       (id: string, direction: 'up' | 'down') => api.patch(`/admin/rules/${id}/move`, { direction }),
  // Invites
  listInvites:    ()                             => api.get('/admin/invites'),
  createInvite:   ()                             => api.post('/admin/invites'),
  deleteInvite:   (id: string)                   => api.delete(`/admin/invites/${id}`),
  // Audit log
  getAuditLog:    (page = 0)                     => api.get('/admin/audit-log', { params: { page } }),
  // Federation (Agora-to-Agora peer instances)
  listInstances:   ()                            => api.get('/admin/federation/instances'),
  addInstance:     (domain: string)              => api.post('/admin/federation/instances', { domain }),
  blockInstance:   (id: string)                  => api.post(`/admin/federation/instances/${id}/block`),
  unblockInstance: (id: string)                  => api.post(`/admin/federation/instances/${id}/unblock`),
  // AMOBILE-176: removing a peer without blocking it (AGORA-320), and the
  // per-peer timeline exchange (AGORA-322).
  disconnectInstance:  (id: string)              => api.delete(`/admin/federation/instances/${id}`),
  setInstanceTimeline: (id: string, enabled: boolean) => api.put(`/admin/federation/instances/${id}/timeline`, { enabled }),
  // Storage / orphaned media
  scanOrphans:    ()                             => api.get('/admin/media/orphans'),
  deleteOrphans:  ()                             => api.delete('/admin/media/orphans'),
  // Fediverse relays (AMOBILE-134)
  listRelays:   ()                 => api.get('/admin/relays'),
  addRelay:     (inboxUrl: string) => api.post('/admin/relays', { inbox_url: inboxUrl }),
  enableRelay:  (id: string)       => api.post(`/admin/relays/${id}/enable`),
  disableRelay: (id: string)       => api.post(`/admin/relays/${id}/disable`),
  deleteRelay:  (id: string)       => api.delete(`/admin/relays/${id}`),
}

// ── Admin: Page moderation ────────────────────────────────────────────────────
export const adminPagesApi = {
  verify:  (slug: string, verified: boolean) => api.patch(`/admin/pages/${slug}/verify`,  { verified }),
  feature: (slug: string, featured: boolean) => api.patch(`/admin/pages/${slug}/feature`, { featured }),
}

// ── Pages ─────────────────────────────────────────────────────────────────────
export const pagesApi = {
  list:         (featured?: boolean)           => api.get('/pages', { params: featured ? { featured: true } : {} }),
  mine:         ()                             => api.get('/pages/mine'),
  get:          (slug: string)                 => api.get(`/pages/${slug}`),
  create:       (data: any)                    => api.post('/pages', data),
  update:       (slug: string, data: any)      => api.patch(`/pages/${slug}`, data),
  delete:       (slug: string)                 => api.delete(`/pages/${slug}`),
  subscribe:    (slug: string)                 => api.post(`/pages/${slug}/subscribe`),
  unsubscribe:  (slug: string)                 => api.delete(`/pages/${slug}/subscribe`),
  getFeed:      (slug: string, page = 0)       => api.get(`/pages/${slug}/feed`, { params: { page } }),
  getMembers:   (slug: string)                 => api.get(`/pages/${slug}/members`),
  inviteMember: (slug: string, data: any)      => api.post(`/pages/${slug}/members`, data),
  acceptInvite: (slug: string)                 => api.post(`/pages/${slug}/members/accept`),
  setMemberRole:(slug: string, userId: string, role: string) =>
                                                  api.patch(`/pages/${slug}/members/${userId}/role`, { role }),
  removeMember: (slug: string, userId: string) => api.delete(`/pages/${slug}/members/${userId}`),
  getAnalytics: (slug: string)                 => api.get(`/pages/${slug}/analytics`),
  createPost:   (slug: string, data: any)      => api.post(`/pages/${slug}/posts`, data),
  search:       (q: string, page = 0)          => api.get('/search/pages', { params: { q, page } }),
}

// ── Feed Interactions ─────────────────────────────────────────────────────────
export const interactionsApi = {
  track: (data: any) => api.post('/feed/interactions', data),
  reset: ()          => api.delete('/feed/interactions'),
}

// ── Group mention search ──────────────────────────────────────────────────────
export const groupMentionApi = {
  search: (q: string) => api.get('/groups/mention-search', { params: { q } }),
}

// ── Poll voters ───────────────────────────────────────────────────────────────
export const pollApi = {
  getVoters: (postId: string) => api.get(`/posts/${postId}/poll/voters`),
}

// ── Waitlist ──────────────────────────────────────────────────────────────────
export const waitlistApi = {
  list:    ()            => api.get('/admin/waitlist'),
  approve: (id: string)  => api.post(`/admin/waitlist/${id}/approve`),
  // AMOBILE-181: rejection is a DELETE on the waitlist entry itself, not a
  // POST to a /reject sub-path (which the backend never registered) — matches
  // the web client and the actual backend route (internal/admin/admin.go).
  reject:  (id: string)  => api.delete(`/admin/waitlist/${id}`),
}

// ── Albums ────────────────────────────────────────────────────────────────────
export const albumsApi = {
  list:         ()                               => api.get('/albums'),
  create:       (data: { name: string; description?: string }) => api.post('/albums', data),
  get:          (id: string)                     => api.get(`/albums/${id}`),
  update:       (id: string, data: any)          => api.patch(`/albums/${id}`, data),
  delete:       (id: string)                     => api.delete(`/albums/${id}`),
  addPhoto:     (id: string, data: { url: string; caption?: string }) => api.post(`/albums/${id}/photos`, data),
  updatePhoto:  (albumId: string, photoId: string, data: any) => api.patch(`/albums/${albumId}/photos/${photoId}`, data),
  deletePhoto:  (albumId: string, photoId: string) => api.delete(`/albums/${albumId}/photos/${photoId}`),
  getUserAlbums:(username: string)               => api.get(`/users/${username}/albums`),
}
