/**
 * Video generation module.
 *
 * Wires the (previously unused) AI provider layer in `@/core/ai` to the task +
 * credit machinery in `@/modules/ai-tasks`, so a generation is a single
 * atomic-ish flow:
 *
 *   reserve credits → create task → call provider → attach provider task id
 *   → poll (or webhook) → store normalized result, refund on failure
 *
 * Providers are built per call from admin/env config, so changing an API key in
 * `/admin/settings` takes effect without a redeploy.
 *
 * Cross-module dependencies (documented in AGENTS.md):
 *   `ai-tasks` — task lifecycle, credit reservation/revocation
 *   `storage`  — mirroring generated media into R2/S3 when configured
 */

import {
  AIManager,
  AIMediaType,
  FalProvider,
  AITaskStatus as ProviderTaskStatus,
  HfsyProvider,
  ReplicateProvider,
  type AIFile,
  type SaveFilesFunction,
} from '@/core/ai';
import {
  defaultResolutionFor,
  getVideoModel,
  type VideoMode,
  type VideoOptions,
  type VideoProviderName,
} from '@/config/video-models';
import {
  AITaskStatus,
  countTasks,
  createTask,
  findTask,
  findTaskByProviderTaskId,
  getTasks,
  softDeleteTask,
  updateTask,
} from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import {
  moderateGeneratedVideos,
  moderateGenerationInput,
} from '@/modules/moderation/service';
import { getStorage } from '@/modules/storage/service';
import { getUuid } from '@/lib/hash';
import {
  composeVideoPrompt,
  type VideoCameraId,
  type VideoShotId,
  type VideoStyleId,
} from '@/lib/video-style-presets';
import type { VideoTaskView } from '@/lib/video-types';

/** `aiTask.mediaType` value that scopes every row this module owns. */
export const VIDEO_MEDIA_TYPE = 'video';

/** Credit transaction scene label, so `/settings/credits` reads sensibly. */
const CREDIT_SCENE = 'video_generation';

// ─── Providers ──────────────────────────────────────────────────────────────

/**
 * Mirror provider-hosted media into our own bucket so the URLs don't expire.
 * Returns undefined when storage isn't configured — the provider then keeps the
 * upstream CDN URL, which is fine for local dev but will rot over time.
 */
async function makeSaveFiles(): Promise<SaveFilesFunction | undefined> {
  const storage = await getStorage();
  if (!storage) return undefined;

  return async (files: AIFile[]) => {
    const saved: AIFile[] = [];
    for (const file of files) {
      try {
        const resp = await fetch(file.url);
        if (!resp.ok) continue;
        const body = new Uint8Array(await resp.arrayBuffer());
        const result = await storage.uploadFile({
          body,
          key: file.key,
          contentType: file.contentType,
          disposition: 'inline',
        });
        if (result.success && result.url) {
          saved.push({ ...file, url: result.url, key: result.key || file.key });
        }
      } catch (error) {
        console.error('[video] mirroring generated file failed:', error);
      }
    }
    return saved.length > 0 ? saved : undefined;
  };
}

/**
 * Build a manager holding every provider that has credentials configured.
 * Admin-panel values win over env (see `getAllConfigs`).
 */
async function buildProviderManager(): Promise<AIManager> {
  const configs = await getAllConfigs();
  const saveFiles = await makeSaveFiles();
  const customStorage = Boolean(saveFiles);

  const manager = new AIManager();

  if (configs.fal_api_key) {
    manager.addProvider(
      new FalProvider({
        apiKey: configs.fal_api_key,
        customStorage,
        saveFiles,
        uuid: getUuid,
      }),
      true
    );
  }

  if (configs.replicate_api_token) {
    manager.addProvider(
      new ReplicateProvider({
        apiToken: configs.replicate_api_token,
        customStorage,
        saveFiles,
        uuid: getUuid,
      })
    );
  }

  if (configs.hfsy_api_key) {
    manager.addProvider(
      new HfsyProvider({
        apiKey: configs.hfsy_api_key,
        baseUrl: configs.hfsy_base_url || undefined,
        customStorage,
        saveFiles,
        uuid: getUuid,
      })
    );
  }

  return manager;
}

