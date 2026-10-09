import {
  AIConfigs,
  AIFile,
  AIGenerateParams,
  AIProvider,
  AITaskResult,
  AITaskStatus,
  AIVideo,
  SaveFilesFunction,
  UuidFunction,
} from './types';

const defaultUuid: UuidFunction = () => crypto.randomUUID();

/**
 * HFSY API configs (OpenAI-style gateway fronting Volcengine video models)
 * @docs https://www.hfsyapi.cn/docs/api
 */
export interface HfsyConfigs extends AIConfigs {
  apiKey: string;
  baseUrl?: string;
  customStorage?: boolean;
  saveFiles?: SaveFilesFunction;
  uuid?: UuidFunction;
}

interface HfsyTask {
  id?: string;
  status?: string;
  progress?: number;
  result_url?: string;
  video_url?: string;
  fail_reason?: string;
  detail?: { url?: string };
}

const HFSY_STATUS: Record<string, AITaskStatus> = {
  queued: AITaskStatus.PENDING,
  pending: AITaskStatus.PENDING,
  in_progress: AITaskStatus.PROCESSING,
  running: AITaskStatus.PROCESSING,
  completed: AITaskStatus.SUCCESS,
  failed: AITaskStatus.FAILED,
  canceled: AITaskStatus.CANCELED,
};

/**
 * HFSY video provider — async task pair:
 *   POST /v1/video/create      -> { id, status }
 *   GET  /v1/video/query/{id}  -> { data: { status, result_url, fail_reason } }
 */
export class HfsyProvider implements AIProvider {
  readonly name = 'hfsy';
  configs: HfsyConfigs;

  constructor(configs: HfsyConfigs) {
    this.configs = configs;
  }

  private get baseUrl(): string {
    return (this.configs.baseUrl || 'https://www.hfsyapi.cn').replace(/\/+$/, '');
  }

  private getUuid(): string {
    return (this.configs.uuid || defaultUuid)();
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.configs.apiKey}`,
    };
  }

  /**
   * Failures come back as either `{ error: { message } }` (gateway) or
   * `{ message, success: false }` (endpoint validation), not always with a
   * non-2xx status — so the body decides whether the call succeeded.
   */
  private async request(url: string, init: RequestInit): Promise<any> {
    const resp = await fetch(url, init);
    const text = await resp.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`hfsy: unexpected response (${resp.status})`);
    }

    const message = data?.error?.message ?? data?.message;
    if (!resp.ok || data?.success === false) {
      throw new Error(message || `hfsy request failed with status: ${resp.status}`);
    }

    return data;
  }

  /**
   * The platform requires every uploaded material to be @-referenced in the
   * prompt (`@image1`, `@video1`, `@audio1`); the Studio prompt carries no
   * tokens, so the missing ones are prepended here.
   */
  private bindReferences(body: Record<string, any>): string {
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';

    const tokens: string[] = [];
    const collect = (prefix: string, value: unknown) => {
      if (!Array.isArray(value)) return;
      value.forEach((_, index) => tokens.push(`@${prefix}${index + 1}`));
    };
    collect('image', body.images);
    collect('video', body.videos);
    collect('audio', body.audios);

    const missing = tokens.filter((token) => !prompt.includes(token));
    return missing.length ? `${missing.join(' ')} ${prompt}`.trim() : prompt;
  }

  async generate({
    params,
  }: {
    params: AIGenerateParams;
  }): Promise<AITaskResult> {
    const { model, prompt, options } = params;

    if (!model) {
      throw new Error('model is required');
    }

    const body: Record<string, any> = { model, prompt: prompt ?? '', ...options };
    body.prompt = this.bindReferences(body);

    const data = await this.request(`${this.baseUrl}/v1/video/create`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    const taskId = data?.id ?? data?.data?.id;
    if (!taskId) {
      throw new Error('generate failed: no task id');
    }

    return {
      taskStatus: AITaskStatus.PENDING,
      taskId,
      taskInfo: {},
      taskResult: data,
    };
  }

  async query({ taskId }: { taskId: string }): Promise<AITaskResult> {
    const data = await this.request(`${this.baseUrl}/v1/video/query/${taskId}`, {
      method: 'GET',
      headers: this.headers(),
    });

    const task = (data?.data ?? {}) as HfsyTask;
    const taskStatus = HFSY_STATUS[(task.status ?? '').toLowerCase()] ?? AITaskStatus.PROCESSING;

    if (taskStatus !== AITaskStatus.SUCCESS) {
      return {
        taskId,
        taskStatus,
        taskInfo: {
          status: task.status ?? '',
          errorCode: '',
          errorMessage: task.fail_reason ?? '',
        },
        taskResult: task,
      };
    }

    // The docs promise `result_url`; a completed task actually returns it as
    // `video_url` (mirrored in `detail.url`). Read all three.
    const url = task.result_url ?? task.video_url ?? task.detail?.url;
    let videos: AIVideo[] = url
      ? [{ id: '', createTime: new Date(), videoUrl: url }]
      : [];

    if (videos.length > 0 && this.configs.customStorage) {
      const files: AIFile[] = videos.map((video, index) => ({
        url: video.videoUrl as string,
        contentType: 'video/mp4',
        key: `hfsy/video/${this.getUuid()}.mp4`,
        index,
        type: 'video',
      }));

      try {
        const saved = await this.configs.saveFiles?.(files);
        saved?.forEach((file) => {
          if (file?.url && file.index !== undefined && videos[file.index]) {
            videos[file.index] = { ...videos[file.index], videoUrl: file.url };
          }
        });
      } catch (error) {
        console.error('save files failed:', error);
      }
    }

    return {
      taskId,
      taskStatus,
      taskInfo: {
        videos,
        status: task.status ?? '',
        errorCode: '',
        errorMessage: task.fail_reason ?? '',
        createTime: new Date(),
      },
      taskResult: task,
    };
  }
}
