import { Platform, Share } from 'react-native'

// AMOBILE-229: Share sends a post's link somewhere else through the system
// share sheet, as distinct from Repost, which republishes it on Agora. The
// rules match the web app's (AGORA-411).

interface ShareablePost {
  id: string
  visibility: string
  external_only?: boolean
  group_id?: string
  author_profile_private?: boolean
  is_remote?: boolean
  remote_instance?: string
  remote_url?: string
}

// Only posts a signed-out visitor can open get a Share button: a link to a
// friends-only, friend-list, private or group post, or to any post by a
// private profile, would only lead anyone else to an access-denied page.
export function isShareable(post: ShareablePost): boolean {
  return post.visibility === 'public' && !post.external_only && !post.group_id && !post.author_profile_private
}

// A post written on Agora shares its permalink on this instance; a post from
// the Fediverse or Bluesky shares the original on its own network.
export function shareUrl(post: ShareablePost, instanceUrl: string | null): string {
  const permalink = `${(instanceUrl || '').replace(/\/+$/, '')}/post/${post.id}`
  const remote = post.remote_url || ''
  if (!post.is_remote || !remote) return permalink
  if (remote.startsWith('at://')) {
    const m = remote.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/?#]+)$/)
    return m ? `https://bsky.app/profile/${m[1]}/post/${m[2]}` : permalink
  }
  if (post.remote_instance !== 'bsky.app' && /^https?:\/\//.test(remote)) return remote
  return permalink
}

export async function sharePost(post: ShareablePost, instanceUrl: string | null) {
  const url = shareUrl(post, instanceUrl)
  try {
    // iOS shows `url` as a link with a preview; Android only reads `message`.
    await Share.share(Platform.OS === 'ios' ? { url } : { message: url })
  } catch {
    // Dismissed, or no share targets: nothing to do.
  }
}
