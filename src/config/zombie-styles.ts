/**
 * Zombie film stories — the product's entire creation surface.
 *
 * The marketing promise is "no prompts": the user uploads two photos and picks
 * a story. Everything the provider actually receives — the film prompt, its
 * duration, and the resolution tier behind it — is pinned here and read
 * server-side, so the drafts never ship to the browser and a rewrite needs no
 * frontend release.
 *
 * Four stories, one file each:
 *
 *   ./prompts/{cabin,shore,street,doorstep}.json
 *
 * A file carries the whole film as `prompt`: one string per entry, joined with
 * `\n` and sent byte for byte. There is no composer and no substitution left —
 * to change a story you change its file, blank lines included, because the
 * provider reads the paragraphs rather than the wrapping.
 *
 * The picker still asks two questions — which world, and whether the second
 * reference is a person or a pet — because that pair is stored on the order and
 * drives the UI. The drafts address both references generically (Character A /
 * Character B), so for a given world both subjects render the same film.
 *
 * Every film rides the same pipeline: the two photos are submitted as two
 * character references (`@image1` / `@image2`), which is how both identities are
 * held across the whole clip. `supportsLastFrame` on the catalog entry is
 * therefore really "accepts a second reference photo" — a replacement model must
 * keep it, and keep a 15s tier.
 *
 * Server-only: import from modules and API routes, never from components.
 */

import cabinWorld from './prompts/cabin.json';
import doorstepWorld from './prompts/doorstep.json';
import shoreWorld from './prompts/shore.json';
import streetWorld from './prompts/street.json';

/**
 * Render tiers the generator offers. The story is identical across them —
 * resolution is the only thing a user pays more for, and each tier is a
 * separate HFSY endpoint: the model id carries the resolution, the request
 * body does not. The first entry is the tier the UI preselects.
 */
export const zombieFilmTiers = [
  { resolution: '480p', modelId: 'sd-2-vip-480' },
  { resolution: '720p', modelId: 'sd-2-vip-720' },
] as const;

export type ZombieFilmResolution =
  (typeof zombieFilmTiers)[number]['resolution'];

/** Tier for a requested resolution; anything unknown renders at the default. */
export function getZombieFilmTier(resolution: unknown) {
  return (
    zombieFilmTiers.find((tier) => tier.resolution === resolution) ??
    zombieFilmTiers[0]
  );
}

export const zombieWorldIds = ['cabin', 'shore', 'street', 'doorstep'] as const;
export type ZombieWorldId = (typeof zombieWorldIds)[number];

export const zombieSubjectIds = ['person', 'pet'] as const;
export type ZombieSubjectId = (typeof zombieSubjectIds)[number];

export const defaultZombieWorld: ZombieWorldId = 'cabin';
export const defaultZombieSubject: ZombieSubjectId = 'person';

interface ZombieWorld {
  id: ZombieWorldId;
  /** Human label for curation only; never reaches the provider. */
  label?: string;
  /** The whole film, one entry per line; joined with `\n` when sent. */
  prompt: readonly string[];
}

/** The four worlds, in the order the picker shows them. */
export const zombieWorlds: readonly ZombieWorld[] = [
  cabinWorld,
  shoreWorld,
  streetWorld,
  doorstepWorld,
] as readonly ZombieWorld[];

interface ZombieSubject {
  id: ZombieSubjectId;
}

/**
 * The picker's second question. The value is recorded on the order, but the
 * drafts no longer branch on it — see the header note.
 */
export const zombieSubjects: readonly ZombieSubject[] = [
  { id: 'person' },
  { id: 'pet' },
];

export interface ZombieFilm {
  world: ZombieWorldId;
  subject: ZombieSubjectId;
  prompt: string;
  duration: number;
}

/**
 * The one way to reach a prompt: an unknown world or subject falls back to the
 * default rather than passing anything on to the provider.
 */
export function getZombieFilm(
  worldId: unknown,
  subjectId: unknown
): ZombieFilm {
  const world =
    zombieWorlds.find((entry) => entry.id === worldId) ??
    zombieWorlds.find((entry) => entry.id === defaultZombieWorld)!;
  const subject =
    zombieSubjects.find((entry) => entry.id === subjectId) ??
    zombieSubjects.find((entry) => entry.id === defaultZombieSubject)!;

  return {
    world: world.id,
    subject: subject.id,
    // Line-per-entry on disk keeps a hand-tuned draft diffable; the provider
    // gets the file back, newlines and all.
    prompt: world.prompt.join('\n'),
    duration: 15,
  };
}
