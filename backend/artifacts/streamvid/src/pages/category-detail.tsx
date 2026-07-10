import { AppLayout } from "@/components/layout/app-layout";
import { useParams } from "wouter";
import { useListVideos, useListCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import {
  Grid3x3, ChevronLeft, TrendingUp, Clock, Star, Flame,
  Eye, MessageSquare, Hourglass, Timer, Crown, Gift,
  Video as VideoIcon, Zap, Tag as TagIcon, Grid2x2,
  LayoutList, RotateCcw, X, SlidersHorizontal, ChevronDown,
  Search, Filter, Check,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { id: "newest",         label: "En Yeni",          icon: Clock,          color: "text-cyan-400" },
  { id: "trending",       label: "Trend",            icon: Flame,          color: "text-orange-400" },
  { id: "most_viewed",    label: "En Çok İzlenen",   icon: Eye,            color: "text-blue-400" },
  { id: "most_liked",     label: "En Beğenilen",     icon: Star,           color: "text-yellow-400" },
  { id: "most_commented", label: "Yorumlanan",        icon: MessageSquare,  color: "text-green-400" },
  { id: "longest",        label: "En Uzun",          icon: Hourglass,      color: "text-violet-400" },
  { id: "shortest",       label: "En Kısa",          icon: Timer,          color: "text-pink-400" },
];

const DURATION_FILTERS = [
  { id: "",      label: "Tüm Süreler", emoji: "⏱" },
  { id: "short", label: "< 10 dk",    emoji: "⚡" },
  { id: "mid",   label: "10–30 dk",   emoji: "🕐" },
  { id: "long",  label: "> 30 dk",    emoji: "🎬" },
];

const TYPE_FILTERS = [
  { id: "",      label: "Tümü",  icon: Grid3x3,   desc: "Her şey" },
  { id: "video", label: "Video", icon: VideoIcon,  desc: "Uzun format" },
  { id: "short", label: "Kısa",  icon: Zap,        desc: "< 60 saniye" },
];

const PREMIUM_FILTERS = [
  { id: "",      label: "Tümü",     icon: Grid3x3, accent: "text-white" },
  { id: "false", label: "Ücretsiz", icon: Gift,    accent: "text-emerald-400" },
  { id: "true",  label: "Premium",  icon: Crown,   accent: "text-yellow-400" },
];

async function fetchCategoryTags(categoryId: number): Promise<{ tag: string; count: number }[]> {
  if (!categoryId) return [];
  const res = await fetch(`/api/categories/${categoryId}/tags`);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.tags ?? [];
}

function FilterChip({
  label, active, onClick, icon: Icon, color,
}: {
  label: string; active: boolean; onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{ touchAction: "manipulation" }}
      className={cn(
        "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border shrink-0 select-none",
        active
          ? "bg-primary text-white border-primary shadow-md shadow-primary/25 scale-[1.02]"
          : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:bg-[#222] hover:text-white hover:border-[#333]"
      )}
    >
      {Icon && <Icon className={cn("h-3.5 w-3.5", active ? "text-white" : (color ?? "text-[#666]"))} />}
      {label}
      {active && <Check className="h-3 w-3 ml-0.5 opacity-80" />}
    </button>
  );
}

function ActiveTag({ label, onRemove, color = "primary" }: {
  label: string; onRemove: () => void; color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary:  "bg-primary/15 text-primary border-primary/30",
    cyan:     "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    violet:   "bg-violet-500/15 text-violet-300 border-violet-500/30",
    yellow:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    emerald:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    orange:   "bg-orange-500/15 text-orange-300 border-orange-500/30",
  };
  return (
    <span className={cn(
      "flex items-center gap-1.5 text-xs border px-2.5 py-1 rounded-full font-medium",
      colorMap[color] ?? colorMap.primary
    )}>
      {label}
      <button
        onClick={onRemove}
        style={{ touchAction: "manipulation" }}
        className="hover:opacity-60 transition-opacity ml-0.5"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function CategoryDetail() {
  const params = useParams();
  const slug = params.id || "";

  const [sort, setSort]         = useState("newest");
  const [duration, setDuration] = useState("");
  const [type, setType]         = useState("");
  const [premium, setPremium]   = useState("");
  const [tag, setTag]           = useState("");
  const [page, setPage]         = useState(1);
  const [showAdv, setShowAdv]   = useState(false);
  const [layout, setLayout]     = useState<"grid" | "list">("grid");
  const [tagSearch, setTagSearch] = useState("");
  const advRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPage(1); }, [slug]);

  const { data: rawCategories, isLoading: categoriesLoading } = useListCategories();
  const allCategories: any[] = Array.isArray(rawCategories)
    ? rawCategories
    : (rawCategories as any)?.categories ?? [];
  const category = allCategories.find((c: any) => c.slug === slug);
  const categoryId: number | undefined = category?.id;
  const categoryNotFound = !categoriesLoading && allCategories.length > 0 && !category;

  const { data, isLoading, isFetching } = useListVideos(
    {
      categoryId,
      sort,
      ...(duration ? { duration } : {}),
      ...(type     ? { type }     : {}),
      ...(premium  ? { isPremium: premium === "true" } : {}),
      ...(tag      ? { tag }      : {}),
      page,
      limit: 24,
    } as any,
    { query: { enabled: !!categoryId } } as any,
  );

  const { data: tagData } = useQuery({
    queryKey: ["category-tags", slug],
    queryFn: () => fetchCategoryTags(categoryId ?? 0),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });
  const availableTags = (tagData ?? []).filter(t =>
    !tagSearch || t.tag.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const videos     = (data as any)?.videos ?? (data as any)?.results ?? [];
  const totalCount = (data as any)?.total  ?? (data as any)?.count   ?? 0;
  const limit      = (data as any)?.limit  ?? 24;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const activeSort = SORT_OPTIONS.find(s => s.id === sort) ?? SORT_OPTIONS[0];
  const activeFilterCount = [duration, type, premium, tag].filter(Boolean).length;

  const resetFilters = () => {
    setSort("newest"); setDuration(""); setType(""); setPremium(""); setTag(""); setPage(1);
  };

  return (
    <AppLayout>
      {/* ── Hero kapak ── */}
      {!categoryNotFound && category?.coverImage && (
        <div className="relative h-48 md:h-64 w-full overflow-hidden">
          <img
            src={category.coverImage}
            alt={category.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-black/50 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 md:px-6 pt-4 pb-10 space-y-4">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-xs text-[#555]">
          <Link href="/categories">
            <span className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer font-medium">
              <ChevronLeft className="h-3.5 w-3.5" /> Kategoriler
            </span>
          </Link>
          <span className="text-[#333]">/</span>
          <span className="text-white font-semibold">{category?.name ?? slug}</span>
        </div>

        {/* ── Kategori bulunamadı ── */}
        {categoryNotFound && (
          <div className="text-center py-24 text-[#555]">
            <Grid3x3 className="h-16 w-16 mx-auto opacity-20 mb-4" />
            <p className="font-medium text-lg text-white">Kategori bulunamadı</p>
            <p className="text-sm mt-1">Bu kategori mevcut değil veya kaldırılmış olabilir</p>
            <Link href="/categories">
              <button className="mt-4 px-4 py-2 rounded-xl border border-[#333] text-sm text-[#888] hover:border-primary/50 hover:text-white transition-all">
                Tüm Kategorilere Dön
              </button>
            </Link>
          </div>
        )}

        {!categoryNotFound && (
          <>
            {/* ── Başlık ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              {!category?.coverImage && (
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/20">
                    <Grid3x3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white">{category?.name ?? slug}</h1>
                    <p className="text-xs text-[#555] mt-0.5">
                      {isLoading ? "Yükleniyor…" : `${totalCount.toLocaleString("tr")} video`}
                    </p>
                  </div>
                </div>
              )}
              {category?.coverImage && (
                <div className="mt-1">
                  <h1 className="text-xl md:text-2xl font-bold text-white">{category.name}</h1>
                  <p className="text-xs text-[#555] mt-0.5">
                    {isLoading ? "Yükleniyor…" : `${totalCount.toLocaleString("tr")} video`}
                  </p>
                </div>
              )}

              {/* Layout toggle */}
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => setLayout("grid")}
                    style={{ touchAction: "manipulation" }}
                    className={cn("p-1.5 rounded transition-all", layout === "grid" ? "bg-primary/25 text-primary" : "text-[#555] hover:text-white")}
                  >
                    <Grid2x2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setLayout("list")}
                    style={{ touchAction: "manipulation" }}
                    className={cn("p-1.5 rounded transition-all", layout === "list" ? "bg-primary/25 text-primary" : "text-[#555] hover:text-white")}
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                FİLTRE SİSTEMİ
            ══════════════════════════════════════════════════════════════ */}
            <div className="space-y-2.5">

              {/* ── Satır 1: Sıralama pills + Gelişmiş buton ── */}
              <div className="flex items-center gap-2">
                {/* Sıralama scrollable pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto flex-1 scrollbar-hide pb-0.5">
                  {SORT_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const active = sort === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => { setSort(opt.id); setPage(1); }}
                        style={{ touchAction: "manipulation" }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border shrink-0 select-none",
                          active
                            ? "bg-primary text-white border-primary shadow-md shadow-primary/25"
                            : "bg-[#181818] text-[#666] border-[#252525] hover:bg-[#1e1e1e] hover:text-white hover:border-[#333]"
                        )}
                      >
                        <Icon className={cn("h-3.5 w-3.5", active ? "text-white" : opt.color)} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Gelişmiş Filtreler butonu */}
                <button
                  onClick={() => setShowAdv(v => !v)}
                  style={{ touchAction: "manipulation" }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border shrink-0 select-none",
                    showAdv || activeFilterCount > 0
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-[#181818] text-[#666] border-[#252525] hover:bg-[#1e1e1e] hover:text-white hover:border-[#333]"
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Filtrele</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-primary text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showAdv && "rotate-180")} />
                </button>
              </div>

              {/* ── Aktif filtre etiketleri ── */}
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-[#444] font-medium uppercase tracking-wider">Aktif:</span>
                  {sort !== "newest" && (
                    <ActiveTag
                      label={SORT_OPTIONS.find(s => s.id === sort)?.label ?? sort}
                      onRemove={() => setSort("newest")}
                      color="primary"
                    />
                  )}
                  {duration && (
                    <ActiveTag
                      label={DURATION_FILTERS.find(d => d.id === duration)?.label ?? duration}
                      onRemove={() => setDuration("")}
                      color="cyan"
                    />
                  )}
                  {type && (
                    <ActiveTag
                      label={TYPE_FILTERS.find(t => t.id === type)?.label ?? type}
                      onRemove={() => setType("")}
                      color="violet"
                    />
                  )}
                  {premium && (
                    <ActiveTag
                      label={PREMIUM_FILTERS.find(p => p.id === premium)?.label ?? premium}
                      onRemove={() => setPremium("")}
                      color="yellow"
                    />
                  )}
                  {tag && (
                    <ActiveTag label={`#${tag}`} onRemove={() => setTag("")} color="emerald" />
                  )}
                  <button
                    onClick={resetFilters}
                    style={{ touchAction: "manipulation" }}
                    className="flex items-center gap-1 text-[10px] text-[#444] hover:text-white transition-colors ml-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Sıfırla
                  </button>
                </div>
              )}

              {/* ── Gelişmiş Filtre Paneli ── */}
              <div
                ref={advRef}
                className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  showAdv ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-4 md:p-5 space-y-5">

                  {/* İçerik Türü */}
                  <div>
                    <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-2.5">İçerik Türü</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TYPE_FILTERS.map(t => {
                        const Icon = t.icon;
                        const active = type === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => { setType(t.id); setPage(1); }}
                            style={{ touchAction: "manipulation" }}
                            className={cn(
                              "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all duration-200 select-none",
                              active
                                ? "bg-primary/15 border-primary/40 text-white"
                                : "bg-[#161616] border-[#222] text-[#555] hover:border-[#333] hover:text-[#aaa]"
                            )}
                          >
                            <Icon className={cn("h-4 w-4", active ? "text-primary" : "")} />
                            <span className="text-xs font-semibold">{t.label}</span>
                            <span className="text-[10px] opacity-50">{t.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Süre */}
                  <div>
                    <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-2.5">Video Süresi</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {DURATION_FILTERS.map(d => {
                        const active = duration === d.id;
                        return (
                          <button
                            key={d.id}
                            onClick={() => { setDuration(d.id); setPage(1); }}
                            style={{ touchAction: "manipulation" }}
                            className={cn(
                              "flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs transition-all duration-200 select-none",
                              active
                                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                                : "bg-[#161616] border-[#222] text-[#555] hover:border-[#333] hover:text-[#aaa]"
                            )}
                          >
                            <span className="text-base">{d.emoji}</span>
                            <span className="font-medium leading-tight text-center">{d.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Erişim Seviyesi */}
                  <div>
                    <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-2.5">Erişim Seviyesi</p>
                    <div className="flex gap-2">
                      {PREMIUM_FILTERS.map(p => {
                        const Icon = p.icon;
                        const active = premium === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => { setPremium(p.id); setPage(1); }}
                            style={{ touchAction: "manipulation" }}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 select-none",
                              active
                                ? p.id === "true"
                                  ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-300"
                                  : p.id === "false"
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                    : "bg-primary/15 border-primary/40 text-primary"
                                : "bg-[#161616] border-[#222] text-[#555] hover:border-[#333] hover:text-[#aaa]"
                            )}
                          >
                            <Icon className={cn("h-3.5 w-3.5", active ? p.accent : "")} />
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Popüler Etiketler */}
                  {(tagData ?? []).length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Popüler Etiketler</p>
                        {(tagData ?? []).length > 8 && (
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#444] pointer-events-none" />
                            <input
                              type="text"
                              value={tagSearch}
                              onChange={e => setTagSearch(e.target.value)}
                              placeholder="Etiket ara…"
                              className="bg-[#161616] border border-[#222] rounded-lg pl-7 pr-3 py-1 text-xs text-white placeholder-[#444] focus:outline-none focus:border-primary/40 w-32"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-hide">
                        <button
                          onClick={() => { setTag(""); setPage(1); }}
                          style={{ touchAction: "manipulation" }}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all select-none",
                            tag === ""
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold"
                              : "bg-[#161616] border-[#222] text-[#555] hover:border-[#333] hover:text-[#aaa]"
                          )}
                        >
                          <TagIcon className="h-3 w-3" /> Tümü
                        </button>
                        {availableTags.map(t => (
                          <button
                            key={t.tag}
                            onClick={() => { setTag(prev => prev === t.tag ? "" : t.tag); setPage(1); }}
                            style={{ touchAction: "manipulation" }}
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all select-none",
                              tag === t.tag
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold"
                                : "bg-[#161616] border-[#222] text-[#555] hover:border-[#333] hover:text-[#aaa]"
                            )}
                          >
                            #{t.tag}
                            <span className="opacity-40 text-[10px]">{t.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alt buton satırı */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#1a1a1a]">
                    <button
                      onClick={resetFilters}
                      style={{ touchAction: "manipulation" }}
                      className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Tümünü Sıfırla
                    </button>
                    <button
                      onClick={() => setShowAdv(false)}
                      style={{ touchAction: "manipulation" }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      {isFetching ? "Aranıyor…" : `${totalCount.toLocaleString("tr")} Sonuç Göster`}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Sonuç sayısı + fetching durumu ── */}
            {!isLoading && !categoriesLoading && categoryId && (
              <div className="flex items-center justify-between text-xs text-[#444]">
                <span>
                  {isFetching
                    ? "Yükleniyor…"
                    : `${totalCount.toLocaleString("tr")} video bulundu`}
                  {activeSort && !isFetching && (
                    <span className="ml-1 opacity-60">
                      — {activeSort.label} sıralamasıyla
                    </span>
                  )}
                </span>
                {isFetching && (
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Video Grid / Liste ── */}
            {(isLoading || categoriesLoading || (!categoryId && !categoryNotFound)) ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="aspect-video w-full rounded-xl" />
                    <div className="flex gap-2">
                      <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-3.5 w-[90%]" />
                        <Skeleton className="h-3 w-[60%]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-24 text-[#555]">
                <Grid3x3 className="h-16 w-16 mx-auto opacity-20 mb-4" />
                <p className="font-medium text-lg text-white">Bu kriterlere uyan video yok</p>
                <p className="text-sm mt-2">Farklı bir filtre veya sıralama deneyin</p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="mt-4 px-4 py-2 rounded-xl border border-[#333] text-sm text-[#888] hover:border-primary/50 hover:text-white transition-all"
                  >
                    Filtreleri Sıfırla
                  </button>
                )}
              </div>
            ) : layout === "grid" ? (
              <div className={cn(
                "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 transition-opacity duration-200",
                isFetching && "opacity-60 pointer-events-none"
              )}>
                {videos.map((video: any) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className={cn("space-y-2 transition-opacity duration-200", isFetching && "opacity-60 pointer-events-none")}>
                {videos.map((video: any) => (
                  <div
                    key={video.id}
                    className="flex gap-3 bg-[#111] border border-[#1e1e1e] rounded-2xl p-2.5 hover:border-primary/30 transition-all duration-200 group"
                  >
                    <div className="w-32 sm:w-44 shrink-0">
                      <VideoCard video={video} />
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <p className="font-semibold text-white text-sm line-clamp-2 leading-snug group-hover:text-primary/90 transition-colors">
                        {video.title}
                      </p>
                      <p className="text-xs text-[#555] mt-1.5">
                        {video.creator?.displayName || video.creator?.username}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-[#444]">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />{(video.viewCount || 0).toLocaleString("tr")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />{(video.likeCount || 0).toLocaleString("tr")}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />{(video.commentCount || 0).toLocaleString("tr")}
                        </span>
                      </div>
                      {video.isPremium && (
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-semibold">
                          <Crown className="h-2.5 w-2.5" /> Premium
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Sayfalama ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ touchAction: "manipulation" }}
                  className="px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#181818] text-xs font-semibold text-[#666] hover:border-primary/40 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ← Önceki
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    const p = page <= 4 ? i + 1 : page - 3 + i;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        style={{ touchAction: "manipulation" }}
                        className={cn(
                          "w-9 h-9 rounded-xl text-xs font-bold transition-all",
                          p === page
                            ? "bg-primary text-white shadow-md shadow-primary/30"
                            : "bg-[#181818] border border-[#2a2a2a] text-[#555] hover:border-primary/40 hover:text-white"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ touchAction: "manipulation" }}
                  className="px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#181818] text-xs font-semibold text-[#666] hover:border-primary/40 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Sonraki →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
