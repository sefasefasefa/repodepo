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
  Video, Filter, ChevronDown, Sparkles, Grid2x2, LayoutList,
} from "lucide-react";
import type { Category } from "@workspace/api-client-react";

const SORT_OPTIONS = [
  { value: "newest",     label: "En Yeni",          icon: Clock },
  { value: "most_viewed",label: "En Çok İzlenen",   icon: Eye },
  { value: "most_liked", label: "En Çok Beğenilen", icon: ThumbsUp },
  { value: "trending",   label: "Trend",            icon: Flame },
];

const TYPE_OPTIONS = [
  { value: "",      label: "Tümü" },
  { value: "video", label: "Video" },
  { value: "short", label: "Kısa" },
];

function SortButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
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
              <Skeleton className="h-3.5 w-[90%]" />
              <Skeleton className="h-3 w-[60%]" />
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
  const [showFilters, setShowFilters] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">("grid");

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
    limit: 40,
  });

  const { data: catsData } = useListCategories();
  const categories: Category[] = (catsData as any)?.categories ?? [];
  const visibleCats = categories.filter((c: Category) => (c.videoCount ?? 0) > 0);

  const videos = data?.videos ?? [];

  const activeSort = SORT_OPTIONS.find(s => s.value === sort)!;

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Videolar</h1>
              <p className="text-xs text-[#666] mt-0.5">
                {isLoading ? "Yükleniyor…" : `${videos.length} video`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                "gap-1.5 text-xs h-8 border",
                showFilters
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-[#888] border-[#2a2a2a] hover:text-white"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtrele
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showFilters && "rotate-180")} />
            </Button>
            <div className="flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
              <button
                onClick={() => setLayout("grid")}
                className={cn("p-1.5 rounded transition-all", layout === "grid" ? "bg-[#2a2a2a] text-white" : "text-[#555] hover:text-[#aaa]")}
              >
                <Grid2x2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setLayout("list")}
                className={cn("p-1.5 rounded transition-all", layout === "list" ? "bg-[#2a2a2a] text-white" : "text-[#555] hover:text-[#aaa]")}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sort bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {SORT_OPTIONS.map(opt => (
            <SortButton
              key={opt.value}
              active={sort === opt.value}
              onClick={() => setSort(opt.value)}
              icon={opt.icon}
              label={opt.label}
            />
          ))}
          <div className="h-4 w-px bg-[#2a2a2a] mx-1 shrink-0" />
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                type === opt.value
                  ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                  : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:bg-[#222] hover:text-white"
              )}
            >
              {opt.label}
            </button>
          ))}
          <div className="h-4 w-px bg-[#2a2a2a] mx-1 shrink-0" />
          <button
            onClick={() => setPremium(prev => prev === true ? undefined : true)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
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
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-3">
            <button
              onClick={() => setCategoryId(null)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
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
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
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

        {/* Active filters summary */}
        {(categoryId || type || premium !== undefined) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#555]">Filtreler:</span>
            {categoryId && (
              <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                {visibleCats.find((c: Category) => c.id === categoryId)?.name}
                <button onClick={() => setCategoryId(null)} className="hover:opacity-70">×</button>
              </span>
            )}
            {type && (
              <span className="flex items-center gap-1 text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded-full">
                {TYPE_OPTIONS.find(t => t.value === type)?.label}
                <button onClick={() => setType("")} className="hover:opacity-70">×</button>
              </span>
            )}
            {premium !== undefined && (
              <span className="flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                Premium
                <button onClick={() => setPremium(undefined)} className="hover:opacity-70">×</button>
              </span>
            )}
            <button
              onClick={() => { setCategoryId(null); setType(""); setPremium(undefined); setSort("newest"); }}
              className="text-xs text-[#555] hover:text-white transition-colors"
            >
              Tümünü Sıfırla
            </button>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <VideoGridSkeleton />
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-[#222] bg-[#111]">
            <Sparkles className="h-12 w-12 text-primary mb-4 opacity-60" />
            <p className="text-white font-semibold text-lg">Video bulunamadı</p>
            <p className="text-[#666] text-sm mt-2 max-w-sm">
              Farklı bir sıralama ya da kategori seçmeyi dene.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-[#333] text-[#888] hover:text-white"
              onClick={() => { setCategoryId(null); setType(""); setPremium(undefined); setSort("newest"); }}
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
          <div className="space-y-3">
            {videos.map(video => (
              <div key={video.id} className="flex gap-4 bg-[#161616] border border-[#1e1e1e] rounded-xl p-3 hover:border-[#2a2a2a] transition-colors">
                <div className="w-40 shrink-0">
                  <VideoCard video={video} />
                </div>
                <div className="flex-1 min-w-0 py-1">
                  <p className="font-semibold text-white text-sm line-clamp-2 leading-snug">{video.title}</p>
                  <p className="text-xs text-[#666] mt-1">{(video as any).creator?.displayName || (video as any).creator?.username}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#555]">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{(video.viewCount || 0).toLocaleString("tr")}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{(video.likeCount || 0).toLocaleString("tr")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section heading */}
        {!isLoading && videos.length > 0 && (
          <div className="flex items-center justify-center pt-4 pb-2">
            <p className="text-xs text-[#444]">
              {videos.length} video — {activeSort.label} sıralamasıyla gösteriliyor
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
