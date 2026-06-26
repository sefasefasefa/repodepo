import { AppLayout } from "@/components/layout/app-layout";
import { useGetWatchHistory, useClearWatchHistory, getGetWatchHistoryQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { History as HistoryIcon, Trash2, Search, X, CheckSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { getLocalWatchHistory } from "@/lib/watch-progress";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

function groupVideosByDate(videos: any[]) {
  const groups: { label: string; videos: any[] }[] = [];
  const today: any[] = [];
  const yesterday: any[] = [];
  const thisWeek: any[] = [];
  const older: any[] = [];

  for (const v of videos) {
    const date = new Date((v as any).watchedAt ?? (v as any).createdAt ?? Date.now());
    if (isToday(date)) today.push(v);
    else if (isYesterday(date)) yesterday.push(v);
    else if (isThisWeek(date)) thisWeek.push(v);
    else older.push(v);
  }

  if (today.length)     groups.push({ label: "Bugün",         videos: today });
  if (yesterday.length) groups.push({ label: "Dün",           videos: yesterday });
  if (thisWeek.length)  groups.push({ label: "Bu Hafta",      videos: thisWeek });
  if (older.length)     groups.push({ label: "Daha Önce",     videos: older });

  return groups;
}

export default function History() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetWatchHistory({ limit: 60 } as any);
  const clearMutation = useClearWatchHistory();
  const localHistory = getLocalWatchHistory();

  const [search, setSearch]           = useState("");
  const [showSearch, setShowSearch]   = useState(false);
  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode]   = useState(false);

  const handleClear = () => {
    clearMutation.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchHistoryQueryKey() }),
    });
  };

  const videos = data?.videos ?? [];
  const filtered = useMemo(() =>
    search ? videos.filter((v: any) => v.title?.toLowerCase().includes(search.toLowerCase())) : videos,
    [videos, search]
  );
  const groups = useMemo(() => groupVideosByDate(filtered), [filtered]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-5">
        {/* Başlık */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-primary" /> İzleme Geçmişi
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => { setShowSearch(v => !v); setSearch(""); }}>
              {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
            <Button
              variant={selectMode ? "default" : "ghost"}
              size="icon"
              onClick={() => { setSelectMode(v => !v); setSelected(new Set()); }}
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
            {selectMode && selected.size > 0 && (
              <Button variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="h-4 w-4" /> {selected.size} sil
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={clearMutation.isPending || videos.length === 0}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" /> Tümünü Temizle
            </Button>
          </div>
        </div>

        {/* Arama */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Geçmişte ara..."
              className="pl-9"
              autoFocus
            />
          </div>
        )}

        {/* Lokal geçmiş (devam edilen videolar) */}
        {!search && localHistory.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="text-sm font-semibold text-primary flex items-center gap-2">
              <HistoryIcon className="h-4 w-4" /> Devam Edilen Videolar
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {localHistory.slice(0, 6).map((item) => (
                <Link key={item.videoId} href={`/videos/${item.videoId}`}>
                  <div className="flex gap-3 rounded-lg border border-white/10 bg-black/20 p-3 hover:bg-black/30 transition-colors cursor-pointer group">
                    <div className="w-20 h-12 rounded-md bg-black/40 overflow-hidden shrink-0 relative">
                      {item.thumbnailUrl
                        ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                        : null}
                      {(item as any).progress && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(100, ((item as any).progress ?? 0) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">{item.title}</p>
                      <p className="text-xs text-white/60 truncate">{item.creatorName || "Bilinmeyen"}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Gruplu Geçmiş */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground flex flex-col items-center">
            <HistoryIcon className="h-16 w-16 opacity-20 mb-4" />
            {search
              ? <><p className="font-medium text-lg">"{search}" bulunamadı</p><Button variant="ghost" className="mt-3" onClick={() => setSearch("")}>Aramayı Temizle</Button></>
              : <><p className="font-medium text-lg">İzleme geçmişin boş</p><p className="text-sm mt-1">Videolar izledikçe burada görünecek</p></>
            }
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{group.label}</h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{group.videos.length} video</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                  {group.videos.map((video: any) => (
                    <div
                      key={video.id}
                      className={cn("relative", selectMode && "cursor-pointer")}
                      onClick={() => selectMode && toggleSelect(video.id)}
                    >
                      {selectMode && (
                        <div className={cn(
                          "absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          selected.has(video.id)
                            ? "bg-primary border-primary"
                            : "bg-black/60 border-white/50"
                        )}>
                          {selected.has(video.id) && <span className="text-white text-xs">✓</span>}
                        </div>
                      )}
                      <div className={cn(selectMode && "pointer-events-none opacity-90")}>
                        <VideoCard video={video} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
