import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { useEvent, useEventListener } from 'expo'

// AGORA-442: the video behind one reel. Mounted only for the reel on screen and
// the ones either side of it (see ReelPage), because each mount creates a
// native player and decoder. useVideoPlayer releases the player when this
// unmounts, which is what keeps memory flat through a long session. expo-video
// plays HLS natively on both platforms, so a Bluesky playlist needs nothing
// extra here.

interface Props {
  source: string
  shouldPlay: boolean
  rewind: boolean       // not the reel on screen: go back to the start
  muted: boolean
  fit: 'cover' | 'contain'
  onFirstFrame: () => void
  onPlayingChange: (playing: boolean) => void
  onProgress: (ratio: number) => void
  onError: () => void
}

export default function ReelPlayer({ source, shouldPlay, rewind, muted, fit, onFirstFrame, onPlayingChange, onProgress, onError }: Props) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true
    p.timeUpdateEventInterval = 0.25
    p.audioMixingMode = 'auto'
  })

  useEffect(() => { player.muted = muted }, [player, muted])

  useEffect(() => {
    if (shouldPlay) player.play()
    else {
      player.pause()
      // A reel that scrolled away starts from the top when it comes back. One
      // the viewer paused themselves stays where it is.
      if (rewind) { try { player.currentTime = 0 } catch { /* not seekable yet */ } }
    }
  }, [player, shouldPlay, rewind])

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing })
  useEffect(() => { onPlayingChange(isPlaying) }, [isPlaying, onPlayingChange])

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const d = player.duration
    if (d > 0) onProgress(currentTime / d)
  })
  useEventListener(player, 'statusChange', ({ status }) => { if (status === 'error') onError() })

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit={fit}
      nativeControls={false}
      allowsPictureInPicture={false}
      onFirstFrameRender={onFirstFrame}
    />
  )
}
