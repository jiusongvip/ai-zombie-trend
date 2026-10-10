import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm';

import { db } from '@/core/db';
import { R2Provider, StorageManager } from '@/core/storage';
import { uploadedFile, type UploadedFile } from '@/config/db/schema';
import { getUuid } from '@/lib/hash';
import { getAllConfigs, type ConfigMap } from '@/modules/config/service';

/**
 * Storage config is DB-driven (like auth/payment/email): values come from the
 * admin "Storage" settings, merged over env via getAllConfigs(). Keys mirror the
 * original ShipAny Two (`r2_*`).
 */
function isConfigured(configs: ConfigMap): boolean {
  return Boolean(
    configs.r2_access_key && configs.r2_secret_key && configs.r2_bucket_name
  );
}

function buildManager(configs: ConfigMap): StorageManager {
  const manager = new StorageManager();
  manager.addProvider(
    new R2Provider({
      accountId: configs.r2_account_id || '',
      accessKeyId: configs.r2_access_key as string,
      secretAccessKey: configs.r2_secret_key as string,
      bucket: configs.r2_bucket_name as string,
      uploadPath: configs.r2_upload_path,
      region: 'auto',
      endpoint: configs.r2_endpoint, // optional custom endpoint
      publicDomain: configs.r2_domain,
    }),
    true
  );
  return manager;
}

export async function isStorageConfigured(): Promise<boolean> {
  return isConfigured(await getAllConfigs());
}

/**
 * Returns a configured StorageManager, or null when storage is not configured
 * (caller should fall back to local/inline handling).
 */
export async function getStorage(): Promise<StorageManager | null> {
  const configs = await getAllConfigs();
  if (!isConfigured(configs)) return null;
  return buildManager(configs);
}

// ─── Upload retention ────────────────────────────────────────────────────────

/** Nothing a user uploaded is kept longer than this — rendered or not. */
export const UPLOAD_RETENTION_MS = 24 * 3600 * 1000;

/** Sweeping on every request would be waste; once per window per process. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweepAt = 0;

/**
 * Ledger row for a staged photo. Deletion is provable from these rows:
 * `purgedAt` is set only once the object is gone from storage.
 */
export async function recordUpload(params: { key: string; url: string }) {
  await db()
    .insert(uploadedFile)
    .values({ id: getUuid(), key: params.key, url: params.url });
}

async function removeObject(row: UploadedFile): Promise<boolean> {
  const name = row.key.split('/').pop();
  if (!name) return false;

  const storage = await getStorage();
  if (storage) return storage.deleteFile({ key: name });

  // No bucket configured — the upload route wrote to public/uploads.
  try {
    await unlink(path.join(process.cwd(), 'public', 'uploads', name));
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete staged photos past the retention window. Objects are content-hashed,
 * so a key re-uploaded inside its window is still referenced — it goes only
 * when its newest row expires. Returns how many objects were purged.
 */
export async function purgeExpiredUploads(limit = 200): Promise<number> {
  const cutoff = new Date(Date.now() - UPLOAD_RETENTION_MS);

  const stale: UploadedFile[] = await db()
    .select()
    .from(uploadedFile)
    .where(and(isNull(uploadedFile.purgedAt), lt(uploadedFile.createdAt, cutoff)))
    .limit(limit);
  if (stale.length === 0) return 0;

  const keys: string[] = [...new Set(stale.map((row) => row.key))];
  const stillReferenced = new Set<string>(
    (
      await db()
        .select({ key: uploadedFile.key })
        .from(uploadedFile)
        .where(
          and(
            isNull(uploadedFile.purgedAt),
            gte(uploadedFile.createdAt, cutoff),
            inArray(uploadedFile.key, keys)
          )
        )
    ).map((row: { key: string }) => row.key)
  );

  let purged = 0;
  for (const key of keys) {
    if (stillReferenced.has(key)) continue;
    const row = stale.find((item) => item.key === key);
    if (!row) continue;
    if (await removeObject(row)) {
      await db()
        .update(uploadedFile)
        .set({ purgedAt: new Date() })
        .where(and(eq(uploadedFile.key, key), isNull(uploadedFile.purgedAt)));
      purged += 1;
    }
  }
  return purged;
}

/**
 * Opportunistic sweep for request paths: never blocks the caller, never runs
 * more than once per window, and never fails the request it decorates.
 */
export function sweepExpiredUploadsSoon() {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  purgeExpiredUploads().catch((error: any) =>
    console.warn('[storage] upload sweep failed:', error?.message)
  );
}

/**
 * A long-lived server (node) also gets a real timer, so retention holds even
 * during a quiet spell with no uploads to piggyback on. The handle lives on
 * `globalThis` so module reloads cannot stack timers, and `unref` keeps it from
 * holding the process open. On a request-scoped runtime the timer simply never
 * fires, and the opportunistic sweep above is what runs.
 */
const SWEEP_TIMER_KEY = Symbol.for('shipany.uploadRetentionSweepTimer');
const globalRef = globalThis as Record<symbol, ReturnType<typeof setInterval> | undefined>;
if (!globalRef[SWEEP_TIMER_KEY]) {
  const timer = setInterval(
    () =>
      purgeExpiredUploads().catch((error: any) =>
        console.warn('[storage] upload sweep failed:', error?.message)
      ),
    SWEEP_INTERVAL_MS
  );
  timer.unref?.();
  globalRef[SWEEP_TIMER_KEY] = timer;
}

