import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  Film,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { tDynamic } from '@/core/i18n/dynamic';
import { Link } from '@/core/i18n/navigation';
import { apiDelete, apiGet, type PageResult } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { VideoTaskView } from '@/lib/video-types';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { VideoPlayer } from '@/components/video-player';

const PAGE_SIZE = 12;

const STATUS_TABS = ['all', 'success', 'processing', 'failed'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

/**
 * Library of rendered films.
 *
 * A page, not a console tab: the product lives on the homepage, so history
 * gets the same marketing shell. Guests are bounced to sign-in by `useAuthGate`
 * with the way back preserved. Prompts are deliberately never shown — the
 * scene templates are backend configuration, not user-facing content.
 */
function TaskCard({
  task,
  onDelete,
}: {
  task: VideoTaskView;
  onDelete: (task: VideoTaskView) => void;
}) {
  const videoUrl = task.videos[0]?.videoUrl;
  const poster = task.videos[0]?.thumbnailUrl;

  return (
    <Card className="overflow-hidden pt-0">
      <div className="bg-muted relative">
        {videoUrl ? (
          <VideoPlayer
            src={videoUrl}
            poster={poster}
            aspectRatio={task.aspectRatio === '9:16' ? '9 / 16' : '16 / 9'}
            className="rounded-none"
          />
        ) : (
          <div
            className="text-muted-foreground flex items-center justify-center gap-2 text-xs"
            style={{
              aspectRatio: task.aspectRatio === '9:16' ? '9 / 16' : '16 / 9',
            }}
          >
            {task.polling ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {tDynamic(`studio.status.${task.status}`)}
              </>
            ) : (
              tDynamic(`studio.status.${task.status}`)
            )}
          </div>
        )}
      </div>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              task.status === 'success'
                ? 'default'
                : task.status === 'failed'
                  ? 'destructive'
                  : 'secondary'
            }
            className="font-normal"
          >
            {tDynamic(`studio.status.${task.status}`)}
          </Badge>
          <span className="text-muted-foreground truncate text-xs">
            {task.modelLabel}
          </span>
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-3 text-[11px]">
          {task.duration && <span>{`${task.duration}s`}</span>}
          {task.aspectRatio && <span>{task.aspectRatio}</span>}
          {task.resolution && <span>{task.resolution}</span>}
          <span className="tabular-nums">
            {m['studio.result.cost']({ credits: task.costCredits })}
          </span>
          <span>{new Date(task.createdAt).toLocaleDateString()}</span>
        </div>

        {task.status === 'failed' && task.errorMessage && (
          <p className="text-destructive line-clamp-2 text-xs">
            {task.errorMessage}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {videoUrl && (
            <a
              href={videoUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'flex-1 gap-1.5'
              )}
            >
              <Download className="size-3.5" />
              {m['studio.library.download']()}
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive gap-1.5"
            onClick={() => onDelete(task)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LibraryPage() {
  const queryClient = useQueryClient();
  const { ready } = useAuthGate();
  const [tab, setTab] = useState<StatusTab>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<VideoTaskView | null>(
    null
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch]);

  const query = useQuery({
    queryKey: ['video-tasks', page, tab, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      // "processing" groups both non-terminal states — see taskConditions().
      if (tab === 'processing') params.set('status', 'pending,processing');
      else if (tab !== 'all') params.set('status', tab);
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiGet<PageResult<VideoTaskView>>(`/api/video/tasks?${params}`);
    },
    enabled: ready,
    placeholderData: keepPreviousData,
    // Keep in-flight generations moving without a manual refresh.
    refetchInterval: (q) =>
      q.state.data?.items.some((item) => item.polling) ? 5000 : false,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => apiDelete(`/api/video/tasks/${taskId}`),
    onSuccess: () => {
      toast.success(m['studio.library.deleted']());
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ['video-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!ready) {
    return (
      <div className="bg-background flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center py-32">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{m['studio.library.title']()}</h1>
              <p className="text-muted-foreground">
                {m['studio.library.description']()}
              </p>
            </div>
            <Link
              href="/#generator"
              className={cn(buttonVariants({ size: 'sm' }), 'gap-2')}
            >
              <Clapperboard className="size-4" />
              {m['studio.library.new']()}
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="border-border flex gap-1 overflow-x-auto border-b">
              {STATUS_TABS.map((tb) => (
                <button
                  key={tb}
                  type="button"
                  onClick={() => setTab(tb)}
                  className={cn(
                    '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    tab === tb
                      ? 'border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  )}
                >
                  {tDynamic(`studio.library.tab_${tb}`)}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={m['studio.library.search_placeholder']()}
                className="pl-9"
              />
            </div>
          </div>

          {/* Grid */}
          {query.isPending ? (
            <div className="flex justify-center py-20">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-20 text-center">
                <Film className="size-10 opacity-40" strokeWidth={1.5} />
                <p className="text-sm">{m['studio.library.empty']()}</p>
                <Link
                  href="/#generator"
                  className={cn(buttonVariants({ size: 'sm' }))}
                >
                  {m['studio.library.empty_cta']()}
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((task) => (
                  <TaskCard key={task.id} task={task} onDelete={setPendingDelete} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    {m['common.table.total']({ count: total })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Delete confirmation */}
        <Dialog
          open={!!pendingDelete}
          onOpenChange={(open) => !open && setPendingDelete(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m['studio.library.delete_title']()}</DialogTitle>
              <DialogDescription>
                {m['studio.library.delete_body']()}
              </DialogDescription>
            </DialogHeader>
            {pendingDelete && (
              <p className="text-muted-foreground rounded-lg border p-3 text-sm">
                {new Date(pendingDelete.createdAt).toLocaleString()} ·{' '}
                {pendingDelete.modelLabel}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingDelete(null)}>
                {m['common.actions.cancel']()}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() =>
                  pendingDelete && deleteMutation.mutate(pendingDelete.id)
                }
              >
                {deleteMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {m['common.actions.delete']()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/library')({
  loader: () => {
    const locale = getLocale();
    return { title: m['studio.library.title']({}, { locale }) };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.title },
          // Personal, auth-gated film history — the public wall is /examples.
          { name: 'robots', content: 'noindex,follow' },
        ]
      : [],
  }),
  component: LibraryPage,
});
