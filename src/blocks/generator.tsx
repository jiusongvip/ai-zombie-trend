'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { tDynamic } from '@/core/i18n/dynamic';
import { Link } from '@/core/i18n/navigation';
import { formatPrice, lowestPricePerFilmInCents } from '@/config/pricing';
import { worldScenes } from '@/config/story-scenes';
import { apiGet, apiPost, type PageResult } from '@/lib/api-client';
import { currentLocationPath, openAuthDialog } from '@/lib/auth-dialog';
import { cn } from '@/lib/utils';
import type { VideoTaskView } from '@/lib/video-types';
import { m } from '@/paraglide/messages.js';
import { Filmstrip } from '@/components/studio/filmstrip';
import { FrameSlot, type FrameSlotValue } from '@/components/studio/frame-slot';
import { Stage } from '@/components/studio/stage';
import { Button, buttonVariants } from '@/components/ui/button';

/**
 * The four worlds, in display order. The server catalog is the authority;
 * these are only the placeholders shown while `/api/zombie/styles` is in
 * flight, so a mismatch costs one re-render, never a rejected generate call.
 */
const WORLDS = ['cabin', 'shore', 'street', 'doorstep'] as const;
const SUBJECTS = ['person', 'pet'] as const;
type ZombieWorld = (typeof WORLDS)[number];
type ZombieSubject = (typeof SUBJECTS)[number];
const MAX_FRAME_MB = 10;
const FALLBACK_RATIOS = ['9:16', '16:9'];
/**
 * Square cells, like the form the market already trained people on. A portrait
 * cell is prettier, but two of them ate ~60px of height and pushed the submit
 * button under the fold on a 900px-tall laptop — the one element that must
 * never need a scroll is the button.
 */
const FRAME_ASPECT = '1 / 1';
/** Shown while the real tier list is in flight — no prices, same two choices. */
const FALLBACK_TIERS: ZombieTier[] = [
  { resolution: '480p', creditCost: 0 },
  { resolution: '720p', creditCost: 0 },
];

const cssAspect = (ratio: string) => ratio.replace(':', ' / ');

interface ZombieTier {
  resolution: string;
  creditCost: number;
}

interface ZombieStylesResponse {
  /** The worlds on offer — the first one is preselected. */
  worlds: { id: string }[];
  /** Who the second photo can be: a person or a pet. */
  subjects: { id: string }[];
  /** Resolution tiers on offer, cheapest first — the first one is preselected. */
  tiers: ZombieTier[];
  aspectRatios: string[];
  providerReady: boolean;
}

interface FilmDraft {
  world: ZombieWorld;
  subject: ZombieSubject;
  aspectRatio: string;
  resolution: string;
  imageUrl?: string;
  lastFrameUrl?: string;
  consent?: boolean;
}

const DRAFT_KEY = 'zombie-draft';
const WORLD_TAGS: readonly string[] = WORLDS;
const SUBJECT_TAGS: readonly string[] = SUBJECTS;

/**
 * The clip the empty stage shows as proof: the cabin story, rendered end to end
 * from two photos. It is local and fast-start, so a tap plays immediately, and
 * the stage takes its 16:9 shape from the file rather than cropping it into the
 * portrait cell a render would use. A missing file just falls back to the plain
 * placeholder — the stage never blocks on proof.
 */
const SAMPLE_FILM = {
  video: '/videos/showcase/zombie-sample-film.mp4',
  poster: '/images/showcase/zombie-sample-film.webp',
  aspect: '16 / 9',
} as const;

/** What the stage needs to play a page's own proof clip. */
export interface StageSampleFilm {
  video: string;
  poster: string;
  /** CSS `aspect-ratio` for the empty frame, e.g. `'9 / 16'`. */
  aspect: string;
  /**
   * Who the second photo is inside this clip. A keyword page passes the story
   * it is about, so the form's own toggle opens on what the proof already
   * showed. Kept as literals rather than the block's union so the example wall
   * does not have to import this module.
   */
  subject?: 'person' | 'pet';
}

