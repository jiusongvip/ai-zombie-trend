/**
 * NSFW content moderation — seeapi (https://www.seeapi.com).
 *
 * Tiered gates ordered by cost, so a rejection is as cheap as possible:
 *
 *   1. prompt text   → reject = skip image checks AND skip generation
 *   2. input images  → reject = skip generation
 *   3. output video  → reject = mark task failed (credits refunded)
 *
 * Every seeapi endpoint shares one shape: POST /v1/inferences (async task)
 * then GET /v1/inferences/{id} until settled. The key lives in the config
 * table (Admin → Settings → AI) with an env fallback; when it is absent the
 * whole pipeline is a no-op.
 *
 * Policy: a flagged verdict always rejects. A *service* failure (bad key,
 * timeout, upstream 5xx) fails OPEN with a console warning — a moderation
 * outage must not block generations the user already paid for.
 */

import { getAllConfigs } from '@/modules/config/service';
import { getNonceStr, md5 } from '@/lib/hash';

const SEEAPI_BASE_URL = 'https://api.seeapi.com';
const POLL_INTERVAL_MS = 2000;

const TEXT_TIMEOUT_MS = 15_000;
const IMAGE_TIMEOUT_MS = 45_000;
const VIDEO_TIMEOUT_MS = 90_000;

/** Rejection surfaced to the user — distinct from internal service errors. */
export class ModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModerationError';
  }
}

// ─── Verdict cache ──────────────────────────────────────────────────────────

/**
 * Verdicts are deterministic per content, and several inputs repeat (the
 * zombie route's server-side style prompts, retried images). Caching by
 * md5(text)/URL avoids re-billing the same check within the TTL.
 */
const CACHE_TTL_MS = 24 * 3600 * 1000;
const CACHE_MAX = 500;
const verdictCache = new Map<string, { flagged: boolean; expires: number }>();

function cacheGet(key: string): boolean | undefined {
  const hit = verdictCache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    verdictCache.delete(key);
    return undefined;
  }
  return hit.flagged;
}

function cacheSet(key: string, flagged: boolean) {
  if (verdictCache.size >= CACHE_MAX) {
    const oldest = verdictCache.keys().next().value;
    if (oldest !== undefined) verdictCache.delete(oldest);
  }
  verdictCache.set(key, { flagged, expires: Date.now() + CACHE_TTL_MS });
}

// ─── seeapi client ──────────────────────────────────────────────────────────

interface SeeapiTask {
  id?: string;
  status?: string;
  result?: { data?: { flagged?: boolean } };
  error?: { message?: string } | string | null;
}

async function getKey(): Promise<string> {
  const configs = await getAllConfigs();
  return configs.seeapi_api_key || '';
}

/** True when a moderation key is configured — used to keep messages honest. */
export async function isModerationEnabled(): Promise<boolean> {
  return Boolean(await getKey());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSettled(status: string | undefined): boolean {
  return (
    status === 'succeeded' ||
    status === 'failed' ||
    status === 'canceled' ||
    status === 'cancelled'
  );
}

function errorText(task: SeeapiTask): string {
  const e = task.error;
  if (!e) return '';
  return typeof e === 'string' ? e : (e.message ?? '');
}

/** Submit an inference and poll it until settled or the timeout budget ends. */
async function runInference(
  key: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ flagged: boolean }> {
  const submit = await fetch(`${SEEAPI_BASE_URL}/v1/inferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Idempotency-Key': getNonceStr(32),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!submit.ok) {
    throw new Error(`seeapi submit failed (${submit.status})`);
  }

  let task: SeeapiTask = await submit.json();
  const deadline = Date.now() + timeoutMs;

  while (!isSettled(task.status)) {
    if (!task.id) throw new Error('seeapi submit returned no task id');
    if (Date.now() > deadline) throw new Error('seeapi check timed out');
    await sleep(POLL_INTERVAL_MS);

    const poll = await fetch(
      `${SEEAPI_BASE_URL}/v1/inferences/${task.id}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!poll.ok) throw new Error(`seeapi poll failed (${poll.status})`);
    task = await poll.json();
  }

  if (task.status !== 'succeeded') {
    throw new Error(
      `seeapi task ${task.status}${errorText(task) ? `: ${errorText(task)}` : ''}`
    );
  }

  return { flagged: task.result?.data?.flagged === true };
}

