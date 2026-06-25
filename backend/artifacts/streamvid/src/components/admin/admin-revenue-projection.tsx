import { useEffect, useState } from "react";
import {
  ComposedChart, AreaChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, BarChart2, RefreshCw, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPI {
  mrr: number;
  arr: number;
  totalActiveSubs: number;
  lastMonthRevenue: number;
  mom: number;
  avgMonthlyToken: number;
  avgMonthlyPPV: number;
  projectedAnnual: number;
}

interface DataPoint {
  month: string;
  label: string;
  actual: number | null;
  subscription?: number;
  token?: number;
  ppv?: number;
  other?: number;
  pessimistic: number | null;
  realistic: number | null;
  optimistic: number | null;
}

interface ProjectionData {
  kpi: KPI;
  scenarios: Record<string, { label: string; color: string }>;
  revenueBreakdown: Record<string, number>;
  history: DataPoint[];
  projection: DataPoint[];
  growthRate: number;
}

type Scenario = "pessimistic" | "realistic" | "optimistic";

const BREAKDOWN_COLORS: Record<string, string> = {
  subscription: "#f90",
  token:        "#22c55e",
  ppv:          "#3b82f6",
  other:        "#8b5cf6",
};
const BREAKDOWN_LABELS: Record<string, string> = {
  subscription: "Abonelik",
  token:        "Token/Bahşiş",
  ppv:          "Kiralık Video",
  other:        "Diğer",
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(1)}K`
  : `$${n.toFixed(2)}`;

function KPICard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string; sub?: string;
  icon: any; color: string; trend?: number;
}) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-[#666]">{label}</p>
        <div className={cn("p-1.5 rounded-lg", color)}><Icon className="h-3.5 w-3.5 text-white" /></div>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-[#555] mt-0.5">{sub}</p>}
      {trend !== undefined && (
        <div className={cn("flex items-center gap-1 text-xs mt-1.5 font-medium", trend >= 0 ? "text-green-400" : "text-red-400")}>
          {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(trend)}% geçen aya göre
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 shadow-2xl text-xs min-w-[160px]">
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload.map((p: any) => p.value != null && (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color ?? p.stroke }} className="capitalize">{p.name}</span>
          <span className="font-bold text-white">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function AdminRevenueProjection() {
  const [data, setData]         = useState<ProjectionData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [scenario, setScenario] = useState<Scenario>("realistic");
  const [tab, setTab]           = useState<"projection" | "breakdown" | "history">("projection");

  const token = localStorage.getItem("token") ?? "";
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/revenue/projection", { headers });
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className={cn("bg-[#1e1e1e] rounded-2xl animate-pulse", i === 1 ? "h-24" : "h-64")} />)}
    </div>
  );

  const { kpi, scenarios, revenueBreakdown, history, projection, growthRate } = data;

  // Grafik için tarih sıralı birleşik dizi
  const chartData = [...history, ...projection];

  const breakdownEntries = Object.entries(revenueBreakdown)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalBreakdown = breakdownEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Gelir Projeksiyonu
          </h2>
          <p className="text-sm text-[#666] mt-0.5">
            Son 6 aylık gerçek veri + 12 aylık projeksiyon
            {growthRate !== 0 && (
              <span className={cn("ml-2 font-medium", growthRate >= 0 ? "text-green-400" : "text-red-400")}>
                ({growthRate > 0 ? "+" : ""}{growthRate}%/ay büyüme)
              </span>
            )}
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-[#888] hover:text-white transition-colors">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Aylık Tekrarlayan Gelir (MRR)" value={fmt(kpi.mrr)} sub={`${kpi.totalActiveSubs} aktif abone`} icon={DollarSign} color="bg-amber-500" trend={kpi.mom} />
        <KPICard label="Yıllık Tekrarlayan Gelir (ARR)" value={fmt(kpi.arr)} sub="Mevcut aboneliklerden" icon={TrendingUp} color="bg-green-600" />
        <KPICard label="Tahmini Yıllık Gelir" value={fmt(kpi.projectedAnnual)} sub="Gerçekçi senaryo" icon={BarChart2} color="bg-blue-600" />
        <KPICard label="Geçen Ay Geliri" value={fmt(kpi.lastMonthRevenue)} sub={`Token: ${fmt(kpi.avgMonthlyToken)} · PPV: ${fmt(kpi.avgMonthlyPPV)}`} icon={Calendar} color="bg-purple-600" trend={kpi.mom} />
      </div>

      {/* Senaryo seçici */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#666] mr-1">Senaryo:</span>
        {(Object.entries(scenarios) as [Scenario, { label: string; color: string }][]).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setScenario(key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
              scenario === key
                ? "border-current text-white"
                : "bg-[#1e1e1e] border-[#2a2a2a] text-[#666] hover:text-[#aaa]"
            )}
            style={scenario === key ? { backgroundColor: `${s.color}22`, borderColor: s.color, color: s.color } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-[#161616] p-1 rounded-xl w-fit">
        {[
          { key: "projection", label: "Projeksiyon" },
          { key: "breakdown",  label: "Gelir Dağılımı" },
          { key: "history",    label: "Geçmiş" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
              tab === t.key ? "bg-[#2a2a2a] text-white" : "text-[#666] hover:text-[#aaa]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Projection chart */}
      {tab === "projection" && (
        <div className="bg-[#1a1a1a] border border-[#1e1e1e] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#aaa] mb-4">Aylık Gelir — Gerçek & Projeksiyon</h3>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f90" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f90" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={scenarios[scenario].color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={scenarios[scenario].color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#666" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "#666" }} tickLine={false} axisLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />

              {/* Gerçek veri */}
              <Area
                type="monotone" dataKey="actual" name="Gerçek"
                fill="url(#actualGrad)" stroke="#f90" strokeWidth={2}
                dot={{ fill: "#f90", r: 3 }} connectNulls={false}
              />

              {/* Projeksiyon çizgisi */}
              <Line
                type="monotone" dataKey={scenario} name={scenarios[scenario].label}
                stroke={scenarios[scenario].color} strokeWidth={2}
                strokeDasharray="6 3"
                dot={false} connectNulls
              />

              {/* Bugünkü kesim çizgisi */}
              <ReferenceLine
                x={history[history.length - 1]?.label}
                stroke="#444" strokeDasharray="4 4"
                label={{ value: "Bugün", fill: "#666", fontSize: 11, position: "top" }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Projeksiyon özeti */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {(Object.entries(scenarios) as [Scenario, { label: string; color: string }][]).map(([key, s]) => {
              const yearTotal = projection.reduce((sum, p) => sum + (p[key] as number ?? 0), 0);
              return (
                <div key={key} className={cn(
                  "rounded-xl p-3 border text-center transition-all",
                  scenario === key ? "border-current" : "bg-[#161616] border-[#1e1e1e]"
                )} style={scenario === key ? { borderColor: s.color, backgroundColor: `${s.color}11` } : undefined}>
                  <p className="text-xs mb-1" style={{ color: s.color }}>{s.label}</p>
                  <p className="text-lg font-bold text-white">{fmt(yearTotal)}</p>
                  <p className="text-[11px] text-[#555]">12 aylık toplam</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Breakdown chart */}
      {tab === "breakdown" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a] border border-[#1e1e1e] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[#aaa] mb-4">Gelir Kaynağı Dağılımı (son 6 ay)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={breakdownEntries.map(([k, v]) => ({ name: BREAKDOWN_LABELS[k] ?? k, value: v, key: k }))}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  paddingAngle={3} dataKey="value"
                >
                  {breakdownEntries.map(([k]) => (
                    <Cell key={k} fill={BREAKDOWN_COLORS[k] ?? "#666"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#1a1a1a] border border-[#1e1e1e] rounded-2xl p-5 flex flex-col justify-center">
            <h3 className="text-sm font-semibold text-[#aaa] mb-4">Detay</h3>
            <div className="space-y-3">
              {breakdownEntries.map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-[#ccc]">{BREAKDOWN_LABELS[k] ?? k}</span>
                    <span className="text-sm font-bold text-white">{fmt(v)}</span>
                  </div>
                  <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${totalBreakdown > 0 ? (v / totalBreakdown) * 100 : 0}%`, backgroundColor: BREAKDOWN_COLORS[k] ?? "#666" }}
                    />
                  </div>
                  <p className="text-[11px] text-[#555] mt-0.5">{totalBreakdown > 0 ? ((v / totalBreakdown) * 100).toFixed(1) : 0}%</p>
                </div>
              ))}
              {breakdownEntries.length === 0 && <p className="text-xs text-[#555]">Henüz gelir verisi yok</p>}
            </div>
          </div>
        </div>
      )}

      {/* History chart */}
      {tab === "history" && (
        <div className="bg-[#1a1a1a] border border-[#1e1e1e] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#aaa] mb-4">Gelir Kaynağı Bazında (son 6 ay)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={history} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#666" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "#666" }} tickLine={false} axisLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />
              <Bar dataKey="subscription" name="Abonelik" stackId="a" fill="#f90"     radius={[0, 0, 0, 0]} />
              <Bar dataKey="token"        name="Token"     stackId="a" fill="#22c55e"  radius={[0, 0, 0, 0]} />
              <Bar dataKey="ppv"          name="PPV"       stackId="a" fill="#3b82f6"  radius={[0, 0, 0, 0]} />
              <Bar dataKey="other"        name="Diğer"     stackId="a" fill="#8b5cf6"  radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Assumptions note */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4">
        <p className="text-xs text-[#555] leading-relaxed">
          <span className="text-[#777] font-medium">Projeksiyon varsayımları: </span>
          Aylık büyüme oranı son {history.length} ayın ortalamasından hesaplanır ({growthRate > 0 ? "+" : ""}{growthRate}%/ay).
          Kötümser senaryo −3pp, iyimser senaryo +4pp sapma uygular.
          MRR hesabı yalnızca aktif abonelikleri kapsar; yeni satışlar büyüme oranına dahildir.
        </p>
      </div>
    </div>
  );
}
