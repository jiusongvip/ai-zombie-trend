'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  CheckCircle2,
  CloudRain,
  Home,
  Loader2,
  Lock,
  Snowflake,
  TriangleAlert,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { tDynamic } from '@/core/i18n/dynamic';
import { Link } from '@/core/i18n/navigation';
import { showcaseItems } from '@/config/showcase';
import { apiGet, apiPost, type PageResult } from '@/lib/api-client';
import { currentLocationPath, openAuthDialog } from '@/lib/auth-dialog';
import { cn } from '@/lib/utils';
import type { VideoTaskView } from '@/lib/video-types';
import { m } from '@/paraglide/messages.js';
import { Filmstrip } from '@/components/studio/filmstrip';
import { FrameSlot, type FrameSlotValue } from '@/components/studio/frame-slot';
import { Stage } from '@/components/studio/stage';
import { Button } from '@/components/ui/button';

/**
 * The four worlds, in display order. The server catalog is the authority;
 * these are only the placeholders shown while `/api/zombie/styles` is in
 * flight, so a mismatch costs one re-render, never a rejected generate call.
 */
const WORLDS = ['cabin', 'shore', 'street', 'doorstep'] as const;
const SUBJECTS = ['person', 'pet'] as const;
const WORLD_ICONS: Record<string, LucideIcon> = {
  cabin: Home,
  shore: Waves,
  street: CloudRain,
  doorstep: Snowflake,
};
type ZombieWorld = (typeof WORLDS)[number];
type ZombieSubject = (typeof SUBJECTS)[number];
const MAX_FRAME_MB = 10;
const FALLBACK_RATIOS = ['9:16', '16:9'];
/** Source photos are phone-shot portraits; the slots keep this shape whatever the output ratio. */
const FRAME_ASPECT = '9 / 16';
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
  shareToWall?: boolean;
}

const DRAFT_KEY = 'zombie-draft';
const WORLD_TAGS: readonly string[] = WORLDS;
const SUBJECT_TAGS: readonly string[] = SUBJECTS;

/**
 * The clip the empty stage shows as proof. Taken from the example wall rather
 * than a new asset so there is one copy of it to keep honest; it's a local,
 * fast-start file, so a tap plays immediately. Missing it just falls back to
 * the plain placeholder — the stage never blocks on proof.
 */
const SAMPLE_FILM = showcaseItems.find(
  (item) => item.id === 'zombie-couple-film'
);

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

/**
 * Redesigned generator — a three-column workbench on large screens so the
 * whole flow (upload → story → submit) lives in the first screen: photo
 * slots left, story + settings + CTA in the wide middle column that used to
 * be dead margin, preview stage right. No numbered steps. Stacks on mobile.
 */
