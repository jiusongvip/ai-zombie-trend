/**
 * Video model catalog — the single source of truth for what the Studio can
 * generate.
 *
 * Two responsibilities live here:
 *
 * 1. **What the UI shows** — label, vendor, duration/aspect/resolution options,
 *    credit price. The `/api/video/models` route exposes this shape to the
 *    client as `PublicVideoModel`; everything else stays server-side.
 *
 * 2. **How a request is shaped** — `buildInput` maps the normalized option set
 *    onto one specific provider endpoint's own input schema. Provider APIs
 *    drift: when a model renames a parameter, edit its builder here and nothing
 *    else in the codebase has to change.
 *
 * Model ids below are the provider's queue endpoint path. For fal, the queue
 * status/result endpoints collapse to the first two path segments (handled by
 * `FalProvider.getQueryModel`), so multi-segment ids like
 * `fal-ai/kling-video/o3/pro/text-to-video` poll `fal-ai/kling-video`.
 */

export type VideoProviderName = 'fal' | 'replicate' | 'hfsy';

export type VideoMode = 'text-to-video' | 'image-to-video';

/** Normalized generation options — the shape the Studio form produces. */
export interface VideoOptions {
  prompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  generateAudio: boolean;
  /** Source image for `image-to-video` models. */
  imageUrl?: string;
  /** Optional end frame for models that support first-to-last transitions. */
  lastFrameUrl?: string;
  /** Structured direction selected in the Studio. */
  style?: string;
  cameraMovement?: string;
  shotSize?: string;
}

/** Catalog entry as returned by `/api/video/models` (no builders, no secrets). */
export interface PublicVideoModel {
  id: string;
  /** Which provider endpoint serves it — lets the UI flag unconfigured ones. */
  provider: VideoProviderName;
  label: string;
  vendor: string;
  modes: VideoMode[];
  creditCost: number;
  durations: number[];
  defaultDuration: number;
  aspectRatios: string[];
  resolutions: string[];
  /**
   * Starting resolution. Derived rather than hand-written — see
   * `defaultResolutionFor()` for why it is not simply `resolutions[0]`.
   */
  defaultResolution: string;
  audio: boolean;
  /** i18n key suffix under `studio.model.highlight.*`. */
  highlight?: string;
  /** Whether the provider accepts an optional end frame for image-to-video. */
  supportsLastFrame?: boolean;
}

export interface VideoModel extends Omit<
  PublicVideoModel,
  'defaultResolution'
> {
  buildInput: (o: VideoOptions) => Record<string, any>;
}

/**
 * Resolution tiers in order of preference, best value first.
 *
 * `resolutions` is written cheapest→priciest, so defaulting to the last entry
 * silently quotes the user the *most expensive* tier (Veo 3.1 opened on 4K).
 * Defaulting to the first is no better — that picks 480p for Seedance. Pick the
 * best standard tier instead, and fall back to whatever the model lists first.
 */
const RESOLUTION_PREFERENCE = ['1080p', '720p', '480p', '2K', '4K'];

export function defaultResolutionFor(resolutions: string[]): string {
  return (
    RESOLUTION_PREFERENCE.find((r) => resolutions.includes(r)) ??
    resolutions[0] ??
    ''
  );
}

/** Shared fal duration convention: `"5"` / `"10"` as a string. */
const seconds = (n: number) => String(n);

