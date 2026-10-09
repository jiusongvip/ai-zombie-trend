import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { envConfigs } from '@/config';
import { getVideoModel } from '@/config/video-models';
import { getBalance } from '@/modules/credits/service';
import { generateVideo, toTaskView } from '@/modules/video/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

const MAX_PROMPT_LENGTH = 2000;

/**
 * A locally-stored source image (`/uploads/<file>` from the no-storage
 * fallback) is only meaningful to us — the provider needs to fetch it, so
 * promote relative paths to absolute using the app URL.
 */
function absolutizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  return `${envConfigs.app_url.replace(/\/$/, '')}${url}`;
}

async function POST({ request }: { request: Request }) {
  // Video generation is expensive upstream — throttle per client.
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 3000,
    keyPrefix: 'video-generate',
  });
  if (limited) return limited;

  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const body = await request.json().catch(() => ({}));
    const modelId = typeof body.model === 'string' ? body.model : '';
    const model = getVideoModel(modelId);
    if (!model) return respErr('Unknown model');

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return respErr(`Prompt must be under ${MAX_PROMPT_LENGTH} characters`);
    }

    const rawImageUrl =
      typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const imageUrl = rawImageUrl ? absolutizeUrl(rawImageUrl) : undefined;

    const rawLastFrameUrl =
      typeof body.lastFrameUrl === 'string' ? body.lastFrameUrl.trim() : '';
    const lastFrameUrl = rawLastFrameUrl
      ? absolutizeUrl(rawLastFrameUrl)
      : undefined;

    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      return respErr('Source image must be a reachable http(s) URL');
    }
    if (lastFrameUrl && !/^https?:\/\//i.test(lastFrameUrl)) {
      return respErr('End frame must be a reachable http(s) URL');
    }

    // Fail fast with a clear message instead of letting the transaction throw.
    const balance = await getBalance(session.user.id);
    if (balance < model.creditCost) {
      return respErr(
        `Insufficient credits — this model costs ${model.creditCost} credits and your balance is ${balance}`
      );
    }

    const task = await generateVideo({
      userId: session.user.id,
      modelId,
      prompt,
      duration: Number(body.duration) || undefined,
      aspectRatio:
        typeof body.aspectRatio === 'string' ? body.aspectRatio : undefined,
      resolution:
        typeof body.resolution === 'string' ? body.resolution : undefined,
      generateAudio:
        typeof body.generateAudio === 'boolean'
          ? body.generateAudio
          : undefined,
      imageUrl,
      lastFrameUrl,
      style: typeof body.style === 'string' ? body.style : undefined,
      cameraMovement:
        typeof body.cameraMovement === 'string'
          ? body.cameraMovement
          : undefined,
      shotSize: typeof body.shotSize === 'string' ? body.shotSize : undefined,
    });

    return respData({ task: toTaskView(task) });
  } catch (error: any) {
    return respErr(error?.message || 'Failed to start generation');
  }
}

export const Route = createFileRoute('/api/video/generate')({
  server: {
    handlers: { POST },
  },
});
