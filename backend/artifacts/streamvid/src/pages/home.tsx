import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useListVideos } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video/video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Flame, Eye, Clock, ThumbsUp, Crown, Star,
  ChevronRight, Play, LayoutGrid, Sparkles,
  BarChart2, SlidersHorizontal, Zap,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { StoriesLiveBar } from "@/components/live/stories-live-bar";
import { useFeatureState } from "@/lib/feature-flags";
import type { Video, Category } from "@workspace/api-client-react";
import { JsonLd } from "@/components/json-ld";
import { usePublicSiteSettings } from "@/lib/use-public-site-settings";
import { getHomeDataFromInit, getInitDataSync } from "@/lib/init-prefetch";

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SectionSkeleton({ count = 4, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div className={cn(
      "grid gap-3 md:gap-4",
      compact
        ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <div className="flex gap-2">
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

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  href,
  iconColor = "text-primary",
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  href?: string;
  iconColor?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className={cn("p-1.5 rounded-lg bg-white/5", iconColor.replace("text-", "bg-").replace("-400", "-500/10").replace("-500", "-500/10"))}>
          <Icon className={cn("h-4.5 w-4.5", iconColor)} style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-white leading-tight">{title}</h2>
            {badge && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-[#666] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {href && (
        <Link href={href}>
          <button className="flex items-center gap-1 text-xs text-[#666] hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
            Tümünü Gör <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </Link>
      )}
    </div>
  );
}

// ── Video Grid ─────────────────────────────────────────────────────────────────
function VideoGrid({ videos, compact = false }: { videos: Video[]; compact?: boolean }) {
  return (
    <div className={cn(
      "grid gap-3 md:gap-4",
      compact
        ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
    )}>
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}

// ── Creator Horizontal Scroll Row ──────────────────────────────────────────────
function CreatorRow({ creators }: { creators: any[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  };

  return (
    <div
      ref={scrollRef}
      className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3"
    >
      {creators.map((creator) => (
        <Link key={creator.id} href={`/creators/${creator.id}`}>
          <div className="shrink-0 w-28 flex flex-col items-center gap-2 p-3 rounded-2xl bg-[#1a1a1a] border border-[#252525] hover:border-primary/40 hover:bg-[#1e1e1e] transition-all cursor-pointer group">
            <div className="relative">
              <Avatar className="h-14 w-14 border-2 border-[#2a2a2a] group-hover:border-primary/50 transition-colors">
                <AvatarImage src={creator.avatarUrl || ""} alt={creator.username} />
                <AvatarFallback className="bg-[#2a2a2a] text-white text-base font-bold">
                  {(creator.displayName || creator.username).substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {creator.isVerified && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#1a1a1a]">
                  <span className="text-[9px] text-white font-bold">✓</span>
                </div>
              )}
            </div>
            <div className="text-center w-full min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {creator.displayName || creator.username}
              </p>
              <p className="text-[10px] text-[#666] mt-0.5">
                {formatNumber(creator.followerCount ?? 0)} takipçi
              </p>
            </div>
          </div>
        </Link>
      ))}
      {/* Tümünü gör butonu */}
      <Link href="/creators">
        <div className="shrink-0 w-28 flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-[#1a1a1a] border border-dashed border-[#2a2a2a] hover:border-primary/30 transition-all cursor-pointer h-full min-h-[120px]">
          <div className="w-10 h-10 rounded-full bg-[#222] flex items-center justify-center">
            <ChevronRight className="h-5 w-5 text-[#555]" />
          </div>
          <p className="text-[10px] text-[#555] text-center leading-tight">Tümünü<br />Gör</p>
        </div>
      </Link>
    </div>
  );
}

// ── Category Card ──────────────────────────────────────────────────────────────
function CategoryCard({ category, index }: { category: Category; index: number }) {
  const colors = [
    "from-purple-600 to-pink-600",
    "from-blue-600 to-cyan-500",
    "from-orange-500 to-red-600",
    "from-green-600 to-emerald-500",
    "from-yellow-500 to-orange-500",
    "from-pink-600 to-rose-500",
    "from-indigo-600 to-violet-600",
    "from-teal-600 to-green-500",
    "from-red-600 to-orange-600",
    "from-cyan-600 to-blue-500",
    "from-violet-600 to-purple-500",
    "from-amber-500 to-yellow-400",
  ];
  const colorIdx = index % colors.length;

  return (
    <Link href={`/categories/${category.slug}`}>
      <div className={cn(
        "relative overflow-hidden rounded-xl aspect-video cursor-pointer group bg-gradient-to-br",
        colors[colorIdx]
      )}>
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 gap-1">
          <p className="font-bold text-white text-sm md:text-base text-center leading-tight drop-shadow">
            {category.name}
          </p>
          {(category.videoCount ?? 0) > 0 && (
            <p className="text-white/70 text-[10px] font-medium">
              {category.videoCount} video
            </p>
          )}
        </div>
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="h-4 w-4 text-white" fill="white" />
        </div>
      </div>
    </Link>
  );
}

// ── For You Section (giriş yapanlar için) ─────────────────────────────────────
function ForYouSection() {
  const { user, token } = useAuth() as any;
  const [videos, setVideos] = useState<Video[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    Promise.all([
      fetch("/api/recommendations/for-you?limit=12", { headers }).then(r => r.json()),
      fetch("/api/recommendations/profile", { headers }).then(r => r.json()),
    ]).then(([recData, profileData]) => {
      setVideos(recData.videos ?? []);
      setProfile(profileData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user, token]);

  if (!user) return null;

  const fmtTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
  };

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="h-[1.125rem] w-[1.125rem] text-primary" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-white leading-tight">Sana Özel</h2>
            <p className="text-xs text-[#666] mt-0.5">İzleme geçmişine göre kişiselleştirildi</p>
          </div>
        </div>
        {profile && (
          <button
            onClick={() => setShowProfile(p => !p)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] border border-[#252525] text-[#888] hover:text-white transition-all"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Zevk Profilim
          </button>
        )}
      </div>

      {/* Zevk profili paneli */}
      {showProfile && profile && (
        <div className="mb-5 bg-[#111] border border-[#1e1e1e] rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 md:col-span-1 space-y-3">
            <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Son 30 Gün</p>
            <div className="space-y-2">
              {[
                { label: "İzlenen Video", value: profile.stats?.videosWatched ?? 0 },
                { label: "Toplam Süre", value: fmtTime(profile.stats?.totalWatchTime ?? 0) },
                { label: "Ort. Tamamlama", value: `%${profile.stats?.avgCompletion ?? 0}` },
                { label: "Beğeni", value: profile.stats?.totalLikes ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-[#555]">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Favori Kategoriler</p>
            {(profile.topCategories?.length ?? 0) === 0 ? (
              <p className="text-xs text-[#444]">Henüz veri yok</p>
            ) : (
              <div className="space-y-1.5">
                {profile.topCategories.slice(0, 4).map((cat: any, i: number) => {
                  const maxTime = profile.topCategories[0]?.totalTime || 1;
                  const pct = Math.round((cat.totalTime / maxTime) * 100);
                  return (
                    <div key={cat.id} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#aaa] truncate">{cat.name}</span>
                        <span className="text-[#444] shrink-0 ml-2">{cat.count}×</span>
                      </div>
                      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%`, opacity: 1 - i * 0.18 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Takip Edilenler</p>
            {(profile.topCreators?.length ?? 0) === 0 ? (
              <p className="text-xs text-[#444]">Henüz veri yok</p>
            ) : (
              <div className="space-y-2">
                {profile.topCreators.slice(0, 4).map((cre: any) => (
                  <Link key={cre.id} href={`/creators/${cre.id}`}>
                    <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                      <div className="w-6 h-6 rounded-full bg-[#222] overflow-hidden shrink-0">
                        {cre.avatarUrl
                          ? <img src={cre.avatarUrl} className="w-full h-full object-cover" loading="lazy" alt="" />
                          : <div className="w-full h-full flex items-center justify-center text-[9px] text-[#666]">
                              {(cre.name || "?").substring(0, 2).toUpperCase()}
                            </div>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-white truncate">{cre.name}</p>
                        <p className="text-[10px] text-[#555]">{cre.count} video izlendi</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Öneri Kalitesi</p>
            <div className="space-y-2">
              {[
                { label: "Kategori Eşleşmesi", pct: Math.min(100, ((profile.topCategories?.length ?? 0) / 5) * 100) },
                { label: "Creator Çeşitliliği", pct: Math.min(100, ((profile.topCreators?.length ?? 0) / 5) * 100) },
                { label: "İzleme Verisi", pct: Math.min(100, ((profile.stats?.videosWatched ?? 0) / 10) * 100) },
              ].map(({ label, pct }) => (
                <div key={label} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#666]">{label}</span>
                    <span className="text-[#444]">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#444]">
              {(profile.stats?.videosWatched ?? 0) < 5
                ? "Daha fazla video izledikçe öneriler gelişir"
                : "Kişiselleştirme aktif"}
            </p>
          </div>
        </div>
      )}

      {/* Video grid */}
      {loading ? (
        <SectionSkeleton count={4} />
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {videos.map(v => <VideoCard key={v.id} video={v} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center py-10 text-center gap-2">
          <Sparkles className="h-8 w-8 text-[#333]" />
          <p className="text-[#555] text-sm">Birkaç video izledikten sonra kişiselleştirilmiş öneriler görünecek.</p>
        </div>
      )}
    </section>
  );
}

// ── Per-category best section ──────────────────────────────────────────────────
function CategorySection({ category }: { category: Category }) {
  const { data, isLoading } = useListVideos({ categoryId: category.id, sort: "most_viewed", limit: 6 });
  const videos = data?.videos ?? [];
  if (!isLoading && videos.length === 0) return null;

  return (
    <section>
      <SectionHeader
        icon={Play}
        title={`${category.name}`}
        subtitle={`${category.name} kategorisinin en çok izlenen videoları`}
        href={`/categories/${category.slug}`}
        iconColor="text-primary"
      />
      {isLoading ? <SectionSkeleton count={4} /> : <VideoGrid videos={videos} />}
    </section>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="border-t border-[#1e1e1e]" />;
}

// ── HomeFilter interface ───────────────────────────────────────────────────────
interface HomeFilter {
  id: number;
  label: string;
  icon: string;
  type: string;
  categoryId: number | null;
  sortBy: string | null;
  rules: Record<string, any>;
  order: number;
  isActive: boolean;
}

// ── Main Home Page ─────────────────────────────────────────────────────────────
export default function Home() {
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<HomeFilter | null>(null);
  const [homeFilters, setHomeFilters] = useState<HomeFilter[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const { settings } = usePublicSiteSettings();
  const { user, token } = useAuth() as any;

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: settings.siteName, item: siteUrl + "/" },
      { "@type": "ListItem", position: 2, name: "Ana Sayfa", item: siteUrl + "/" },
    ],
  };

  const ffVideos        = useFeatureState("videos");
  const ffShorts        = useFeatureState("shorts");
  const ffCategories    = useFeatureState("categories");
  const ffCreators      = useFeatureState("creators");
  const ffStories       = useFeatureState("stories");
  const ffLive          = useFeatureState("live_streams");
  const ffSubscriptions = useFeatureState("subscriptions");

  // ── Anasayfa verisi (tek istek) ─────────────────────────────────────────────
  const [homeData, setHomeData] = useState<any>(() => {
    const sync = getInitDataSync();
    if (sync?.homeData && (sync.homeData as any).trending?.length > 0) return sync.homeData;
    return null;
  });
  const [homeLoading, setHomeLoading] = useState(() => {
    const sync = getInitDataSync();
    return !(sync?.homeData && (sync.homeData as any).trending?.length > 0);
  });

  useEffect(() => {
    const sync = getInitDataSync();
    if (sync?.homeData && (sync.homeData as any).home_filters) {
      setHomeFilters((sync.homeData as any).home_filters);
    }
  }, []);

  useEffect(() => {
    const applyData = (d: any) => {
      setHomeData(d);
      if (d.home_filters) setHomeFilters(d.home_filters);
      setHomeLoading(false);
    };
    if (user) {
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      fetch("/api/home", { headers }).then(r => r.json()).then(applyData).catch(() => setHomeLoading(false));
      return;
    }
    if (!homeLoading) return;
    getHomeDataFromInit().then(cached => {
      if (cached && (cached as any).trending?.length > 0) { applyData(cached); return; }
      fetch("/api/home").then(r => r.json()).then(applyData).catch(() => setHomeLoading(false));
    });
  }, [user]);

  // ── Veri dönüşümleri ────────────────────────────────────────────────────────
  const trendingVideos   = homeData?.trending     ?? [];
  const newestVideos     = homeData?.newest       ?? [];
  const mostViewedVideos = homeData?.most_viewed  ?? [];
  const mostLikedVideos  = homeData?.most_liked   ?? [];
  const shortsVideos     = homeData?.shorts       ?? [];
  const premiumVideos    = homeData?.premium      ?? [];
  const categories: Category[] = homeData?.categories ?? [];
  const creators: any[]  = homeData?.creators    ?? [];

  const visibleCategories = [...categories]
    .filter((c: Category) => (c as any).showOnHome !== false)
    .sort((a: any, b: any) => (a.homeOrder ?? 0) - (b.homeOrder ?? 0));

  // Kategori veya filtre seçilince içerik alanına scroll
  // scrollIntoView yerine window.scrollTo kullanıyoruz: navbar (56px) + filtre bar (~52px) yüksekliğini hesaba katıyoruz
  useEffect(() => {
    if ((activeCategory || activeFilter) && contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      const STICKY_OFFSET = 56 + 52; // navbar + filter bar
      const scrollTop = window.scrollY + rect.top - STICKY_OFFSET;
      window.scrollTo({ top: Math.max(0, scrollTop), behavior: "smooth" });
    }
  }, [activeCategory, activeFilter]);

  // Filtre durumu
  const hasActiveSelection = !!activeFilter || !!activeCategory;

  const filterParams = (() => {
    if (!activeFilter) return { categoryId: activeCategory ?? undefined };
    const p: Record<string, any> = {};
    if (activeFilter.categoryId) p.categoryId = activeFilter.categoryId;
    else if (activeCategory) p.categoryId = activeCategory;
    if (activeFilter.rules?.min_views) p.minViews = activeFilter.rules.min_views;
    if (activeFilter.rules?.min_likes) p.minLikes = activeFilter.rules.min_likes;
    if (activeFilter.rules?.is_premium) p.isPremium = true;
    return p;
  })();
  const filteredSort = activeFilter?.sortBy ?? "most_viewed";

  const { data: filteredData, isLoading: filteredLoading } = useListVideos(
    hasActiveSelection ? { sort: filteredSort, limit: 24, ...filterParams } : { sort: "newest", limit: 1 }
  );

  const activeCategoryObj = activeCategory
    ? categories.find((c: Category) => c.id === activeCategory)
    : null;

  // Trending ile örtüşen içerikleri diğer bölümlerden çıkar
  const trendingIds    = new Set(trendingVideos.map((v: Video) => v.id));
  const uniqueMostViewed = mostViewedVideos.filter((v: Video) => !trendingIds.has(v.id));
  const uniqueMostLiked  = mostLikedVideos.filter((v: Video)  => !trendingIds.has(v.id));

  // Most Viewed bölümünü yalnızca gerçekten farklı içerik varsa göster
  const showMostViewed = uniqueMostViewed.length > 0;

  return (
    <AppLayout>
      <JsonLd id="schema-breadcrumb-home" schema={breadcrumbSchema} />

      {/* ── Stories + Live Bar ── */}
      {(ffStories !== "disabled" || ffLive !== "disabled") && <StoriesLiveBar />}

      {/* ── Filtre Bar (sticky pill'ler) ── */}
      {ffVideos !== "disabled" && (homeFilters.length > 0 || visibleCategories.length > 0) && (
        <div className="sticky top-14 z-30 bg-[#111]/90 backdrop-blur-md border-b border-[#1a1a1a]">
          <div className="max-w-[1600px] mx-auto px-3 md:px-6">
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-hide">
              {/* Tümü */}
              <button
                onClick={() => { setActiveFilter(null); setActiveCategory(null); }}
                style={{ touchAction: "manipulation" }}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border",
                  !activeFilter && !activeCategory
                    ? "bg-primary text-white border-primary shadow-sm shadow-primary/30"
                    : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:bg-[#222] hover:text-white"
                )}
              >
                Tümü
              </button>

              {/* Admin panelinden özel filtreler */}
              {homeFilters.map((f) => (
                <button
                  key={f.id}
                  style={{ touchAction: "manipulation" }}
                  onClick={() => {
                    if (f.type === "category" && f.categoryId) {
                      if (activeCategory === f.categoryId && activeFilter === null) { setActiveCategory(null); return; }
                      setActiveCategory(f.categoryId);
                      setActiveFilter(null);
                    } else {
                      if (activeFilter?.id === f.id) { setActiveFilter(null); setActiveCategory(null); return; }
                      setActiveFilter(f);
                      setActiveCategory(null);
                    }
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border flex items-center gap-1.5",
                    activeFilter?.id === f.id
                      ? "bg-primary text-white border-primary shadow-sm shadow-primary/30"
                      : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:bg-[#222] hover:text-white"
                  )}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}

              {/* Kategoriler */}
              {visibleCategories.slice(0, 15).map((cat: Category) => (
                <button
                  key={cat.id}
                  style={{ touchAction: "manipulation" }}
                  onClick={() => {
                    if (activeCategory === cat.id && !activeFilter) { setActiveCategory(null); return; }
                    setActiveCategory(cat.id);
                    setActiveFilter(null);
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border",
                    activeCategory === cat.id && !activeFilter
                      ? "bg-primary text-white border-primary shadow-sm shadow-primary/30"
                      : "bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:bg-[#222] hover:text-white"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Ana İçerik ── */}
      <div ref={contentRef} className="max-w-[1600px] mx-auto px-3 md:px-6 py-6 space-y-10">

        {/* Aktif filtre / kategori sonuçları */}
        {hasActiveSelection && ffVideos !== "disabled" && (
          <section>
            <SectionHeader
              icon={SlidersHorizontal}
              title={
                activeFilter
                  ? `${activeFilter.icon} ${activeFilter.label}`
                  : (activeCategoryObj?.name ?? "Kategori")
              }
              subtitle={
                activeFilter
                  ? ([
                      activeFilter.rules?.min_views ? `Min. ${activeFilter.rules.min_views.toLocaleString()} izlenme` : null,
                      activeFilter.rules?.min_likes  ? `Min. ${activeFilter.rules.min_likes} beğeni` : null,
                      activeFilter.rules?.is_premium ? "Sadece Premium" : null,
                    ].filter(Boolean).join(" · ") || "Filtrelenmiş sonuçlar")
                  : "Kategoriye göre videolar"
              }
              iconColor="text-primary"
              href={
                !activeFilter && activeCategoryObj
                  ? `/categories/${(activeCategoryObj as any).slug}`
                  : undefined
              }
            />
            {filteredLoading ? (
              <SectionSkeleton count={6} />
            ) : filteredData?.videos && filteredData.videos.length > 0 ? (
              <VideoGrid videos={filteredData.videos} />
            ) : (
              <div className="flex flex-col items-center py-12 text-center gap-2">
                <SlidersHorizontal className="h-8 w-8 text-[#333]" />
                <p className="text-[#555] text-sm">Bu filtreye uygun içerik bulunamadı.</p>
              </div>
            )}
          </section>
        )}

        {/* Filtre aktifken ayraç */}
        {hasActiveSelection && <Divider />}

        {/* Ana bölümler — filtre aktif olsa da her zaman göster */}
        <>
            {/* 1. Sana Özel — sadece giriş yapmış kullanıcılar */}
            {ffVideos !== "disabled" && <ForYouSection />}

            {/* 2. En Trend ── */}
            {ffVideos !== "disabled" && (
              <>
                {(user) && <Divider />}
                <section>
                  <SectionHeader
                    icon={Flame}
                    title="En Trend"
                    subtitle="Şu an en çok izlenenler"
                    href="/videos?sort=trending"
                    iconColor="text-orange-400"
                    badge="🔥"
                  />
                  {homeLoading ? (
                    <SectionSkeleton count={4} />
                  ) : trendingVideos.length > 0 ? (
                    <VideoGrid videos={trendingVideos.slice(0, 8)} />
                  ) : (
                    <p className="text-[#555] text-sm py-8 text-center">İçerik bulunamadı</p>
                  )}
                </section>
              </>
            )}

            {/* 3. Öne Çıkan Creator'lar ── */}
            {ffCreators !== "disabled" && creators.length > 0 && (
              <>
                <Divider />
                <section>
                  <SectionHeader
                    icon={Star}
                    title="Öne Çıkan İçerik Üreticileri"
                    subtitle="En popüler creator'lar"
                    href="/creators"
                    iconColor="text-yellow-400"
                  />
                  <CreatorRow creators={creators} />
                </section>
              </>
            )}

            {/* 5. En Çok İzlenenler (trending ile aynı değilse göster) ── */}
            {ffVideos !== "disabled" && showMostViewed && (
              <>
                <Divider />
                <section>
                  <SectionHeader
                    icon={Eye}
                    title="En Çok İzlenenler"
                    subtitle="Tüm zamanların en popüler videoları"
                    href="/videos?sort=most_viewed"
                    iconColor="text-blue-400"
                  />
                  {homeLoading ? (
                    <SectionSkeleton count={4} />
                  ) : (
                    <VideoGrid videos={uniqueMostViewed.slice(0, 8)} />
                  )}
                </section>
              </>
            )}

            {/* 6. Premium İçerikler ── */}
            {ffSubscriptions !== "disabled" && premiumVideos.length > 0 && (
              <>
                <Divider />
                <section>
                  <SectionHeader
                    icon={Crown}
                    title="Premium İçerikler"
                    subtitle="Özel abonelik gerektiren videolar"
                    href="/pricing"
                    iconColor="text-yellow-500"
                    badge="VIP"
                  />
                  <VideoGrid videos={premiumVideos.slice(0, 6)} />
                </section>
              </>
            )}

            {/* 7. Kısa Videolar ── */}
            {ffShorts !== "disabled" && shortsVideos.length > 0 && (
              <>
                <Divider />
                <section>
                  <SectionHeader
                    icon={Zap}
                    title="Kısa Videolar"
                    subtitle="Hızlı, eğlenceli — kaydırmaya devam et"
                    href="/shorts"
                    iconColor="text-pink-400"
                    badge="NEW"
                  />
                  <VideoGrid videos={shortsVideos.slice(0, 8)} compact />
                </section>
              </>
            )}

            {/* 8. En Çok Beğenilenler ── */}
            {ffVideos !== "disabled" && uniqueMostLiked.length > 0 && (
              <>
                <Divider />
                <section>
                  <SectionHeader
                    icon={ThumbsUp}
                    title="En Çok Beğenilenler"
                    subtitle="Topluluktan en çok beğeni alan videolar"
                    href="/videos?sort=most_liked"
                    iconColor="text-green-400"
                  />
                  {homeLoading ? (
                    <SectionSkeleton count={4} />
                  ) : uniqueMostLiked.length > 0 ? (
                    <VideoGrid videos={uniqueMostLiked.slice(0, 8)} />
                  ) : (
                    <p className="text-[#555] text-sm py-8 text-center">İçerik bulunamadı</p>
                  )}
                </section>
              </>
            )}

            {/* 9. En Yeni Yüklenenler ── */}
            {ffVideos !== "disabled" && newestVideos.length > 0 && (
              <>
                <Divider />
                <section>
                  <SectionHeader
                    icon={Clock}
                    title="En Yeni Yüklenenler"
                    subtitle="Az önce yüklendi"
                    href="/videos?sort=newest"
                    iconColor="text-cyan-400"
                    badge="YENİ"
                  />
                  {homeLoading ? (
                    <SectionSkeleton count={4} />
                  ) : newestVideos.length > 0 ? (
                    <VideoGrid videos={newestVideos.slice(0, 8)} />
                  ) : (
                    <p className="text-[#555] text-sm py-8 text-center">İçerik bulunamadı</p>
                  )}
                </section>
              </>
            )}

          </>
      </div>
    </AppLayout>
  );
}
