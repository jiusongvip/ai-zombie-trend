'use client';

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import type { VideoModelsResponse } from '@/lib/video-types';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Model breadth as a single moving strip — one line, zero marketing. The full
 * lineup with prices lives in the Studio picker; this only whispers
 * "every frontier model, one account".
 */
export function Models() {
  const { data, isPending } = useQuery({
    queryKey: ['video-models'],
    queryFn: () => apiGet<VideoModelsResponse>('/api/video/models'),
    staleTime: 5 * 60_000,
  });

  const ticker = [
    ...new Set((data?.models ?? []).map((model) => `${model.label} · ${model.vendor}`)),
  ];

  return (
    <section className="border-border/60 border-y py-4">
      {isPending ? (
        <Skeleton className="mx-auto h-8 w-full max-w-3xl rounded-full" />
      ) : (
        <div className="marquee-track relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
          <div className="animate-marquee flex w-max gap-3">
            {[...ticker, ...ticker].map((entry, i) => (
              <span
                key={`${entry}-${i}`}
                className="border-border/70 bg-secondary/50 text-muted-foreground whitespace-nowrap rounded-full border px-4 py-1.5 text-sm"
              >
                {entry}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
