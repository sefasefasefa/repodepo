import { AppLayout } from "@/components/layout/app-layout";
import { useParams } from "wouter";
import { useListVideos } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { Grid3x3, SlidersHorizontal, ChevronLeft, TrendingUp, Clock, Star, Flame } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SORT_OPTIONS = [
  { id: "newest",   label: "En Yeni",    icon: Clock },
  { id: "popular",  label: "En Popüler", icon: TrendingUp },
  { id: "trending", label: "Trend",      icon: Flame },
  { id: "rating",   label: "En Beğenilen", icon: Star },
];

const DURATION_FILTERS = [
  { id: "",      label: "Hepsi" },
  { id: "short", label: "< 10 dk" },
  { id: "mid",   label: "10–30 dk" },
  { id: "long",  label: "> 30 dk" },
];

const QUALITY_FILTERS = [
  { id: "",    label: "Hepsi" },
  { id: "4k",  label: "4K" },
  { id: "hd",  label: "HD" },
  { id: "sd",  label: "SD" },
];

export default function CategoryDetail() {
  const params = useParams();
  const categoryId = parseInt(params.id || "0");

  const [sort, setSort]         = useState("newest");
  const [duration, setDuration] = useState("");
  const [quality, setQuality]   = useState("");
  const [page, setPage]         = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useListVideos({
    category: categoryId || undefined,
    ordering: sort === "newest" ? "-created_at" : sort === "popular" ? "-view_count" : sort === "rating" ? "-like_count" : "-created_at",
    page,
  } as any);

  const videos = (data as any)?.results ?? (data as any)?.videos ?? [];
  const totalCount = (data as any)?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/categories">
            <span className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
              <ChevronLeft className="h-4 w-4" /> Kategoriler
            </span>
          </Link>
          <span>/</span>
          <span className="text-white font-medium">Kategori #{categoryId}</span>
        </div>

        {/* Başlık + Filtre Butonu */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/15 p-2.5 rounded-xl">
              <Grid3x3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Kategori #{categoryId}</h1>
              {!isLoading && <p className="text-xs text-muted-foreground">{totalCount} video</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filtrele / Sırala
          </Button>
        </div>

        {/* Filtre Paneli */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            {/* Sıralama */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sıralama</p>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { setSort(opt.id); setPage(1); }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
                        sort === opt.id
                          ? "border-primary bg-primary/15 text-white font-semibold"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Süre */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Süre</p>
              <div className="flex flex-wrap gap-2">
                {DURATION_FILTERS.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setDuration(d.id); setPage(1); }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm border transition-all",
                      duration === d.id
                        ? "border-primary bg-primary/15 text-white font-semibold"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Kalite */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Kalite</p>
              <div className="flex flex-wrap gap-2">
                {QUALITY_FILTERS.map(q => (
                  <button
                    key={q.id}
                    onClick={() => { setQuality(q.id); setPage(1); }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm border transition-all",
                      quality === q.id
                        ? "border-primary bg-primary/15 text-white font-semibold"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Video Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Grid3x3 className="h-16 w-16 mx-auto opacity-20 mb-4" />
            <p className="font-medium text-lg">Bu kategoride video yok</p>
            <p className="text-sm mt-1">Yakında içerik eklenecek</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {videos.map((video: any) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              ← Önceki
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = page <= 4 ? i + 1 : page - 3 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "w-9 h-9 rounded-lg text-sm font-medium transition-all",
                      p === page ? "bg-primary text-white" : "bg-card border border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Sonraki →
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
