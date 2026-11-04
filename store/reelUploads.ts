import { create } from 'zustand'
import type { QueryClient } from '@tanstack/react-query'
import { feedApi } from '../api'
import { useToastStore } from './toast'

// AGORA-443: posting a reel. It is a store rather than component state so the
// upload carries on when the person leaves the creation screen (or the Reels
// screen) and is told, by a toast, when the reel is posted or has failed. It
// lives only as long as the app does: there is no resuming after the app is
// closed, so a failure leaves the details here for a one-tap retry.

export interface ReelUploadParams {
  file: { uri: string; name: string; type: string }
  trimStartMs?: number
  trimEndMs?: number
  coverMs?: number
  // The post's own fields; video_url and video_thumb_url are added when the
  // transcode finishes.
  post: Record<string, any>
}

export type ReelUploadStatus = 'idle' | 'uploading' | 'processing' | 'posting' | 'failed'

interface ReelUploadState {
  status: ReelUploadStatus
  progress: number
  error: string
  start: (params: ReelUploadParams, qc: QueryClient) => boolean
  retry: (qc: QueryClient) => void
  cancel: () => void
  dismiss: () => void
}

let params: ReelUploadParams | null = null
let abort: AbortController | null = null
let cancelled = false

const POLL_MS = 1500
// A little over the server's own limit on one transcode.
const GIVE_UP_MS = 16 * 60_000

export const useReelUploads = create<ReelUploadState>((set, get) => {
  const fail = (message: string) => {
    set({ status: 'failed', error: message })
    useToastStore.getState().show(message, 'error')
  }

  const run = async (qc: QueryClient) => {
    if (!params) return
    const p = params
    cancelled = false
    abort = new AbortController()
    set({ status: 'uploading', progress: 0, error: '' })
    try {
      const up = await feedApi.uploadVideo(
        p.file,
        { trimStartMs: p.trimStartMs, trimEndMs: p.trimEndMs, coverMs: p.coverMs },
        (r) => set({ progress: r }),
        abort.signal,
      )
      const jobId: string = up.data?.job_id
      if (!jobId) throw new Error('The server did not accept the video.')

      set({ status: 'processing' })
      const deadline = Date.now() + GIVE_UP_MS
      let url = ''
      let thumb = ''
      for (;;) {
        if (cancelled) return
        if (Date.now() > deadline) throw new Error('Processing is taking too long. Please try again.')
        await new Promise((r) => setTimeout(r, POLL_MS))
        if (cancelled) return
        const { data } = await feedApi.getVideoJob(jobId)
        if (data.status === 'done') { url = data.url; thumb = data.thumb_url || ''; break }
        if (data.status === 'failed') throw new Error(data.error || 'Video processing failed. Please try a different video.')
      }

      set({ status: 'posting' })
      await feedApi.createPost({ ...p.post, video_url: url, video_thumb_url: thumb })
      params = null
      set({ status: 'idle', progress: 0, error: '' })
      for (const key of ['feed', 'reels', 'user-posts', 'profile-posts']) qc.invalidateQueries({ queryKey: [key] })
      useToastStore.getState().show('Your reel is posted')
    } catch (e: any) {
      if (cancelled || e?.code === 'ERR_CANCELED') return
      fail(e?.response?.data?.error || e?.message || 'Could not post your reel.')
    }
  }

  return {
    status: 'idle',
    progress: 0,
    error: '',

    // false when another reel is still on its way: one at a time keeps the
    // progress and the retry unambiguous.
    start: (next, qc) => {
      const { status } = get()
      if (status === 'uploading' || status === 'processing' || status === 'posting') return false
      params = next
      useToastStore.getState().show('Posting your reel…')
      void run(qc)
      return true
    },
    retry: (qc) => { if (get().status === 'failed') void run(qc) },
    cancel: () => {
      cancelled = true
      abort?.abort()
      params = null
      set({ status: 'idle', progress: 0, error: '' })
    },
    dismiss: () => { params = null; set({ status: 'idle', progress: 0, error: '' }) },
  }
})
