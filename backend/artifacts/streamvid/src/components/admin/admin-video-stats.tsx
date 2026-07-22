import { useEffect, useState, useCallback } from "react";
import {
  Eye, Heart, MessageSquare, TrendingUp, Film, Flame,
  PlayCircle, BarChart3, RefreshCw, Video,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VideoCard {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  type: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  creator: string | null;
  createdAt: string;
  viewers24h?: number;
  periodViews?: number;
  periodLikes?: number;
}

interface CategoryRow {
  category: string;
  videoCount: number;
  totalViews: number;
}

interface Summary {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  periodViews: number;
  periodLikes: number;
  periodNewVideos: number;
}

interface AnalyticsData {
  period: string;
  summary: Summary;
  topByViews: VideoCard[];
  topByLikes: VideoCard[];
  topByComments: VideoCard[];
  topByViewsPeriod: VideoCard[];
  topByLikesPeriod: VideoCard[];
  trending: VideoCard[];
  activeNow: VideoCard[];
  categoryBreakdown: CategoryRow[];
}

interface TrendPoint {
  time: string;
  views: number;
  uniqueViewers: number;
  likes: number;
}

interface TrendData {
  bucket: "minute" | "hour" | "day" | "week" | "month";
  period: string;
  points: TrendPoint[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBucketLabel(time: string, bucket: TrendData["bucket"]) {
  const d = new Date(time);
  if (bucket === "minute") return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bucket === "hour")   return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bucket === "day")    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  if (bucket === "week")   return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  return d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
}

const PERIOD_LABELS: Record<string, string> = {
  "5min": "Son 5 dk", "1h": "Son 1 saat", "24h": "Son 24 saat",
  "7d": "Son 7 gün", "30d": "Son 30 gün", "3m": "Son 3 ay",
  "6m": "Son 6 ay", "1y": "Son 1 yıl", "all": "Tüm zamanlar",
};

const BAR_COLORS = [
  "#a855f7","#6366f1","#3b82f6","#06b6d4","#10b981",
  "#f59e0b","#f97316","#ef4444","#ec4899","#8b5cf6",
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function VideoRow({
  video, rank, metric, barColor, max,
}: {
  video: VideoCard; rank: number; metric: number; barColor: string; max: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2 group">
      <span className="text-[#555] text-xs font-mono w-5 shrink-0 text-right">{rank}</span>
      {video.thumbnailUrl ? (
        <img src={video.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded bg-[#1a1a1a] shrink-0" />
      ) : (
        <div className="w-12 h-8 rounded bg-[#1a1a1a] shrink-0 flex items-center justify-center">
          <Film className="h-3 w-3 text-[#444]" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#ddd] truncate font-medium">{video.title}</p>
        <p className="text-[10px] text-[#555] truncate">{video.creator ?? "—"}</p>
        <div className="mt-1 h-1 bg-[#252525] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: max > 0 ? `${(metric / max) * 100}%` : "0%", background: barColor }}
          />
        </div>
      </div>
      <span className="text-xs font-bold shrink-0 tabular-nums" style={{ color: barColor }}>
        {fmt(metric)}
      </span>
    </div>
  );
}

function RankCard({
  title, icon: Icon, iconColor, videos, metricKey, barColor,
}: {
  title: string;
  icon: any;
  iconColor: string;
  videos: VideoCard[];
  metricKey: keyof VideoCard;
  barColor: string;
}) {
  const max = videos.length ? Math.max(...videos.map(v => Number(v[metricKey]) || 0)) : 1;
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5">
      <h3 className={cn("text-sm font-semibold text-white flex items-center gap-2 mb-3", iconColor)}>
        <Icon className="h-4 w-4" />
        <span className="text-white">{title}</span>
      </h3>
      {videos.length === 0 ? (
        <p className="text-xs text-[#555] py-6 text-center">Bu dönemde veri yok</p>
      ) : (
        <div className="space-y-1 divide-y divide-[#1c1c1c]">
          {videos.slice(0, 10).map((v, i) => (
            <VideoRow
              key={v.id}
              video={v}
              rank={i + 1}
              metric={Number(v[metricKey]) || 0}
              barColor={barColor}
              max={max}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const views   = payload.find((p: any) => p.dataKey === "views")?.value ?? 0;
  const unique  = payload.find((p: any) => p.dataKey === "uniqueViewers")?.value ?? 0;
  const likes   = payload.find((p: any) => p.dataKey === "likes")?.value ?? 0;
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 shadow-xl text-xs space-y-1.5">
      <p className="text-[#888] mb-1">{label}</p>
      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-violet-500" /><span className="text-[#aaa]">İzlenme:</span><span className="font-bold text-white">{views}</span></div>
      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-400" /><span className="text-[#aaa]">Tekil İzleyici:</span><span className="font-bold text-white">{unique}</span></div>
      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400" /><span className="text-[#aaa]">Beğeni:</span><span className="font-bold text-white">{likes}</span></div>
    </div>
  );
}

function CategoryBarChart({ data }: { data: CategoryRow[] }) {
  if (!data.length) return (
    <div className="h-48 flex items-center justify-center text-[#444] text-xs">Kategori verisi yok</div>
  );
  const points = data.slice(0, 10).map((r, i) => ({
    name: r.category?.length > 12 ? r.category.slice(0, 12) + "…" : r.category,
    fullName: r.category,
    views: r.totalViews,
    videos: r.videoCount,
    fill: BAR_COLORS[i % BAR_COLORS.length],
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={points} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-xs shadow-xl">
                <p className="text-white font-medium mb-1">{d.fullName}</p>
                <p className="text-[#aaa]">Görüntülenme: <span className="text-white font-bold">{fmt(d.views)}</span></p>
                <p className="text-[#aaa]">Video sayısı: <span className="text-white font-bold">{d.videos}</span></p>
              </div>
            );
          }}
        />
        <Bar dataKey="views" radius={[3, 3, 0, 0]}>
          {points.map((p, i) => (
            <rect key={i} fill={p.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  period: string;
}

export default function AdminVideoStats({ period }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token") ?? "";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, trendRes] = await Promise.all([
        fetch(`/api/admin/video-analytics?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/analytics/video-trends?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (analyticsRes.ok) setData(await analyticsRes.json());
      if (trendRes.ok) setTrend(await trendRes.json());
    } finally {
      setLoading(false);
    }
  }, [period, token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const trendPoints = (trend?.points ?? []).map(p => ({
    ...p,
    label: formatBucketLabel(p.time, trend?.bucket ?? "hour"),
  }));

  const usePeriodRankings = period !== "all";
  const topViewVideos = usePeriodRankings
    ? (data?.topByViewsPeriod ?? [])
    : (data?.topByViews ?? []);
  const topLikeVideos = usePeriodRankings
    ? (data?.topByLikesPeriod ?? [])
    : (data?.topByLikes ?? []);

  const s = data?.summary;
  const periodLabel = PERIOD_LABELS[period] ?? period;

  return (
    <div className="space-y-5 pt-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Video Analitiği
          </h2>
          <p className="text-sm text-[#666] mt-0.5">{periodLabel} video performans istatistikleri</p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333] transition-colors text-[#888] hover:text-white"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: `${periodLabel} İzlenme`,
            value: s ? fmt(s.periodViews) : "…",
            sub: `Toplam: ${s ? fmt(s.totalViews) : "…"}`,
            color: "text-violet-400",
            icon: Eye,
          },
          {
            label: `${periodLabel} Beğeni`,
            value: s ? fmt(s.periodLikes) : "…",
            sub: `Toplam: ${s ? fmt(s.totalLikes) : "…"}`,
            color: "text-rose-400",
            icon: Heart,
          },
          {
            label: "Toplam Yorum",
            value: s ? fmt(s.totalComments) : "…",
            sub: "tüm zamanlar",
            color: "text-cyan-400",
            icon: MessageSquare,
          },
          {
            label: `${periodLabel} Yeni Video`,
            value: s ? fmt(s.periodNewVideos) : "…",
            sub: `Toplam: ${s ? fmt(s.totalVideos) : "…"}`,
            color: "text-amber-400",
            icon: Video,
          },
        ].map(({ label, value, sub, color, icon: Icon }) => (
          <div key={label} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn("h-3.5 w-3.5", color)} />
              <p className="text-xs text-[#666]">{label}</p>
            </div>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            <p className="text-[10px] text-[#444] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Video trends chart */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            İzlenme ve Beğeni Trendi
          </h3>
          <p className="text-xs text-[#555] mt-0.5">
            {periodLabel}
            {" · "}
            {trend?.bucket === "minute" ? "Dakika bazlı" : trend?.bucket === "hour" ? "Saatlik" : trend?.bucket === "day" ? "Günlük" : trend?.bucket === "week" ? "Haftalık" : "Aylık"}
          </p>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#161616] border border-[#252525] rounded-xl p-3 text-center">
            <p className="text-[10px] text-[#555] mb-1">Toplam İzlenme</p>
            <p className="text-xl font-bold text-violet-400">
              {loading ? "…" : fmt(trendPoints.reduce((s, p) => s + p.views, 0))}
            </p>
          </div>
          <div className="bg-[#161616] border border-[#252525] rounded-xl p-3 text-center">
            <p className="text-[10px] text-[#555] mb-1">Tekil İzleyici</p>
            <p className="text-xl font-bold text-cyan-400">
              {loading ? "…" : fmt(trendPoints.reduce((s, p) => s + p.uniqueViewers, 0))}
            </p>
          </div>
          <div className="bg-[#161616] border border-[#252525] rounded-xl p-3 text-center">
            <p className="text-[10px] text-[#555] mb-1">Toplam Beğeni</p>
            <p className="text-xl font-bold text-rose-400">
              {loading ? "…" : fmt(trendPoints.reduce((s, p) => s + p.likes, 0))}
            </p>
          </div>
        </div>

        <div className="h-56">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          ) : trendPoints.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#444]">
              <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">Bu dönemde izlenme verisi yok</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendPoints} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLikes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradUnique" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<TrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#666", paddingTop: 8 }}
                  formatter={(v) => v === "views" ? "İzlenme" : v === "uniqueViewers" ? "Tekil İzleyici" : "Beğeni"}
                />
                <Area type="monotone" dataKey="views" stroke="#a855f7" strokeWidth={2} fill="url(#gradViews)" dot={false} activeDot={{ r: 4, fill: "#a855f7" }} />
                <Area type="monotone" dataKey="uniqueViewers" stroke="#22d3ee" strokeWidth={1.5} fill="url(#gradUnique)" dot={false} activeDot={{ r: 3, fill: "#22d3ee" }} />
                <Area type="monotone" dataKey="likes" stroke="#f43f5e" strokeWidth={2} fill="url(#gradLikes)" dot={false} activeDot={{ r: 4, fill: "#f43f5e" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top videos: most watched + most liked */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankCard
          title={`En Çok İzlenen — ${periodLabel}`}
          icon={Eye}
          iconColor="text-violet-400"
          videos={topViewVideos}
          metricKey={usePeriodRankings ? "periodViews" : "viewCount"}
          barColor="#a855f7"
        />
        <RankCard
          title={`En Çok Beğenilen — ${periodLabel}`}
          icon={Heart}
          iconColor="text-rose-400"
          videos={topLikeVideos}
          metricKey={usePeriodRankings ? "periodLikes" : "likeCount"}
          barColor="#f43f5e"
        />
      </div>

      {/* Trending + Active now */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankCard
          title="Trend Videolar (Son 30 Gün)"
          icon={Flame}
          iconColor="text-orange-400"
          videos={data?.trending ?? []}
          metricKey="viewCount"
          barColor="#f97316"
        />
        <RankCard
          title="Şu An İzlenenler (Son 24 Saat)"
          icon={PlayCircle}
          iconColor="text-emerald-400"
          videos={data?.activeNow ?? []}
          metricKey="viewers24h"
          barColor="#10b981"
        />
      </div>

      {/* En çok yorum + Kategori */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankCard
          title="En Çok Yorum Alan"
          icon={MessageSquare}
          iconColor="text-cyan-400"
          videos={data?.topByComments ?? []}
          metricKey="commentCount"
          barColor="#06b6d4"
        />
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            Kategori Dağılımı — Görüntülenme
          </h3>
          <CategoryBarChart data={data?.categoryBreakdown ?? []} />
          {(data?.categoryBreakdown ?? []).length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
              {data!.categoryBreakdown.slice(0, 10).map((r, i) => {
                const max = data!.categoryBreakdown[0]?.totalViews || 1;
                return (
                  <div key={r.category} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                    <span className="text-[11px] text-[#aaa] flex-1 truncate">{r.category}</span>
                    <span className="text-[11px] text-[#555]">{r.videoCount} video</span>
                    <span className="text-[11px] font-bold text-white tabular-nums">{fmt(r.totalViews)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
