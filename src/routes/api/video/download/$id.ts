import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { getVideoTask } from '@/modules/video/service';
import { respErr } from '@/lib/resp';

/**
 * Streams a finished clip back as an attachment.
 *
 * `download` on an anchor is ignored cross-origin, and every result URL comes
 * from a provider CDN or the R2 bucket — so linking straight to the file opened
 * a new tab instead of saving it. Serving it from our own origin with
 * `Content-Disposition: attachment` is what makes the button a real download.
 */
async function GET({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const task = await getVideoTask({
      taskId: params.id,
      userId: session.user.id,
    });
    const url = task.videos?.[0]?.videoUrl;
    if (!url) return respErr('No video available');

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) return respErr('Video unavailable');

    const headers = new Headers({
      'Content-Disposition': `attachment; filename="ai-zombie-${task.id}.mp4"`,
      'Content-Type':
        upstream.headers.get('Content-Type')?.startsWith('video/') === true
          ? upstream.headers.get('Content-Type')!
          : 'video/mp4',
      'Cache-Control': 'private, max-age=3600',
    });
    const length = upstream.headers.get('Content-Length');
    // Only safe to forward when the body passes through byte-for-byte —
    // a mismatched Content-Length truncates or hangs the download.
    if (length && !upstream.headers.get('Content-Encoding')) {
      headers.set('Content-Length', length);
    }

    return new Response(upstream.body, { headers });
  } catch (error: any) {
    return respErr(error?.message || 'Failed to download');
  }
}

export const Route = createFileRoute('/api/video/download/$id')({
  server: {
    handlers: { GET },
  },
});
