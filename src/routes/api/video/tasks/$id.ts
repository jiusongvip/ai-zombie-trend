import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { deleteVideoTask, getVideoTask } from '@/modules/video/service';
import { respData, respErr, respOk } from '@/lib/resp';

/**
 * Poll one generation. Returns the normalized task view, syncing from the
 * provider first when the task is still running — so the client can just poll
 * this endpoint until `polling` goes false.
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

    return respData({ task });
  } catch (error: any) {
    return respErr(error?.message || 'Failed to load task');
  }
}

/** Soft-delete — hides the row from the library, keeps it for accounting. */
async function DELETE({
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

    await deleteVideoTask({ taskId: params.id, userId: session.user.id });
    return respOk();
  } catch (error: any) {
    return respErr(error?.message || 'Failed to delete task');
  }
}

export const Route = createFileRoute('/api/video/tasks/$id')({
  server: {
    handlers: { GET, DELETE },
  },
});
