import { useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

import { apiGet, apiPost } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface AdminClip {
  id: string;
  video: string;
  poster?: string;
  aspect: '16:9' | '9:16';
  model: string;
  createdAt: string;
  featured: boolean;
}

const PAGE_SIZE = 24;

function CommunityWallPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ['admin-videos', page],
    queryFn: () =>
      apiGet<{ items: AdminClip[]; total: number }>(
        `/api/admin/videos?page=${page}&pageSize=${PAGE_SIZE}`
      ),
    placeholderData: keepPreviousData,
  });

  const featureMutation = useMutation({
    mutationFn: (v: { taskId: string; featured: boolean }) =>
      apiPost('/api/admin/videos', v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">社区墙精选</h1>
        <p className="text-muted-foreground">
          新生成的成片默认自动上墙；把某条的开关关闭即可从首页社区墙撤下，重新打开即恢复展示。
        </p>
      </div>

      {listQuery.isLoading ? (
        <p className="text-muted-foreground">加载中…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center">
            还没有可用的生成记录。
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((clip) => (
            <Card
              key={clip.id}
              className={cn(
                'overflow-hidden p-0',
                clip.featured && 'ring-primary ring-2'
              )}
            >
              <CardContent className="p-0">
                <div
                  className={cn(
                    'bg-muted relative w-full overflow-hidden',
                    clip.aspect === '16:9' ? 'aspect-video' : 'aspect-[9/16]'
                  )}
                >
                  <video
                    src={clip.video}
                    poster={clip.poster}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 size-full object-cover"
                  />
                  {clip.featured && (
                    <Badge className="bg-primary absolute top-2 left-2 gap-1">
                      <Star className="size-3 fill-current" />
                      已上墙
                    </Badge>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {clip.model}
                    </span>
                    <Switch
                      checked={clip.featured}
                      onCheckedChange={(checked) =>
                        featureMutation.mutate({
                          taskId: clip.id,
                          featured: checked,
                        })
                      }
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(clip.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            上一页
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(p + 1, pages))}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/admin/videos')({
  component: CommunityWallPage,
});
