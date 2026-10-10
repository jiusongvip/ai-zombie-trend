import { createFileRoute } from '@tanstack/react-router';

import { getCommunityClips } from '@/modules/video/service';
import { respData, respErr } from '@/lib/resp';

/**
 * Public community wall — recent successful generations from every user,
 * newest first. No auth: the landing page's explore feed reads this directly.
 * Backs the auto-show feature; disabled entirely when the admin flips the
 * `community_wall_enabled` switch off (returns an empty list).
 */
async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const raw = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 60) : 24;
    return respData({ items: await getCommunityClips(limit) });
  } catch (error: any) {
    return respErr(error?.message || 'Failed to load community clips');
  }
}

export const Route = createFileRoute('/api/video/community')({
  server: {
    handlers: { GET },
  },
});