/** Provider names that currently have credentials — surfaced to the UI. */
export async function getConfiguredProviders(): Promise<VideoProviderName[]> {
  const configs = await getAllConfigs();
  const names: VideoProviderName[] = [];
  if (configs.fal_api_key) names.push('fal');
  if (configs.replicate_api_token) names.push('replicate');
  if (configs.hfsy_api_key) names.push('hfsy');
  return names;
}

// ─── Status mapping ─────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, AITaskStatus> = {
  pending: AITaskStatus.PENDING,
  processing: AITaskStatus.PROCESSING,
  success: AITaskStatus.SUCCESS,
  failed: AITaskStatus.FAILED,
  canceled: AITaskStatus.CANCELED,
};

function toTaskStatus(status: ProviderTaskStatus): AITaskStatus {
  return STATUS_MAP[status as string] ?? AITaskStatus.PROCESSING;
}

const TERMINAL_STATUSES: string[] = [
  AITaskStatus.SUCCESS,
  AITaskStatus.FAILED,
  AITaskStatus.CANCELED,
];

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// ─── Views ──────────────────────────────────────────────────────────────────

export type { VideoTaskView } from '@/lib/video-types';

/** Tolerantly parse a JSON text column — legacy rows may hold anything. */
function parseJson(value: unknown): any {
  if (!value || typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function toTaskView(task: any): VideoTaskView {
  const options = (parseJson(task.options) ?? {}) as Partial<VideoOptions>;
  const result = (parseJson(task.taskResult) ?? {}) as {
    videos?: { videoUrl?: string; thumbnailUrl?: string }[];
    errorMessage?: string;
  };
  const model = getVideoModel(task.model);

  return {
    id: task.id,
    provider: task.provider,
    model: task.model,
    modelLabel: model?.label ?? task.model,
    prompt: task.prompt ?? '',
    status: task.status,
    polling: !isTerminalStatus(task.status),
    videos: Array.isArray(result.videos) ? result.videos : [],
    errorMessage: result.errorMessage ?? '',
    costCredits: task.costCredits ?? 0,
    duration: options.duration,
    aspectRatio: options.aspectRatio,
    resolution: options.resolution,
    generateAudio: options.generateAudio,
    sourceImageUrl: options.imageUrl,
    lastFrameUrl: options.lastFrameUrl,
    style: options.style,
    cameraMovement: options.cameraMovement,
    shotSize: options.shotSize,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  };
}

// ─── Generate ───────────────────────────────────────────────────────────────

export interface GenerateVideoParams {
  userId: string;
  modelId: string;
  prompt?: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  generateAudio?: boolean;
  imageUrl?: string;
  lastFrameUrl?: string;
  style?: VideoStyleId;
  cameraMovement?: VideoCameraId;
  shotSize?: VideoShotId;
}

/**
 * Kick off a generation. Credits are reserved before the provider is called, so
 * an under-funded request never reaches a paid upstream API.
 */
export async function generateVideo(params: GenerateVideoParams) {
  const model = getVideoModel(params.modelId);
  if (!model) throw new Error('Unknown model');

  const mode: VideoMode = params.imageUrl ? 'image-to-video' : 'text-to-video';
  if (!model.modes.includes(mode)) {
    throw new Error(
      mode === 'image-to-video'
        ? 'This model does not accept a source image'
        : 'This model requires a source image'
    );
  }

  const prompt = (params.prompt ?? '').trim();
  if (mode === 'text-to-video' && !prompt) {
    throw new Error('Prompt is required');
  }

  // Keep the user's scene prompt separate from the structured direction. The
  // provider receives one concise, positive prompt; the task keeps the raw
  // prompt and selections so the Studio can edit them without duplicating text.
  const providerPrompt = composeVideoPrompt({
    prompt,
    mode,
    style: params.style,
    cameraMovement: params.cameraMovement,
    shotSize: params.shotSize,
  });

  // Clamp every option against the model's own set — a stale client must not be
  // able to send a duration the endpoint doesn't accept.
  const duration = model.durations.includes(Number(params.duration))
    ? Number(params.duration)
    : model.defaultDuration;
  const resolution = model.resolutions.includes(params.resolution ?? '')
    ? (params.resolution as string)
    : defaultResolutionFor(model.resolutions);
  const aspectRatio = model.aspectRatios.includes(params.aspectRatio ?? '')
    ? (params.aspectRatio as string)
    : model.aspectRatios[0];
  const lastFrameUrl =
    model.supportsLastFrame && params.lastFrameUrl
      ? params.lastFrameUrl
      : undefined;

  const providerOptions: VideoOptions = {
    prompt: providerPrompt,
    duration,
    aspectRatio,
    resolution,
    generateAudio: params.generateAudio ?? model.audio,
    imageUrl: params.imageUrl,
    lastFrameUrl,
    style: params.style,
    cameraMovement: params.cameraMovement,
    shotSize: params.shotSize,
  };
  const persistedOptions: VideoOptions = { ...providerOptions, prompt };

  // Tiered NSFW gates before any credit reservation: prompt text first, then
  // input images — a rejection here costs the checks, never a generation.
  await moderateGenerationInput({
    prompt,
    imageUrls: [providerOptions.imageUrl, providerOptions.lastFrameUrl],
  });

  const manager = await buildProviderManager();
  const provider = manager.getProvider(model.provider);
  if (!provider) {
    throw new Error(
      `Provider "${model.provider}" is not configured — add its API key in Admin → Settings → AI`
    );
  }

  const task = await createTask({
    userId: params.userId,
    mediaType: VIDEO_MEDIA_TYPE,
    provider: model.provider,
    model: model.id,
    prompt,
    costCredits: model.creditCost,
    options: persistedOptions,
    scene: CREDIT_SCENE,
  });

  try {
    const result = await provider.generate({
      params: {
        mediaType: AIMediaType.VIDEO,
        model: model.id,
        prompt: providerPrompt,
        options: model.buildInput(providerOptions),
      },
    });

    await updateTask({
      taskId: task.id,
      status: AITaskStatus.PENDING,
      providerTaskId: result.taskId,
    });

    return { ...task, taskId: result.taskId };
  } catch (error: any) {
    // Refunds the reserved credits — see updateTask.
    await updateTask({
      taskId: task.id,
      status: AITaskStatus.FAILED,
      taskResult: { errorMessage: error?.message || 'Generation failed' },
    });
    throw error;
  }
}

// ─── Poll / sync ────────────────────────────────────────────────────────────

/**
 * Output moderation can outlast a poll tick, and browser polling shares the
 * path with webhooks — lock per task so concurrent syncs await one moderation
 * run instead of re-billing it.
 */
const outputModerationLocks = new Map<
  string,
  Promise<{ flagged: boolean; reason?: string }>
>();

function gateGeneratedVideos(
  taskId: string,
  videoUrls: string[]
): Promise<{ flagged: boolean; reason?: string }> {
  let pending = outputModerationLocks.get(taskId);
  if (!pending) {
    pending = moderateGeneratedVideos(videoUrls).finally(() => {
      outputModerationLocks.delete(taskId);
    });
    outputModerationLocks.set(taskId, pending);
  }
  return pending;
}

/**
 * Refresh one task from its provider and persist the normalized result.
 * A no-op for terminal tasks, so it is safe to call on every poll tick.
 */
export async function refreshVideoTask(taskId: string) {
  const task = await findTask(taskId);
  if (!task || task.mediaType !== VIDEO_MEDIA_TYPE) {
    throw new Error('Task not found');
  }
  if (isTerminalStatus(task.status) || !task.taskId) return task;

  const model = getVideoModel(task.model);
  if (!model) return task;

  const manager = await buildProviderManager();
  const provider = manager.getProvider(model.provider);
  if (!provider?.query) return task;

  try {
    const result = await provider.query({
      taskId: task.taskId,
      mediaType: AIMediaType.VIDEO,
      model: model.id,
    });

    let status = toTaskStatus(result.taskStatus);
    let videos = result.taskInfo?.videos ?? [];
    let errorMessage = result.taskInfo?.errorMessage ?? '';

    // Final NSFW gate: a flagged render never reaches SUCCESS — failing the
    // task routes it through updateTask's credit revocation, and the video
    // URLs are dropped from the persisted result.
    if (status === AITaskStatus.SUCCESS && videos.length > 0) {
      const verdict = await gateGeneratedVideos(
        task.id,
        videos
          .map((v: { videoUrl?: string }) => v.videoUrl)
          .filter((u: string | undefined): u is string => Boolean(u))
      );
      if (verdict.flagged) {
        status = AITaskStatus.FAILED;
        videos = [];
        errorMessage =
          verdict.reason || 'Generated video was flagged by content moderation';
      }
    }

    await updateTask({
      taskId: task.id,
      status,
      taskResult: {
        videos,
        status: result.taskInfo?.status ?? '',
        errorMessage,
      },
    });
  } catch (error: any) {
    // A poll failure is not proof the generation failed — the upstream job may
    // still be running, or the network may be flaky. Record it but leave the
    // task non-terminal so the next tick can retry, and only give up after the
    // row is clearly stale (handled by the caller's timeout UI).
    console.error('[video] polling failed:', error?.message);
  }

  return findTask(task.id);
}

/**
 * Match an inbound provider webhook to one of our rows and sync it.
 * Webhooks let a generation finish without the browser staying open.
 */
export async function handleProviderWebhook(
  providerName: string,
  payload: any
): Promise<{ matched: boolean }> {
  const providerTaskId =
    providerName === 'fal'
      ? payload?.request_id
      : providerName === 'replicate'
        ? payload?.id
        : undefined;

  if (!providerTaskId) return { matched: false };

  const task = await findTaskByProviderTaskId(providerTaskId);
  if (!task) return { matched: false };

  await refreshVideoTask(task.id);
  return { matched: true };
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function listVideoTasks(params: {
  userId: string;
  page?: number;
  pageSize?: number;
  status?: string;
  model?: string;
  search?: string;
}) {
  const { userId, page = 1, pageSize = 12, status, model, search } = params;

  const [rows, total] = await Promise.all([
    getTasks({
      userId,
      mediaType: VIDEO_MEDIA_TYPE,
      status,
      model,
      search,
      page,
      limit: pageSize,
    }),
    countTasks({ userId, mediaType: VIDEO_MEDIA_TYPE, status, model, search }),
  ]);

  return { items: rows.map(toTaskView), total };
}

/** Fetch one task and, when still running, sync it before returning. */
export async function getVideoTask(params: {
  taskId: string;
  userId?: string;
}): Promise<VideoTaskView> {
  const task = await findTask(params.taskId);
  if (!task || task.mediaType !== VIDEO_MEDIA_TYPE) {
    throw new Error('Task not found');
  }
  if (params.userId && task.userId !== params.userId) {
    throw new Error('Task not found');
  }

  const fresh = isTerminalStatus(task.status)
    ? task
    : await refreshVideoTask(task.id);

  return toTaskView(fresh ?? task);
}

export async function deleteVideoTask(params: {
  taskId: string;
  userId: string;
}) {
  await softDeleteTask({ taskId: params.taskId, userId: params.userId });
}

/** Recent successful generations for the Studio sidebar / library teaser. */
export async function listRecentVideoTasks(userId: string, limit = 6) {
  const rows = await getTasks({
    userId,
    mediaType: VIDEO_MEDIA_TYPE,
    status: AITaskStatus.SUCCESS,
    page: 1,
    limit,
  });
  return rows.map(toTaskView);
}
