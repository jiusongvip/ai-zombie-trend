'use client';

import { cn } from '@/lib/utils';

/**
 * Bare video player. Props-only by design (no i18n reads) — the calling page
 * owns the surrounding chrome, download button, and labels.
 *
 * `aspectRatio` is a CSS value like `'16 / 9'` so the frame doesn't reflow when
 * the video metadata loads.
 */
export function VideoPlayer({
  src,
  poster,
  aspectRatio = '16 / 9',
  className,
}: {
  src: string;
  poster?: string;
  aspectRatio?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-muted relative w-full overflow-hidden rounded-xl',
        className
      )}
      style={{ aspectRatio }}
    >
      <video
        key={src}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className="size-full object-contain"
      />
    </div>
  );
}
