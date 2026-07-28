import { formatDistanceToNow } from 'date-fns'

/**
 * Returns the display handle for a user.
 * Local users:  @username
 * Remote (fediverse) users: @username@instance.com
 */
export function handle(username?: string | null, isRemote?: boolean, remoteInstance?: string): string {
  // Not every feed serialises a username — group feed posts can arrive with
  // neither `author_username` nor `username`. This is a display helper, so a
  // missing name renders as nothing rather than throwing: dereferencing it here
  // threw inside PostCard's render, and React Native turns an uncaught render
  // error into a native crash with no JS stack (AMOBILE-147 / AMOBILE-148).
  if (!username) return ''

  // A remote user's `username` is already stored as the full "handle@domain"
  // synthetic form server-side, so appending remoteInstance again would
  // double the domain (AMOBILE-123 / AGORA-183).
  if (username.includes('@')) {
    return `@${username}`
  }
  if (isRemote && remoteInstance) {
    return `@${username}@${remoteInstance}`
  }
  return `@${username}`
}

/**
 * Relative timestamp for display, or '' when the date is missing or unparseable.
 *
 * date-fns throws a RangeError on an invalid Date, which inside a render is a
 * native crash with no JS stack — the same failure mode as `handle` above.
 */
export function timeAgo(value?: string | number | Date | null, addSuffix = true): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return formatDistanceToNow(date, { addSuffix })
  } catch {
    return ''
  }
}
