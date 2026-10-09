import {
  Clapperboard,
  Download,
  Film,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { VideoTaskView } from '@/lib/video-types';
import { Button, buttonVariants } from '@/components/ui/button';
import { VideoPlayer } from '@/components/video-player';

export interface StageLabels {
  emptyTitle: string;
  emptyBody: string;
  queuedTitle: string;
  processingTitle: string;
  renderingBody: string;
  /** Contains `{seconds}`. */
  elapsedTemplate: string;
  failedTitle: string;
  failedFallback: string;
  /** Contains `{credits}`. */
  refundedTemplate: string;
  /**
   * Shown when the request itself failed, so no task exists to read a cost
   * from. True in both cases: either nothing was reserved, or the reservation
   * was refunded server-side.
   */
  noCharge: string;
  /** Terminal state that is neither a clip nor a provider error. */
  stoppedBody: string;
  download: string;
  regenerate: string;
  loadSettings: string;
  /** Micro-label above the shot's own settings. */
  shotSettings: string;
  costTemplate: string;
}

/**
 * Caps the frame's width so its height can never exceed `vhBudget`.
 *
 * Without this, a 16:9 stage on a 1920px screen is ~845px tall and pushes the
 * cost block and the Generate button below the fold — you would have to scroll
 * to spend credits. Deriving the cap from the ratio keeps the frame honest at
 * every shape (9:16 ends up a tall narrow cell, 21:9 a wide short one) instead
 * of letterboxing it.
 */
function maxWidthForAspect(
  aspect: string,
  vhBudget: number
): string | undefined {
  const [w, h] = aspect.split('/').map((part) => Number(part.trim()));
  if (!w || !h) return undefined;
  return `calc(${vhBudget}vh * ${w} / ${h})`;
}

/**
 * The result stage — the reason the page exists, so it gets the room.
 *
 * Research note — the two failure modes of every competitor's canvas are the
 * same: a mostly-empty box that tells you nothing while you wait, and a result
 * with no obvious next move. So:
 *
 * - The empty frame is drawn at the *selected* aspect ratio, which turns dead
 *   space into a preview of the shape you are about to buy.
 * - Waiting states carry the real status, the elapsed clock and an explicit
 *   "you can leave" promise, because a 40-credit render that looks stalled gets
 *   abandoned and re-run.
 * - A finished shot always offers the three moves people actually want:
 *   take the file, render the same settings again, or pull the settings back
 *   into the form.
 *
 * Props-only, no i18n reads.
 */
export function Stage({
  task,
  elapsedSeconds,
  frameAspect,
  labels,
  statusLabel,
  error,
  onRegenerate,
  onLoadSettings,
  busy = false,
  vhBudget = 58,
}: {
  task: VideoTaskView | null;
  elapsedSeconds: number;
  /** CSS aspect value for the frame, e.g. `'9 / 16'`. */
  frameAspect: string;
  labels: StageLabels;
  /** Resolves a raw task status to a localized label. */
  statusLabel: (status: string) => string;
  /**
   * Submission failure. A provider that rejects the request outright never
   * yields a task, so without this the stage would sit blank and the only
   * feedback would be a toast that scrolls away.
   */
  error?: string | null;
  onRegenerate?: () => void;
  onLoadSettings?: () => void;
  /** A new generation is being submitted right now. */
  busy?: boolean;
  /**
   * Share of the viewport height (in vh) the frame may occupy. Landing pages
   * that must keep the submit button above the fold pass a smaller budget
   * than the studio default.
   */
  vhBudget?: number;
}) {
  const video = task?.videos?.[0];
  const failure =
    task?.status === 'failed'
      ? task.errorMessage || labels.failedFallback
      : !task && error
        ? error
        : null;

  return (
    <div
      className="mx-auto w-full space-y-3"
      style={{ maxWidth: maxWidthForAspect(frameAspect, vhBudget) }}
    >
      <div
        style={{ aspectRatio: frameAspect }}
        className="border-border/70 bg-black/40 relative w-full overflow-hidden rounded-2xl border"
      >
        {failure ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
            <TriangleAlert className="text-destructive size-5" />
            <p className="text-sm font-medium">{labels.failedTitle}</p>
            <p className="text-muted-foreground max-w-md text-[11px] leading-relaxed break-words">
              {failure}
            </p>
            {task ? (
              task.costCredits > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {labels.refundedTemplate.replace(
                    '{credits}',
                    String(task.costCredits)
                  )}
                </p>
              )
            ) : (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {labels.noCharge}
              </p>
            )}
          </div>
        ) : !task ? (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Film className="text-primary/50 size-6" strokeWidth={1.5} />
            <p className="text-foreground/70 text-sm font-medium">
              {labels.emptyTitle}
            </p>
            <p className="max-w-xs text-[11px] leading-relaxed">
              {labels.emptyBody}
            </p>
          </div>
        ) : task.status === 'success' && video?.videoUrl ? (
          <VideoPlayer
            src={video.videoUrl}
            poster={video.thumbnailUrl}
            aspectRatio={frameAspect}
            className="size-full rounded-none"
          />
        ) : task.polling ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
            <Loader2 className="size-5 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {task.status === 'pending'
                  ? labels.queuedTitle
                  : labels.processingTitle}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {labels.elapsedTemplate.replace(
                  '{seconds}',
                  String(elapsedSeconds)
                )}
              </p>
              <p className="text-muted-foreground max-w-xs text-[11px] leading-relaxed">
                {labels.renderingBody}
              </p>
            </div>
            <div className="bg-white/10 h-1 w-40 overflow-hidden rounded-full">
              <div className="bg-primary h-full w-1/3 animate-pulse rounded-full" />
            </div>
          </div>
        ) : (
          /* Terminal, but neither a finished clip nor a provider error —
             e.g. a run that was stopped. Never leave the user on a spinner. */
          <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium">{statusLabel(task.status)}</p>
            <p className="text-muted-foreground max-w-sm text-[11px] leading-relaxed">
              {labels.stoppedBody}
            </p>
          </div>
        )}
      </div>

      {task && (
        <div className="flex flex-wrap items-center gap-2">
          {task.status === 'success' && video?.videoUrl && (
            <a
              href={video.videoUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
            >
              <Download className="size-3.5" />
              {labels.download}
            </a>
          )}

          {task.status !== 'pending' && task.status !== 'processing' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onRegenerate}
              disabled={busy}
            >
              <RotateCcw className="size-3.5" />
              {labels.regenerate}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={onLoadSettings}
            disabled={busy}
          >
            <SlidersHorizontal className="size-3.5" />
            {labels.loadSettings}
          </Button>

          <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-[11px]">
            <Clapperboard className="size-3" />
            {task.modelLabel}
          </span>
        </div>
      )}

      {task && (
        <div className="text-muted-foreground space-y-1.5 border-t pt-3 text-[11px]">
          <p className="text-muted-foreground/80">{labels.shotSettings}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {task.duration && (
              <span className="tabular-nums">{task.duration}s</span>
            )}
            {task.aspectRatio && <span>{task.aspectRatio}</span>}
            {task.resolution && <span>{task.resolution}</span>}
            {task.generateAudio && <span>audio</span>}
            <span className="tabular-nums">
              {labels.costTemplate.replace(
                '{credits}',
                String(task.costCredits)
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