export const videoModels: VideoModel[] = [
  // ─── fal · text to video ────────────────────────────────────────────────
  {
    id: 'fal-ai/veo3.1',
    provider: 'fal',
    label: 'Veo 3.1',
    vendor: 'Google DeepMind',
    modes: ['text-to-video'],
    creditCost: 120,
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4K'],
    audio: true,
    highlight: 'cinematic',
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: `${o.duration}s`,
      resolution: o.resolution,
      generate_audio: o.generateAudio,
    }),
  },
  {
    id: 'fal-ai/kling-video/o3/pro/text-to-video',
    provider: 'fal',
    label: 'Kling 3 Pro',
    vendor: 'Kuaishou',
    modes: ['text-to-video'],
    creditCost: 100,
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['1080p'],
    audio: true,
    highlight: 'storyboard',
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: seconds(o.duration),
      generate_audio: o.generateAudio,
    }),
  },
  {
    id: 'bytedance/seedance-2.0/text-to-video',
    provider: 'fal',
    label: 'Seedance 2',
    vendor: 'ByteDance',
    modes: ['text-to-video'],
    creditCost: 80,
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p'],
    audio: true,
    highlight: 'storyboard',
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: seconds(o.duration),
      resolution: o.resolution,
      generate_audio: o.generateAudio,
    }),
  },
  {
    id: 'alibaba/happy-horse/v1.1/text-to-video',
    provider: 'fal',
    label: 'Happy Horse 1.1',
    vendor: 'Alibaba',
    modes: ['text-to-video'],
    creditCost: 70,
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    audio: true,
    highlight: 'lipsync',
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: seconds(o.duration),
      resolution: o.resolution,
    }),
  },
  {
    id: 'google/gemini-omni-flash',
    provider: 'fal',
    label: 'Gemini Omni',
    vendor: 'Google DeepMind',
    modes: ['text-to-video'],
    creditCost: 50,
    durations: [4, 6, 10],
    defaultDuration: 6,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p'],
    audio: true,
    highlight: 'physics',
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: seconds(o.duration),
    }),
  },
  {
    id: 'fal-ai/wan/v2.7/text-to-video',
    provider: 'fal',
    label: 'Wan 2.7',
    vendor: 'Alibaba',
    modes: ['text-to-video'],
    creditCost: 40,
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    audio: true,
    highlight: 'value',
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: seconds(o.duration),
      resolution: o.resolution,
    }),
  },

  // ─── fal · image to video ───────────────────────────────────────────────
  {
    id: 'fal-ai/kling-video/v3/pro/image-to-video',
    provider: 'fal',
    label: 'Kling 3 Pro',
    vendor: 'Kuaishou',
    modes: ['image-to-video'],
    creditCost: 100,
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['auto'],
    resolutions: ['1080p'],
    audio: true,
    highlight: 'storyboard',
    buildInput: (o) => ({
      prompt: o.prompt,
      image_url: o.imageUrl,
      duration: seconds(o.duration),
      generate_audio: o.generateAudio,
    }),
  },
  {
    id: 'bytedance/seedance-2.0/image-to-video',
    provider: 'fal',
    label: 'Seedance 2',
    vendor: 'ByteDance',
    modes: ['image-to-video'],
    // Priced to `CREDITS_PER_FILM` in config/pricing.ts — this fork's only
    // generation path is the homepage zombie-film generator, so this number IS
    // the film price the marketing quotes. Keep the two in sync.
    creditCost: 20,
    durations: [5, 10, 15],
    defaultDuration: 5,
    // Order matters: the generator's default is the first entry, and 9:16 is
    // what the trend is shot for (TikTok / Reels / Shorts).
    aspectRatios: ['9:16', '16:9'],
    resolutions: ['480p', '720p'],
    audio: true,
    highlight: 'first_last_frame',
    supportsLastFrame: true,
    buildInput: (o) => ({
      prompt: o.prompt,
      image_url: o.imageUrl,
      ...(o.lastFrameUrl ? { end_image_url: o.lastFrameUrl } : {}),
      duration: seconds(o.duration),
      resolution: o.resolution,
      aspect_ratio: o.aspectRatio,
    }),
  },
  {
    id: 'minimax/h3/image-to-video',
    provider: 'fal',
    label: 'MiniMax H3',
    vendor: 'MiniMax',
    modes: ['image-to-video'],
    creditCost: 60,
    durations: [6, 10],
    defaultDuration: 6,
    aspectRatios: ['auto'],
    resolutions: ['1080p', '2K'],
    audio: true,
    highlight: 'first_last_frame',
    supportsLastFrame: true,
    buildInput: (o) => ({
      prompt: o.prompt,
      image_url: o.imageUrl,
      ...(o.lastFrameUrl ? { end_image_url: o.lastFrameUrl } : {}),
      duration: seconds(o.duration),
      resolution: o.resolution,
    }),
  },
  {
    id: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    provider: 'fal',
    label: 'Kling 2.5 Turbo Pro',
    vendor: 'Kuaishou',
    modes: ['image-to-video'],
    creditCost: 50,
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['auto'],
    resolutions: ['1080p'],
    audio: false,
    highlight: 'value',
    buildInput: (o) => ({
      prompt: o.prompt,
      image_url: o.imageUrl,
      duration: seconds(o.duration),
    }),
  },

  // ─── Replicate ──────────────────────────────────────────────────────────
  {
    id: 'google/veo-3.1',
    provider: 'replicate',
    label: 'Veo 3.1',
    vendor: 'Google DeepMind',
    modes: ['text-to-video', 'image-to-video'],
    creditCost: 120,
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    audio: true,
    highlight: 'cinematic',
    // ReplicateProvider.formatInput rewrites `image_input` → `reference_images`.
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: o.duration,
      resolution: o.resolution,
      ...(o.imageUrl ? { image_input: [o.imageUrl] } : {}),
    }),
  },
  {
    id: 'openai/sora-2',
    provider: 'replicate',
    label: 'Sora 2',
    vendor: 'OpenAI',
    modes: ['text-to-video', 'image-to-video'],
    creditCost: 150,
    durations: [4, 8, 12],
    defaultDuration: 4,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p'],
    audio: true,
    highlight: 'cinematic',
    // formatInput rewrites `image_input` → `input_reference` and `duration` → `seconds`.
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: o.duration,
      ...(o.imageUrl ? { image_input: [o.imageUrl] } : {}),
    }),
  },
  {
    id: 'minimax/hailuo-02',
    provider: 'replicate',
    label: 'Hailuo 02',
    vendor: 'MiniMax',
    modes: ['text-to-video'],
    creditCost: 60,
    durations: [6, 10],
    defaultDuration: 6,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    audio: false,
    highlight: 'value',
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: o.duration,
      resolution: o.resolution,
    }),
  },

  // ─── HFSY · Seedance 2 omni-reference ───────────────────────────────────
  {
    id: 'sd-2-vip-480',
    provider: 'hfsy',
    label: 'Seedance 2 VIP',
    vendor: 'ByteDance',
    modes: ['text-to-video', 'image-to-video'],
    // Flat per-generation price like every other row here. Upstream is billed
    // per second (¥0.25/s), so 20 credits still covers the 15s worst case.
    creditCost: 20,
    durations: [5, 10, 15],
    defaultDuration: 5,
    // First entry is the generator default and the API's own default.
    aspectRatios: ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'],
    resolutions: ['480p'],
    audio: true,
    // The second frame is a second *character reference*, not an end frame —
    // this model has no first-to-last transition, it reads both as @image refs.
    supportsLastFrame: true,
    buildInput: (o) => {
      const images = [o.imageUrl, o.lastFrameUrl].filter(Boolean) as string[];
      return {
        orientation: ['16:9', '4:3', '21:9'].includes(o.aspectRatio)
          ? 'landscape'
          : 'portrait',
        ratio: o.aspectRatio,
        duration: o.duration,
        ...(images.length ? { images } : {}),
      };
    },
  },
];

export function listVideoModels(): VideoModel[] {
  return videoModels;
}

export function getVideoModel(id: string): VideoModel | undefined {
  return videoModels.find((m) => m.id === id);
}

/** Strip server-only fields (the input builders) before sending to a client. */
export function toPublicVideoModel(model: VideoModel): PublicVideoModel {
  return {
    id: model.id,
    provider: model.provider,
    label: model.label,
    vendor: model.vendor,
    modes: model.modes,
    creditCost: model.creditCost,
    durations: model.durations,
    defaultDuration: model.defaultDuration,
    aspectRatios: model.aspectRatios,
    resolutions: model.resolutions,
    defaultResolution: defaultResolutionFor(model.resolutions),
    audio: model.audio,
    highlight: model.highlight,
    supportsLastFrame: model.supportsLastFrame,
  };
}

/** Cheapest model — used as the default selection and for "from N credits". */
export function cheapestCreditCost(): number {
  return videoModels.reduce(
    (min, m) => Math.min(min, m.creditCost),
    Number.POSITIVE_INFINITY
  );
}
