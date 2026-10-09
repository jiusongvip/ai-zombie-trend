import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { listVideoTasks } from '@/modules/video/service';
import { respErr, respPage } from '@/lib/resp';

/** Paginated generation history for the signed-in user. */
async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('pageSize') || '12'))
    );

    const { items, total } = await listVideoTasks({
      userId: session.user.id,
      page,
      pageSize,
      status: searchParams.get('status') || undefined,
      model: searchParams.get('model') || undefined,
      search: searchParams.get('search') || undefined,
    });

    return respPage(items, total);
  } catch (error: any) {
    return respErr(error?.message || 'Failed to load tasks');
  }
}

export const Route = createFileRoute('/api/video/tasks')({
  server: {
    handlers: { GET },
  },
});
