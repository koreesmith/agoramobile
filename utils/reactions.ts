/**
 * Canonical reaction set, shared by post/comment reactions and DM message
 * reactions. Mirrors the web app's `frontend/src/utils/reactions.ts`; the two
 * are expected to stay in step, and the backend enforces this exact list of
 * types on both react endpoints (AGORA-305 / AMOBILE-170).
 *
 * Ordered positive → neutral → negative so the picker reads as a gradient
 * rather than an arbitrary pile.
 *
 * `like` is the federation primitive: an inbound ActivityPub favourite and a
 * Bluesky like both arrive as `like`, so it carries the neutral thumbs-up
 * rather than the heart. The heart belongs to `love`.
 *
 * Previously this array was copy-pasted into PostCard, the post detail screen,
 * and ReactorsModal, with no labels and no single owner.
 */
export const REACTIONS = [
  { type: 'like',     emoji: '👍',  label: 'Like'     },
  { type: 'love',     emoji: '❤️',  label: 'Love'     },
  { type: 'laugh',    emoji: '😂',  label: 'Laugh'    },
  { type: 'wow',      emoji: '😮',  label: 'Wow'      },
  { type: 'care',     emoji: '🫂',  label: 'Care'     },
  { type: 'thankful', emoji: '🙏',  label: 'Thankful' },
  { type: 'pride',    emoji: '🏳️‍🌈', label: 'Pride'    },
  { type: 'sad',      emoji: '😢',  label: 'Sad'      },
  { type: 'angry',    emoji: '😡',  label: 'Angry'    },
  { type: 'dislike',  emoji: '👎',  label: 'Dislike'  },
]

export const REACTION_MAP: Record<string, { emoji: string; label: string }> = Object.fromEntries(
  REACTIONS.map(r => [r.type, { emoji: r.emoji, label: r.label }])
)

/**
 * Values that are no longer canonical but can still reach a render.
 *
 * DM reactions stored the raw emoji glyph before AMOBILE-170 folded them onto
 * the shared type set, and `vomit` was a real reaction type until the same
 * change retired it. The server migrates both, but a cached result outlives an
 * app update, so a client can hold a pre-migration payload well after the
 * backend has moved on. Without this, those render as an empty badge or, worse,
 * as the literal string "vomit".
 *
 * This app's old DM quick-set carried pouting-face where the web app's carried
 * thumbs-down, so both are mapped.
 */
const LEGACY_VALUES: Record<string, string> = {
  '❤️': 'love', '😂': 'laugh', '😮': 'wow', '😢': 'sad',
  '👍': 'like', '👎': 'dislike', '😡': 'angry',
  vomit: 'dislike',
}

/**
 * Resolves a stored reaction value (a type name, or a pre-AMOBILE-170 DM glyph)
 * for display. An unrecognised value renders as-is rather than vanishing,
 * which matters here because a stale cache outlives an app update.
 */
export function reactionDisplay(value: string): { emoji: string; label: string } {
  return REACTION_MAP[value] ?? REACTION_MAP[LEGACY_VALUES[value]] ?? { emoji: value, label: value }
}

/**
 * Geometry for a one-row reaction picker, shared by the post picker and the DM
 * picker so the calculation has a single home.
 *
 * At ten reactions the row no longer fits a narrow phone at the sizing both
 * pickers used for nine, so the row takes an explicit width and its items flex
 * to fill it. Deliberately not sizing each item to its own glyph: an emoji's
 * advance is wider than its font size by a factor that varies per glyph and per
 * platform, so anything derived from that would be a guess that reintroduces the
 * overflow when it is wrong. Equal slots also make PostCard's drag-to-pick maths
 * exact, since that maps a finger to an index by dividing the measured row width
 * by REACTIONS.length.
 *
 * Pass `Dimensions.get('window').width`; kept as an argument so this stays
 * free of react-native imports.
 */
export function pickerMetrics(screenWidth: number, margin = 8, cap = 380) {
  const width = Math.min(screenWidth - margin * 2, cap)
  const slot  = width / REACTIONS.length
  return { margin, width, slot, emoji: Math.min(26, Math.floor(slot * 0.72)) }
}