// ─── Checks ─────────────────────────────────────────────────────────────────

async function checkText(key: string, text: string): Promise<boolean> {
  const cacheKey = `text:${md5(text)}`;
  const hit = cacheGet(cacheKey);
  if (hit !== undefined) return hit;

  const { flagged } = await runInference(
    key,
    {
      model: 'text-nsfw-filter',
      endpoint: 'text-moderation',
      provider: 'seeapi',
      input: { text },
    },
    TEXT_TIMEOUT_MS
  );
  cacheSet(cacheKey, flagged);
  return flagged;
}

async function checkImage(key: string, url: string): Promise<boolean> {
  const cacheKey = `image:${md5(url)}`;
  const hit = cacheGet(cacheKey);
  if (hit !== undefined) return hit;

  const { flagged } = await runInference(
    key,
    {
      model: 'nsfw-filter',
      endpoint: 'image-moderation',
      provider: 'seeapi',
      input: { image_url: url, strict_special_care: true },
    },
    IMAGE_TIMEOUT_MS
  );
  cacheSet(cacheKey, flagged);
  return flagged;
}

async function checkVideo(key: string, url: string): Promise<boolean> {
  const cacheKey = `video:${md5(url)}`;
  const hit = cacheGet(cacheKey);
  if (hit !== undefined) return hit;

  const { flagged } = await runInference(
    key,
    {
      model: 'video-nsfw-filter',
      endpoint: 'video-moderation',
      provider: 'seeapi',
      input: {
        video_url: url,
        num_frames: 8,
        strict_special_care: true,
        return_frames: 'none',
      },
    },
    VIDEO_TIMEOUT_MS
  );
  cacheSet(cacheKey, flagged);
  return flagged;
}

// ─── Gates ──────────────────────────────────────────────────────────────────

/**
 * Localhost/`/uploads` URLs exist only on our side of the wire — seeapi cannot
 * fetch them, so checking would fail (and possibly bill nothing). Skip them
 * rather than noise the logs; on any deployed site the URLs are public.
 */
function isPublicHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  try {
    const host = new URL(url).hostname;
    return !/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host);
  } catch {
    return false;
  }
}

/**
 * Gate 1+2, run before credits are reserved. Text first, then input images —
 * a text rejection never pays for an image check. Throws ModerationError on a
 * flagged verdict; any other failure fails open.
 */
export async function moderateGenerationInput(params: {
  prompt?: string;
  imageUrls?: (string | undefined)[];
}): Promise<void> {
  let key: string;
  try {
    key = await getKey();
  } catch (error: any) {
    console.warn('[moderation] config unavailable, allowing through:', error?.message);
    return;
  }
  if (!key) return;

  const urls = (params.imageUrls ?? []).filter(isPublicHttpUrl);

  try {
    if (params.prompt) {
      if (await checkText(key, params.prompt)) {
        throw new ModerationError(
          'Your prompt was flagged by content moderation. Please describe a different scene.'
        );
      }
    }

    for (const url of urls) {
      if (await checkImage(key, url)) {
        throw new ModerationError(
          'One of your source images was flagged by content moderation. Please upload a different photo.'
        );
      }
    }
  } catch (error) {
    if (error instanceof ModerationError) throw error;
    console.warn('[moderation] input check unavailable, allowing through:', (error as Error)?.message);
  }
}

/**
 * Gate 3, run on the generated video before the task is marked SUCCESS.
 * Never throws: moderation outages return a pass, flagged content returns
 * the reason so the caller can fail (and refund) the task.
 */
export async function moderateGeneratedVideos(
  videoUrls: string[]
): Promise<{ flagged: boolean; reason?: string }> {
  const urls = videoUrls.filter(isPublicHttpUrl);
  if (urls.length === 0) return { flagged: false };

  let key: string;
  try {
    key = await getKey();
  } catch (error: any) {
    console.warn('[moderation] config unavailable, allowing through:', error?.message);
    return { flagged: false };
  }
  if (!key) return { flagged: false };

  try {
    for (const url of urls) {
      if (await checkVideo(key, url)) {
        return {
          flagged: true,
          reason:
            'The generated video was flagged by content moderation. Your credits have been refunded.',
        };
      }
    }
  } catch (error: any) {
    console.warn('[moderation] output check unavailable, allowing through:', error?.message);
  }

  return { flagged: false };
}