function saveDraft(draft: FilmDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

function takeDraft(): FilmDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DRAFT_KEY);
    const parsed = JSON.parse(raw) as Partial<FilmDraft>;
    if (
      typeof parsed.world === 'string' &&
      WORLD_TAGS.includes(parsed.world) &&
      typeof parsed.subject === 'string' &&
      SUBJECT_TAGS.includes(parsed.subject) &&
      typeof parsed.imageUrl === 'string' &&
      typeof parsed.lastFrameUrl === 'string'
    ) {
      return {
        world: parsed.world as ZombieWorld,
        subject: parsed.subject as ZombieSubject,
        aspectRatio:
          typeof parsed.aspectRatio === 'string' &&
          FALLBACK_RATIOS.includes(parsed.aspectRatio)
            ? parsed.aspectRatio
            : FALLBACK_RATIOS[0],
        resolution:
          typeof parsed.resolution === 'string' ? parsed.resolution : '',
        imageUrl: parsed.imageUrl,
        lastFrameUrl: parsed.lastFrameUrl,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function useElapsed(startedAt: number | null, active: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active || startedAt === null) return;
    const tick = () =>
      setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt, active]);

  return seconds;
}

const EMPTY_FRAME: FrameSlotValue = { status: 'idle' };

/** A gate failure, printed where the failure is rather than in a top-of-screen toast. */
function FieldNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-destructive mt-2 flex items-start gap-1.5 text-xs leading-snug">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** One option in the Quality / Format stacks: label left, consequence right. */
function OptionRow({
  active,
  label,
  note,
  onClick,
}: {
  active: boolean;
  label: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-all',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      {note && (
        <span className="text-[11px] whitespace-nowrap tabular-nums opacity-80">
          {note}
        </span>
      )}
    </button>
  );
}

/**
 * The first screen is the whole product: the pitch and the proof on the left,
 * the submit card on the right, both inside one viewport on a laptop.
 *
 * This replaced a centred hero sitting above a three-column workbench. That
 * layout was prettier and worse: the two photo slots, the four story cards,
 * the tier toggles, the balance block, two checkboxes and the button needed
 * roughly 1,200px of height, so the only element that matters — the submit
 * button — sat below the fold on every laptop screen.
 *
 * The shape now follows the reference the market has already validated: one
 * promise column, one form column, one button. The story worlds, the balance
 * and the auto-refund line are kept, but each is one compact row instead of a
 * card, and the result of a render replaces the example film in the same slot
 * the example film occupied, so nothing jumps across the page when it lands.
 */
