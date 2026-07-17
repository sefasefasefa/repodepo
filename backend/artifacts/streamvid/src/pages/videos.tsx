import { AppLayout } from "@/components/layout/app-layout";
import { useListVideos, useListCategories } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video/video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Flame, Eye, Clock, ThumbsUp, Crown, SlidersHorizontal,
  Video, Filter, ChevronDown, Sparkles, Grid2x2, LayoutList, Tag, X,
} from "lucide-react";
import type { Category } from "@workspace/api-client-react";

const SORT_OPTIONS = [
  { value: "newest",      label: "En Yeni",          icon: Clock },
  { value: "most_viewed", label: "En Çok İzlenen",   icon: Eye },
  { value: "most_liked",  label: "En Çok Beğenilen", icon: ThumbsUp },
  { value: "trending",    label: "Trend",             icon: Flame },
];

const TYPE_OPTIONS = [
  { value: "",      label: "Tümü" },
  { value: "video", label: "Video" },
  { value: "short", label: "Kısa" },
];

const DURATION_OPTIONS = [
  { value: "",     label: "Tüm Süreler" },
  { value: "short", label: "< 10 dk" },
  { value: "mid",   label: "10–30 dk" },
  { value: "long",  label: "30 dk+" },
];

const MIN_VIEWS_OPTIONS = [
  { value: 0,    label: "Fark etmez" },
  { value: 100,  label: "100+" },
  { value: 1000, label: "1.000+" },
  { value: 5000, label: "5.000+" },
];

const MIN_LIKES_OPTIONS = [
  { value: 0,   label: "Fark etmez" },
  { value: 10,  label: "10+" },
  { value: 50,  label: "50+" },
  { value: 200, label: "200+" },
];

function SortButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border touch-manipulation",
        active
          ? "bg-primary/20 text-primary border-primary/40"
          : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:bg-[#222] hover:text-white"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function VideoGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <div className="flex gap-2 mt-1">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="space-y-1.5 w-full">
              <Skeleton className="h-3 w-[90%]" />
              <Skeleton className="h-2.5 w-[60%]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Videos() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);

  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [type, setType] = useState(searchParams.get("type") || "");
  const [categoryId, setCategoryId] = useState<number | null>(
    searchParams.get("categoryId") ? Number(searchParams.get("categoryId")) : null
  );
  const [premium, setPremium] = useState<boolean | undefined>(undefined);
  const [duration, setDuration] = useState("");
  const [minViews, setMinViews] = useState(0);
  const [minLikes, setMinLikes] = useState(0);
  const [tag, setTag] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  // SEO: sayfa başlığını güncelle
  useEffect(() => { document.title = "Videolar"; }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setSort(p.get("sort") || "newest");
    setType(p.get("type") || "");
    setCategoryId(p.get("categoryId") ? Number(p.get("categoryId")) : null);
  }, [location]);

  const { data, isLoading } = useListVideos({
    sort,
    ...(type ? { type } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(premium !== undefined ? { isPremium: premium } : {}),
    ...(duration ? { duration } : {}),
    ...(minViews ? { minViews } : {}),
    ...(minLikes ? { minLikes } : {}),
    ...(tag ? { tag } : {}),
    limit: 40,
  } as any);

  const { data: catsData } = useListCategories();
  const categories: Category[] = Array.isArray(catsData)
    ? (catsData as any)
    : (catsData as any)?.categories ?? [];
  const visibleCats = categories.filter((c: Category) => (c.videoCount ?? 0) > 0);

  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  useEffect(() => {
    fetch("/api/videos/tags")
      .then(r => r.json())
      .then(d => setTags(d.tags ?? []))
      .catch(() => {});
  }, []);

  const hasAdvancedFilters = !!duration || minViews > 0 || minLikes > 0 || !!tag;

  const resetAll = () => {
    setCategoryId(null); setType(""); setPremium(undefined); setSort("newest");
    setDuration(""); setMinViews(0); setMinLikes(0); setTag("");
  };

  const videos = data?.videos ?? [];
  const activeSort = SORT_OPTIONS.find(s => s.value === sort)!;

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-xl">
              <Video className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-white">Videolar</h1>
              <p className="text-[10px] sm:text-xs text-[#666]">
                {isLoading ? "Yükleniyor…" : `${videos.length} video`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowFilters(v => !v); setShowAdvanced(false); }}
              className={cn(
                "gap-1 sm:gap-1.5 text-xs h-8 border px-2 sm:px-3",
                showFilters
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-[#888] border-[#2a2a2a] hover:text-white"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtrele</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showFilters && "rotate-180")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowAdvanced(v => !v); setShowFilters(false); }}
              className={cn(
                "gap-1 sm:gap-1.5 text-xs h-8 border px-2 sm:px-3",
                showAdvanced || hasAdvancedFilters
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-[#888] border-[#2a2a2a] hover:text-white"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ek Filtreler</span>
              {hasAdvancedFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
            </Button>
            <div className="flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
              <button
                onClick={() => setLayout("grid")}
                className={cn("p-1.5 rounded transition-all touch-manipulation", layout === "grid" ? "bg-[#2a2a2a] text-white" : "text-[#555] hover:text-[#aaa]")}
              >
                <Grid2x2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setLayout("list")}
                className={cn("p-1.5 rounded transition-all touch-manipulation", layout === "list" ? "bg-[#2a2a2a] text-white" : "text-[#555] hover:text-[#aaa]")}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sort + type + premium filter bar — horizontal scroll on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3">
          {SORT_OPTIONS.map(opt => (
            <SortButton
              key={opt.value}
              active={sort === opt.value}
              onClick={() => setSort(opt.value)}
              icon={opt.icon}
              label={opt.label}
            />
          ))}
          <div className="h-4 w-px bg-[#2a2a2a] shrink-0" />
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={cn(
                "shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all border touch-manipulation",
                type === opt.value
                  ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                  : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:bg-[#222] hover:text-white"
              )}
            >
              {opt.label}
            </button>
          ))}
          <div className="h-4 w-px bg-[#2a2a2a] shrink-0" />
          <button
            onClick={() => setPremium(prev => prev === true ? undefined : true)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border touch-manipulation",
              premium === true
                ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:bg-[#222] hover:text-white"
            )}
          >
            <Crown className="h-3.5 w-3.5" /> Premium
          </button>
        </div>

        {/* Category filter chips */}
        {showFilters && visibleCats.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 bg-[#111] border border-[#1e1e1e] rounded-xl py-3 mx-0">
            <button
              onClick={() => setCategoryId(null)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border touch-manipulation",
                categoryId === null
                  ? "bg-primary text-white border-primary"
                  : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-white"
              )}
            >
              Tüm Kategoriler
            </button>
            {visibleCats.map((cat: Category) => (
              <button
                key={cat.id}
                onClick={() => setCategoryId(prev => prev === cat.id ? null : cat.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border touch-manipulation",
                  categoryId === cat.id
                    ? "bg-primary text-white border-primary"
                    : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-white"
                )}
              >
                {cat.name}
                {cat.videoCount ? <span className="ml-1 opacity-60">{cat.videoCount}</span> : null}
              </button>
            ))}
          </div>
        )}

        {/* Advanced filters panel */}
        {showAdvanced && (
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-4 mx-0">
            <div>
              <p className="text-xs text-[#888] mb-2 font-medium">Süre</p>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border touch-manipulation",
                      duration === opt.value
                        ? "bg-primary text-white border-primary"
                        : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-white"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-2 font-medium">Minimum İzlenme</p>
              <div className="flex flex-wrap gap-2">
                {MIN_VIEWS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMinViews(opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border touch-manipulation",
                      minViews === opt.value
                        ? "bg-primary text-white border-primary"
                        : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-white"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-2 font-medium">Minimum Beğeni</p>
              <div className="flex flex-wrap gap-2">
                {MIN_LIKES_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMinLikes(opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border touch-manipulation",
                      minLikes === opt.value
                        ? "bg-primary text-white border-primary"
                        : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-white"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {tags.length > 0 && (
              <div>
                <p className="text-xs text-[#888] mb-2 font-medium flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Etiketler
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(t => (
                    <button
                      key={t.tag}
                      onClick={() => setTag(prev => prev === t.tag ? "" : t.tag)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all border touch-manipulation",
                        tag === t.tag
                          ? "bg-primary text-white border-primary"
                          : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-white"
                      )}
                    >
                      #{t.tag} <span className="opacity-60">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {hasAdvancedFilters && (
              <button
                onClick={() => { setDuration(""); setMinViews(0); setMinLikes(0); setTag(""); }}
                className="flex items-center gap-1 text-xs text-[#666] hover:text-white transition-colors touch-manipulation"
              >
                <X className="h-3 w-3" /> Ek filtreleri temizle
              </button>
            )}
          </div>
        )}

        {/* Active filter tags */}
        {(categoryId || type || premium !== undefined || hasAdvancedFilters) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#555]">Filtreler:</span>
            {categoryId && (
              <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                {visibleCats.find((c: Category) => c.id === categoryId)?.name || `Kategori #${categoryId}`}
                <button onClick={() => setCategoryId(null)} className="hover:opacity-70 touch-manipulation">×</button>
              </span>
            )}
            {type && (
              <span className="flex items-center gap-1 text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded-full">
                {TYPE_OPTIONS.find(t => t.value === type)?.label}
                <button onClick={() => setType("")} className="hover:opacity-70 touch-manipulation">×</button>
              </span>
            )}
            {premium !== undefined && (
              <span className="flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                Premium
                <button onClick={() => setPremium(undefined)} className="hover:opacity-70 touch-manipulation">×</button>
              </span>
            )}
            {duration && (
              <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full">
                {DURATION_OPTIONS.find(d => d.value === duration)?.label}
                <button onClick={() => setDuration("")} className="hover:opacity-70 touch-manipulation">×</button>
              </span>
            )}
            {minViews > 0 && (
              <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-300 border border-green-500/20 px-2 py-0.5 rounded-full">
                {MIN_VIEWS_OPTIONS.find(o => o.value === minViews)?.label} izlenme
                <button onClick={() => setMinViews(0)} className="hover:opacity-70 touch-manipulation">×</button>
              </span>
            )}
            {minLikes > 0 && (
              <span className="flex items-center gap-1 text-xs bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded-full">
                {MIN_LIKES_OPTIONS.find(o => o.value === minLikes)?.label} beğeni
                <button onClick={() => setMinLikes(0)} className="hover:opacity-70 touch-manipulation">×</button>
              </span>
            )}
            {tag && (
              <span className="flex items-center gap-1 text-xs bg-orange-500/10 text-orange-300 border border-orange-500/20 px-2 py-0.5 rounded-full">
                #{tag}
                <button onClick={() => setTag("")} className="hover:opacity-70 touch-manipulation">×</button>
              </span>
            )}
            <button
              onClick={resetAll}
              className="text-xs text-[#555] hover:text-white transition-colors touch-manipulation"
            >
              Sıfırla
            </button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <VideoGridSkeleton />
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-[#222] bg-[#111]">
            <Sparkles className="h-10 w-10 text-primary mb-3 opacity-60" />
            <p className="text-white font-semibold text-base">Video bulunamadı</p>
            <p className="text-[#666] text-sm mt-1.5 max-w-xs">
              Farklı bir sıralama ya da kategori seçmeyi dene.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-[#333] text-[#888] hover:text-white"
              onClick={resetAll}
            >
              Filtreleri Sıfırla
            </Button>
          </div>
        ) : layout === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {videos.map(video => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {videos.map(video => (
              <div
                key={video.id}
                className="flex gap-3 bg-[#161616] border border-[#1e1e1e] rounded-xl p-2.5 sm:p-3 hover:border-[#2a2a2a] transition-colors"
              >
                <div className="w-24 sm:w-36 md:w-44 shrink-0">
                  <VideoCard video={video} />
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="font-semibold text-white text-xs sm:text-sm line-clamp-2 leading-snug">
                    {video.title}
                  </p>
                  <p className="text-[10px] sm:text-xs text-[#666] mt-1">
                    {(video as any).creator?.displayName || (video as any).creator?.username}
                  </p>
                  <div className="flex items-center gap-2 sm:gap-3 mt-1.5 text-[10px] sm:text-xs text-[#555]">
                    <span className="flex items-center gap-0.5 sm:gap-1">
                      <Eye className="h-3 w-3" />
                      {(video.viewCount || 0).toLocaleString("tr")}
                    </span>
                    <span className="flex items-center gap-0.5 sm:gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {(video.likeCount || 0).toLocaleString("tr")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && videos.length > 0 && (
          <div className="flex items-center justify-center pt-2 pb-4">
            <p className="text-xs text-[#444]">
              {videos.length} video — {activeSort.label} sıralamasıyla
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
