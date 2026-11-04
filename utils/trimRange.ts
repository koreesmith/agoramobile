// AGORA-443: the rules for the trim handles, kept apart from the gesture code
// so they can be checked on their own. They match the web dialog and the
// server (AGORA-439): the kept part is never shorter than MIN_CLIP or longer
// than the instance's limit (MAX_CLIP, 2 minutes, unless an admin lowered it:
// AGORA-444), and moving one handle drags the other along rather than
// refusing, so the thumb always follows the finger.

export const MIN_CLIP = 0.5
export const MAX_CLIP = 120

export interface Range { start: number; end: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Move the start handle to `value` (seconds) in a video of `duration` seconds.
export function moveStart(r: Range, value: number, duration: number, max: number = MAX_CLIP): Range {
  const start = clamp(value, 0, Math.max(0, r.end - MIN_CLIP))
  let end = r.end
  if (end - start > max) end = start + max
  return { start, end: Math.min(duration, end) }
}

// Move the end handle to `value`.
export function moveEnd(r: Range, value: number, duration: number, max: number = MAX_CLIP): Range {
  const end = clamp(value, Math.min(duration, r.start + MIN_CLIP), duration)
  let start = r.start
  if (end - start > max) start = end - max
  return { start: Math.max(0, start), end }
}

// The range a video starts with: all of it, or its first `max` seconds.
export function initialRange(duration: number, max: number = MAX_CLIP): Range {
  return { start: 0, end: Math.min(duration, max) }
}

// A length limit the way a person would say it: "2 minutes", "90 seconds".
export function limitText(sec: number): string {
  return sec >= 60 && sec % 60 === 0 ? `${sec / 60} minute${sec === 60 ? '' : 's'}` : `${sec} seconds`
}

// Whether the range actually cuts anything off, so an untouched video is
// uploaded exactly as chosen. A hair of slack so a duration the picker and the
// player disagree about by a frame doesn't count as a trim.
export function isTrimmed(r: Range, duration: number): boolean {
  return duration > 0 && (r.start > 0.05 || r.end < duration - 0.25)
}

// The cover frame can't be later than the end of the clip.
export function clampCover(offset: number, r: Range): number {
  return clamp(offset, 0, Math.max(0, r.end - r.start))
}

// `count` times, evenly spread across the kept part, for the cover strip.
export function stripTimes(r: Range, count: number): number[] {
  const len = r.end - r.start
  if (count <= 1 || len <= 0) return [r.start]
  // Stay a hair inside the end so the last frame can be decoded.
  return Array.from({ length: count }, (_, i) => r.start + Math.min(len - 0.05, (len * (i + 0.5)) / count))
}
