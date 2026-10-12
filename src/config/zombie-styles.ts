/**
 * Zombie film styles — the product's entire creation surface.
 *
 * The marketing promise is "no prompts": the user uploads two photos and
 * picks a story. Everything the provider actually receives — scene prompt,
 * duration, and the resolution tier behind it — is pinned here and composed
 * server-side, so the templates never ship to the browser and can be tuned
 * without a frontend release.
 *
 * Every style rides the same pipeline: the two photos are submitted as two
 * character references (`@image1` / `@image2`), which is how both identities
 * are held across the whole clip. `supportsLastFrame` on the catalog entry is
 * therefore really "accepts a second reference photo" — a replacement model
 * must keep it, and keep a 15s tier.
 *
 * One template body serves all four stories: the only per-style variables are
 * the opening relationship line and Character B's pronouns, so a beat change
 * is a single edit rather than four.
 *
 * Server-only: import from modules and API routes, never from components.
 */

import type { ShowcaseTag } from '@/config/showcase';

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

/**
 * Character A is always a person, so the survivor keeps they/them throughout —
 * only Character B's pronouns vary with what the second reference depicts.
 */
interface StoryRole {
  opening: string;
  bSubject: string;
  bObject: string;
  bPossessive: string;
}

const storyRoles: Record<ShowcaseTag, StoryRole> = {
  couple: {
    opening:
      'Character A is the survivor. Character B is their partner, who has tragically transformed into a zombie.',
    bSubject: 'they',
    bObject: 'them',
    bPossessive: 'their',
  },
  pet: {
    opening:
      'Character A is the owner. Character B is their beloved pet — a dog or cat matching the second reference — which has tragically transformed into an undead animal.',
    bSubject: 'it',
    bObject: 'it',
    bPossessive: 'its',
  },
  friend: {
    opening:
      'Character A is the survivor. Character B is their best friend, who has tragically transformed into a zombie.',
    bSubject: 'they',
    bObject: 'them',
    bPossessive: 'their',
  },
  family: {
    opening:
      'Character A is the younger survivor. Character B is their parent — the elder of the two references — who has tragically transformed into a zombie.',
    bSubject: 'they',
    bObject: 'them',
    bPossessive: 'their',
  },
};

function cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function storyPrompt(role: StoryRole): string {
  const isPet = role.bSubject === 'it';

  const identity = isPet
    ? 'Preserve the exact breed, coat, size and facial identity of the pet, and the owner’s exact face, hairstyle and body proportions, throughout the video. Their genders, appearances, and relationship can vary depending on the supplied references.'
    : 'Preserve the exact facial identity, recognizable hairstyle, body proportions, and distinctive appearance of both characters throughout the video. Their genders, appearances, and relationship can vary depending on the supplied references.';

  const undeadFace = isPet
    ? 'Character B has pale grey fur, cloudy white eyes, dark veins and disheveled fur. The expression is frightening and inhuman, yet the animal remains unmistakably recognizable as the same beloved pet.'
    : 'Character B has pale grey skin, cloudy white eyes, dark veins, hollow facial features and disheveled hair. The expression is frightening and inhuman, yet the character remains unmistakably recognizable as Character B.';

  const survivorShot = isPet
    ? 'Cut to Character B dragging itself closer from across the wooden cabin, moving with an unnatural, stiff gait, but not attacking.'
    : 'Cut to Character B slowly walking closer from across the wooden cabin, moving with an unnatural, stiff zombie-like gait, but not attacking.';

  const recognition = isPet
    ? 'Character B stops moving. For a moment, something familiar flickers in its cloudy eyes.'
    : 'Character B stops walking. For a moment, something familiar flickers in their cloudy eyes.';

  return `Create a 15-second, emotionally devastating cinematic 3D video using two character references:

CHARACTER A: @image1
CHARACTER B: @image2

${role.opening}

${identity}

SHOT 1 — THE CABIN (0–4 SECONDS)

Inside a dark, abandoned rustic wooden cabin, Character A stands trembling, holding a handgun lowered at their side.

Begin with a tight cinematic close-up of Character A's tearful face.

Character A is crying intensely, tears visibly streaming down their cheeks. Their eyes are red and filled with heartbreak. Their lips tremble, their breathing is uneven, and their hands shake uncontrollably.

Character A cannot bring themself to raise the weapon.

${survivorShot}

Dim daylight enters through old wooden windows, illuminating floating dust particles. Cold blue-grey lighting and deep shadows create a tragic, oppressive atmosphere.

SHOT 2 — THE UNDEAD FACE (4–6 SECONDS)

Cut sharply to an extreme close-up of Character B's horrifying undead face.

${undeadFace}

Use an intense, nearly motionless close-up with shallow depth of field, capturing subtle facial twitches and unsettling breathing.

No excessive gore or graphic wounds. No biting. No blood.

SHOT 3 — THE CHOICE (6–10 SECONDS)

Cut back to Character A, still crying, the gun lowered.

Character A hesitates one final time, overwhelmed by grief and love.

Instead of firing, Character A deliberately lets the gun fall away from their hands.

Character A then slowly spreads both arms wide, not in aggression, but in silent grief and recognition.

Their tearful expression shows painful acceptance and love.

For a brief instant, Character A remains motionless with both arms open.

${recognition}

${cap(role.bSubject)} does not attack. ${cap(role.bSubject)} stumbles forward and gently rests ${role.bPossessive} head against Character A's shoulder.

Character A closes their eyes and holds ${role.bObject}.

The camera slowly circles the two figures in the cold cabin.

SHOT 4 — THE MEMORY / MATCH CUT (10–15 SECONDS)

At the precise moment Character B rests against Character A, perform an instantaneous cinematic hard cut.

The dark wooden cabin becomes an expansive golden wheat field under a breathtaking sunset.

Both characters are now completely alive and healthy, restored to their normal appearance exactly matching the reference images, wearing clean everyday clothing that fits their original gender and identity.

IMPORTANT: The embrace movement must continue seamlessly across the cut.

The same embrace becomes warm, alive, and joyful.

Character A holds Character B tightly.

Both characters hold each other affectionately, reunited at last.

Their faces express profound relief, tenderness, and bittersweet happiness.

Golden sunlight illuminates their hair and faces. A gentle breeze moves through the surrounding wheat.

The camera slowly pulls back to reveal the vast, peaceful wheat field, ending on the two characters embracing beneath the glowing sunset.

VISUAL AND CAMERA DIRECTION

4K cinematic quality, photorealistic 3D rendering, film-quality animation, highly detailed facial expressions, realistic tears, natural skin textures, detailed hair simulation, physically accurate lighting, volumetric sunlight, atmospheric dust, realistic clothing physics, cinematic depth of field, smooth dynamic tracking shots, and professional film color grading.

First 10 seconds: dark, cold, desaturated, frightening, emotionally tense.
Final 5 seconds: luminous, warm, golden, peaceful, nostalgic, emotionally healing.

SOUND DESIGN

First scene: eerie wooden cabin ambience, faint wind, shaky breathing, quiet sobbing, approaching footsteps, and rising cinematic tension.

The undead close-up: unsettling breathing and a subtle low-frequency rumble.

The embrace: a soft, emotional swell.`;
}

export interface ZombieStyle {
  id: ShowcaseTag;
  prompt: string;
  duration: number;
}

export const zombieStyles: ZombieStyle[] = (
  Object.keys(storyRoles) as ShowcaseTag[]
).map((id) => ({
  id,
  prompt: storyPrompt(storyRoles[id]),
  duration: 15,
}));

export function getZombieStyle(id: string): ZombieStyle | undefined {
  return zombieStyles.find((style) => style.id === id);
}