export function Generator() {
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
  const [shareToWall, setShareToWall] = useState(false);
  // Gate messages stay hidden until the first click, then track live — each one
  // disappears the moment its own condition is met.
  const [attempted, setAttempted] = useState(false);

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
    shareToWall,
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
    if (blocked) {
      setAttempted(true);
      revealMissing();
      return;
    }
    if (!signedIn) {
      saveDraft(draft());
      // Come back to the form itself, not the top of the page.
      openAuthDialog(`${currentLocationPath('/').split('#')[0]}#generator`);
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
    queuedTitle: m['studio.stage.queued'](),
    processingTitle: m['studio.stage.processing'](),
    renderingBody: m['studio.stage.rendering_body'](),
    elapsedTemplate: m['studio.stage.elapsed']({ seconds: '{seconds}' }),
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

  return (
    <section
      id="generator"
      className="grain-overlay relative scroll-mt-16 overflow-hidden px-4 pt-5 pb-10 sm:pt-7 sm:pb-12 lg:pt-3 lg:pb-8"
    >
      {/* Background glow */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift-a absolute -top-1/3 -left-1/4 size-[70vmin] rounded-full opacity-15 blur-3xl [background:radial-gradient(circle_at_center,var(--primary)_0%,transparent_60%)]" />
      </div>

      <div className="mx-auto w-full max-w-6xl xl:max-w-[84rem] 2xl:max-w-[104rem]">
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

        {/* Main layout: photo card + story/settings card + stage */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,20rem)] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)_minmax(0,26rem)] xl:gap-6 2xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)_minmax(0,30rem)]">
          {/* ── Left: Photo Upload Card ──────────────────────────────── */}
          <div className="border-border/60 bg-card/90 rounded-2xl border p-4 backdrop-blur-sm sm:p-5">
            {/* Photo Upload Section */}
            <div ref={photosRef}>
              {/* Form-group label, not a content heading — keeps every h3 on the page inside an h2 section. */}
              <p className="text-foreground mb-3 text-sm font-semibold">
                {m['landing.generator.step_photos']()}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Photo 1 */}
                <div>
                  <FrameSlot
                    value={firstFrame}
                    onChange={setFirstFrame}
                    aspectRatio={FRAME_ASPECT}
                    maxHeight="min(38vh, 22rem)"
                    maxSizeMB={MAX_FRAME_MB}
                    invalid={photosInvalid && !firstFrame.url}
                    labels={frameLabels}
                  />
                  <p className="text-foreground mt-2 text-sm font-medium">
                    {m['landing.generator.frame_a']()}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {m['landing.generator.frame_a_hint']()}
                  </p>
                </div>

                {/* Photo 2 */}
                <div>
                  <FrameSlot
                    value={lastFrame}
                    onChange={setLastFrame}
                    aspectRatio={FRAME_ASPECT}
                    maxHeight="min(38vh, 22rem)"
                    maxSizeMB={MAX_FRAME_MB}
                    invalid={photosInvalid && !lastFrame.url}
                    labels={frameLabels}
                  />
                  <p className="text-foreground mt-2 text-sm font-medium">
                    {m['landing.generator.frame_b']()}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {m['landing.generator.frame_b_hint']()}
                  </p>
                </div>
              </div>

              {attempted && uploading && (
                <FieldNote>{m['studio.form.upload_uploading']()}</FieldNote>
              )}
              {attempted && !uploading && !hasBothPhotos && (
                <FieldNote>{m['landing.generator.needs_photos']()}</FieldNote>
              )}

              {/* Photo-permission rule, next to the upload slots */}
              <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs leading-snug">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                {m['landing.generator.photo_rules']()}
              </p>

              {/* Privacy note */}
              <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs leading-snug">
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                {m['landing.generator.privacy_note']()}
              </p>
            </div>
          </div>

          {/* ── Middle: Story & Settings Card ────────────────────────── */}
          <div className="border-border/60 bg-card/90 rounded-2xl border p-4 backdrop-blur-sm sm:p-5">
            {/* Who turns, then where it happens — the two halves of the story. */}
            <div className="mb-4">
              <p className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {m['landing.generator.subject']()}
              </p>
              <div className="bg-muted/50 flex rounded-lg p-1">
                {SUBJECTS.map((id) => {
                  const active = id === activeSubject;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSubject(id)}
                      className={cn(
                        'flex-1 rounded-md px-3 py-2.5 text-sm font-medium transition-all',
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
              <p className="text-muted-foreground mt-2 text-xs leading-snug">
                {m['landing.generator.subject_hint']()}
              </p>
            </div>

            {/* World cards — the setting and the match cut, not the relationship. */}
            <div className="mb-4">
              <p className="text-foreground mb-3 text-sm font-semibold">
                {m['landing.generator.pick']()}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {WORLDS.map((id) => {
                  const Icon = WORLD_ICONS[id];
                  const active = id === activeWorld;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWorld(id)}
                      className={cn(
                        'relative rounded-xl border p-3 text-left transition-all',
                        active
                          ? 'border-primary bg-primary/10 ring-primary/30 ring-2'
                          : 'border-border/60 bg-muted/20 hover:border-primary/50'
                      )}
                    >
                      <span
                        className={cn(
                          'mb-2 flex size-8 items-center justify-center rounded-lg',
                          active
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="block text-sm leading-tight font-semibold">
                        {tDynamic(`landing.worlds.${id}.title`)}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-[11px] leading-snug">
                        {tDynamic(`landing.worlds.${id}.desc`)}
                      </span>
                      {active && (
                        <CheckCircle2 className="text-primary absolute top-2.5 right-2.5 size-4" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration, Format & Quality */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
              {/* Duration (fixed at 15s for zombie) */}
              <div>
                <p className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  {m['landing.generator.duration']()}
                </p>
                <div className="border-primary/50 bg-primary/10 flex items-center justify-between rounded-lg border px-3 py-2.5">
                  <span className="text-primary text-sm font-medium">15s</span>
                  <span className="text-muted-foreground text-xs">
                    {m['landing.generator.cinematic']()}
                  </span>
                </div>
              </div>

              {/* Format toggle */}
              <div>
                <p className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  {m['landing.generator.format']()}
                </p>
                <div className="bg-muted/50 flex rounded-lg p-1">
                  {ratios.map((ratio) => {
                    const active = ratio === aspectRatio;
                    return (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={cn(
                          'flex-1 rounded-md px-3 py-2.5 text-sm font-medium transition-all',
                          active
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {tDynamic(
                          `landing.generator.format.${ratio === '9:16' ? 'vertical' : 'wide'}`
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quality toggle — the one paid choice in this form */}
              <div className="col-span-2 lg:col-span-1">
                <p className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  {m['landing.generator.quality']()}
                </p>
                <div className="bg-muted/50 flex rounded-lg p-1">
                  {tiers.map((tier) => {
                    const active = tier.resolution === activeResolution;
                    return (
                      <button
                        key={tier.resolution}
                        type="button"
                        onClick={() => setResolution(tier.resolution)}
                        className={cn(
                          'flex-1 rounded-md px-2 py-1.5 text-center text-sm leading-tight font-medium transition-all',
                          active
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {tier.resolution}
                        {tier.creditCost > 0 && (
                          <span className="block text-[11px] font-normal">
                            {m['studio.result.cost']({
                              credits: tier.creditCost,
                            })}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Credit info */}
            <div
              ref={creditsRef}
              className="border-border/60 mb-4 border-t pt-3"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-xs">
                    {m['studio.form.balance_label']()}
                  </p>
                  <p className="text-foreground text-sm font-medium tabular-nums">
                    {signedIn
                      ? balance !== undefined
                        ? m['studio.form.balance_value']({ balance })
                        : '…'
                      : '—'}
                  </p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-muted-foreground text-xs">
                    {m['studio.form.after_label']()}
                  </p>
                  <p className="text-foreground text-sm font-medium tabular-nums">
                    {signedIn && balance !== undefined
                      ? m['studio.form.after_value']({
                          left: Math.max(0, balance - cost),
                        })
                      : m['studio.result.cost']({ credits: cost })}
                  </p>
                </div>
              </div>

              {attempted && !providerReady && (
                <FieldNote>{m['studio.form.no_provider']()}</FieldNote>
              )}
              {attempted && !canAfford && (
                <FieldNote>
                  {m['landing.generator.insufficient']()}{' '}
                  <Link
                    href="/pricing"
                    className="underline underline-offset-4"
                  >
                    {m['landing.generator.top_up']()}
                  </Link>
                </FieldNote>
              )}
            </div>

            {/* Likeness consent — the server refuses the render without it */}
            <div ref={consentRef} className="mt-4 space-y-2.5">
              <label
                className={cn(
                  'hover:text-foreground flex cursor-pointer items-start gap-2.5 text-xs leading-snug transition-colors',
                  attempted && !consented
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={(event) => setConsented(event.target.checked)}
                  className="accent-primary mt-0.5 size-4 shrink-0"
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
              <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-start gap-2.5 text-xs leading-snug transition-colors">
                <input
                  type="checkbox"
                  checked={shareToWall}
                  onChange={(event) => setShareToWall(event.target.checked)}
                  className="accent-primary mt-0.5 size-4 shrink-0"
                />
                <span>{m['landing.generator.share_body']()}</span>
              </label>
            </div>

            {/* CTA Button */}
            <Button
              size="lg"
              className="bg-primary shadow-primary/25 hover:bg-primary/90 w-full rounded-xl text-base font-semibold shadow-lg disabled:opacity-50"
              onClick={onGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="mr-2 size-5 animate-spin" />
              ) : null}
              {generateMutation.isPending
                ? m['studio.generate.submitting']()
                : !signedIn && cost > 0
                  ? m['landing.generator.cta_guest']({ credits: cost })
                  : cost > 0
                    ? m['studio.generate.submit_cost']({ credits: cost })
                    : m['landing.generator.start']()}
            </Button>

            <p className="text-muted-foreground mt-3 text-center text-xs">
              {m['landing.hero.note']()}
            </p>
          </div>

          {/* ── Right: Preview Stage ─────────────────────────────────── */}
          <div className="space-y-4">
            <div ref={stageRef}>
              <Stage
                task={activeTask}
                elapsedSeconds={elapsed}
                frameAspect={cssAspect(aspectRatio)}
                vhBudget={46}
                labels={stageLabels}
                statusLabel={statusLabel}
                error={submitError}
                busy={generateMutation.isPending}
                sample={
                  SAMPLE_FILM?.video
                    ? {
                        video: SAMPLE_FILM.video,
                        poster: SAMPLE_FILM.cover,
                        badge: m['landing.generator.sample.badge'](),
                        playLabel: m['landing.generator.sample.play'](),
                      }
                    : undefined
                }
                onRegenerate={() => generateMutation.mutate(draft())}
                onLoadSettings={() => activeTask && loadSettings(activeTask)}
              />
            </div>

            {signedIn && recent.length > 0 && (
              <div className="space-y-2">
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
        </div>
      </div>
    </section>
  );
}
