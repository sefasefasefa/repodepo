import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, Users, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartPoint {
  time: string;
  visits: number;
  unique: number;
}

interface ChartData {
  bucket: "minute" | "hour" | "day";
  period: string;
  points: ChartPoint[];
}

const PERIOD_LABELS: Record<string, string> = {
  "5min": "Son 5 Dakika",
  "1h":   "Son 1 Saat",
  "24h":  "Son 24 Saat",
  "7d":   "Son 7 Gün",
  "30d":  "Son 30 Gün",
  "all":  "Tüm Zamanlar",
};

function formatLabel(time: string, bucket: "minute" | "hour" | "day") {
  const d = new Date(time);
  if (bucket === "minute") return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bucket === "hour")   return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).replace(",", "");
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function CustomTooltip({ active, payload, label, bucket }: any) {
  if (!active || !payload?.length) return null;
  const visits = payload.find((p: any) => p.dataKey === "visits")?.value ?? 0;
  const unique  = payload.find((p: any) => p.dataKey === "unique")?.value ?? 0;
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 shadow-xl text-xs">
      <p className="text-[#888] mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[#aaa]">Toplam Ziyaret:</span>
          <span className="font-bold text-white">{visits}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[#aaa]">Tekil Ziyaretçi:</span>
          <span className="font-bold text-white">{unique}</span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  period: string;
  countryFilter?: string;
}

export default function AdminVisitorChart({ period, countryFilter }: Props) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token") ?? "";

  const fetchChart = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (countryFilter) params.set("country", countryFilter);
      const res = await fetch(`/api/admin/visitors/chart?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json: ChartData = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [period, countryFilter, token]);

  useEffect(() => {
    fetchChart();
    // Auto-refresh only on live period
    if (period === "5min") {
      const t = setInterval(fetchChart, 10000);
      return () => clearInterval(t);
    }
  }, [fetchChart, period]);

  const points = (data?.points ?? []).map(p => ({
    ...p,
    label: formatLabel(p.time, data?.bucket ?? "hour"),
  }));

  const totalVisits  = points.reduce((s, p) => s + p.visits, 0);
  const totalUnique  = points.reduce((s, p) => s + p.unique, 0);
  const peakVisits   = points.length ? Math.max(...points.map(p => p.visits)) : 0;
  const peakLabel    = points.find(p => p.visits === peakVisits)?.label ?? "—";

  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Ziyaretçi Trafi Grafiği
          </h3>
          <p className="text-xs text-[#555] mt-0.5">
            {PERIOD_LABELS[period] ?? period}
            {countryFilter ? ` — ${countryFilter}` : ""}
            {" · "}
            {data?.bucket === "minute" ? "Dakika bazlı" : data?.bucket === "hour" ? "Saatlik" : "Günlük"}
          </p>
        </div>
      </div>

      {/* Mini stat row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#161616] border border-[#252525] rounded-xl p-3 text-center">
          <p className="text-[10px] text-[#555] mb-1">Toplam Ziyaret</p>
          <p className="text-xl font-bold text-white">{loading ? "…" : totalVisits}</p>
        </div>
        <div className="bg-[#161616] border border-[#252525] rounded-xl p-3 text-center">
          <p className="text-[10px] text-[#555] mb-1">Tekil Ziyaretçi</p>
          <p className="text-xl font-bold text-emerald-400">{loading ? "…" : totalUnique}</p>
        </div>
        <div className="bg-[#161616] border border-[#252525] rounded-xl p-3 text-center">
          <p className="text-[10px] text-[#555] mb-1">Tepe Nokta</p>
          <p className="text-xl font-bold text-amber-400">{loading ? "…" : peakVisits}</p>
          {!loading && peakLabel !== "—" && (
            <p className="text-[10px] text-[#555] truncate">{peakLabel}</p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-52">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : points.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#444]">
            <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">Bu dönemde trafik verisi yok</p>
            <p className="text-[11px] text-[#333] mt-1">Ziyaretçiler gezindikçe grafik dolacak</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradVisits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradUnique" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#555", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#555", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip bucket={data?.bucket} />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#666", paddingTop: 8 }}
                formatter={(v) => v === "visits" ? "Toplam Ziyaret" : "Tekil Ziyaretçi"}
              />
              <Area
                type="monotone"
                dataKey="visits"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#gradVisits)"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
              />
              <Area
                type="monotone"
                dataKey="unique"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#gradUnique)"
                dot={false}
                activeDot={{ r: 4, fill: "#34d399" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
