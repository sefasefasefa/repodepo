import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListVideos,
} from "@workspace/api-client-react";
import { VideoCard } from "@/components/video/video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Flame, Eye, Clock, ThumbsUp, Crown, Star,
  ChevronRight, Play, Users,
  Sparkles, TrendingUp, BarChart2, SlidersHorizontal,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { StoriesLiveBar } from "@/components/live/stories-live-bar";
import { useFeatureState } from "@/lib/feature-flags";
import type { Video, Category } from "@workspace/api-client-react";
import { JsonLd } from "@/components/json-ld";
import { usePublicSiteSettings } from "@/lib/use-public-site-settings";
import { getHomeDataFromInit, getInitDataSync } from "@/lib/init-prefetch";

function SectionSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-video w-full rounded-lg" />
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

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  href,
  iconColor = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  href?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <Icon className={cn("h-5 w-5", iconColor)} />
        <div>
          <h2 className="text-base md:text-lg font-bold text-white leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-[#888] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {href && (
        <Link href={href}>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#888] hover:text-white text-xs gap-1 px-2"
          >
            Tümünü Gör <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      )}
    </div>
  );
}

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

function CreatorCard({ creator }: { creator: any }) {
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  return (
    <Link href={`/creators/${creator.id}`}>
      <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] hover:border-primary/50 hover:bg-[#252525] transition-all cursor-pointer group">
        <div className="relative">
          <Avatar className="h-16 w-16 border-2 border-[#333] group-hover:border-primary/50 transition-colors">
            <AvatarImage src={creator.avatarUrl || ""} alt={creator.username} />
            <AvatarFallback className="bg-[#333] text-white text-lg font-bold">
              {(creator.displayName || creator.username).substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {creator.isVerified && (
            <div className="absolute -bottom-1 -right-1 bg-primary rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#1e1e1e]">
              <span className="text-[9px] text-white font-bold">✓</span>
            </div>
          )}
        </div>
        <div className="text-center min-w-0 w-full">
          <p className="text-xs font-semibold text-white truncate leading-tight">
            {creator.displayName || creator.username}
          </p>
          <p className="text-[11px] text-[#888] mt-0.5">
            {formatNumber(creator.followerCount)} takipçi
          </p>
        </div>
        <Button
          size="sm"
          className="h-7 text-xs w-full bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/40 transition-all"
        >
          Takip Et
        </Button>
      </div>
    </Link>
  );
}

function CategoryCard({ category }: { category: Category }) {
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
  const colorIdx = (category.id % colors.length);

  return (
    <Link href={`/categories/${category.id}`}>
      <div className={cn(
        "relative overflow-hidden rounded-xl aspect-video cursor-pointer group bg-gradient-to-br",
        colors[colorIdx]
      )}>
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
          <p className="font-bold text-white text-sm md:text-base text-center leading-tight drop-shadow">
            {category.name}
          </p>
          <p className="text-white/80 text-xs mt-1">
            {category.videoCount ?? 0} video
          </p>
        </div>
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="h-4 w-4 text-white" fill="white" />
        </div>
      </div>
    </Link>
  );
}

// ── Sana Özel bölümü ──────────────────────────────────────────────────────
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
    }).finally(() => setLoading(false));
  }, [user, token]);

  if (!user) return null;

  const fmtTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}s ${m}d` : `${m}d`;
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base md:text-lg font-bold text-white leading-tight">Sana Özel</h2>
            <p className="text-xs text-[#888] mt-0.5">İzleme geçmişine göre kişiselleştirildi</p>
          </div>
        </div>
        {profile && (
          <button
            onClick={() => setShowProfile(p => !p)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#aaa] hover:text-white transition-all"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Zevk Profilim
          </button>
        )}
      </div>

      {/* Zevk profili paneli */}
      {showProfile && profile && (
        <div className="mb-4 bg-[#111] border border-[#222] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* İstatistikler */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <p className="text-[11px] font-bold text-[#555] uppercase tracking-widest">Son 30 Gün</p>
            <div className="space-y-2">
              {[
                { label: "İzlenen Video", value: profile.stats.videosWatched },
                { label: "Toplam Süre",   value: fmtTime(profile.stats.totalWatchTime) },
                { label: "Ort. Tamamlama", value: `%${profile.stats.avgCompletion}` },
                { label: "Beğeni",        value: profile.stats.totalLikes },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-[#666]">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top kategoriler */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-[#555] uppercase tracking-widest">Favori Kategoriler</p>
            {profile.topCategories.length === 0 ? (
              <p className="text-xs text-[#555]">Henüz veri yok</p>
            ) : (
              <div className="space-y-1.5">
                {profile.topCategories.slice(0, 4).map((cat: any, i: number) => {
                  const maxTime = profile.topCategories[0]?.totalTime || 1;
                  const pct = Math.round((cat.totalTime / maxTime) * 100);
                  return (
                    <div key={cat.id} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#ccc] truncate">{cat.name}</span>
                        <span className="text-[#555] shrink-0 ml-2">{cat.count}×</span>
                      </div>
                      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%`, opacity: 1 - i * 0.18 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top creator'lar */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-[#555] uppercase tracking-widest">Takip Edilenler</p>
            {profile.topCreators.length === 0 ? (
              <p className="text-xs text-[#555]">Henüz veri yok</p>
            ) : (
              <div className="space-y-2">
                {profile.topCreators.slice(0, 4).map((cre: any) => (
                  <Link key={cre.id} href={`/creators/${cre.id}`}>
                    <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                      <div className="w-6 h-6 rounded-full bg-[#2a2a2a] overflow-hidden shrink-0">
                        {cre.avatarUrl
                          ? <img src={cre.avatarUrl} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-[9px] text-[#888]">
                              {cre.name.substring(0, 2).toUpperCase()}
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

          {/* Öneri kalitesi */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-[#555] uppercase tracking-widest">Öneri Kalitesi</p>
            <div className="space-y-2">
              {[
                { label: "Kategori Eşleşmesi", pct: Math.min(100, (profile.topCategories.length / 5) * 100) },
                { label: "Creator Çeşitliliği",  pct: Math.min(100, (profile.topCreators.length  / 5) * 100) },
                { label: "İzleme Verisi",          pct: Math.min(100, (profile.stats.videosWatched / 10) * 100) },
              ].map(({ label, pct }) => (
                <div key={label} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#888]">{label}</span>
                    <span className="text-[#555]">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#444] mt-1">
              {profile.stats.videosWatched < 5
                ? "Daha fazla video izledikçe öneriler gelişir"
                : "Kişiselleştirme aktif"}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <SectionSkeleton count={4} />
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {videos.map(v => <VideoCard key={v.id} video={v} />)}
        </div>
      ) : (
        <div className="text-center py-8 text-[#555] text-sm">
          Henüz yeterli izleme verisi yok. Birkaç video izledikten sonra kişiselleştirilmiş öneriler görünecek.
        </div>
      )}
    </section>
  );
}

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

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<HomeFilter | null>(null);
  const [homeFilters, setHomeFilters] = useState<HomeFilter[]>([]);
  const { settings } = usePublicSiteSettings();
  const { user, token } = useAuth() as any;

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: settings.siteName,
        item: siteUrl + "/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Ana Sayfa",
        item: siteUrl + "/",
      },
    ],
  };

  const ffVideos = useFeatureState("videos");
  const ffShorts = useFeatureState("shorts");
  const ffCategories = useFeatureState("categories");
  const ffCreators = useFeatureState("creators");
  const ffStories = useFeatureState("stories");
  const ffLive = useFeatureState("live_streams");
  const ffSubscriptions = useFeatureState("subscriptions");

  // ── Tek API isteğiyle tüm anasayfa verisi ───────────────────────────────
  // Senkron başlangıç: __HP_INIT__ veya localStorage cache varsa ilk render'da skeleton yok
  const [homeData, setHomeData] = useState<any>(() => {
    const sync = getInitDataSync();
    if (sync?.homeData && (sync.homeData as any).trending?.length > 0) return sync.homeData;
    return null;
  });
  const [homeLoading, setHomeLoading] = useState(() => {
    const sync = getInitDataSync();
    return !(sync?.homeData && (sync.homeData as any).trending?.length > 0);
  });

  // Senkron veri varsa homeFilters de hemen yükle
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

    // Giriş yapmış kullanıcılar her zaman taze veri çeker
    if (user) {
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      fetch("/api/home", { headers })
        .then(r => r.json())
        .then(applyData)
        .catch(() => setHomeLoading(false));
      return;
    }

    // Senkron veri varsa ek fetch gerekmez
    if (!homeLoading) return;

    // Anonim kullanıcılar için init cache dene, yoksa /api/home çek
    getHomeDataFromInit().then(cached => {
      if (cached && (cached as any).trending?.length > 0) {
        applyData(cached);
        return;
      }
      fetch("/api/home")
        .then(r => r.json())
        .then(applyData)
        .catch(() => setHomeLoading(false));
    });
  }, [user]);

  const trendingData   = homeData ? { videos: homeData.trending }    : undefined;
  const newestData     = homeData ? { videos: homeData.newest }      : undefined;
  const mostViewedData = homeData ? { videos: homeData.most_viewed } : undefined;
  const mostLikedData  = homeData ? { videos: homeData.most_liked }  : undefined;
  const shortData      = homeData ? { videos: homeData.shorts }      : undefined;
  const premiumData    = homeData ? { videos: homeData.premium }     : undefined;
  const categories: Category[] = homeData?.categories ?? [];
  const visibleCategories = categories.filter((c: Category) => (c.videoCount ?? 0) > 0);
  const creators: any[] = homeData?.creators ?? [];

  const trendingLoading   = homeLoading;
  const newestLoading     = homeLoading;
  const mostViewedLoading = homeLoading;
  const mostLikedLoading  = homeLoading;

  // Kategoriye tıklandığında veya özel filtre seçildiğinde dinamik sorgu
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
    activeFilter ? { sort: filteredSort, limit: 24, ...filterParams } : { sort: "newest", limit: 1 }
  );

  return (
    <AppLayout>
      <JsonLd id="schema-breadcrumb-home" schema={breadcrumbSchema} />

      {/* Instagram-style Stories + Live bar */}
      {(ffStories !== "disabled" || ffLive !== "disabled") && <StoriesLiveBar />}

      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 space-y-10">

        {/* Filtre bar — her zaman görünür, yatay kaydırmalı pill'ler */}
        {ffVideos !== "disabled" && (homeFilters.length > 0 || visibleCategories.length > 0) && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3">
            {/* Tümü */}
            <button
              onClick={() => { setActiveFilter(null); setActiveCategory(null); }}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all border",
                !activeFilter && !activeCategory
                  ? "bg-primary text-white border-primary"
                  : "bg-[#1e1e1e] text-[#ccc] border-[#333] hover:bg-[#2a2a2a] hover:text-white"
              )}
            >
              Tümü
            </button>

            {/* Admin panelinden eklenen özel filtreler */}
            {homeFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  if (activeFilter?.id === f.id) { setActiveFilter(null); setActiveCategory(null); return; }
                  setActiveFilter(f);
                  setActiveCategory(f.type === "category" && f.categoryId ? f.categoryId : null);
                }}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all border flex items-center gap-1.5",
                  activeFilter?.id === f.id
                    ? "bg-primary text-white border-primary"
                    : "bg-[#1e1e1e] text-[#ccc] border-[#333] hover:bg-[#2a2a2a] hover:text-white"
                )}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            ))}

            {/* Kategoriler */}
            {visibleCategories.slice(0, 12).map((cat: Category) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveFilter(null);
                  setActiveCategory(activeCategory === cat.id ? null : cat.id);
                }}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all border",
                  activeCategory === cat.id && !activeFilter
                    ? "bg-primary text-white border-primary"
                    : "bg-[#1e1e1e] text-[#ccc] border-[#333] hover:bg-[#2a2a2a] hover:text-white"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Aktif filtre sonuçları */}
        {activeFilter && ffVideos !== "disabled" && (
          <section>
            <SectionHeader
              icon={SlidersHorizontal}
              title={`${activeFilter.icon} ${activeFilter.label}`}
              subtitle={[
                activeFilter.rules?.min_views ? `Min. ${activeFilter.rules.min_views.toLocaleString()} izlenme` : null,
                activeFilter.rules?.min_likes ? `Min. ${activeFilter.rules.min_likes} beğeni` : null,
                activeFilter.rules?.is_premium ? "Sadece Premium" : null,
              ].filter(Boolean).join(" · ") || "Filtrelenmiş sonuçlar"}
              iconColor="text-primary"
            />
            {filteredLoading ? (
              <SectionSkeleton count={6} />
            ) : filteredData?.videos && filteredData.videos.length > 0 ? (
              <VideoGrid videos={filteredData.videos} />
            ) : (
              <p className="text-[#666] text-sm py-8 text-center">Bu filtreye uygun içerik bulunamadı</p>
            )}
          </section>
        )}

        {/* SANA ÖZEL */}
        {ffVideos !== "disabled" && <ForYouSection />}

        {/* TRENDING */}
        {ffVideos !== "disabled" && (
          <section>
            <SectionHeader
              icon={Flame}
              title="En Trend"
              subtitle="Şu an en çok izlenenler"
              href="/videos?sort=trending"
              iconColor="text-orange-500"
            />
            {trendingLoading ? (
              <SectionSkeleton count={4} />
            ) : trendingData?.videos && trendingData.videos.length > 0 ? (
              <VideoGrid videos={trendingData.videos.slice(0, 8)} />
            ) : (
              <p className="text-[#666] text-sm py-8 text-center">İçerik bulunamadı</p>
            )}
          </section>
        )}

        {/* TOP MODELS */}
        {ffCreators !== "disabled" && creators.length > 0 && (
          <section>
            <SectionHeader
              icon={Star}
              title="Öne Çıkan Modeller"
              subtitle="En popüler içerik oluşturucular"
              href="/creators"
              iconColor="text-yellow-400"
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {creators.slice(0, 8).map((creator: any) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </div>
          </section>
        )}

        {/* MOST VIEWED */}
        {ffVideos !== "disabled" && (
          <section>
            <SectionHeader
              icon={Eye}
              title="En Çok İzlenenler"
              subtitle="Tüm zamanların en popüler videoları"
              href="/videos?sort=most_viewed"
              iconColor="text-blue-400"
            />
            {mostViewedLoading ? (
              <SectionSkeleton count={4} />
            ) : mostViewedData?.videos && mostViewedData.videos.length > 0 ? (
              <VideoGrid videos={mostViewedData.videos.slice(0, 8)} />
            ) : (
              <p className="text-[#666] text-sm py-8 text-center">İçerik bulunamadı</p>
            )}
          </section>
        )}

        {/* CATEGORIES GRID */}
        {ffCategories !== "disabled" && visibleCategories.length > 0 && (
          <section>
            <SectionHeader
              icon={Users}
              title="Kategoriler"
              href="/categories"
              iconColor="text-violet-400"
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 md:gap-3">
              {visibleCategories.slice(0, 12).map((cat: Category) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          </section>
        )}

        {/* SHORTS / KISA VİDEOLAR */}
        {ffShorts !== "disabled" && shortData?.videos && shortData.videos.length > 0 && (
          <section>
            <SectionHeader
              icon={Play}
              title="Kısa Videolar"
              subtitle="Hızlı, eğlenceli, kaydırmaya devam et"
              href="/shorts"
              iconColor="text-pink-400"
            />
            <VideoGrid videos={shortData.videos.slice(0, 8)} compact />
          </section>
        )}

        {/* MOST LIKED */}
        {ffVideos !== "disabled" && (
          <section>
            <SectionHeader
              icon={ThumbsUp}
              title="En Çok Beğenilenler"
              subtitle="Topluluktan en çok beğeni alan videolar"
              href="/videos?sort=most_liked"
              iconColor="text-green-400"
            />
            {mostLikedLoading ? (
              <SectionSkeleton count={4} />
            ) : mostLikedData?.videos && mostLikedData.videos.length > 0 ? (
              <VideoGrid videos={mostLikedData.videos.slice(0, 8)} />
            ) : (
              <p className="text-[#666] text-sm py-8 text-center">İçerik bulunamadı</p>
            )}
          </section>
        )}

        {/* PREMIUM */}
        {ffSubscriptions !== "disabled" && premiumData?.videos && premiumData.videos.length > 0 && (
          <section>
            <SectionHeader
              icon={Crown}
              title="Premium İçerikler"
              subtitle="Özel abonelik gerektiren videolar"
              href="/pricing"
              iconColor="text-yellow-500"
            />
            <VideoGrid videos={premiumData.videos.slice(0, 6)} />
          </section>
        )}

        {/* NEWEST */}
        {ffVideos !== "disabled" && (
          <section>
            <SectionHeader
              icon={Clock}
              title="En Yeni Yüklenenler"
              subtitle="Az önce yüklendi"
              href="/videos?sort=newest"
              iconColor="text-cyan-400"
            />
            {newestLoading ? (
              <SectionSkeleton count={4} />
            ) : newestData?.videos && newestData.videos.length > 0 ? (
              <VideoGrid videos={newestData.videos.slice(0, 8)} />
            ) : (
              <p className="text-[#666] text-sm py-8 text-center">İçerik bulunamadı</p>
            )}
          </section>
        )}

        {/* PER-CATEGORY BEST */}
        {ffVideos !== "disabled" && ffCategories !== "disabled" && visibleCategories.slice(0, 5).map((cat: Category) => (
          <CategorySection key={cat.id} category={cat} />
        ))}

      </div>
    </AppLayout>
  );
}

function CategorySection({ category }: { category: Category }) {
  const { data, isLoading } = useListVideos({
    categoryId: category.id,
    sort: "most_viewed",
    limit: 6,
  });

  const videos = data?.videos ?? [];
  if (!isLoading && videos.length === 0) return null;

  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    gaming: Flame,
    dance: Star,
    comedy: ThumbsUp,
    cooking: Crown,
    travel: Eye,
    music: Play,
    fitness: Users,
    technology: Star,
  };
  const Icon = icons[category.slug] ?? Play;

  return (
    <section>
      <SectionHeader
        icon={Icon}
        title={`${category.name} — En İyiler`}
        subtitle={`${category.name} kategorisinin en çok izlenen videoları`}
        href={`/categories/${category.id}`}
        iconColor="text-primary"
      />
      {isLoading ? (
        <SectionSkeleton count={4} />
      ) : (
        <VideoGrid videos={videos} />
      )}
    </section>
  );
}
