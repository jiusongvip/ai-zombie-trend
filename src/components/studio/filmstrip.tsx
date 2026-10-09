import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { VideoTaskView } from '@/lib/video-types';

/**
 * Recently rendered shots, as a horizontal strip under the stage.
 *
 * Deliberately a strip and not a grid: the Studio's job is the shot in front of
 * you, and a grid of four thumbnails competes with it. The strip keeps history
 * one gesture away without stealing the fold, and clicking a cell loads that
 * shot back into the stage — the same "open an old render and keep working"
 * loop Flow builds its whole library around.
 *
 * Props-only, no i18n reads; the caller owns the header and the status labels.
 */
export function Filmstrip({
  tasks,
  activeId,
  onSelect,
  statusLabel,
  className,
}: {
  tasks: VideoTaskView[];
  activeId?: string | null;
  onSelect: (taskId: string) => void;
  /** Resolves a task status to a localized label. */
  statusLabel: (status: string) => string;
  className?: string;
}) {
  if (tasks.length === 0) return null;

  return (
    <div
      className={cn('-mx-1 flex gap-2 overflow-x-auto px-1 pb-1', className)}
    >
      {tasks.map((task) => {
        const video = task.videos?.[0];
        const active = task.id === activeId;
        return (
          <button
            key={task.id}
            type="button"
            onClick={() => onSelect(task.id)}
            className={cn(
              'group w-36 shrink-0 overflow-hidden rounded-xl border text-left transition-colors',
              active
                ? 'border-primary/60'
                : 'border-border hover:border-primary/40'
            )}
          >
            <div className="bg-muted relative aspect-video w-full">
              {video?.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : video?.videoUrl ? (
                <video
                  src={video.videoUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="size-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex size-full items-center justify-center px-2 text-center text-[10px]">
                  {statusLabel(task.status)}
                </div>
              )}

              {task.polling && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Loader2 className="size-4 animate-spin text-white" />
                </div>
              )}
              {active && (
                <div className="bg-primary absolute top-0 left-0 h-full w-0.5" />
              )}
            </div>
            <div className="space-y-0.5 p-2">
              <p className="text-[11px] leading-snug">
                {new Date(task.createdAt).toLocaleDateString()}
              </p>
              <p className="text-muted-foreground truncate text-[10px]">
                {task.modelLabel}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
