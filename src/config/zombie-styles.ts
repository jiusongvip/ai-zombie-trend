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

export const zombieWorlds: readonly ZombieWorld[] = [
  {
    id: 'cabin',
    shot: 'THE CABIN',
    setup:
      'Inside a dark, abandoned rustic wooden cabin, Character A stands trembling, holding a handgun lowered at their side.',
    onAFace: '',
    restraint: 'Character A cannot bring themself to raise the weapon.',
    bWaiting:
      'Across the cabin, Character B — zombified, pale, stiff, but still unmistakably {loved} — stands perfectly still, facing Character A, watching.',
    atmosphere:
      'Dim daylight enters through old wooden windows, illuminating floating dust particles. Cold blue-grey lighting and deep shadows create a tragic, oppressive atmosphere.',
    onBFace: '',
    tension: 'and unsettling breathing',
    propLowered: 'Cut back to Character A, still crying, the gun lowered.',
    choice:
      'Instead of firing, Character A deliberately lets the gun fall away from their hands, then slowly spreads both arms wide — not in aggression, but in silent grief and recognition.',
    sees: "Character B sees Character A's open arms.",
    motionless:
      'For a brief instant, Character A remains motionless with both arms open.',
    ground: 'across the cabin floor',
    circlePlace: 'in the cold cabin',
    poseScene: 'cabin',
    worldShift:
      'The dark wooden cabin becomes an expansive golden wheat field under a breathtaking sunset.',
    warmLight:
      'Golden sunlight illuminates their hair and faces. A gentle breeze moves through the surrounding wheat.',
    reveal:
      'The camera slowly pulls back to reveal the vast, peaceful wheat field, ending on the two characters embracing beneath the glowing sunset.',
    volumetric: 'volumetric sunlight',
    atmospheric: 'atmospheric dust',
    soundFirst:
      'First scene: eerie wooden cabin ambience, faint wind, shaky breathing, quiet sobbing, and rising cinematic tension.',
  },
  {
    id: 'shore',
    shot: 'THE GREY SHORE',
    setup:
      "On a cold, overcast beach under a pale grey sky, Character A stands trembling at the water's edge, holding Character B's necklace in one hand.",
    onAFace: ' Wind moves through their hair.',
    restraint: '',
    bWaiting:
      'Across the wet sand, Character B — zombified, pale, stiff, but still unmistakably {loved} — stands perfectly still, facing Character A, watching.',
    atmosphere:
      'Cold blue-grey lighting, grey waves, and deep shadows create a tragic, oppressive atmosphere.',
    onBFace: ' Sea wind moves through {poss} {hair}.',
    tension: 'and the sound of waves',
    propLowered: 'Cut back to Character A, still crying, the necklace lowered.',
    choice:
      'Instead of turning away, Character A slowly opens both arms wide — not in aggression, but in silent grief and recognition.',
    sees: "Character B sees Character A's open arms.",
    motionless:
      'For a brief instant, Character A remains motionless with both arms open on the grey shore.',
    ground: 'across the wet sand',
    circlePlace: 'by the sea',
    poseScene: 'grey shore',
    worldShift:
      'The grey overcast shore becomes the exact same beach at golden sunset.',
    warmLight:
      'Golden sunset light illuminates their hair and faces. A gentle sea breeze moves through the air. The waves glow warm.',
    reveal:
      'The camera slowly pulls back to reveal the vast, peaceful beach, ending on the two characters embracing beneath the glowing sunset.',
    volumetric: 'volumetric sunset light',
    atmospheric: 'atmospheric sea mist',
    soundFirst:
      'First scene: grey waves, cold sea wind, shaky breathing, quiet sobbing, and rising cinematic tension.',
  },
  {
    id: 'street',
    shot: 'THE RAINY STREET',
    setup:
      "On a dark, rain-soaked city street at night, Character A stands trembling under a flickering neon sign, holding Character B's folded umbrella in both hands.",
    onAFace: ' Rain runs down their cheeks together with their tears.',
    restraint: '',
    bWaiting:
      'Across the street, Character B — zombified, pale, stiff, but still unmistakably {loved} — stands perfectly still in the rain, facing Character A, watching.',
    atmosphere:
      'Neon reflections shimmer on the wet asphalt. Cold blue-violet lighting and deep shadows create a tragic, oppressive atmosphere.',
    onBFace: ' Rain drips from {poss} {hair}.',
    tension: 'and rain on {poss} {surface}',
    propLowered: 'Cut back to Character A, still crying, the umbrella lowered.',
    choice:
      'Instead of backing away, Character A opens the umbrella and holds it out toward Character B — not in aggression, but in silent grief and recognition.',
    sees: 'Character B sees the umbrella held out to {object}.',
    motionless:
      'For a brief instant, Character A remains motionless with the umbrella held open.',
    ground: 'across the wet street',
    circlePlace: 'in the rain',
    poseScene: 'rainy',
    worldShift:
      'The rainy night street becomes the exact same street corner on a bright, sunny afternoon.',
    warmLight:
      'Golden afternoon sunlight illuminates their hair and faces. A gentle breeze moves through the street.',
    reveal:
      'The camera slowly pulls back to reveal the peaceful street corner, ending on the two characters embracing under the warm sun.',
    volumetric: 'volumetric sunlight',
    atmospheric: 'atmospheric rain',
    soundFirst:
      'First scene: rain on asphalt, distant city hum, shaky breathing, quiet sobbing, and rising cinematic tension.',
  },
  {
    id: 'doorstep',
    shot: 'THE SNOWY DOORSTEP',
    setup:
      "Outside a quiet house on a snowy winter night, Character A stands trembling at the front door, holding Character B's house key in one hand.",
    onAFace: ' Snowflakes settle on their hair and shoulders.',
    restraint: '',
    bWaiting:
      'Across the snowy yard, Character B — zombified, pale, stiff, but still unmistakably {loved} — stands perfectly still in the snow, facing Character A, watching.',
    atmosphere:
      'Warm porch light spills onto the snow. Cold blue-grey lighting and deep shadows create a tragic, oppressive atmosphere.',
    onBFace: ' Snowflakes catch on {poss} {hair}.',
    tension: 'and breath in the cold air',
    propLowered: 'Cut back to Character A, still crying, the key lowered.',
    choice:
      'Instead of retreating inside, Character A slowly opens both arms wide — not in aggression, but in silent grief and recognition.',
    sees: "Character B sees Character A's open arms.",
    motionless:
      'For a brief instant, Character A remains motionless with both arms open in the falling snow.',
    ground: 'across the snow',
    circlePlace: 'in the snow',
    poseScene: 'snowy',
    worldShift:
      'The snowy winter night becomes the exact same doorstep on a warm summer evening.',
    warmLight:
      'Golden evening sunlight illuminates their hair and faces. A gentle breeze moves through the warm air.',
    reveal:
      'The camera slowly pulls back to reveal the peaceful doorstep, ending on the two characters embracing under the summer sky.',
    volumetric: 'volumetric sunlight',
    atmospheric: 'atmospheric snow',
    soundFirst:
      'First scene: soft wind, falling snow, shaky breathing, quiet sobbing, and rising cinematic tension.',
  },
];

