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

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:      (instanceUrl: string, username: string, password: string) =>
    axios.post(`${instanceUrl}/api/auth/login`, { username, password }),
  register:   (data: any)        => api.post('/auth/register', data),
  me:         ()                 => api.get('/auth/me'),
  meWithUrl:  (instanceUrl: string, token: string) =>
    axios.get(`${instanceUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
  instance:   (baseUrl: string)  => axios.get(`${baseUrl}/api/instance`),
  changePassword: (data: any)    => api.post('/auth/change-password', data),
}

// ── Feed ──────────────────────────────────────────────────────────────────────
export const feedApi = {
  getFeed:      (page = 0)           => api.get('/feed', { params: { page } }),
  getPost:      (id: string)         => api.get(`/posts/${id}`),
  createPost:   (data: any)          => api.post('/posts', data),
  deletePost:   (id: string)         => api.delete(`/posts/${id}`),
  likePost:     (id: string)         => api.post(`/posts/${id}/like`),
  unlikePost:   (id: string)         => api.delete(`/posts/${id}/like`),
  reactPost:    (id: string, type: string) => api.post(`/posts/${id}/react`, { type }),
  unreactPost:  (id: string)         => api.delete(`/posts/${id}/react`),
  repostPost:   (id: string)         => api.post(`/posts/${id}/repost`),
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
  previewUrl:   (url: string)        => api.post('/preview', { url }),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getProfile:    (username: string) => api.get(`/users/${username}`),
  updateProfile: (data: any)        => api.patch('/users/me', data),
  uploadAvatar:  (file: any)        => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  discover:      ()                 => api.get('/users/discover'),
}

// ── Friends ───────────────────────────────────────────────────────────────────
export const friendsApi = {
  listFriends:    ()               => api.get('/friends'),
  listRequests:   ()               => api.get('/friends/requests'),
  sendRequest:    (id: string)     => api.post(`/friends/request/${id}`),
  acceptRequest:  (id: string)     => api.post(`/friends/accept/${id}`),
  declineRequest: (id: string)     => api.post(`/friends/decline/${id}`),
  unfriend:       (id: string)     => api.delete(`/friends/${id}`),
  listGroups:     ()               => api.get('/friend-groups'),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list:        ()               => api.get('/notifications'),
  unreadCount: ()               => api.get('/notifications/unread-count'),
  markRead:    (id: string)     => api.post(`/notifications/${id}/read`),
  markAllRead: ()               => api.post('/notifications/read-all'),
}

// ── Groups ────────────────────────────────────────────────────────────────────
export const groupsApi = {
  list:        ()               => api.get('/groups'),
  get:         (slug: string)   => api.get(`/groups/${slug}`),
  getFeed:     (slug: string, page = 0) => api.get(`/groups/${slug}/posts`, { params: { page } }),
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
