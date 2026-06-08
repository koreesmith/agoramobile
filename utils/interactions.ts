import { AppState } from 'react-native'
import { interactionsApi } from '../api'

export type InteractionType = 'like' | 'comment' | 'repost' | 'profile_view' | 'link_click' | 'post_view'

interface InteractionEvent {
  type: InteractionType
  post_id?: string
  user_id?: string
  timestamp: number
}

let queue: InteractionEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(flush, 5000)
}

async function flush() {
  flushTimer = null
  if (queue.length === 0) return
  const batch = [...queue]
  queue = []
  try {
    await interactionsApi.track({ events: batch })
  } catch {
    // fire-and-forget: swallow all errors
  }
}

// Flush on app background
AppState.addEventListener('change', (state) => {
  if (state === 'background' || state === 'inactive') {
    flush()
  }
})

export function trackInteraction(type: InteractionType, postId?: string, userId?: string) {
  queue.push({ type, post_id: postId, user_id: userId, timestamp: Date.now() })
  scheduleFlush()
}
