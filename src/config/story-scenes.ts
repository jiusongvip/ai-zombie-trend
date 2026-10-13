/**
 * Concept frames for the four story worlds.
 *
 * These illustrate the *setting* — they are not rendered results, so every use
 * of one has to carry the "concept frame" badge. The proof of what the
 * generator produces stays the example film.
 *
 * Kept apart from `zombie-styles.ts` on purpose: that catalog is server-only
 * because it holds the prompts, and the prompts are the one thing this product
 * promises never to ship to the browser.
 */
export const worldScenes: Record<string, { full: string; thumb: string }> = {
  cabin: {
    full: '/images/scenes/scene-cabin.webp',
    thumb: '/images/scenes/scene-cabin-thumb.webp',
  },
  shore: {
    full: '/images/scenes/scene-shore.webp',
    thumb: '/images/scenes/scene-shore-thumb.webp',
  },
  street: {
    full: '/images/scenes/scene-street.webp',
    thumb: '/images/scenes/scene-street-thumb.webp',
  },
  doorstep: {
    full: '/images/scenes/scene-doorstep.webp',
    thumb: '/images/scenes/scene-doorstep-thumb.webp',
  },
};
