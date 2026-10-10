'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, WandSparkles } from 'lucide-react';

import { tDynamic } from '@/core/i18n/dynamic';
import { useRouter } from '@/core/i18n/navigation';
import { showcaseItems, type ShowcaseItem, type ShowcaseTag } from '@/config/showcase';
import { envConfigs } from '@/config';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

const TAGS: ShowcaseTag[] = ['couple', 'pet', 'friend', 'halloween'];

/** Shape of one item from `GET /api/video/community`. */
interface CommunityClipDto {
  id: string;
  video: string;
  poster?: string;
  aspect: '16:9' | '9:16';
  model: string;
  createdAt: string;
}

/** Adapt a community clip to the card's `ShowcaseItem` shape. */
function toCommunityItem(c: CommunityClipDto): ShowcaseItem {
  return {
    id: `community-${c.id}`,
    modelId: 'community',
    model: c.model,
    aspect: c.aspect,
    // Community clips carry no curated story tag; surfaced only on "all".
    tag: 'couple',
    cover: c.poster ?? '',
    video: c.video,
    prompt: {
      en: 'A community creation, generated straight from two photos with AI Zombie Video',
      zh: '社区作品：用两张照片经 AI Zombie Video 直接生成',
    },
  };
}

/**
 * The explore feed — the homepage's main body, laid out like Hailuo/Pika's
 * community wall: full-bleed masonry, filter tabs, minimal chrome. Every card
 * hands its story to the generator workbench above. Real clips autoplay muted
 * when `video` is set.
 */
export function Showcase({
  tagFilter,
  sectionId = 'explore',
}: {
  tagFilter?: ShowcaseTag;
  sectionId?: string;
} = {}) {
  const locale = getLocale();
  const router = useRouter();
  const [tag, setTag] = useState<ShowcaseTag | 'all'>(tagFilter ?? 'all');
  const [community, setCommunity] = useState<ShowcaseItem[]>([]);

  useEffect(() => {
    if (tagFilter) return; // explore-only: a scoped embed skips the fetch
    let alive = true;
    fetch('/api/video/community?limit=24')
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const items: CommunityClipDto[] = j?.data?.items ?? [];
        setCommunity(items.map(toCommunityItem));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tagFilter]);

  const staticItems =
    tag === 'all'
      ? showcaseItems
      : showcaseItems.filter((item) => item.tag === tag);

  // Community clips are uncategorised real generations — surface them only on
  // the "all" tab, and skip any whose file already shows as a curated card.
  const curatedVideos = new Set(
    showcaseItems.map((i) => i.video).filter(Boolean)
  );
  const items =
    tag === 'all'
      ? [
          ...staticItems,
          ...community.filter((c) => !curatedVideos.has(c.video)),
        ]
      : staticItems;

  /**
   * Hand the card's story to the generator workbench. On the homepage the
   * workbench is on-screen, so scroll to it. From a separate page (e.g.
   * /examples) there is nothing to scroll to — send the user home with the
   * story preselected via the `style` query param instead.
   */
  function tryItem(item: ShowcaseItem) {
    if (document.getElementById('generator')) {
      window.dispatchEvent(
        new CustomEvent('zombie-style', { detail: item.tag })
      );
      document
        .getElementById('generator')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    router.push(`/?style=${item.tag}#generator`);
  }

  return (
    <section id={sectionId} className="scroll-mt-16 px-4 py-14 sm:py-16">
      <div className="mx-auto max-w-[1600px]">
        {/* Header row: one line of copy + filter tabs. No hero-style section block. */}
        <div className="mb-8 flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {m['landing.explore.title']({ appName: envConfigs.app_name })}
            </h2>
            <p className="text-muted-foreground text-sm">
              {m['landing.explore.description']()}
            </p>
          </div>

          {!tagFilter && (
            <nav
              aria-label={m['landing.explore.title']({ appName: envConfigs.app_name })}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            >
              {(['all', ...TAGS] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTag(key)}
                  className={cn(
                    'shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors',
                    tag === key
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/40 border transition-colors'
                  )}
                >
                  {key === 'all'
                    ? m['landing.explore.tab_all']()
                    : tDynamic(`landing.usecases.${key}.title`)}
                </button>
              ))}
            </nav>
          )}
        </div>

        <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 [&>*]:mb-3">
          {items.map((item) => (
            <ShowcaseCard key={item.id} item={item} locale={locale} onTry={tryItem} />
          ))}
        </div>

        <p className="text-muted-foreground mt-10 text-center text-xs">
          {m['landing.explore.note']({ appName: envConfigs.app_name })}
        </p>
      </div>
    </section>
  );
}

/**
 * One feed card. A clip plays muted+looping while it is in view and pauses
 * when it scrolls away — the Hailuo/Pika behavior — so fifteen cards never
 * compete for bandwidth at once. `preload="none"` keeps the first paint to
 * posters only; playback starts from the poster frame.
 */
function ShowcaseCard({
  item,
  locale,
  onTry,
}: {
  item: ShowcaseItem;
  locale: string;
  onTry: (item: ShowcaseItem) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // No ratio threshold: a 9:16 card is often TALLER than the viewport,
        // so "55% visible" can never be reached and the clip would sit frozen
        // on its poster. Play as soon as any part enters, pause when fully out.
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <article
      id={item.id}
      className={cn(
        'group border-border/60 bg-card relative overflow-hidden rounded-xl border transition-transform duration-300 group-hover:-translate-y-0.5',
        item.aspect === '16:9' ? 'aspect-video' : 'aspect-[9/16]'
      )}
    >
      {item.video ? (
        <video
          ref={videoRef}
          src={item.video}
          poster={item.cover || undefined}
          muted
          loop
          playsInline
          preload={item.cover ? 'none' : 'metadata'}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <img
          src={item.cover}
          alt={item.prompt.en}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      )}

      <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
        <Play className="size-3 fill-current" />
        {item.model}
      </span>

      {/* Prompt overlay — hover on desktop, always visible on mobile. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3.5 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100">
        <p className="line-clamp-2 text-[13px] leading-snug text-white/90">
          {item.prompt[locale as 'en' | 'zh'] ?? item.prompt.en}
        </p>
        <button
          type="button"
          onClick={() => onTry(item)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <WandSparkles className="size-3.5" />
          {m['landing.explore.try']()}
        </button>
      </div>
    </article>
  );
}
