import { useEffect, useState, useCallback } from "react";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup,
} from "react-simple-maps";
import { useAuth } from "@/lib/auth";
import {
  Users, Globe, TrendingUp, RefreshCw, Wifi, MapPin, X,
  Eye, Heart, MessageSquare, Flame, BarChart3, Film,
  PlayCircle, Clock, Activity,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, Legend, BarChart, Bar,
} from "recharts";
import { cn } from "@/lib/utils";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Visitor {
  id: string; lat: number; lng: number;
  country: string; city: string; page: string; lastSeen: number;
}
interface VisitorData {
  total: number; uniqueSessions: number; mode: "live" | "historical";
  visitors: Visitor[];
  topCountries: { country: string; count: number }[];
  topPages: { page: string; count: number }[];
}
interface ChartPoint { time: string; visits: number; unique: number; label?: string; }
interface ChartData { bucket: "minute"|"hour"|"day"|"week"|"month"; period: string; points: ChartPoint[]; }

interface VideoCard {
  id: number; title: string; thumbnailUrl: string | null; type: string;
  viewCount: number; likeCount: number; commentCount: number;
  creator: string | null; createdAt: string;
  viewers24h?: number; periodViews?: number; periodLikes?: number;
}
interface CategoryRow { category: string; videoCount: number; totalViews: number; }
interface Summary {
  totalVideos: number; totalViews: number; totalLikes: number; totalComments: number;
  periodViews: number; periodLikes: number; periodNewVideos: number;
}
interface AnalyticsData {
  period: string; summary: Summary;
  topByViews: VideoCard[]; topByLikes: VideoCard[]; topByComments: VideoCard[];
  topByViewsPeriod: VideoCard[]; topByLikesPeriod: VideoCard[];
  trending: VideoCard[]; activeNow: VideoCard[]; categoryBreakdown: CategoryRow[];
}
interface TrendPoint { time: string; views: number; uniqueViewers: number; likes: number; }
interface TrendData { bucket: "minute"|"hour"|"day"|"week"|"month"; period: string; points: TrendPoint[]; }

// ── Constants ──────────────────────────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  TR: "Türkiye", US: "ABD", GB: "Birleşik Krallık", DE: "Almanya",
  FR: "Fransa", JP: "Japonya", BR: "Brezilya", RU: "Rusya",
  AU: "Avustralya", IN: "Hindistan", CA: "Kanada", ES: "İspanya",
  IT: "İtalya", NL: "Hollanda", AE: "BAE", SG: "Singapur", MX: "Meksika",
};

const PAGE_LABELS: Record<string, string> = {
  "/": "Ana Sayfa", "/videos": "Videolar", "/shorts": "Shorts",
  "/login": "Giriş", "/register": "Kayıt", "/pricing": "Fiyatlar",
  "/admin": "Admin", "/downloads": "İndirilenler",
};

const PERIODS = [
  { value: "5min", label: "Canlı",  sublabel: "Son 5 dk",   live: true,  accent: "#22c55e" },
  { value: "1h",   label: "Saat",   sublabel: "Son 1 saat", live: false, accent: "#3b82f6" },
  { value: "24h",  label: "Gün",    sublabel: "Son 24 sa",  live: false, accent: "#06b6d4" },
  { value: "7d",   label: "Hafta",  sublabel: "Son 7 gün",  live: false, accent: "#a78bfa" },
  { value: "30d",  label: "Ay",     sublabel: "Son 30 gün", live: false, accent: "#f59e0b" },
  { value: "1y",   label: "Yıl",    sublabel: "Son 365 gün",live: false, accent: "#f97316" },
  { value: "all",  label: "Tümü",   sublabel: "Tüm zamanlar",live:false, accent: "#ec4899" },
];

