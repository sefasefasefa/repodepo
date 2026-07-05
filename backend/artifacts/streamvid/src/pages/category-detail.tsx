import { AppLayout } from "@/components/layout/app-layout";
import { useParams } from "wouter";
import { useListVideos, useListCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import {
  Grid3x3, SlidersHorizontal, ChevronLeft, TrendingUp, Clock, Star, Flame,
  Eye, MessageSquare, Hourglass, Timer, Crown, Gift, Video as VideoIcon,
  Zap, Tag as TagIcon, Grid2x2, LayoutList, RotateCcw, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SORT_OPTIONS = [
  { id: "newest",         label: "En Yeni",       icon: Clock },
  { id: "trending",       label: "Trend",         icon: Flame },
  { id: "most_viewed",    label: "En Çok İzlenen", icon: Eye },
  { id: "most_liked",     label: "En Beğenilen",   icon: Star },
  { id: "most_commented", label: "En Çok Yorumlanan", icon: MessageSquare },
  { id: "longest",        label: "En Uzun",        icon: Hourglass },
  { id: "shortest",       label: "En Kısa",        icon: Timer },
];

const DURATION_FILTERS = [
  { id: "",      label: "Tüm Süreler" },
  { id: "short", label: "< 10 dk" },
  { id: "mid",   label: "10–30 dk" },
  { id: "long",  label: "> 30 dk" },
];

const TYPE_FILTERS = [
  { id: "",      label: "Tümü",  icon: Grid3x3 },
  { id: "video", label: "Video", icon: VideoIcon },
  { id: "short", label: "Kısa",  icon: Zap },
];

const PREMIUM_FILTERS = [
  { id: "",      label: "Tümü",     icon: Grid3x3 },
  { id: "false", label: "Ücretsiz", icon: Gift },
  { id: "true",  label: "Premium",  icon: Crown },
];

async function fetchCategoryTags(categoryId: number): Promise<{ tag: string; count: number }[]> {
  if (!categoryId) return [];
  const res = await fetch(`/api/categories/${categoryId}/tags`);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.tags ?? [];
}

export default function CategoryDetail() {
  const params = useParams();
  const categoryId = parseInt(params.id || "0");

  const [sort, setSort]         = useState("newest");
  const [duration, setDuration] = useState("");
  const [type, setType]         = useState("");
  const [premium, setPremium]   = useState("");
  const [tag, setTag]           = useState("");
  const [page, setPage]         = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [layout, setLayout]     = useState<"grid" | "list">("grid");

  useEffect(() => { setPage(1); }, [categoryId]);

  const { data, isLoading, isFetching } = useListVideos({
    categoryId: categoryId || undefined,
    sort,
    ...(duration ? { duration } : {}),
    ...(type ? { type } : {}),
    ...(premium ? { isPremium: premium === "true" } : {}),
    ...(tag ? { tag } : {}),
    page,
    limit: 24,
  } as any);

  const { data: rawCategories } = useListCategories();
  const allCategories: any[] = Array.isArray(rawCategories) ? rawCategories : (rawCategories as any)?.categories ?? [];
  const category = allCategories.find((c: any) => c.id === categoryId);

  const { data: tagData } = useQuery({
    queryKey: ["category-tags", categoryId],
    queryFn: () => fetchCategoryTags(categoryId),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });
  const availableTags = tagData ?? [];

  const videos = (data as any)?.videos ?? (data as any)?.results ?? [];
  const totalCount = (data as any)?.total ?? (data as any)?.count ?? 0;
  const limit = (data as any)?.limit ?? 24;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const activeFilterCount = [duration, type, premium, tag].filter(Boolean).length;

  const resetFilters = () => {
    setSort("newest"); setDuration(""); setType(""); setPremium(""); setTag(""); setPage(1);
  };

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
          <span className="text-white font-medium">{category?.name ?? `Kategori #${categoryId}`}</span>
        </div>

        {/* Kapak Görseli */}
        {category?.coverImage && (
          <div className="relative h-40 md:h-56 w-full overflow-hidden rounded-2xl">
            <img
              src={category.coverImage}
              alt={category.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
            <div className="absolute bottom-4 left-4">
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">{category.name}</h1>
              {!isLoading && <p className="text-sm text-white/80 mt-1">{totalCount.toLocaleString("tr")} video</p>}
            </div>
          </div>
        )}

        {/* Başlık + Filtre Butonu */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!category?.coverImage && (
            <div className="flex items-center gap-3">
              <div className="bg-primary/15 p-2.5 rounded-xl">
                <Grid3x3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{category?.name ?? `Kategori #${categoryId}`}</h1>
                {!isLoading && <p className="text-xs text-muted-foreground">{totalCount.toLocaleString("tr")} video</p>}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex bg-card border border-border rounded-lg p-0.5">
              <button
                onClick={() => setLayout("grid")}
                className={cn("p-1.5 rounded transition-all", layout === "grid" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white")}
                aria-label="Izgara görünümü"
              >
                <Grid2x2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLayout("list")}
                className={cn("p-1.5 rounded transition-all", layout === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white")}
                aria-label="Liste görünümü"
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filtrele / Sırala
              {activeFilterCount > 0 && (
                <span className="ml-0.5 bg-primary text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
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

            {/* Tür */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">İçerik Türü</p>
              <div className="flex flex-wrap gap-2">
                {TYPE_FILTERS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setType(t.id); setPage(1); }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
                        type === t.id
                          ? "border-primary bg-primary/15 text-white font-semibold"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {t.label}
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

            {/* Erişim */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Erişim</p>
              <div className="flex flex-wrap gap-2">
                {PREMIUM_FILTERS.map(p => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setPremium(p.id); setPage(1); }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
                        premium === p.id
                          ? "border-primary bg-primary/15 text-white font-semibold"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Etiketler */}
            {availableTags.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Popüler Etiketler</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setTag(""); setPage(1); }}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-all",
                      tag === ""
                        ? "border-primary bg-primary/15 text-white font-semibold"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <TagIcon className="h-3 w-3" /> Tümü
                  </button>
                  {availableTags.map(t => (
                    <button
                      key={t.tag}
                      onClick={() => { setTag(prev => prev === t.tag ? "" : t.tag); setPage(1); }}
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-all",
                        tag === t.tag
                          ? "border-primary bg-primary/15 text-white font-semibold"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      #{t.tag}
                      <span className="opacity-50 text-xs">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeFilterCount > 0 && (
              <div className="pt-1 border-t border-border">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Filtreleri Sıfırla
                </button>
              </div>
            )}
          </div>
        )}

        {/* Aktif Filtre Etiketleri */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Filtreler:</span>
            {duration && (
              <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                {DURATION_FILTERS.find(d => d.id === duration)?.label}
                <button onClick={() => setDuration("")} className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            )}
            {type && (
              <span className="flex items-center gap-1 text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded-full">
                {TYPE_FILTERS.find(t => t.id === type)?.label}
                <button onClick={() => setType("")} className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            )}
            {premium && (
              <span className="flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                {PREMIUM_FILTERS.find(p => p.id === premium)?.label}
                <button onClick={() => setPremium("")} className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            )}
            {tag && (
              <span className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                #{tag}
                <button onClick={() => setTag("")} className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            )}
            <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-white transition-colors">
              Tümünü Sıfırla
            </button>
          </div>
        )}

        {/* Video Grid / Liste */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Grid3x3 className="h-16 w-16 mx-auto opacity-20 mb-4" />
            <p className="font-medium text-lg">Bu kriterlere uyan video yok</p>
            <p className="text-sm mt-1">Farklı bir filtre veya sıralama deneyin</p>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                Filtreleri Sıfırla
              </Button>
            )}
          </div>
        ) : layout === "grid" ? (
          <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 transition-opacity",
            isFetching && "opacity-60"
          )}>
            {videos.map((video: any) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className={cn("space-y-2 transition-opacity", isFetching && "opacity-60")}>
            {videos.map((video: any) => (
              <div
                key={video.id}
                className="flex gap-3 bg-card border border-border rounded-xl p-2.5 sm:p-3 hover:border-primary/40 transition-colors"
              >
                <div className="w-28 sm:w-40 md:w-48 shrink-0">
                  <VideoCard video={video} />
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="font-semibold text-white text-sm line-clamp-2 leading-snug">{video.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {video.creator?.displayName || video.creator?.username}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{(video.viewCount || 0).toLocaleString("tr")}</span>
                    <span className="flex items-center gap-1"><Star className="h-3 w-3" />{(video.likeCount || 0).toLocaleString("tr")}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{(video.commentCount || 0).toLocaleString("tr")}</span>
                  </div>
                </div>
              </div>
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
