import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { getAdminClips, setClipFeatured } from '@/modules/video/service';
import { hasPermission } from '@/modules/rbac/service';
import { respData, respErr } from '@/lib/resp';

const noStore = {
  headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
};

async function session(request: Request, perm: string) {
  const auth = getAuth();
  const s = await auth.api.getSession({ headers: request.headers });
  if (!s?.user) return { err: respErr('Unauthorized') } as const;
  if (!(await hasPermission(s.user.id, perm)))
    return { err: respErr('Forbidden') } as const;
  return { userId: s.user.id } as const;
}

/** Admin curation list — recent successful generations, featured flag included. */
async function GET({ request }: { request: Request }) {
  try {
    const r = await session(request, 'admin.settings.read');
    if ('err' in r) return r.err;
    const url = new URL(request.url);
    const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize')) || 24, 1), 60);
    return respData(await getAdminClips({ page, limit: pageSize }), noStore);
  } catch (error: any) {
    return respErr(error?.message || 'Failed to load clips');
  }
}

/** Feature or un-feature a clip for the public community wall. */
async function POST({ request }: { request: Request }) {
  try {
    const r = await session(request, 'admin.settings.write');
    if ('err' in r) return r.err;
    const body = await request.json().catch(() => ({}));
    const { taskId, featured } = body as { taskId?: string; featured?: boolean };
    if (!taskId || typeof featured !== 'boolean')
      return respErr('taskId and boolean featured are required');
    await setClipFeatured(taskId, featured);
    return respData({ ok: true }, noStore);
  } catch (error: any) {
    return respErr(error?.message || 'Failed to update clip');
  }
}

export const Route = createFileRoute('/api/admin/videos')({
  server: {
    handlers: { GET, POST },
  },
});