const BAR_COLORS = [
  "#a855f7","#6366f1","#3b82f6","#06b6d4","#10b981",
  "#f59e0b","#f97316","#ef4444","#ec4899","#8b5cf6",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPage(page: string) {
  if (PAGE_LABELS[page]) return PAGE_LABELS[page];
  if (page.startsWith("/videos/")) return "Video İzleme";
  if (page.startsWith("/creator/")) return "Creator";
  if (page.startsWith("/categories/")) return "Kategori";
  return page;
}

function formatRelativeTime(ts: number) {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
  return `${Math.floor(diff / 86400)}g`;
}

function formatChartLabel(time: string, bucket: ChartData["bucket"]) {
  const d = new Date(time);
  if (bucket === "minute") return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bucket === "hour")   return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bucket === "day")    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  if (bucket === "week")   return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  return d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
}

function formatTrendLabel(time: string, bucket: TrendData["bucket"]) {
  const d = new Date(time);
  if (bucket === "minute") return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bucket === "hour")   return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bucket === "day")    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  if (bucket === "week")   return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  return d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
}

// ── Map dot ────────────────────────────────────────────────────────────────────

function MapDot({ lat, lng, isNew, isHistorical }: { lat: number; lng: number; isNew: boolean; isHistorical: boolean }) {
  return (
    <Marker coordinates={[lng, lat]}>
      <g>
        <circle
          r={isNew ? 7 : isHistorical ? 3.5 : 4.5}
          fill={isNew ? "#fbbf24" : isHistorical ? "#a78bfa" : "#ef4444"}
          fillOpacity={isHistorical ? 0.75 : 0.95}
          stroke="white" strokeWidth={0.8}
          style={{ animation: isNew ? "mapPulse 2s ease-out infinite" : undefined }}
        />
        {isNew && (
          <circle r={11} fill="transparent" stroke="#fbbf24" strokeWidth={1.2} strokeOpacity={0.5}
            style={{ animation: "mapRipple 2s ease-out infinite" }} />
        )}
      </g>
    </Marker>
  );
}

// ── Period selector ────────────────────────────────────────────────────────────

