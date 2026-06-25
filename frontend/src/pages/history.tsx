import { AppLayout } from "@/components/layout/app-layout";
import { useGetWatchHistory, useClearWatchHistory, getGetWatchHistoryQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getLocalWatchHistory } from "@/lib/watch-progress";
import { Link } from "wouter";

export default function History() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetWatchHistory({ limit: 20 } as any);
  const clearMutation = useClearWatchHistory();
  const localHistory = getLocalWatchHistory();

  const handleClear = () => {
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWatchHistoryQueryKey() });
      }
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-primary" /> Watch History
          </h1>
          <Button variant="outline" size="sm" onClick={handleClear} disabled={clearMutation.isPending || data?.videos.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" /> Clear History
          </Button>
        </div>

        {localHistory.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 space-y-3">
            <div className="text-sm font-semibold text-primary">Cihazda kay1tl1 devam edilen videolar</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {localHistory.slice(0, 6).map((item) => (
                <Link key={item.videoId} href={`/videos/${item.videoId}`}>
                  <div className="flex gap-3 rounded-lg border border-white/10 bg-black/20 p-3 hover:bg-black/30 transition-colors cursor-pointer">
                    <div className="w-20 h-12 rounded-md bg-black/40 overflow-hidden shrink-0">
                      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.title}</p>
                      <p className="text-xs text-white/60 truncate">{item.creatorName || "Bilinmeyen creator"}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {data?.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
            {data?.videos.length === 0 && (
              <div className="col-span-full text-center py-20 text-muted-foreground flex flex-col items-center">
                <HistoryIcon className="h-16 w-16 opacity-20 mb-4" />
                <p>Your watch history is empty.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}