import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  Eye, Heart, MessageSquare, TrendingUp, Film, Users,
  RefreshCw, BarChart3, Flame, PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

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
}

interface AnalyticsData {
  summary: Summary;
  topByViews: VideoCard[];
  topByLikes: VideoCard[];
  topByComments: VideoCard[];
  trending: VideoCard[];
  activeNow: VideoCard[];
  categoryBreakdown: CategoryRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function VideoRow({
  video,
  rank,
  metric,
  metricLabel,
  metricColor,
  max,
}: {
  video: VideoCard;
  rank: number;
  metric: number;
  metricLabel: string;
  metricColor: string;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2 group">
      <span className="text-[#555] text-xs font-mono w-5 shrink-0 text-right">{rank}</span>
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="w-12 h-8 object-cover rounded bg-[#1a1a1a] shrink-0"
        />
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
            className={cn("h-full rounded-full transition-all duration-700", metricColor)}
            style={{ width: max > 0 ? `${(metric / max) * 100}%` : "0%" }}
          />
        </div>
      </div>
      <span className={cn("text-xs font-bold shrink-0", metricColor.replace("bg-", "text-").replace("/80", ""))}>
        {fmt(metric)}
      </span>
    </div>
  );
}

function RankCard({
  title,
  icon: Icon,
  iconColor,
  videos,
  metricKey,
  metricLabel,
  barColor,
}: {
  title: string;
  icon: any;
  iconColor: string;
  videos: VideoCard[];
  metricKey: keyof VideoCard;
  metricLabel: string;
  barColor: string;
}) {
  const max = videos.length ? Math.max(...videos.map(v => Number(v[metricKey]) || 0)) : 1;
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Icon className={cn("h-4 w-4", iconColor)} />
        {title}
      </h3>
      {videos.length === 0 ? (
        <p className="text-xs text-[#555] py-4 text-center">Henüz veri yok</p>
      ) : (
        <div className="space-y-1 divide-y divide-[#222]">
          {videos.slice(0, 10).map((v, i) => (
            <VideoRow
              key={v.id}
              video={v}
              rank={i + 1}
              metric={Number(v[metricKey]) || 0}
              metricLabel={metricLabel}
              metricColor={barColor}
              max={max}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChart({ data }: { data: CategoryRow[] }) {
  const colors = [
    "#a855f7", "#6366f1", "#3b82f6", "#06b6d4", "#10b981",
    "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#8b5cf6",
  ];
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-primary" />
        Kategori Dağılımı — Görüntülenme
      </h3>
      {data.length === 0 ? (
        <p className="text-xs text-[#555] py-4 text-center">Henüz veri yok</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data.map(r => ({ ...r, views: r.totalViews }))}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "#555", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmt}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fill: "#888", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, fontSize: 11 }}
              formatter={(v: any) => [fmt(Number(v)), "Görüntülenme"]}
            />
            <Bar dataKey="views" radius={4} maxBarSize={18}>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminVideoDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"views" | "likes" | "comments" | "trending" | "active">("views");
  const token = localStorage.getItem("token") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/video-analytics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { id: "views",    label: "En Çok İzlenen",  icon: Eye },
    { id: "likes",    label: "En Çok Beğenilen", icon: Heart },
    { id: "comments", label: "En Çok Yorumlanan", icon: MessageSquare },
    { id: "trending", label: "Trend (30 gün)",   icon: Flame },
    { id: "active",   label: "Şu An İzlenen",   icon: PlayCircle },
  ] as const;

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Video Analitik Paneli
          </h2>
          <p className="text-sm text-[#666] mt-0.5">
            Tüm videoların performans metrikleri
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333] transition-colors text-[#888] hover:text-white"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Toplam Video", value: summary?.totalVideos, icon: Film, color: "text-blue-400" },
          { label: "Toplam Görüntülenme", value: summary?.totalViews, icon: Eye, color: "text-primary" },
          { label: "Toplam Beğeni", value: summary?.totalLikes, icon: Heart, color: "text-rose-400" },
          { label: "Toplam Yorum", value: summary?.totalComments, icon: MessageSquare, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-[#666] mb-1">{label}</p>
                <p className={cn("text-2xl font-bold", color)}>
                  {loading ? "—" : fmt(value ?? 0)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#2a2a2a]">
                <Icon className={cn("h-4 w-4", color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={cn(
              "flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap",
              tab === id
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-[#1a1a1a] border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#444]"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Main grid: rank list + category chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          {loading ? (
            <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-8 flex items-center justify-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {tab === "views" && (
                <RankCard
                  title="En Çok İzlenen Videolar"
                  icon={Eye}
                  iconColor="text-primary"
                  videos={data?.topByViews ?? []}
                  metricKey="viewCount"
                  metricLabel="görüntülenme"
                  barColor="bg-primary/80"
                />
              )}
              {tab === "likes" && (
                <RankCard
                  title="En Çok Beğenilen Videolar"
                  icon={Heart}
                  iconColor="text-rose-400"
                  videos={data?.topByLikes ?? []}
                  metricKey="likeCount"
                  metricLabel="beğeni"
                  barColor="bg-rose-500/80"
                />
              )}
              {tab === "comments" && (
                <RankCard
                  title="En Çok Yorumlanan Videolar"
                  icon={MessageSquare}
                  iconColor="text-amber-400"
                  videos={data?.topByComments ?? []}
                  metricKey="commentCount"
                  metricLabel="yorum"
                  barColor="bg-amber-500/80"
                />
              )}
              {tab === "trending" && (
                <RankCard
                  title="Trend Videolar (Son 30 Gün)"
                  icon={Flame}
                  iconColor="text-orange-400"
                  videos={data?.trending ?? []}
                  metricKey="viewCount"
                  metricLabel="görüntülenme"
                  barColor="bg-orange-500/80"
                />
              )}
              {tab === "active" && (
                <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                    <PlayCircle className="h-4 w-4 text-green-400" />
                    Şu An İzlenen Videolar
                    <span className="ml-1 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  </h3>
                  {(data?.activeNow ?? []).length === 0 ? (
                    <p className="text-xs text-[#555] py-4 text-center">Son 24 saatte aktif izlenme yok</p>
                  ) : (
                    <div className="space-y-1 divide-y divide-[#222]">
                      {(data?.activeNow ?? []).slice(0, 10).map((v, i) => (
                        <div key={v.id} className="flex items-center gap-3 py-2">
                          <span className="text-[#555] text-xs font-mono w-5 shrink-0 text-right">{i + 1}</span>
                          {v.thumbnailUrl ? (
                            <img src={v.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded bg-[#1a1a1a] shrink-0" />
                          ) : (
                            <div className="w-12 h-8 rounded bg-[#1a1a1a] shrink-0 flex items-center justify-center">
                              <Film className="h-3 w-3 text-[#444]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#ddd] truncate font-medium">{v.title}</p>
                            <p className="text-[10px] text-[#555] truncate">{v.creator ?? "—"}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-green-400">{fmt(v.viewers24h ?? 0)}</p>
                            <p className="text-[10px] text-[#555]">izleyici/24s</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Category chart */}
        <CategoryChart data={data?.categoryBreakdown ?? []} />
      </div>

      {/* Bottom: side-by-side mini tables for likes & comments if viewing views tab */}
      {tab === "views" && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RankCard
            title="En Çok Beğenilen"
            icon={Heart}
            iconColor="text-rose-400"
            videos={(data?.topByLikes ?? []).slice(0, 5)}
            metricKey="likeCount"
            metricLabel="beğeni"
            barColor="bg-rose-500/80"
          />
          <RankCard
            title="En Çok Yorumlanan"
            icon={MessageSquare}
            iconColor="text-amber-400"
            videos={(data?.topByComments ?? []).slice(0, 5)}
            metricKey="commentCount"
            metricLabel="yorum"
            barColor="bg-amber-500/80"
          />
        </div>
      )}
    </div>
  );
}
