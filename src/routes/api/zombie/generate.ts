import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { envConfigs } from '@/config';
import { getZombieStyle } from '@/config/zombie-styles';
import { getBalance } from '@/modules/credits/service';
import { getVideoModel } from '@/config/video-models';
import {
  CONSENT_POLICY_VERSION,
  generateVideo,
  toTaskView,
} from '@/modules/video/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

/**
 * Locally-stored source images (`/uploads/<file>` from the no-storage
 * fallback) are only meaningful to us — the provider must fetch them, so
 * relative paths are promoted to absolute using the app URL.
 */
function absolutizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  return `${envConfigs.app_url.replace(/\/$/, '')}${url}`;
}

/**
 * The homepage's one-button render: two uploaded photos + a style id in, a
 * generation task out. Prompt, model, duration and resolution all come from
 * the server-side style catalog — the client never sees or sends any of them.
 */
async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 3000,
    keyPrefix: 'zombie-generate',
  });
  if (limited) return limited;

  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const body = await request.json().catch(() => ({}));
    const style = getZombieStyle(body.style);
    if (!style) return respErr('Unknown style');

    const imageUrl =
      typeof body.imageUrl === 'string' && body.imageUrl.trim()
        ? absolutizeUrl(body.imageUrl.trim())
        : '';
    const lastFrameUrl =
      typeof body.lastFrameUrl === 'string' && body.lastFrameUrl.trim()
        ? absolutizeUrl(body.lastFrameUrl.trim())
        : '';

    if (!imageUrl || !lastFrameUrl) {
      return respErr('Both photos are required');
    }
    if (
      !/^https?:\/\//i.test(imageUrl) ||
      !/^https?:\/\//i.test(lastFrameUrl)
    ) {
      return respErr('Photos must be reachable http(s) URLs');
    }

    // The uploader must declare they may use both likeness(es) before a
    // face-driven render is accepted. generateVideo re-checks this invariant.
    if (body.consent !== true) {
      return respErr(
        'You must confirm you may use the uploaded photos before generating'
      );
    }

    const model = getVideoModel(style.modelId);
    if (!model) return respErr('Model unavailable');

    // Whitelisted against the model's own list — anything else falls back to
    // the first entry (9:16) rather than reaching the provider verbatim.
    const aspectRatio = model.aspectRatios.includes(body.aspectRatio)
      ? (body.aspectRatio as string)
      : model.aspectRatios[0];

    const balance = await getBalance(session.user.id);
    if (balance < model.creditCost) {
      return respErr(
        `Insufficient credits — this film costs ${model.creditCost} credits and your balance is ${balance}`
      );
    }

    const task = await generateVideo({
      userId: session.user.id,
      modelId: style.modelId,
      prompt: style.prompt,
      duration: style.duration,
      resolution: style.resolution,
      aspectRatio,
      imageUrl,
      lastFrameUrl,
      consent: CONSENT_POLICY_VERSION,
      shareToWall: body.shareToWall === true,
    });

    return respData({ task: toTaskView(task) });
  } catch (error: any) {
    return respErr(error?.message || 'Failed to start generation');
  }
}

export const Route = createFileRoute('/api/zombie/generate')({
  server: {
    handlers: { POST },
  },
});
