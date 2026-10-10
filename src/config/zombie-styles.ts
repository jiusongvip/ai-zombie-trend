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

export interface ZombieStyle {
  id: ShowcaseTag;
  prompt: string;
  duration: number;
}

export const zombieStyles: ZombieStyle[] = [
  {
    id: 'couple',
    prompt:
      'Emotionally devastating cinematic 3D film, 15 seconds, four shots, built from the two supplied character references. Preserve each character’s exact facial identity, hairstyle, body proportions and clothing across the whole video. Shot 1 (0–4s): inside a dark abandoned rustic wooden cabin, the survivor from the first photo stands trembling, aiming a handgun at the zombified partner from the second photo; tight close-up on their tearful face behind the raised gun, red eyes, trembling lips, uneven breathing, hands shaking, unable to pull the trigger; cut to the zombie walking closer with an unnatural gait; dim daylight through old wooden windows, floating dust, cold blue-grey lighting, deep shadows. Shot 2 (4–6s): extreme close-up of the zombie’s face — pale grey skin, cloudy white eyes, dark veins, hollow features, disheveled hair, bared teeth; frightening yet unmistakably the same person; shallow depth of field, subtle facial twitches; no gore, no graphic wounds. Shot 3 (6–10s): back to the survivor, still crying; they hesitate once more, deliberately lower the gun and let it fall away, then slowly spread both arms wide in silent invitation, their expression showing painful acceptance; for a brief instant they hold still, then the zombie breaks into a violent sprint and leaps straight at them, camera tracking the acceleration. Shot 4 (10–15s): at the exact moment the zombie is airborne, an instantaneous hard cut — the dark cabin becomes an expansive golden wheat field under a breathtaking sunset, both characters fully alive and healthy in clean everyday clothes; the airborne movement continues seamlessly across the cut, the violent leap landing as a joyful embrace; the survivor catches them and wraps both arms tightly around them, faces showing relief, tenderness and bittersweet happiness; golden sunlight in their hair, a breeze moving through the wheat, camera slowly pulling back on the two figures embracing beneath the glowing sunset. Photorealistic 3D rendering, 4K film quality, highly detailed facial expressions, realistic tears, volumetric light, cinematic depth of field, professional color grading — first 10 seconds dark, cold and desaturated; final 5 seconds luminous, warm and golden.',
    duration: 15,
  },
  {
    id: 'pet',
    prompt:
      'Emotionally devastating cinematic 3D film, 15 seconds, four shots, built from the two supplied references: the owner and their pet. Preserve the pet’s exact breed, coat, size and facial identity, and the owner’s exact face, hair and proportions, across the whole video. Shot 1 (0–4s): inside a dark abandoned rustic wooden cabin, the owner from the first photo stands trembling, aiming a handgun at the zombified pet from the second photo; tight close-up on their tearful face behind the raised gun, red eyes, shaking hands, unable to fire; cut to the pet dragging itself closer with an unnatural, threatening gait; dim daylight through old wooden windows, floating dust, cold blue-grey light, deep shadows. Shot 2 (4–6s): extreme close-up of the pet’s undead face — pale grey fur, cloudy white eyes, dark veins, bared teeth; frightening yet unmistakably the same beloved animal; shallow depth of field, subtle twitches; no gore, no wounds. Shot 3 (6–10s): the owner hesitates one final time, deliberately lowers the gun and lets it fall, then kneels and spreads both arms wide, silently inviting the pet in; for a brief instant they hold still, then the pet breaks into a violent sprint and leaps toward them, camera tracking the acceleration. Shot 4 (10–15s): at the exact moment the pet is airborne, an instantaneous hard cut — the cabin becomes an expansive golden wheat field at sunset, the pet fully healthy with a clean bright coat, the owner in clean everyday clothes; the airborne movement continues seamlessly, the leap landing as an embrace; the owner catches the pet and holds it tight, face pressed into its fur with relief and bittersweet joy; golden sunlight, a breeze through the wheat, camera slowly pulling back on the two of them beneath the glowing sunset. Photorealistic 3D rendering, 4K film quality, detailed fur and tear simulation, volumetric light, cinematic depth of field, professional color grading — first 10 seconds dark, cold and frightening; final 5 seconds luminous, warm and healing.',
    duration: 15,
  },
  {
    id: 'friend',
    prompt:
      'Emotionally devastating cinematic 3D film, 15 seconds, four shots, built from the two supplied character references: two best friends. Preserve each friend’s exact facial identity, hairstyle, body proportions and clothing across the whole video. Shot 1 (0–4s): inside a dark abandoned rustic wooden cabin, one friend from the first photo stands trembling, aiming a handgun at the other friend, now zombified, from the second photo; tight close-up on the survivor’s tearful face behind the raised gun, red eyes, trembling lips, unsteady hands, unable to pull the trigger; cut to the zombie friend closing the distance with an unnatural gait; dim daylight through old wooden windows, floating dust, cold blue-grey lighting, deep shadows. Shot 2 (4–6s): extreme close-up of the undead face — pale grey skin, cloudy white eyes, dark veins, hollow features, bared teeth; horrifying yet clearly still the same friend; shallow depth of field, subtle facial twitches; no gore, no graphic wounds. Shot 3 (6–10s): the survivor hesitates one last time, deliberately lowers the gun and lets it drop from their hands, then steps forward and spreads both arms wide in painful acceptance; for a brief instant nothing moves, then the zombie friend sprints and leaps straight at them, camera tracking the burst of speed. Shot 4 (10–15s): at the precise moment they are airborne, an instantaneous hard cut — the cabin becomes an expansive golden wheat field under a breathtaking sunset, both friends alive and healthy in clean everyday clothes; the airborne motion continues seamlessly across the cut, the attack landing as a tight embrace; they catch each other and hold on, faces showing relief, tenderness and bittersweet happiness; golden sunlight in their hair, wind moving through the wheat, camera slowly pulling back to reveal the vast peaceful field. Photorealistic 3D rendering, 4K film quality, highly detailed expressions, realistic tears, volumetric light, cinematic depth of field, professional color grading — first 10 seconds dark, cold and tense; final 5 seconds warm, golden and nostalgic.',
    duration: 15,
  },
  {
    id: 'family',
    prompt:
      'Emotionally devastating cinematic 3D film, 15 seconds, four shots, built from the two supplied character references: a parent and their grown child. Preserve each character’s exact facial identity, hairstyle, body proportions, clothing and the age difference between them across the whole video. Shot 1 (0–4s): inside a dark abandoned rustic wooden cabin, the younger survivor from the first photo stands trembling, aiming a handgun at the zombified elder from the second photo; tight close-up on their tearful face behind the raised gun, red eyes, trembling lips, unsteady hands, unable to pull the trigger; cut to the zombie dragging itself closer with an unnatural gait; dim daylight through old wooden windows, floating dust, cold blue-grey lighting, deep shadows. Shot 2 (4–6s): extreme close-up of the undead face — pale grey skin, cloudy white eyes, dark veins, hollow features, greying disheveled hair; frightening yet unmistakably the same parent; shallow depth of field, subtle facial twitches; no gore, no graphic wounds. Shot 3 (6–10s): the survivor hesitates one last time, deliberately lowers the gun and lets it fall from their hands, then steps forward and spreads both arms wide, bending slightly the way a child does coming home; for a brief instant nothing moves, then the zombie breaks into a violent sprint and leaps straight at them, camera tracking the acceleration. Shot 4 (10–15s): at the exact moment they are airborne, an instantaneous hard cut — the dark cabin becomes an expansive golden wheat field under a breathtaking sunset, both characters fully alive and healthy in clean everyday clothes; the airborne movement continues seamlessly across the cut, the violent leap landing as a tight embrace; the survivor catches the elder and holds them, faces pressed together showing relief, tenderness and bittersweet happiness; golden sunlight in their hair, a breeze moving through the wheat, camera slowly pulling back on the two figures embracing beneath the glowing sunset. Photorealistic 3D rendering, 4K film quality, highly detailed facial expressions, realistic tears, volumetric light, cinematic depth of field, professional color grading — first 10 seconds dark, cold and desaturated; final 5 seconds luminous, warm and golden.',
    duration: 15,
  },
];

export function getZombieStyle(id: string): ZombieStyle | undefined {
  return zombieStyles.find((style) => style.id === id);
}
