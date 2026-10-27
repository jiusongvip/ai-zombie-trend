/**
 * Zombie film stories — the product's entire creation surface.
 *
 * The marketing promise is "no prompts": the user uploads two photos and
 * picks a story. Everything the provider actually receives — scene prompt,
 * duration, and the resolution tier behind it — is pinned here and composed
 * server-side, so the templates never ship to the browser and can be tuned
 * without a frontend release.
 *
 * A story is two orthogonal choices, which is why there is no style list:
 *
 *   world    — where it happens and what the match cut resolves into
 *              (cabin, shore, street, doorstep). Four of them.
 *   subject  — who turns undead: a person they love, or their pet.
 *              Two of them, and they drive pronouns plus every line that
 *              describes a face, a coat, or a body.
 *
 * 4 × 2 = eight films from one template body: the world contributes the
 * setting, prop, weather and lighting beats; the subject contributes identity
 * lock, undead look, contact and restoration. Neither axis is a separate
 * prompt to maintain.
 *
 * The beats themselves live as JSON so they can be edited one story at a
 * time without touching this module:
 *
 *   ./prompts/{cabin,shore,street,doorstep}.json   one file per world
 *   ./prompts/subjects/{person,pet}.json           one file per subject
 *
 * This module only loads them and composes `storyPrompt()`; nothing below
 * needs editing to change what a film says.
 *
 * A world can also be pinned to a hand-tuned full prompt instead of being
 * composed. Those drafts live in the world's own JSON as `prompt`, one string
 * per line, and are sent byte for byte (joined with newlines), so the file is
 * the whole truth for that film and `storyPrompt()` is skipped:
 *
 *   ./prompts/cabin.json  →  "prompt": [ "Create a 15-second…", … ]
 *
 * Every film rides the same pipeline: the two photos are submitted as two
 * character references (`@image1` / `@image2`), which is how both identities
 * are held across the whole clip. `supportsLastFrame` on the catalog entry is
 * therefore really "accepts a second reference photo" — a replacement model
 * must keep it, and keep a 15s tier.
 *
 * Characters are referred to with they/them (a pet is an "it") because the
 * references decide who these people are; nothing in the template assumes a
 * gender, a species pairing, or which of the two photos is which.
 *
 * Server-only: import from modules and API routes, never from components.
 */

import cabinWorld from './prompts/cabin.json';
import doorstepWorld from './prompts/doorstep.json';
import shoreWorld from './prompts/shore.json';
import streetWorld from './prompts/street.json';
import personSubject from './prompts/subjects/person.json';
import petSubject from './prompts/subjects/pet.json';

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

/**
 * World beats. Strings may carry the substitution tokens `{loved}`, `{hair}`,
 * `{surface}`, `{poss}`, `{object}` — each is filled from the chosen subject,
 * so one world serves both a person and a pet without duplicating the scene.
 */
interface ZombieWorld {
  id: ZombieWorldId;
  /** Human label for curation only; never reaches the provider. */
  label?: string;
  /**
   * A hand-tuned full prompt, one array entry per line. When present it
   * replaces every beat below: the lines are joined with `\n` and sent as is,
   * for both subjects. The beats stay for reference and for worlds that are
   * still composed.
   */
  prompt?: readonly string[];
  /** SHOT 1 heading. */
  shot: string;
  /** Where Character A stands and what they hold. */
  setup: string;
  /** Weather on A's face, appended to the close-up sentence. */
  onAFace: string;
  /** A's moment of weakness before the choice; only the armed world needs it. */
  restraint: string;
  /** Where B waits, motionless, facing A. */
  bWaiting: string;
  /** Lighting of the cold half. */
  atmosphere: string;
  /** Weather on B's undead face, appended to the extreme close-up. */
  onBFace: string;
  /** What the shallow-focus close-up is holding on to. */
  tension: string;
  /** SHOT 3 opener, with the prop lowered. */
  propLowered: string;
  /** What A does instead of the expected defensive move. */
  choice: string;
  /** What reaches B. */
  sees: string;
  motionless: string;
  /** The ground B crosses on the run. */
  ground: string;
  circlePlace: string;
  /** Scene word reused by the "keep the same pose" instruction. */
  poseScene: string;
  /** The match cut itself. */
  worldShift: string;
  warmLight: string;
  reveal: string;
  volumetric: string;
  atmospheric: string;
  soundFirst: string;
}

/**
 * The four worlds, in the order the picker shows them. Each file holds every
 * beat for one story, so a rewrite is a one-file change.
 */
export const zombieWorlds: readonly ZombieWorld[] = [
  cabinWorld,
  shoreWorld,
  streetWorld,
  doorstepWorld,
] as readonly ZombieWorld[];

/**
 * Subject beats — everything that depends on whether the second reference is
 * a human being or an animal: pronouns, the identity lock, the undead face,
 * how the contact lands, and what "restored" means.
 */
