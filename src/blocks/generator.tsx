'use client';

import { useEffect, useRef, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { CheckCircle2, Loader2, Lock, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { tDynamic } from '@/core/i18n/dynamic';
import { Link } from '@/core/i18n/navigation';
import { showcaseItems, type ShowcaseTag } from '@/config/showcase';
import { apiGet, apiPost, type PageResult } from '@/lib/api-client';
import { currentLocationPath, openAuthDialog } from '@/lib/auth-dialog';
import { cn } from '@/lib/utils';
import type { VideoTaskView } from '@/lib/video-types';
import { m } from '@/paraglide/messages.js';
import { Filmstrip } from '@/components/studio/filmstrip';
import { FrameSlot, type FrameSlotValue } from '@/components/studio/frame-slot';
import { Stage } from '@/components/studio/stage';
import { Button } from '@/components/ui/button';

const STYLES: ShowcaseTag[] = ['couple', 'pet', 'friend', 'family'];
const MAX_FRAME_MB = 10;
const FALLBACK_RATIOS = ['9:16', '16:9'];

const cssAspect = (ratio: string) => ratio.replace(':', ' / ');

interface ZombieStylesResponse {
  styles: { id: string; creditCost: number }[];
  aspectRatios: string[];
  providerReady: boolean;
}

interface FilmDraft {
  style: ShowcaseTag;
  aspectRatio: string;
  imageUrl?: string;
  lastFrameUrl?: string;
}

const DRAFT_KEY = 'zombie-draft';
const TAGS: string[] = STYLES;

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
      typeof parsed.style === 'string' &&
      TAGS.includes(parsed.style) &&
      typeof parsed.imageUrl === 'string' &&
      typeof parsed.lastFrameUrl === 'string'
    ) {
      return {
        style: parsed.style as ShowcaseTag,
        aspectRatio:
          typeof parsed.aspectRatio === 'string' &&
          FALLBACK_RATIOS.includes(parsed.aspectRatio)
            ? parsed.aspectRatio
            : FALLBACK_RATIOS[0],
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
  const [style, setStyle] = useState<ShowcaseTag>('couple');
  const [aspectRatio, setAspectRatio] = useState(FALLBACK_RATIOS[0]);
  const [firstFrame, setFirstFrame] = useState<FrameSlotValue>(EMPTY_FRAME);
  const [lastFrame, setLastFrame] = useState<FrameSlotValue>(EMPTY_FRAME);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Restore draft after sign-up
  useEffect(() => {
    const draft = takeDraft();
    if (!draft) return;
    setStyle(draft.style);
    setAspectRatio(draft.aspectRatio);
    setFirstFrame({ url: draft.imageUrl, status: 'uploaded' });
    setLastFrame({ url: draft.lastFrameUrl, status: 'uploaded' });
    toast.info(m['landing.generator.draft_restored']());
  }, []);

  // Style from URL (?style=xxx)
  useEffect(() => {
    const styleParam = new URLSearchParams(window.location.search).get('style');
    if (styleParam && TAGS.includes(styleParam as ShowcaseTag)) {
      setStyle(styleParam as ShowcaseTag);
    }
  }, []);

  // External "Try this" event
  useEffect(() => {
    const pick = (event: Event) => {
      const tag = (event as CustomEvent<string>).detail;
      if (TAGS.includes(tag)) setStyle(tag as ShowcaseTag);
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
  const cost = stylesQuery.data?.styles[0]?.creditCost ?? 0;
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
    style,
    aspectRatio,
    imageUrl: firstFrame.url,
    lastFrameUrl: lastFrame.url,
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

  function onGenerate() {
    if (!signedIn) {
      saveDraft(draft());
      // Come back to the form itself, not the top of the page.
      openAuthDialog(`${currentLocationPath('/').split('#')[0]}#generator`);
      return;
    }
    generateMutation.mutate(draft());
  }

  const blockedReason = uploading
    ? m['studio.form.upload_uploading']()
    : !hasBothPhotos
      ? m['landing.generator.needs_photos']()
      : !providerReady
        ? m['studio.form.no_provider']()
        : !canAfford
          ? m['landing.generator.insufficient']()
          : null;

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
    costTemplate: m['studio.result.cost']({ credits: '{credits}' }),
  };

  const statusLabel = (status: string) => tDynamic(`studio.status.${status}`);

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
            <div>
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
                    aspectRatio={cssAspect(aspectRatio)}
                    maxHeight="min(38vh, 22rem)"
                    maxSizeMB={MAX_FRAME_MB}
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
                    aspectRatio={cssAspect(aspectRatio)}
                    maxHeight="min(38vh, 22rem)"
                    maxSizeMB={MAX_FRAME_MB}
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

              {/* Privacy note */}
              <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs leading-snug">
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                {m['landing.generator.privacy_note']()}
              </p>
            </div>
          </div>

          {/* ── Middle: Story & Settings Card ────────────────────────── */}
          <div className="border-border/60 bg-card/90 rounded-2xl border p-4 backdrop-blur-sm sm:p-5">
            {/* Story Scene Cards */}
            <div className="mb-4">
              <p className="text-foreground mb-3 text-sm font-semibold">
                {m['landing.generator.pick']()}
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {STYLES.map((tag) => {
                  const item = showcaseItems.find((i) => i.tag === tag)!;
                  const active = style === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setStyle(tag)}
                      className={cn(
                        'group relative overflow-hidden rounded-xl border text-left transition-all',
                        active
                          ? 'border-primary ring-primary/30 ring-2'
                          : 'border-border/60 hover:border-primary/50'
                      )}
                    >
                      <img
                        src={item.cover}
                        alt=""
                        loading="lazy"
                        className="aspect-[4/3] size-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2.5 pt-8 pb-2.5">
                        <p className="text-xs leading-tight font-semibold text-white">
                          {tDynamic(`landing.usecases.${tag}.title`)}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-tight text-white/70">
                          {tDynamic(`landing.usecases.${tag}.desc`)}
                        </p>
                      </div>
                      {active && (
                        <CheckCircle2 className="text-primary absolute top-2 right-2 size-4 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration & Format */}
            <div className="mb-4 grid grid-cols-2 gap-3">
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
            </div>

            {/* Credit info */}
            <div className="border-border/60 mb-4 flex items-center justify-between border-t pt-3">
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

            {/* CTA Button */}
            <Button
              size="lg"
              className="bg-primary shadow-primary/25 hover:bg-primary/90 w-full rounded-xl text-base font-semibold shadow-lg disabled:opacity-50"
              onClick={onGenerate}
              disabled={generateMutation.isPending || !!blockedReason}
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

            {blockedReason && !generateMutation.isPending && (
              <p className="text-muted-foreground mt-3 text-center text-sm">
                {blockedReason}
                {!canAfford && signedIn && (
                  <>
                    {' '}
                    <Link
                      href="/pricing"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {m['landing.generator.top_up']()}
                    </Link>
                  </>
                )}
              </p>
            )}

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
