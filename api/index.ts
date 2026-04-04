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
export const feedApi = {
  getFeed:      (offset = 0)          => api.get('/feed', { params: { offset } }),
  getPost:      (id: string)         => api.get(`/posts/${id}`),
  createPost:   (data: any)          => api.post('/posts', data),
  deletePost:   (id: string)         => api.delete(`/posts/${id}`),
  editPost:     (id: string, data: { content?: string; content_warning?: string; visibility?: string; group_id?: string }) => api.patch(`/posts/${id}`, data),
  likePost:     (id: string)         => api.post(`/posts/${id}/like`),
  unlikePost:   (id: string)         => api.delete(`/posts/${id}/like`),
  reactPost:    (id: string, type: string) => api.post(`/posts/${id}/react`, { type }),
  unreactPost:  (id: string)         => api.delete(`/posts/${id}/react`),
  repostPost:   (id: string, data?: any) => api.post(`/posts/${id}/repost`, data || {}),
  pollVote:     (id: string, optionId: string) => api.post(`/posts/${id}/poll/vote`, { option_id: optionId }),
  pollUnvote:   (id: string) => api.delete(`/posts/${id}/poll/vote`),
  pollAddOption:(id: string, text: string) => api.post(`/posts/${id}/poll/options`, { text }),
  getComments:  (id: string)         => api.get(`/posts/${id}/comments`),
  createComment:(id: string, data: any) => api.post(`/posts/${id}/comments`, data),
  deleteComment:(postId: string, commentId: string) => api.delete(`/posts/${postId}/comments/${commentId}`),
  getUserPosts: (username: string)   => api.get(`/users/${username}/posts`),
  uploadMedia:  (file: any, category = 'posts') => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/media/upload?category=${category}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  previewUrl:   (url: string)        => api.get('/preview', { params: { url } }),
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
  discover:        ()                 => api.get('/users/discover'),
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
  unfriend:       (id: string)     => api.delete(`/friends/${id}`),
  listFriendLists: ()               => api.get('/friend-groups'),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list:            ()                   => api.get('/notifications'),
  unreadCount:     ()                   => api.get('/notifications/unread-count'),
  markRead:        (id: string)         => api.post(`/notifications/${id}/read`),
  markAllRead:     ()                   => api.post('/notifications/read-all'),
  getEmailPrefs:   ()                   => api.get('/notifications/email-preferences'),
  updateEmailPrefs:(enabled: boolean)   => api.put('/notifications/email-preferences', { email_notifications_enabled: enabled }),
}

// ── Groups ────────────────────────────────────────────────────────────────────
export const groupsApi = {
  list:        ()               => api.get('/groups'),
  listFilter:  (filter: string) => api.get('/groups', { params: { filter } }),
  get:         (slug: string)   => api.get(`/groups/${slug}`),
  getFeed:     (slug: string, page = 0) => api.get(`/groups/${slug}/feed`, { params: { page } }),
  join:        (slug: string)   => api.post(`/groups/${slug}/join`),
  leave:       (slug: string)   => api.delete(`/groups/${slug}/leave`),
  createPost:  (slug: string, data: any) => api.post(`/groups/${slug}/posts`, data),
  create:      (data: any)      => api.post('/groups', data),
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
}

// ── Search ────────────────────────────────────────────────────────────────────
export const searchApi = {
  search: (q: string) => api.get('/search', { params: { q } }),
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
}

// ── Instance rules ────────────────────────────────────────────────────────────
export const rulesApi = {
  list: () => api.get('/instance/rules'),
}

// ── Blocking ──────────────────────────────────────────────────────────────────
export const blockApi = {
  blockUser:   (id: string) => api.post(`/users/${id}/block`),
  unblockUser: (id: string) => api.delete(`/users/${id}/block`),
  listBlocked: ()           => api.get('/users/blocked'),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats:  ()                             => api.get('/admin/stats'),
  listUsers: (q?: string)                   => api.get('/admin/users', { params: { q } }),
  setRole:   (userID: string, role: string) => api.patch(`/admin/users/${userID}/role`, { role }),
}

// ── Waitlist ──────────────────────────────────────────────────────────────────
export const waitlistApi = {
  list:    ()            => api.get('/admin/waitlist'),
  approve: (id: string)  => api.post(`/admin/waitlist/${id}/approve`),
  reject:  (id: string)  => api.post(`/admin/waitlist/${id}/reject`),
}