interface ZombieSubject {
  id: ZombieSubjectId;
  /** Human label for curation only; never reaches the provider. */
  label?: string;
  bObject: string;
  bPossessive: string;
  /** How B is described while waiting. */
  loved: string;
  /** The line that fixes both identities across the whole clip. */
  opening: string;
  identity: string;
  undeadLook: string;
  /** Body-covering words the weather plays against. */
  hair: string;
  surface: string;
  /**
   * The refusal and the run, as two full sentences. The verbs have to agree
   * with the pronoun ("They do … run" / "It does … runs"), so the subject owns
   * this line rather than the template.
   */
  advance: string;
  /** The rest of the run into the arms — the emotional peak of the clip. */
  contact: string;
  /** The instant the match cut fires on. */
  embrace: string;
  restored: string;
  /** Texture list for the camera direction paragraph. */
  texture: string;
}

/**
 * The two subjects. Shared by all four worlds, so a pronoun or identity-lock
 * change lands in every film at once.
 */
export const zombieSubjects: readonly ZombieSubject[] = [
  personSubject,
  petSubject,
] as readonly ZombieSubject[];

/** World text is shared by both subjects, so subject words are substituted in. */
function fill(template: string, role: ZombieSubject): string {
  return template
    .replace(/\{loved\}/g, role.loved)
    .replace(/\{hair\}/g, role.hair)
    .replace(/\{surface\}/g, role.surface)
    .replace(/\{poss\}/g, role.bPossessive)
    .replace(/\{object\}/g, role.bObject);
}

/** Paragraph join — skips the beats a world doesn't have instead of leaving blanks. */
function paragraphs(lines: string[]): string {
  return lines.filter((line) => line.trim() !== '').join('\n\n');
}

function storyPrompt(world: ZombieWorld, role: ZombieSubject): string {
  return paragraphs([
    'Create a 15-second, emotionally devastating cinematic 3D video using two character references:',
    'CHARACTER A: @image1\nCHARACTER B: @image2',
    role.opening,
    role.identity,
    'Character B always faces Character A and never moves behind them.',

    `SHOT 1 — ${world.shot} (0–4 SECONDS)`,
    world.setup,
    `Begin with a tight cinematic close-up of Character A's tearful face.${fill(world.onAFace, role)}`,
    'Character A is crying intensely, tears visibly streaming down their cheeks. Their eyes are red and filled with heartbreak. Their lips tremble, their breathing is uneven, and their hands shake uncontrollably.',
    world.restraint,
    fill(world.bWaiting, role),
    world.atmosphere,

    'SHOT 2 — THE UNDEAD FACE (4–6 SECONDS)',
    `Cut sharply to an extreme close-up of Character B's horrifying undead face.${fill(world.onBFace, role)}`,
    role.undeadLook,
    `Use an intense, nearly motionless close-up with shallow depth of field, capturing subtle facial twitches ${fill(world.tension, role)}.`,
    'No excessive gore or graphic wounds. No biting. No blood.',

    'SHOT 3 — THE CHOICE (6–10 SECONDS)',
    world.propLowered,
    'Character A hesitates one final time, overwhelmed by grief and love.',
    world.choice,
    'Their tearful expression shows painful acceptance and love.',
    world.motionless,
    `${fill(world.sees, role)} Something familiar flickers in ${role.bPossessive} cloudy eyes.`,
    `${role.advance} ${world.ground}, ${role.contact}`,
    `Character A closes their eyes and holds ${role.bObject}.`,
    `The camera slowly circles the two figures ${world.circlePlace}.`,

    'SHOT 4 — THE MEMORY / MATCH CUT (10–15 SECONDS)',
    `At the precise moment ${role.embrace}, perform an instantaneous cinematic hard cut.`,
    world.worldShift,
    role.restored,
    `IMPORTANT: The embrace movement must continue seamlessly across the cut. Both keep the exact same face-to-face position and embrace pose they had at the end of the ${world.poseScene} scene.`,
    'The same embrace becomes warm, alive, and joyful.',
    'Character A holds Character B tightly.',
    'Both hold each other affectionately, reunited at last.',
    'Their faces express profound relief, tenderness, and bittersweet happiness.',
    world.warmLight,
    world.reveal,

    'VISUAL AND CAMERA DIRECTION',
    `4K cinematic quality, photorealistic 3D rendering, film-quality animation, highly detailed facial expressions, realistic tears, ${role.texture}, physically accurate lighting, ${world.volumetric}, ${world.atmospheric}, realistic clothing physics, cinematic depth of field, smooth dynamic tracking shots, and professional film color grading.`,
    'First 10 seconds: dark, cold, desaturated, frightening, emotionally tense.\nFinal 5 seconds: luminous, warm, golden, peaceful, nostalgic, emotionally healing.',
    "IMPORTANT — THIS RULE COVERS ALL FOUR SCENES: No excessive gore or graphic wounds. No biting. No blood. Character B never attacks, bites, scratches, chases, or physically harms Character A in any shot. The only physical contact in the entire video is Character B running into Character A's arms and the two embracing.",

    'SOUND DESIGN',
    world.soundFirst,
    'The undead close-up: unsettling breathing and a subtle low-frequency rumble.',
    'The embrace: a soft, emotional swell.',
  ]);
}

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
    // A pinned draft is the whole film: no subject substitution applies.
    prompt: world.prompt
      ? world.prompt.join('\n')
      : storyPrompt(world, subject),
    duration: 15,
  };
}
