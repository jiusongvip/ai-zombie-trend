import { and, count, desc, eq, inArray, isNull, like, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { aiTask } from '@/config/db/schema';
import { consume, revoke } from '@/modules/credits/service';
import { getUuid } from '@/lib/hash';

export enum AITaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

/**
 * Shared WHERE clause for task listing/counting so `getTasks` and `countTasks`
 * can never drift apart. Always excludes soft-deleted rows.
 *
 * `status` accepts a comma-separated list so a UI tab can group several states
 * (e.g. `pending,processing` for "running").
 */
function taskConditions(params: {
  userId?: string;
  mediaType?: string;
  status?: string;
  model?: string;
  search?: string;
}) {
  const { userId, mediaType, status, model, search } = params;
  const statuses = status
    ? status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return and(
    userId ? eq(aiTask.userId, userId) : undefined,
    mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
    statuses.length === 1
      ? eq(aiTask.status, statuses[0])
      : statuses.length > 1
        ? inArray(aiTask.status, statuses)
        : undefined,
    model ? eq(aiTask.model, model) : undefined,
    search
      ? or(
          like(aiTask.prompt, `%${search}%`),
          like(aiTask.model, `%${search}%`)
        )
      : undefined,
    isNull(aiTask.deletedAt)
  );
}

/**
 * Create an AI task with optional credit consumption.
 *
 * Credits are reserved here, BEFORE the provider is called — so a request that
 * is rejected for insufficient balance never reaches a paid upstream API.
 * The provider's own task id is attached afterwards via `updateTask`.
 */
export async function createTask(params: {
  userId: string;
  mediaType: string;
  provider: string;
  model: string;
  prompt: string;
  costCredits?: number;
  options?: any;
  scene?: string;
  consent?: string;
  shareToWall?: boolean;
}): Promise<any> {
  const {
    userId,
    mediaType,
    provider,
    model,
    prompt,
    costCredits,
    options,
    scene,
    consent,
    shareToWall,
  } = params;

  return db().transaction(async (tx: any) => {
    // 1. Insert task
    const taskData: any = {
      id: getUuid(),
      userId,
      mediaType,
      provider,
      model,
      prompt,
      status: AITaskStatus.PENDING,
      costCredits: costCredits || 0,
      options: options ? JSON.stringify(options) : null,
      scene: scene || '',
      consent: consent ?? null,
      // Always written: a deployed database may still carry `featured DEFAULT
      // true` from before the wall became opt-in, and an omitted column would
      // let that default publish a stranger's likeness on its own.
      featured: shareToWall === true,
    };

    const [task] = await tx.insert(aiTask).values(taskData).returning();

    // 2. Consume credits if cost > 0
    if (costCredits && costCredits > 0) {
      const result = await consume({
        userId,
        credits: costCredits,
        scene: scene || 'ai_task',
        description: `AI ${mediaType} generation`,
        metadata: JSON.stringify({ taskId: task.id }),
        tx,
      });

      if (!result.success) {
        throw new Error('Insufficient credits');
      }

      // Store consumed credit ID for potential revocation
      if (result.consumedCredit) {
        await tx
          .update(aiTask)
          .set({
            taskInfo: JSON.stringify({ creditId: result.consumedCredit.id }),
            creditId: result.consumedCredit.id,
          })
          .where(eq(aiTask.id, task.id));
      }
    }

    return task;
  });
}

/**
 * Update task status. Revokes credits on failure.
 *
 * `providerTaskId` is the upstream task id (fal request_id / Replicate
 * prediction id) — required later to poll or to match a webhook back to this
 * row. `taskInfo` is never written here: it holds the creditId used for
 * revocation, and overwriting it would silently break refunds.
 */
export async function updateTask(params: {
  taskId: string;
  status: AITaskStatus;
  taskResult?: any;
  providerTaskId?: string;
}) {
  const { taskId, status, taskResult, providerTaskId } = params;

  const [task] = await db()
    .select()
    .from(aiTask)
    .where(eq(aiTask.id, taskId))
    .limit(1);

  if (!task) throw new Error('Task not found');

  // Update task
  const updateData: any = { status };
  if (taskResult !== undefined) {
    updateData.taskResult = JSON.stringify(taskResult);
  }
  if (providerTaskId) {
    updateData.taskId = providerTaskId;
  }

  await db().update(aiTask).set(updateData).where(eq(aiTask.id, taskId));

  // Revoke credits on failure
  if (status === AITaskStatus.FAILED && task.taskInfo) {
    try {
      const info = JSON.parse(task.taskInfo as string);
      if (info.creditId) {
        await revoke(info.creditId);
      }
    } catch {
      // Ignore parse errors
    }
  }
}

/**
 * Get tasks for a user.
 */
export async function getTasks(params: {
  userId: string;
  mediaType?: string;
  status?: string;
  model?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const {
    userId,
    mediaType,
    status,
    model,
    search,
    page = 1,
    limit = 20,
  } = params;

  return db()
    .select()
    .from(aiTask)
    .where(taskConditions({ userId, mediaType, status, model, search }))
    .orderBy(desc(aiTask.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
}

/**
 * Clips for the public community wall: successful, not soft-deleted, and
 * featured. `featured` defaults false, so this is the opt-in set only —
 * uploads that declared wall sharing at submit time, plus admin curations.
 * Newest first.
 */
export async function listFeaturedTasks(params: {
  mediaType: string;
  limit?: number;
}) {
  const { mediaType, limit = 24 } = params;
  return db()
    .select()
    .from(aiTask)
    .where(
      and(
        eq(aiTask.mediaType, mediaType),
        eq(aiTask.status, AITaskStatus.SUCCESS),
        eq(aiTask.featured, true),
        isNull(aiTask.deletedAt)
      )
    )
    .orderBy(desc(aiTask.createdAt))
    .limit(limit);
}

/**
 * Recent successful tasks across all users for the admin curation screen —
 * featured or not — newest first, with a total for pagination.
 */
export async function listSuccessfulTasks(params: {
  mediaType: string;
  page?: number;
  limit?: number;
}) {
  const { mediaType, page = 1, limit = 24 } = params;
  const where = and(
    eq(aiTask.mediaType, mediaType),
    eq(aiTask.status, AITaskStatus.SUCCESS),
    isNull(aiTask.deletedAt)
  );
  const [items, [{ total }]] = await Promise.all([
    db()
      .select()
      .from(aiTask)
      .where(where)
      .orderBy(desc(aiTask.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db().select({ total: count() }).from(aiTask).where(where),
  ]);
  return { items, total };
}

/** Feature or un-feature a task for the community wall. */
export async function setTaskFeatured(taskId: string, featured: boolean) {
  return db()
    .update(aiTask)
    .set({ featured })
    .where(eq(aiTask.id, taskId));
}

/**
 * Count tasks matching the same filters as `getTasks` — for pagination totals.
 */
export async function countTasks(params: {
  userId?: string;
  mediaType?: string;
  status?: string;
  model?: string;
  search?: string;
}): Promise<number> {
  const [row] = await db()
    .select({ value: count() })
    .from(aiTask)
    .where(taskConditions(params));
  return row?.value ?? 0;
}

/**
 * Soft-delete a task. Pass `userId` to scope the delete to its owner (the
 * caller-facing path); omit it for admin operations.
 */
export async function softDeleteTask(params: {
  taskId: string;
  userId?: string;
}) {
  const { taskId, userId } = params;

  const [task] = await db()
    .select()
    .from(aiTask)
    .where(eq(aiTask.id, taskId))
    .limit(1);

  if (!task) throw new Error('Task not found');
  if (userId && task.userId !== userId) throw new Error('Task not found');

  await db()
    .update(aiTask)
    .set({ deletedAt: new Date() })
    .where(eq(aiTask.id, taskId));

  return task;
}

/**
 * Find task by ID.
 */
export async function findTask(taskId: string) {
  const [result] = await db()
    .select()
    .from(aiTask)
    .where(eq(aiTask.id, taskId))
    .limit(1);
  return result;
}

/**
 * Find a task by the upstream provider's task id — used by provider webhooks,
 * which know the fal `request_id` / Replicate prediction id but not our row id.
 */
export async function findTaskByProviderTaskId(providerTaskId: string) {
  const [result] = await db()
    .select()
    .from(aiTask)
    .where(eq(aiTask.taskId, providerTaskId))
    .limit(1);
  return result;
}