export function Generator({
  variant = 'hero',
  sample = SAMPLE_FILM,
  pitch,
}: {
  /**
   * `hero` is the homepage first screen: the pitch above the proof, the submit
   * card beside it. `card` keeps that exact arrangement — same container, same
   * grid, same promise column — and swaps the homepage lines for the page's own
   * `pitch`, so a keyword page still ships exactly one H1, in the slot the
   * homepage puts its headline.
   */
  variant?: 'hero' | 'card';
  /**
   * The clip the empty frame plays. The homepage shows the cabin film; a
   * keyword page passes the story it is about, so the proof on screen is the
   * proof the page promised.
   */
  sample?: StageSampleFilm;
  /**
   * The promise column for a page that is not the homepage: its title as the H1
   * and one sentence written for the person reading it, not for a search
   * result. Omit on the homepage, where both come from the localized copy.
   */
  pitch?: { title: string; lead: string };
} = {}) {
  const isHero = variant === 'hero';
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const signedIn = !!session?.user;

  // Form state
  const [world, setWorld] = useState<ZombieWorld>(WORLDS[0]);
  const [subject, setSubject] = useState<ZombieSubject>(SUBJECTS[0]);
  const [aspectRatio, setAspectRatio] = useState(FALLBACK_RATIOS[0]);
  // Empty until the tier list lands or the user picks — see `activeResolution`.
  const [resolution, setResolution] = useState('');
  const [firstFrame, setFirstFrame] = useState<FrameSlotValue>(EMPTY_FRAME);
  const [lastFrame, setLastFrame] = useState<FrameSlotValue>(EMPTY_FRAME);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  // The example film decides how far the form sits down the page. Phones stack
  // the proof above the form, so they get the short budget either way. On a
  // wide screen the proof sits beside the form, where its height never moves
  // the button — and a keyword page opens ~48px higher than the homepage, since
  // nothing but the page's own padding sits above the block, so it can spend a
  // little more of the viewport on proof.
  const compactBudget = isHero ? 34 : 30;
  const wideBudget = isHero ? 48 : 52;
  const [stageBudget, setStageBudget] = useState(wideBudget);
  useEffect(() => {
    const compact = window.matchMedia('(max-width: 1023px)');
    const apply = () =>
      setStageBudget(compact.matches ? compactBudget : wideBudget);
    apply();
    compact.addEventListener('change', apply);
    return () => compact.removeEventListener('change', apply);
  }, [compactBudget, wideBudget]);
  // Gate messages stay hidden until the first click, then track live — each one
  // disappears the moment its own condition is met.
  const [attempted, setAttempted] = useState(false);

  // The page's proof implies its story: a pet page shows a pet film, so the
  // subject toggle opens on pet. A restored draft and an explicit `?subject=`
  // are both applied by the effects below, so they outrank this default.
  useEffect(() => {
    if (sample.subject) setSubject(sample.subject);
  }, [sample.subject]);

  // Restore draft after sign-up
  useEffect(() => {
    const draft = takeDraft();
    if (!draft) return;
    setWorld(draft.world);
    setSubject(draft.subject);
    setAspectRatio(draft.aspectRatio);
    setResolution(draft.resolution);
    setFirstFrame({ url: draft.imageUrl, status: 'uploaded' });
    setLastFrame({ url: draft.lastFrameUrl, status: 'uploaded' });
    toast.info(m['landing.generator.draft_restored']());
  }, []);

  // Deep links into one axis of the story: ?world=shore&subject=pet
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const worldParam = params.get('world');
    const subjectParam = params.get('subject');
    if (worldParam && WORLD_TAGS.includes(worldParam)) {
      setWorld(worldParam as ZombieWorld);
    }
    if (subjectParam && SUBJECT_TAGS.includes(subjectParam)) {
      setSubject(subjectParam as ZombieSubject);
    }
  }, []);

  // External "Try this" event — the example wall is organised by *who* turns,
  // so a showcase tag lands on the subject axis, never on a world.
  useEffect(() => {
    const pick = (event: Event) => {
      const tag = (event as CustomEvent<string>).detail;
      setSubject(tag === 'pet' ? 'pet' : 'person');
    };
    window.addEventListener('zombie-style', pick);
    return () => window.removeEventListener('zombie-style', pick);
  }, []);

  // Data fetching
  const stylesQuery = useQuery({
    queryKey: ['zombie-styles'],
    queryFn: () => apiGet<ZombieStylesResponse>('/api/zombie/styles'),
    staleTime: 5 * 60_000,
  });
  const providerReady = stylesQuery.data?.providerReady !== false;
  const tiers = stylesQuery.data?.tiers.length
    ? stylesQuery.data.tiers
    : FALLBACK_TIERS;
  // The first tier is the server's own default, so an untouched form and a
  // draft carrying a since-removed tier both land on a billable resolution.
  const activeResolution = tiers.some((tier) => tier.resolution === resolution)
    ? resolution
    : tiers[0].resolution;
  const cost =
    tiers.find((tier) => tier.resolution === activeResolution)?.creditCost ?? 0;
  // Same guard on the story axes: a since-removed world or subject falls back
  // to the first one the server still offers rather than POSTing a dead id.
  const activeWorld = (stylesQuery.data?.worlds.length
    ? stylesQuery.data.worlds.map((entry) => entry.id)
    : WORLD_TAGS
  ).includes(world)
    ? world
    : (WORLDS[0] as ZombieWorld);
  const activeSubject = (stylesQuery.data?.subjects.length
    ? stylesQuery.data.subjects.map((entry) => entry.id)
    : SUBJECT_TAGS
  ).includes(subject)
    ? subject
    : (SUBJECTS[0] as ZombieSubject);
  const ratios = stylesQuery.data?.aspectRatios.length
    ? stylesQuery.data.aspectRatios.filter((r) => ['9:16', '16:9'].includes(r))
    : FALLBACK_RATIOS;

  const creditsQuery = useQuery({
    queryKey: ['user-credits', 'balance'],
    queryFn: () => apiGet<{ balance: number }>('/api/credits'),
    enabled: signedIn,
  });
  const balance = creditsQuery.data?.balance;
  const canAfford = balance === undefined || balance >= cost;
  // A signed-in account with too few credits is not a form error, it is a
  // purchase decision — so the button changes job instead of turning red.
  const needsTopUp = signedIn && balance !== undefined && balance < cost;

  const recentQuery = useQuery({
    queryKey: ['video-tasks', 'recent'],
    queryFn: () =>
      apiGet<PageResult<VideoTaskView>>('/api/video/tasks?page=1&pageSize=10'),
    enabled: signedIn,
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.items.some((item) => item.polling) ? 5000 : false,
  });
  const recent = recentQuery.data?.items ?? [];

  const activeTaskQuery = useQuery({
    queryKey: ['video-task', activeTaskId],
    queryFn: () =>
      apiGet<{ task: VideoTaskView }>(`/api/video/tasks/${activeTaskId}`),
    enabled: !!activeTaskId,
    refetchInterval: (query) => (query.state.data?.task.polling ? 4000 : false),
  });
  const activeTask = activeTaskQuery.data?.task ?? null;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const photosRef = useRef<HTMLDivElement | null>(null);
  const creditsRef = useRef<HTMLDivElement | null>(null);
  const consentRef = useRef<HTMLDivElement | null>(null);
  const revealStage = () => {
    const el = stageRef.current;
    if (!el) return;
    const { top, bottom } = el.getBoundingClientRect();
    if (top < 0 || bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const activePolling = activeTask?.polling;
  useEffect(() => {
    if (!activeTaskId || activePolling !== false) return;
    queryClient.invalidateQueries({ queryKey: ['user-credits'] });
    queryClient.invalidateQueries({ queryKey: ['video-tasks'] });
  }, [activeTaskId, activePolling, queryClient]);

  const startedAtRef = useRef<number | null>(null);
  if (activeTask?.polling && startedAtRef.current === null) {
    startedAtRef.current =
      new Date(activeTask.createdAt).getTime() || Date.now();
  }
  if (!activeTask?.polling) startedAtRef.current = null;
  const elapsed = useElapsed(startedAtRef.current, !!activeTask?.polling);

  const uploading =
    firstFrame.status === 'uploading' || lastFrame.status === 'uploading';
  const hasBothPhotos = !!firstFrame.url && !!lastFrame.url;

  const draft = (): FilmDraft => ({
    world: activeWorld,
    subject: activeSubject,
    aspectRatio,
    resolution: activeResolution,
    imageUrl: firstFrame.url,
    lastFrameUrl: lastFrame.url,
    consent: consented,
  });

  const generateMutation = useMutation({
    mutationFn: (body: FilmDraft) =>
      apiPost<{ task: VideoTaskView }>('/api/zombie/generate', body),
    onMutate: () => setSubmitError(null),
    onSuccess: ({ task }) => {
      queryClient.setQueryData(['video-task', task.id], { task });
      setActiveTaskId(task.id);
      sessionStorage.removeItem(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['video-tasks'] });
      toast.success(m['studio.generate.started']());
      revealStage();
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['video-tasks'] });
      toast.error(error.message);
    },
  });

  /** Each gate renders beside the control it refers to, never as a toast. */
  const missing = {
    photos: uploading || !hasBothPhotos,
    consent: !consented,
    service: !providerReady,
    credits: !canAfford,
  };
  const blocked =
    missing.photos || missing.consent || missing.service || missing.credits;

  function revealMissing() {
    const spots: Array<[boolean, HTMLElement | null]> = [
      [missing.photos, photosRef.current],
      [missing.consent, consentRef.current],
      [missing.service || missing.credits, creditsRef.current],
    ];
    const spot = spots.find(([bad]) => bad)?.[1];
    if (!spot) return;
    const { top, bottom } = spot.getBoundingClientRect();
    if (top < 0 || bottom > window.innerHeight) {
      spot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function onGenerate() {
    // Sign-in comes first: the button says "Sign in" for a guest, so it must
    // open sign-in even when no photos are picked yet. Running the gates first
    // left a visitor staring at two red boxes under a button that promised a
    // sign-in prompt. Whatever they did fill in survives in the draft.
    if (!signedIn) {
      saveDraft(draft());
      // Come back to the form itself, not the top of the page.
      openAuthDialog(`${currentLocationPath('/').split('#')[0]}#generator`);
      return;
    }
    if (blocked) {
      setAttempted(true);
      revealMissing();
      return;
    }
    generateMutation.mutate(draft());
  }

  const loadSettings = (task: VideoTaskView) => {
    if (task.sourceImageUrl) {
      setFirstFrame({ url: task.sourceImageUrl, status: 'uploaded' });
    }
    if (task.lastFrameUrl) {
      setLastFrame({ url: task.lastFrameUrl, status: 'uploaded' });
    }
    toast.success(m['studio.stage.settings_loaded']());
  };

  const frameLabels = {
    upload: m['studio.frames.upload'](),
    uploading: m['studio.frames.uploading'](),
    failed: m['studio.frames.failed'](),
    replace: m['studio.frames.replace'](),
    remove: m['studio.frames.remove'](),
    maxSize: m['studio.frames.max_size']({ size: '{size}' }),
    imageOnly: m['studio.frames.image_only'](),
    readFailed: m['studio.frames.read_failed'](),
    processFailed: m['studio.frames.process_failed'](),
  };

  const stageLabels = {
    emptyTitle: m['landing.generator.stage.empty_title'](),
    emptyBody: m['landing.generator.stage.empty_body'](),
    renderingTitle: m['studio.stage.processing'](),
    elapsedTemplate: m['studio.stage.elapsed']({ seconds: '{seconds}' }),
    waitNote: m['landing.generator.delivery_note'](),
    failedTitle: m['studio.result.failed_title'](),
    failedFallback: m['studio.result.failed_fallback'](),
    refundedTemplate: m['studio.result.refunded']({ credits: '{credits}' }),
    noCharge: m['studio.stage.failed_no_charge'](),
    stoppedBody: m['studio.stage.stopped_body'](),
    download: m['studio.result.download'](),
    regenerate: m['studio.stage.regenerate'](),
    loadSettings: m['studio.stage.load_settings'](),
    shotSettings: m['studio.stage.shot_settings'](),
    audioOn: m['studio.stage.audio_on'](),
    costTemplate: m['studio.result.cost']({ credits: '{credits}' }),
  };

  const statusLabel = (status: string) => tDynamic(`studio.status.${status}`);

  /** Empty slots only turn red once a click has asked for them. */
  const photosInvalid = attempted && !uploading;

  /**
   * The empty frame takes its shape from the clip it is actually showing — the
   * cabin film is 16:9, a keyword page's own proof is usually 9:16 — instead of
   * cropping it. A real render always uses the ratio the user picked — that is
   * the shape being bought.
   */
  const stageAspect = activeTask ? cssAspect(aspectRatio) : sample.aspect;
  const showingSample = !activeTask;

  const ctaLabel = generateMutation.isPending
    ? m['studio.generate.submitting']()
    : needsTopUp
      ? m['landing.generator.cta_get_credits']()
      : !signedIn
        ? m['landing.generator.cta_signin']()
        : cost > 0
          ? m['studio.generate.submit_cost']({ credits: cost })
          : m['landing.generator.start']();

  return (
    <section
      id="generator"
      className={cn(
        'grain-overlay relative scroll-mt-16 overflow-hidden',
        isHero ? 'px-4 pt-6 pb-12 sm:pt-8 lg:pt-10 lg:pb-14' : 'py-6 sm:py-8'
      )}
    >
      {/* Background glow */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift-a absolute -top-1/3 -left-1/4 size-[70vmin] rounded-full opacity-15 blur-3xl [background:radial-gradient(circle_at_center,var(--primary)_0%,transparent_60%)]" />
      </div>

      <div className="mx-auto w-full max-w-6xl xl:max-w-[76rem]">
        {/* Dev warning */}
        {import.meta.env.DEV && !providerReady && stylesQuery.isSuccess && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {m['landing.generator.notice.title']()}
              </p>
              <p className="text-muted-foreground">
                {m['landing.generator.notice.body']()}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] xl:gap-14">
          {/* ── Left: the promise, then the proof ───────────────────────── */}
          <div className="flex flex-col">
            {(isHero || pitch) && (
              <>
                <span className="border-primary/40 bg-primary/10 text-primary inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide uppercase">
                  <span className="bg-primary size-1.5 animate-pulse rounded-full" />
                  {m['landing.hero.badge']()}
                </span>

                <h1 className="font-display text-glow mt-4 text-3xl leading-[1.05] font-bold tracking-tight text-balance uppercase sm:text-4xl lg:text-[2.9rem]">
                  {pitch?.title ?? m['landing.hero.headline']()}
                </h1>

                <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-relaxed sm:text-[15px]">
                  {pitch?.lead ?? m['landing.hero.subheadline']()}
                </p>
              </>
            )}

            {/* The four facts a buyer checks before uploading anything — they
                travel with the form, whichever page the form is on. */}
            <ul className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              {[
                m['landing.hero.spec_photos'](),
                m['landing.hero.spec_length'](),
                m['landing.hero.spec_audio'](),
                m['landing.hero.spec_format'](),
              ].map((label) => (
                <li key={label} className="flex items-center gap-1.5">
                  <span className="bg-primary size-1.5 rounded-full" />
                  {label}
                </li>
              ))}
            </ul>

            <p className="text-muted-foreground/80 mt-2 text-xs">
              {m['landing.hero.price_line']({
                price: formatPrice(lowestPricePerFilmInCents()),
              })}
            </p>

            {/* Proof sits in the same slot the render will land in. */}
            <div className="mt-6">
              <div ref={stageRef}>
                <Stage
                  task={activeTask}
                  elapsedSeconds={elapsed}
                  frameAspect={stageAspect}
                  vhBudget={stageBudget}
                  labels={stageLabels}
                  statusLabel={statusLabel}
                  error={submitError}
                  busy={generateMutation.isPending}
                  sample={{
                    video: sample.video,
                    poster: sample.poster,
                    alt: m['landing.generator.sample.badge'](),
                  }}
                  onRegenerate={() => generateMutation.mutate(draft())}
                  onLoadSettings={() => activeTask && loadSettings(activeTask)}
                />
              </div>

              {showingSample && (
                <p className="text-muted-foreground mt-2.5 text-center text-[11px] leading-relaxed">
                  {m['landing.generator.sample.caption']()}{' '}
                  <Link
                    href="/examples"
                    className="hover:text-primary underline underline-offset-4"
                  >
                    {m['landing.generator.examples_link']()}
                  </Link>
                </p>
              )}
            </div>

            {signedIn && recent.length > 0 && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-wide uppercase opacity-70">
                    {m['landing.generator.recent.title']()}
                  </p>
                  <Link
                    href="/library"
                    className="text-muted-foreground hover:text-primary text-xs transition-colors"
                  >
                    {m['landing.generator.recent.all']()}
                  </Link>
                </div>
                <Filmstrip
                  tasks={recent}
                  activeId={activeTaskId}
                  onSelect={setActiveTaskId}
                  statusLabel={statusLabel}
                />
              </div>
            )}
          </div>

          {/* ── Right: the submit card ───────────────────────────────────── */}
          <div className="border-border/60 bg-card/90 rounded-2xl border p-4 shadow-lg backdrop-blur-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  {m['landing.generator.card_title']()}
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {m['landing.generator.card_hint']()}
                </p>
              </div>

              {/* Who turns — it decides what photo two has to be, so it sits
                  on the title row, before anyone picks up a phone. */}
              <div
                role="group"
                aria-label={m['landing.generator.subject']()}
                className="bg-muted/50 flex shrink-0 rounded-lg p-1"
              >
                {SUBJECTS.map((id) => {
                  const active = id === activeSubject;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSubject(id)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                        active
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tDynamic(`landing.generator.subject.${id}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Two photos, each labelled with its role in the film. The second
                label follows the toggle above: a person turned, or the animal. */}
            <div ref={photosRef} className="mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FrameSlot
                    value={firstFrame}
                    onChange={setFirstFrame}
                    aspectRatio={FRAME_ASPECT}
                    maxSizeMB={MAX_FRAME_MB}
                    invalid={photosInvalid && !firstFrame.url}
                    labels={frameLabels}
                  />
                  <p className="text-foreground mt-2 text-sm font-medium">
                    {m['landing.generator.frame_a']()}
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    {m['landing.generator.frame_a_hint']()}
                  </p>
                </div>

                <div>
                  <FrameSlot
                    value={lastFrame}
                    onChange={setLastFrame}
                    aspectRatio={FRAME_ASPECT}
                    maxSizeMB={MAX_FRAME_MB}
                    invalid={photosInvalid && !lastFrame.url}
                    labels={frameLabels}
                  />
                  <p className="text-foreground mt-2 text-sm font-medium">
                    {activeSubject === 'pet'
                      ? m['landing.generator.frame_b_pet']()
                      : m['landing.generator.frame_b']()}
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    {activeSubject === 'pet'
                      ? m['landing.generator.frame_b_pet_hint']()
                      : m['landing.generator.frame_b_hint']()}
                  </p>
                </div>
              </div>

              {attempted && uploading && (
                <FieldNote>{m['studio.form.upload_uploading']()}</FieldNote>
              )}
              {attempted && !uploading && !hasBothPhotos && (
                <FieldNote>{m['landing.generator.needs_photos']()}</FieldNote>
              )}
            </div>

            {/* The world: four thumbnails, one tap, no paragraph to read. */}
            <div className="mt-4">
              <p className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {m['landing.generator.pick']()}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {WORLDS.map((id) => {
                  const active = id === activeWorld;
                  const scene = worldScenes[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWorld(id)}
                      aria-pressed={active}
                      className={cn(
                        'relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-lg border p-1.5 text-left transition-all',
                        active
                          ? 'border-primary ring-primary/30 ring-2'
                          : 'border-border/60 hover:border-primary/50'
                      )}
                    >
                      {scene ? (
                        <img
                          src={scene.banner}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 -z-10 size-full object-cover"
                        />
                      ) : (
                        <span className="bg-muted/40 absolute inset-0 -z-10" />
                      )}
                      <span
                        aria-hidden
                        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
                      />
                      <span className="block text-[11px] leading-tight font-semibold text-white">
                        {tDynamic(`landing.worlds.${id}.title`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality and format: the two decisions, one row each. */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  {m['landing.generator.quality']()}
                </p>
                <div className="space-y-1.5">
                  {tiers.map((tier) => (
                    <OptionRow
                      key={tier.resolution}
                      active={tier.resolution === activeResolution}
                      label={tier.resolution}
                      note={
                        tier.creditCost > 0
                          ? m['studio.result.cost']({
                              credits: tier.creditCost,
                            })
                          : undefined
                      }
                      onClick={() => setResolution(tier.resolution)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  {m['landing.generator.format']()}
                </p>
                <div className="space-y-1.5">
                  {ratios.map((ratio) => (
                    <OptionRow
                      key={ratio}
                      active={ratio === aspectRatio}
                      label={ratio}
                      note={tDynamic(
                        `landing.generator.format_note.${ratio === '9:16' ? 'vertical' : 'wide'}`
                      )}
                      onClick={() => setAspectRatio(ratio)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Balance — only once there is an account to spend from. */}
            {signedIn && (
              <div
                ref={creditsRef}
                className="border-border/60 mt-4 flex items-center justify-between border-t pt-3 text-xs"
              >
                <span className="text-muted-foreground">
                  {balance !== undefined
                    ? m['studio.form.balance_value']({ balance })
                    : '…'}
                  {cost > 0 && (
                    <>
                      {' · '}
                      {m['landing.generator.this_film']({ credits: cost })}
                    </>
                  )}
                </span>
                <Link
                  href="/pricing"
                  className="text-primary underline underline-offset-4"
                >
                  {m['landing.generator.top_up']()}
                </Link>
              </div>
            )}

            {/* Likeness consent — the server refuses the render without it. */}
            <div ref={consentRef} className="mt-4 space-y-2">
              <label
                className={cn(
                  'hover:text-foreground flex cursor-pointer items-start gap-2.5 text-[11px] leading-snug transition-colors',
                  attempted && !consented
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={(event) => setConsented(event.target.checked)}
                  className="accent-primary mt-0.5 size-3.5 shrink-0"
                />
                <span>
                  {m['landing.generator.consent_body']()}{' '}
                  <Link
                    href="/terms-of-service"
                    className={cn(
                      'underline',
                      attempted && !consented
                        ? 'text-destructive'
                        : 'text-foreground'
                    )}
                  >
                    {m['landing.generator.consent_terms']()}
                  </Link>
                </span>
              </label>
              {attempted && !consented && (
                <FieldNote>{m['landing.generator.need_consent']()}</FieldNote>
              )}
            </div>

            {/* The one button. It never changes meaning except when the
                account simply cannot pay for this run. */}
            {needsTopUp ? (
              <Link
                href="/pricing"
                onClick={() => saveDraft(draft())}
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'bg-primary shadow-primary/25 hover:bg-primary/90 mt-4 w-full rounded-xl text-base font-semibold shadow-lg'
                )}
              >
                {ctaLabel}
              </Link>
            ) : (
              <Button
                size="lg"
                className="bg-primary shadow-primary/25 hover:bg-primary/90 mt-4 w-full rounded-xl text-base font-semibold shadow-lg disabled:opacity-50"
                onClick={onGenerate}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending && (
                  <Loader2 className="mr-2 size-5 animate-spin" />
                )}
                {ctaLabel}
              </Button>
            )}

            {attempted && !providerReady && (
              <FieldNote>{m['studio.form.no_provider']()}</FieldNote>
            )}
            {needsTopUp && (
              <FieldNote>{m['landing.generator.insufficient']()}</FieldNote>
            )}

            <p className="text-muted-foreground mt-3 flex items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed">
              <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
              {m['landing.generator.trust_line']()}
            </p>

            <p className="text-muted-foreground/70 mt-2 text-center text-[10px] leading-relaxed">
              {m['landing.generator.photo_rules']()}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
