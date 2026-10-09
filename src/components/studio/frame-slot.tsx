import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

export type FrameSlotStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

export interface FrameSlotValue {
  url?: string;
  status: FrameSlotStatus;
}

export interface FrameSlotLabels {
  upload: string;
  uploading: string;
  failed: string;
  replace: string;
  remove: string;
  maxSize: string;
  imageOnly: string;
}

/**
 * Uploads one image to the app's own storage endpoint.
 *
 * `@/lib/api-client` cannot carry a multipart body — `request()` forces a JSON
 * content type whenever a body is present — so binary uploads go through a raw
 * `fetch`. This mirrors `ImageUploader`'s uploader exactly; only the chrome
 * around it is different.
 */
async function uploadFrame(file: File): Promise<string> {
  const body = new FormData();
  body.append('files', file);

  const response = await fetch('/api/storage/upload-image', {
    method: 'POST',
    body,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const result = await response.json().catch(() => null);
  const url = result?.data?.urls?.[0];
  if (result?.code !== 0 || !url) {
    throw new Error(result?.message || 'Upload failed');
  }
  return url as string;
}

/**
 * A single source frame, drawn as a film cell at the clip's own aspect ratio.
 *
 * The generic `ImageUploader` renders a square tile with its own chrome. A
 * source frame is the first thing the model actually sees, so it gets a slot
 * shaped like the output: the empty state reads as "this is where the frame
 * goes" instead of "upload a file", and you can tell 9:16 from 16:9 before you
 * spend credits. That is also how every serious tool frames it — Flow calls
 * them frames and ingredients, Pika calls the pair Pikaframes.
 *
 * Props-only, no i18n reads.
 */
export function FrameSlot({
  label,
  hint,
  value,
  onChange,
  aspectRatio = '16 / 9',
  maxHeight,
  maxSizeMB = 10,
  disabled = false,
  labels,
  className,
}: {
  /** Header row above the drop zone. Omit to render the slot chrome-less. */
  label?: string;
  /** Right-aligned micro-copy in the header row. */
  hint?: string;
  value: FrameSlotValue;
  onChange: (value: FrameSlotValue) => void;
  /** CSS aspect value, e.g. `'9 / 16'`. */
  aspectRatio?: string;
  /**
   * Optional viewport-derived cap, e.g. `'min(38vh, 22rem)'`. On short
   * screens the honest aspect ratio alone can push the submit button below
   * the fold; the cap trades a little shape honesty for a first-screen flow.
   */
  maxHeight?: string;
  maxSizeMB?: number;
  disabled?: boolean;
  labels: FrameSlotLabels;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [state, setState] = useState<{
    url?: string;
    preview?: string;
    status: FrameSlotStatus;
  }>(() =>
    value.url
      ? { url: value.url, preview: value.url, status: 'uploaded' }
      : { status: 'idle' }
  );

  // Follow parent-driven changes — a preset frame, or "load settings" from a
  // previous generation. Returning `prev` untouched when the url already
  // matches keeps this from fighting the local upload state.
  useEffect(() => {
    setState((prev) => {
      if (value.url === prev.url) return prev;
      return value.url
        ? { url: value.url, preview: value.url, status: 'uploaded' }
        : { status: 'idle' };
    });
  }, [value.url]);

  const accept = async (file: File) => {
    if (!file.type?.startsWith('image/')) {
      toast.error(labels.imageOnly);
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(labels.maxSize.replace('{size}', String(maxSizeMB)));
      return;
    }

    const blob = URL.createObjectURL(file);
    setState({ status: 'uploading', preview: blob });
    onChange({ status: 'uploading' });

    try {
      const url = await uploadFrame(file);
      URL.revokeObjectURL(blob);
      setState({ url, preview: url, status: 'uploaded' });
      onChange({ url, status: 'uploaded' });
    } catch (error: any) {
      setState({ status: 'error', preview: blob });
      onChange({ status: 'error' });
      toast.error(
        error?.message ? `${labels.failed}: ${error.message}` : labels.failed
      );
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = () => {
    setState({ status: 'idle' });
    onChange({ status: 'idle' });
  };

  const openPicker = () => {
    if (disabled || state.status === 'uploading') return;
    inputRef.current?.click();
  };

  const filled = state.status === 'uploaded' && !!state.preview;

  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || hint) && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium">{label}</span>
          {hint && (
            <span className="text-muted-foreground truncate text-[11px]">
              {hint}
            </span>
          )}
        </div>
      )}

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={filled ? labels.replace : labels.upload}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !disabled) void accept(file);
        }}
        style={{ aspectRatio, maxHeight }}
        className={cn(
          'group relative w-full overflow-hidden rounded-xl border transition-colors outline-none',
          'focus-visible:ring-primary/40 focus-visible:ring-2',
          filled
            ? 'border-border/70'
            : 'border-border bg-muted/40 hover:border-primary/40 hover:bg-muted/60 border-dashed',
          dragActive && 'border-primary bg-primary/5 border-solid',
          disabled && 'pointer-events-none opacity-50',
          !disabled && 'cursor-pointer'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void accept(file);
          }}
        />

        {filled ? (
          <>
            <img
              src={state.preview}
              alt=""
              className="size-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openPicker();
                }}
                className="bg-background/90 text-foreground hover:bg-background inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
              >
                <RefreshCw className="size-3" />
                {labels.replace}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  clear();
                }}
                className="bg-background/90 text-destructive hover:bg-background inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
              >
                <X className="size-3" />
                {labels.remove}
              </button>
            </div>
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center">
            {state.status === 'error' ? (
              <>
                <TriangleAlert className="text-destructive size-5" />
                <span className="text-destructive text-[11px] font-medium">
                  {labels.failed}
                </span>
              </>
            ) : (
              <>
                <ImagePlus
                  className="text-muted-foreground/70 size-5"
                  strokeWidth={1.75}
                />
                <span className="text-xs font-medium">{labels.upload}</span>
                <span className="text-muted-foreground text-[11px]">
                  {labels.maxSize.replace('{size}', String(maxSizeMB))}
                </span>
              </>
            )}
          </div>
        )}

        {state.status === 'uploading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 text-[11px] font-medium text-white">
            <Loader2 className="size-3.5 animate-spin" />
            {labels.uploading}
          </div>
        )}
      </div>
    </div>
  );
}
