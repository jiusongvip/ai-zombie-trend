/**
 * Client-safe video direction presets.
 *
 * These are deliberately short, positive motion/style phrases. The leading
 * prompt still owns the scene; presets only add one clear direction so they
 * improve controllability without turning the request into a giant template.
 */

export const VIDEO_STYLE_IDS = [
  'cinematic',
  'commercial',
  'documentary',
  'anime',
  '3d-animation',
  'stop-motion',
] as const;

export type VideoStyleId = (typeof VIDEO_STYLE_IDS)[number];

export const VIDEO_STYLE_PROMPTS: Record<VideoStyleId, string> = {
  cinematic: 'cinematic live-action look with natural, controlled motion',
  commercial:
    'polished commercial film look with clean composition and premium lighting',
  documentary:
    'observational documentary look with natural light and realistic motion',
  anime: 'stylized 2D anime animation with expressive, clean movement',
  '3d-animation':
    'stylized 3D animation with smooth character motion and polished materials',
  'stop-motion':
    'handcrafted stop-motion animation with tactile textures and slightly stepped motion',
};

export const VIDEO_CAMERA_IDS = [
  'locked',
  'slow-push-in',
  'tracking',
  'orbit',
  'handheld',
  'pan',
] as const;

export type VideoCameraId = (typeof VIDEO_CAMERA_IDS)[number];

export const VIDEO_CAMERA_PROMPTS: Record<VideoCameraId, string> = {
  locked: 'locked camera; the camera remains still',
  'slow-push-in': 'a slow push-in toward the subject',
  tracking: 'a smooth tracking shot following the subject',
  orbit: 'a slow orbit around the subject',
  handheld: 'subtle handheld camera movement',
  pan: 'a slow pan across the scene',
};

export const VIDEO_SHOT_IDS = ['wide', 'medium', 'close-up'] as const;

export type VideoShotId = (typeof VIDEO_SHOT_IDS)[number];

export const VIDEO_SHOT_PROMPTS: Record<VideoShotId, string> = {
  wide: 'wide shot',
  medium: 'medium shot',
  'close-up': 'close-up shot',
};

export function composeVideoPrompt({
  prompt,
  mode,
  style,
  cameraMovement,
  shotSize,
}: {
  prompt: string;
  mode: 'text-to-video' | 'image-to-video';
  style?: VideoStyleId;
  cameraMovement?: VideoCameraId;
  shotSize?: VideoShotId;
}): string {
  const parts = [prompt.trim()];

  if (mode === 'image-to-video' && parts[0].length === 0) {
    parts[0] = 'The subject moves naturally with subtle, continuous motion.';
  }

  if (shotSize) {
    parts.push(`Framing: ${VIDEO_SHOT_PROMPTS[shotSize]}.`);
  }
  if (cameraMovement) {
    parts.push(`Camera movement: ${VIDEO_CAMERA_PROMPTS[cameraMovement]}.`);
  }
  if (style) {
    parts.push(`Visual style: ${VIDEO_STYLE_PROMPTS[style]}.`);
  }

  return parts.join(' ').trim();
}