function PeriodTabs({ period, onChange }: { period: string; onChange: (v: string) => void }) {
  const active = PERIODS.find(p => p.value === period) ?? PERIODS[0];
  return (
    <div className="flex items-center gap-1 bg-[#141414] border border-[#252525] rounded-xl p-1">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          style={{ touchAction: "manipulation" }}
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
            period === p.value
              ? "text-white shadow-sm"
              : "text-[#555] hover:text-[#888]"
          )}
        >
          {period === p.value && (
            <span
              className="absolute inset-0 rounded-lg"
              style={{ background: `${active.accent}22`, border: `1px solid ${active.accent}44` }}
            />
          )}
          {p.live && (
            <span className={cn("relative w-1.5 h-1.5 rounded-full shrink-0",
              period === p.value ? "bg-green-400 animate-pulse" : "bg-[#333]"
            )} />
          )}
          <span className="relative">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon: Icon }: {
  label: string; value: string | number; sub?: string; accent: string; icon: any;
}) {
  return (
    <div className="bg-[#161616] border border-[#222] rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#555] font-medium">{label}</p>
        <span className="p-1.5 rounded-lg" style={{ background: `${accent}18` }}>
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        </span>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[#3a3a3a]">{sub}</p>}
    </div>
  );
}

// ── Video rank row ─────────────────────────────────────────────────────────────

function VideoRankRow({ video, rank, metric, accent, max }: {
  video: VideoCard; rank: number; metric: number; accent: string; max: number;
}) {
  const pct = max > 0 ? (metric / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#1a1a1a] last:border-0 group">
      <span className={cn(
        "text-xs font-bold w-5 shrink-0 text-center",
        rank === 1 ? "text-amber-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-700" : "text-[#444]"
      )}>{rank}</span>
      {video.thumbnailUrl ? (
        <img src={video.thumbnailUrl} alt="" className="w-11 h-7 object-cover rounded-md bg-[#1a1a1a] shrink-0" />
      ) : (
        <div className="w-11 h-7 rounded-md bg-[#1a1a1a] shrink-0 flex items-center justify-center">
          <Film className="h-3 w-3 text-[#333]" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#ddd] truncate font-medium">{video.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex-1 h-0.5 bg-[#1e1e1e] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: accent }} />
          </div>
        </div>
      </div>
      <span className="text-xs font-bold shrink-0 tabular-nums" style={{ color: accent }}>
        {fmt(metric)}
      </span>
    </div>
  );
}

function VideoRankCard({ title, icon: Icon, accent, videos, metricKey }: {
  title: string; icon: any; accent: string; videos: VideoCard[]; metricKey: keyof VideoCard;
}) {
  const max = videos.length ? Math.max(...videos.map(v => Number(v[metricKey]) || 0)) : 1;
  return (
    <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-3">
        <span className="p-1.5 rounded-lg" style={{ background: `${accent}18` }}>
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {videos.length === 0 ? (
        <div className="py-8 text-center">
          <Film className="h-8 w-8 text-[#2a2a2a] mx-auto mb-2" />
          <p className="text-xs text-[#444]">Bu dönemde veri yok</p>
        </div>
      ) : (
        <div>
          {videos.slice(0, 10).map((v, i) => (
            <VideoRankRow key={v.id} video={v} rank={i + 1}
              metric={Number(v[metricKey]) || 0} accent={accent} max={max} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chart tooltips ─────────────────────────────────────────────────────────────

function VisitorTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 shadow-xl text-xs space-y-1.5">
      <p className="text-[#666] mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-violet-500" />
        <span className="text-[#888]">Toplam:</span>
        <span className="font-bold text-white">{payload.find((p: any) => p.dataKey === "visits")?.value ?? 0}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-[#888]">Tekil:</span>
        <span className="font-bold text-white">{payload.find((p: any) => p.dataKey === "unique")?.value ?? 0}</span>
      </div>
    </div>
  );
}

function VideoTrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 shadow-xl text-xs space-y-1.5">
      <p className="text-[#666] mb-1">{label}</p>
      {[
        { key: "views", label: "İzlenme", color: "#a855f7" },
        { key: "uniqueViewers", label: "Tekil İzleyici", color: "#22d3ee" },
        { key: "likes", label: "Beğeni", color: "#f43f5e" },
      ].map(({ key, label: l, color }) => (
        <div key={key} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-[#888]">{l}:</span>
          <span className="font-bold text-white">{payload.find((p: any) => p.dataKey === key)?.value ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

// ── Skeleton loader ────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-[#1e1e1e] rounded-xl", className)} />;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminVisitorMap() {
  const { user } = useAuth();
  const [data, setData] = useState<VisitorData | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIds = useState<Set<string>>(new Set())[0];
  const [period, setPeriod] = useState("5min");
  const [countryFilter, setCountryFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"visitors"|"videos">("visitors");
  const token = localStorage.getItem("token") ?? "";

  const isLive = period === "5min";
  const activePeriod = PERIODS.find(p => p.value === period) ?? PERIODS[0];

  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams({ period });
      if (countryFilter) params.set("country", countryFilter);

      const [visRes, chartRes, analyticsRes, trendRes] = await Promise.all([
        fetch(`/api/admin/visitors?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/visitors/chart?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/video-analytics?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/analytics/video-trends?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (visRes.ok) {
        const json: VisitorData = await visRes.json();
        if (isLive) {
          const incoming = new Set(json.visitors.map(v => v.id));
          const fresh = new Set([...incoming].filter(id => !prevIds.has(id)));
          setNewIds(fresh);
          for (const id of incoming) prevIds.add(id);
          for (const id of [...prevIds].filter(id => !incoming.has(id))) prevIds.delete(id);
          setTimeout(() => setNewIds(new Set()), 3000);
        } else {
          setNewIds(new Set());
        }
        setData(json);
      }
      if (chartRes.ok) setChartData(await chartRes.json());
      if (analyticsRes.ok) setAnalyticsData(await analyticsRes.json());
      if (trendRes.ok) setTrendData(await trendRes.json());
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [token, period, countryFilter, isLive]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
    if (isLive) {
      const t = setInterval(fetchAll, 8000);
      return () => clearInterval(t);
    }
  }, [fetchAll, isLive]);

  const handlePeriodChange = (v: string) => {
    setPeriod(v);
    setCountryFilter("");
    setLoading(true);
  };

  const chartPoints = (chartData?.points ?? []).map(p => ({
    ...p,
    label: formatChartLabel(p.time, chartData?.bucket ?? "hour"),
  }));
  const trendPoints = (trendData?.points ?? []).map(p => ({
    ...p,
    label: formatTrendLabel(p.time, trendData?.bucket ?? "hour"),
  }));

  const usePeriodRankings = period !== "all";
  const topViewVideos  = usePeriodRankings ? (analyticsData?.topByViewsPeriod ?? []) : (analyticsData?.topByViews ?? []);
  const topLikeVideos  = usePeriodRankings ? (analyticsData?.topByLikesPeriod ?? []) : (analyticsData?.topByLikes ?? []);
  const s = analyticsData?.summary;

  const bucketLabel = chartData?.bucket === "minute" ? "Dakika bazlı"
    : chartData?.bucket === "hour" ? "Saatlik"
    : chartData?.bucket === "day" ? "Günlük"
    : chartData?.bucket === "week" ? "Haftalık" : "Aylık";

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes mapPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.7} }
        @keyframes mapRipple { 0%{r:7;opacity:0.7} 100%{r:20;opacity:0} }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-primary" />
            Analitik Merkezi
          </h2>
          <p className="text-sm text-[#555] mt-1">
            {isLive
              ? <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  Canlı — son 5 dakikadaki aktif ziyaretçiler
                </span>
              : `${activePeriod.sublabel} · ${new Date().toLocaleDateString("tr-TR")}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {countryFilter && (
            <button onClick={() => setCountryFilter("")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 border border-primary/25 text-xs font-medium text-primary"
              style={{ touchAction: "manipulation" }}>
              <Globe className="h-3 w-3" />
              {COUNTRY_NAMES[countryFilter] ?? countryFilter}
              <X className="h-3 w-3" />
            </button>
          )}
          <button onClick={() => { setLoading(true); fetchAll(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] text-xs text-[#666] hover:text-white transition-colors"
            style={{ touchAction: "manipulation" }}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Yenile
          </button>
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-[#444]">
            <Clock className="h-3 w-3" />
            {lastRefresh.toLocaleTimeString("tr-TR")}
          </span>
        </div>
      </div>

      {/* ── Period selector ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto pb-1">
        <PeriodTabs period={period} onChange={handlePeriodChange} />
      </div>

      {/* ── Top KPI row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={isLive ? "Aktif Ziyaretçi" : "Toplam Ziyaret"}
          value={loading ? "…" : fmt(data?.total ?? 0)}
          sub={activePeriod.sublabel}
          accent="#a855f7"
          icon={Users}
        />
        <StatCard
          label="Tekil Oturum"
          value={loading ? "…" : fmt(data?.uniqueSessions ?? 0)}
          sub="benzersiz session"
          accent="#06b6d4"
          icon={Wifi}
        />
        <StatCard
          label="Ülke / Bölge"
          value={loading ? "…" : fmt(data?.topCountries.length ?? 0)}
          sub="aktif ülke"
          accent="#f59e0b"
          icon={Globe}
        />
        <StatCard
          label={`${activePeriod.sublabel} İzlenme`}
          value={loading ? "…" : fmt(s?.periodViews ?? 0)}
          sub={`toplam: ${fmt(s?.totalViews ?? 0)}`}
          accent="#f43f5e"
          icon={Eye}
        />
      </div>

      {/* ── Main content tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[#1e1e1e]">
        {[
          { id: "visitors" as const, label: "Ziyaretçi Haritası", icon: Globe },
          { id: "videos"   as const, label: "Video Dashboard",    icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === id
                ? "border-primary text-white"
                : "border-transparent text-[#555] hover:text-[#888]"
            )}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ══ VISITOR MAP TAB ════════════════════════════════════════════════ */}
      {activeTab === "visitors" && (
        <div className="space-y-5">

          {/* Map + sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Map */}
            <div className="lg:col-span-2 bg-[#0a0e1a] border border-[#1a2030] rounded-2xl overflow-hidden"
              style={{ minHeight: 380 }}>
              <div className="relative">
                <ComposableMap
                  projectionConfig={{ scale: 145, center: [20, 8] }}
                  style={{ width: "100%", height: "100%" }}
                >
                  <ZoomableGroup zoom={1} minZoom={1} maxZoom={5}>
                    <Geographies geography={GEO_URL}>
                      {({ geographies }) =>
                        geographies.map(geo => (
                          <Geography key={geo.rsmKey} geography={geo}
                            fill="#111927" stroke="#1a2535" strokeWidth={0.4}
                            style={{ default: { outline: "none" }, hover: { fill: "#162030", outline: "none" }, pressed: { outline: "none" } }}
                          />
                        ))
                      }
                    </Geographies>
                    {data?.visitors.map(v => (
                      <MapDot key={v.id} lat={v.lat} lng={v.lng}
                        isNew={newIds.has(v.id)} isHistorical={!isLive} />
                    ))}
                  </ZoomableGroup>
                </ComposableMap>
              </div>

              {/* Legend + count */}
              <div className="flex items-center gap-4 px-4 py-3 border-t border-[#151e2b]">
                {isLive ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-[#555]">
                      <div className="w-3 h-3 rounded-full bg-red-500" /> Aktif
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#555]">
                      <div className="w-3 h-3 rounded-full bg-amber-400" /> Yeni gelen
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-[#555]">
                    <div className="w-3 h-3 rounded-full bg-violet-400" /> Ziyaretçi konumu
                  </div>
                )}
                <span className="ml-auto text-xs text-[#333]">{data?.visitors.length ?? 0} nokta</span>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-3">

              {/* Top countries */}
              <div className="bg-[#161616] border border-[#222] rounded-2xl p-4">
                <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" /> En Fazla Ziyaret — Ülke
                </h3>
                {(!data || data.topCountries.length === 0) ? (
                  <p className="text-xs text-[#444] py-2">Henüz ziyaretçi yok</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.topCountries.map(({ country, count }, i) => {
                      const total = data.topCountries.reduce((s, c) => s + c.count, 0) || 1;
                      const pct = (count / total) * 100;
                      const isActive = countryFilter === country;
                      return (
                        <button key={country} onClick={() => setCountryFilter(isActive ? "" : country)}
                          style={{ touchAction: "manipulation" }}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-xl px-2 py-1 transition-colors text-left",
                            isActive ? "bg-primary/10" : "hover:bg-[#1e1e1e]"
                          )}>
                          <span className="text-[10px] text-[#444] w-4 shrink-0 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={cn("text-xs truncate", isActive ? "text-primary font-medium" : "text-[#bbb]")}>
                                {COUNTRY_NAMES[country] ?? country}
                              </span>
                              <span className="text-xs font-bold text-white ml-2 tabular-nums">{count}</span>
                            </div>
                            <div className="h-1 bg-[#252525] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: isActive ? "#a855f7" : "#6b21a8" }} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top pages */}
              <div className="bg-[#161616] border border-[#222] rounded-2xl p-4">
                <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" /> En Çok Ziyaret Edilen
                </h3>
                {(!data || data.topPages.length === 0) ? (
                  <p className="text-xs text-[#444] py-2">Henüz veri yok</p>
                ) : (
                  <div className="space-y-0.5">
                    {data.topPages.map(({ page, count }) => (
                      <div key={page} className="flex items-center justify-between py-1.5 border-b border-[#1c1c1c] last:border-0">
                        <span className="text-xs text-[#999] truncate max-w-[130px]">{formatPage(page)}</span>
                        <span className="text-xs font-bold text-primary tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent visitors */}
              <div className="bg-[#161616] border border-[#222] rounded-2xl p-4">
                <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Wifi className="h-3.5 w-3.5" />
                  {isLive ? "Anlık Ziyaretçiler" : "Son Ziyaretçiler"}
                </h3>
                {(!data || data.visitors.length === 0) ? (
                  <p className="text-xs text-[#444] py-2">{isLive ? "Aktif ziyaretçi yok" : "Bu dönemde veri yok"}</p>
                ) : (
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {data.visitors.slice(0, 20).map(v => (
                      <div key={v.id} className={cn(
                        "flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors",
                        newIds.has(v.id) ? "bg-amber-900/15 border border-amber-500/15" : "hover:bg-[#1e1e1e]"
                      )}>
                        <MapPin className="h-3 w-3 text-[#444] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[#ccc] truncate">
                            {COUNTRY_NAMES[v.country] ?? v.country}{v.city ? ` · ${v.city}` : ""}
                          </p>
                          <p className="text-[10px] text-[#444] truncate">{formatPage(v.page)}</p>
                        </div>
                        {newIds.has(v.id)
                          ? <span className="text-[10px] text-amber-400 font-bold shrink-0">YENİ</span>
                          : !isLive && v.lastSeen
                            ? <span className="text-[10px] text-[#444] shrink-0">{formatRelativeTime(v.lastSeen)}</span>
                            : null
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Traffic chart */}
          <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Ziyaretçi Trafik Grafiği
                </h3>
                <p className="text-xs text-[#444] mt-0.5">{activePeriod.sublabel} · {bucketLabel}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2">
                  <p className="text-[10px] text-[#444]">Toplam</p>
                  <p className="text-base font-bold text-white tabular-nums">
                    {loading ? "…" : fmt(chartPoints.reduce((s, p) => s + p.visits, 0))}
                  </p>
                </div>
                <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2">
                  <p className="text-[10px] text-[#444]">Tekil</p>
                  <p className="text-base font-bold text-emerald-400 tabular-nums">
                    {loading ? "…" : fmt(chartPoints.reduce((s, p) => s + p.unique, 0))}
                  </p>
                </div>
                <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2">
                  <p className="text-[10px] text-[#444]">Tepe</p>
                  <p className="text-base font-bold text-amber-400 tabular-nums">
                    {loading ? "…" : fmt(chartPoints.length ? Math.max(...chartPoints.map(p => p.visits)) : 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="h-52">
              {loading ? (
                <div className="h-full flex items-center justify-center gap-1.5">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              ) : chartPoints.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#333]">
                  <TrendingUp className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-xs">Bu dönemde trafik verisi yok</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartPoints} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gVis" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gUniq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartTooltip content={<VisitorTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#555", paddingTop: 8 }}
                      formatter={v => v === "visits" ? "Toplam Ziyaret" : "Tekil Ziyaretçi"} />
                    <Area type="monotone" dataKey="visits" stroke="#a855f7" strokeWidth={2} fill="url(#gVis)" dot={false} activeDot={{ r: 4, fill: "#a855f7" }} />
                    <Area type="monotone" dataKey="unique" stroke="#34d399" strokeWidth={2} fill="url(#gUniq)" dot={false} activeDot={{ r: 4, fill: "#34d399" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ VIDEO DASHBOARD TAB ════════════════════════════════════════════ */}
      {activeTab === "videos" && (
        <div className="space-y-5">

          {/* Video KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label={`${activePeriod.sublabel} İzlenme`}   value={loading ? "…" : fmt(s?.periodViews    ?? 0)} sub={`toplam: ${fmt(s?.totalViews    ?? 0)}`} accent="#a855f7" icon={Eye} />
            <StatCard label={`${activePeriod.sublabel} Beğeni`}    value={loading ? "…" : fmt(s?.periodLikes    ?? 0)} sub={`toplam: ${fmt(s?.totalLikes    ?? 0)}`} accent="#f43f5e" icon={Heart} />
            <StatCard label="Toplam Yorum"                         value={loading ? "…" : fmt(s?.totalComments  ?? 0)} sub="tüm zamanlar"                             accent="#06b6d4" icon={MessageSquare} />
            <StatCard label={`${activePeriod.sublabel} Yeni Video`} value={loading ? "…" : fmt(s?.periodNewVideos ?? 0)} sub={`toplam: ${fmt(s?.totalVideos  ?? 0)}`} accent="#f59e0b" icon={Film} />
          </div>

          {/* Trend chart */}
          <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  İzlenme ve Beğeni Trendi
                </h3>
                <p className="text-xs text-[#444] mt-0.5">{activePeriod.sublabel}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2">
                  <p className="text-[10px] text-[#444]">İzlenme</p>
                  <p className="text-base font-bold text-violet-400 tabular-nums">
                    {loading ? "…" : fmt(trendPoints.reduce((s, p) => s + p.views, 0))}
                  </p>
                </div>
                <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2">
                  <p className="text-[10px] text-[#444]">Tekil</p>
                  <p className="text-base font-bold text-cyan-400 tabular-nums">
                    {loading ? "…" : fmt(trendPoints.reduce((s, p) => s + p.uniqueViewers, 0))}
                  </p>
                </div>
                <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2">
                  <p className="text-[10px] text-[#444]">Beğeni</p>
                  <p className="text-base font-bold text-rose-400 tabular-nums">
                    {loading ? "…" : fmt(trendPoints.reduce((s, p) => s + p.likes, 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="h-56">
              {loading ? (
                <div className="h-full flex items-center justify-center gap-1.5">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              ) : trendPoints.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#333]">
                  <BarChart3 className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-xs">Bu dönemde izlenme verisi yok</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendPoints} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gvViews"  x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gvLikes"  x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gvUnique" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartTooltip content={<VideoTrendTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#555", paddingTop: 8 }}
                      formatter={v => v === "views" ? "İzlenme" : v === "uniqueViewers" ? "Tekil İzleyici" : "Beğeni"} />
                    <Area type="monotone" dataKey="views"         stroke="#a855f7" strokeWidth={2} fill="url(#gvViews)"  dot={false} activeDot={{ r: 4, fill: "#a855f7" }} />
                    <Area type="monotone" dataKey="uniqueViewers" stroke="#22d3ee" strokeWidth={1.5} fill="url(#gvUnique)" dot={false} activeDot={{ r: 3, fill: "#22d3ee" }} />
                    <Area type="monotone" dataKey="likes"         stroke="#f43f5e" strokeWidth={2} fill="url(#gvLikes)"  dot={false} activeDot={{ r: 4, fill: "#f43f5e" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top 3 ranking cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <VideoRankCard
              title="En Çok İzlenen"
              icon={Eye}
              accent="#a855f7"
              videos={topViewVideos}
              metricKey={usePeriodRankings ? "periodViews" : "viewCount"}
            />
            <VideoRankCard
              title="En Çok Beğenilen"
              icon={Heart}
              accent="#f43f5e"
              videos={topLikeVideos}
              metricKey={usePeriodRankings ? "periodLikes" : "likeCount"}
            />
            <VideoRankCard
              title="En Çok Yorum Alan"
              icon={MessageSquare}
              accent="#06b6d4"
              videos={analyticsData?.topByComments ?? []}
              metricKey="commentCount"
            />
          </div>

          {/* Trending + Active now */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VideoRankCard
              title="Trend Videolar — Son 30 Gün"
              icon={Flame}
              accent="#f97316"
              videos={analyticsData?.trending ?? []}
              metricKey="viewCount"
            />
            <VideoRankCard
              title="Şu An İzlenenler — Son 24 Saat"
              icon={PlayCircle}
              accent="#10b981"
              videos={analyticsData?.activeNow ?? []}
              metricKey="viewers24h"
            />
          </div>

          {/* Category breakdown */}
          {(analyticsData?.categoryBreakdown ?? []).length > 0 && (
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Kategori Dağılımı — Görüntülenme
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analyticsData!.categoryBreakdown.slice(0, 10).map((r, i) => ({
                      name: r.category?.length > 12 ? r.category.slice(0, 12) + "…" : r.category,
                      fullName: r.category,
                      views: r.totalViews,
                      videos: r.videoCount,
                      fill: BAR_COLORS[i % BAR_COLORS.length],
                    }))}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#444", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#444", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <RechartTooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-xs shadow-xl">
                          <p className="text-white font-medium mb-1">{d.fullName}</p>
                          <p className="text-[#888]">Görüntülenme: <span className="text-white font-bold">{fmt(d.views)}</span></p>
                          <p className="text-[#888]">Video sayısı: <span className="text-white font-bold">{d.videos}</span></p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                      {analyticsData!.categoryBreakdown.slice(0, 10).map((_, i) => (
                        <rect key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {analyticsData!.categoryBreakdown.slice(0, 10).map((r, i) => (
                  <div key={r.category} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                    <span className="text-[11px] text-[#888] flex-1 truncate">{r.category}</span>
                    <span className="text-[11px] font-bold text-white tabular-nums">{fmt(r.totalViews)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
