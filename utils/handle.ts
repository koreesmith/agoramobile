/**
 * Returns the display handle for a user.
 * Local users:  @username
 * Remote (fediverse) users: @username@instance.com
 */
export function handle(username: string, isRemote?: boolean, remoteInstance?: string): string {
  if (isRemote && remoteInstance) {
    return `@${username}@${remoteInstance}`
  }
  return `@${username}`
}
