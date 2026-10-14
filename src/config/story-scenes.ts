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
export const worldScenes: Record<string, { full: string; banner: string }> = {
  cabin: {
    full: '/images/scenes/scene-cabin.webp',
    banner: '/images/scenes/scene-cabin-banner.webp',
  },
  shore: {
    full: '/images/scenes/scene-shore.webp',
    banner: '/images/scenes/scene-shore-banner.webp',
  },
  street: {
    full: '/images/scenes/scene-street.webp',
    banner: '/images/scenes/scene-street-banner.webp',
  },
  doorstep: {
    full: '/images/scenes/scene-doorstep.webp',
    banner: '/images/scenes/scene-doorstep-banner.webp',
  },
};