/**
 * Subject beats — everything that depends on whether the second reference is
 * a human being or an animal: pronouns, the identity lock, the undead face,
 * how the contact lands, and what "restored" means.
 */
interface ZombieSubject {
  id: ZombieSubjectId;
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

export const zombieSubjects: readonly ZombieSubject[] = [
  {
    id: 'person',
    bObject: 'them',
    bPossessive: 'their',
    loved: 'the person Character A loves',
    opening:
      'Character A is the survivor. Character B is someone Character A deeply loves — their partner, best friend, or family member, exactly as the two references suggest — who has tragically transformed into a zombie.',
    identity:
      'Preserve the exact facial identity, recognizable hairstyle, body proportions, and distinctive appearance of both characters throughout the video. Their genders, appearances, and relationship can vary depending on the supplied references.',
    undeadLook:
      'Character B has pale grey skin, cloudy white eyes, dark veins, hollow facial features, and disheveled hair. The expression is frightening and inhuman, yet the character remains unmistakably recognizable as Character B.',
    hair: 'hair',
    surface: 'skin',
    advance: 'They do not attack. They suddenly run forward',
    contact:
      "straight into Character A's arms, and wrap their arms tightly around Character A.",
    embrace: 'Character B wraps their arms around Character A',
    restored:
      'Both characters are now completely alive and healthy, restored to their normal human appearance exactly matching the reference images, wearing clean everyday clothing that fits their original gender and identity.',
    texture: 'natural skin textures, detailed hair simulation',
  },
  {
    id: 'pet',
    bObject: 'it',
    bPossessive: 'its',
    loved: 'the animal Character A loves',
    opening:
      'Character A is the owner. Character B is their beloved pet — the dog or cat from the second reference — which has tragically transformed into an undead animal.',
    identity:
      "Preserve the exact breed, coat, size, and facial identity of the pet, and Character A's exact face, hairstyle, and body proportions, throughout the video.",
    undeadLook:
      'Character B has pale grey fur, cloudy white eyes, dark veins, and disheveled fur. The expression is frightening and inhuman, yet the animal remains unmistakably recognizable as the same beloved pet.',
    hair: 'fur',
    surface: 'fur',
    advance: 'It does not attack. It suddenly runs forward',
    contact:
      "straight into Character A's arms, and presses its head and body against their chest.",
    embrace: "Character B presses its body into Character A's arms",
    restored:
      'Both are now completely alive and healthy — Character A restored to their normal human appearance, and Character B to its living coat, bright eyes, and size, both exactly matching the reference images. Character A wears clean everyday clothing.',
    texture: 'natural fur and coat texture, detailed hair simulation',
  },
];

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
    prompt: storyPrompt(world, subject),
    duration: 15,
  };
}
