import { createFileRoute } from '@tanstack/react-router';

import { handleProviderWebhook } from '@/modules/video/service';

/**
 * Provider webhook sink for AI generations.
 *
 * Polling from the browser is the primary path (it works on localhost, where
 * fal and Replicate refuse to deliver webhooks). This endpoint is the
 * production-grade fallback: it lets a generation finish and be persisted even
 * if the user closes the tab. Point fal's `fal_webhook` / Replicate's `webhook`
 * at `<app_url>/api/video/notify/<provider>` — the provider layer already
 * attaches the callback when a public URL is configured.
 *
 * Always answers 200: a non-2xx makes the provider retry, and a task we can't
 * match will never become matchable on a retry.
 */
async function POST({
  request,
  params,
}: {
  request: Request;
  params: { provider: string };
}) {
  const provider = params.provider;

  try {
    const payload = await request.json().catch(() => null);
    if (!payload) {
      console.warn(`[video] empty ${provider} webhook payload`);
      return new Response('ok');
    }

    const { matched } = await handleProviderWebhook(provider, payload);
    if (!matched) {
      console.warn(`[video] unmatched ${provider} webhook`);
    }

    return new Response('ok');
  } catch (error: any) {
    console.error(`[video] ${provider} webhook failed:`, error?.message);
    return new Response('ok');
  }
}

export const Route = createFileRoute('/api/video/notify/$provider')({
  server: {
    handlers: { POST },
  },
});
