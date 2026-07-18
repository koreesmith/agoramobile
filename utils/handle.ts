/**
 * Returns the display handle for a user.
 * Local users:  @username
 * Remote (fediverse) users: @username@instance.com
 */
export function handle(username: string, isRemote?: boolean, remoteInstance?: string): string {
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
