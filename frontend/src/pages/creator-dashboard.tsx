import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useGetCreatorEarnings, useGetCreatorAnalytics } from "@workspace/api-client-react";
import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, DollarSign, Eye, Users, Heart,
  RefreshCw, Calendar, Video, ArrowUpRight, ArrowDownRight,
  Crown, ShoppingBag, Zap, Coins, Wallet, Send, Clock, CheckCircle, XCircle, Loader2,
  FileText, CheckCheck, Ban, MessageSquare, Radio, Store,
} from "lucide-react";
import { CreatorLivePanel } from "@/components/live/creator-live-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const PERIODS = [
  { id: "7d",  label: "7 Gün" },
  { id: "30d", label: "30 Gün" },
  { id: "90d", label: "90 Gün" },
  { id: "1y",  label: "1 Yıl" },
];

const COLORS = {
  views:     "#a855f7",
  earnings:  "#22c55e",
  followers: "#3b82f6",
  likes:     "#ef4444",
};

const PIE_COLORS = ["#a855f7", "#22c55e", "#3b82f6", "#f59e0b"];

function StatCard({
  icon: Icon, label, value, sub, color, trend,
}: {
  icon: any; label: string; value: string | number; sub?: string;
  color?: string; trend?: number;
}) {
  return (
    <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={cn("p-2 rounded-xl", color ? `${color}/10` : "bg-[#222]")}>
          <Icon className={cn("h-4 w-4", color ? color.replace("bg-", "text-") : "text-[#888]")} />
        </div>
        {trend !== undefined && (
          <div className={cn("flex items-center gap-0.5 text-xs font-medium",
            trend >= 0 ? "text-green-400" : "text-red-400")}>
            {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-[#666] text-xs mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-[#555] text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[#888] text-xs mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: <span className="text-white">{typeof p.value === "number" ? p.value.toLocaleString("tr") : p.value}</span>
        </p>
      ))}
    </div>
  );
};

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

const WITHDRAW_STATUS_STYLE: Record<string, string> = {
  pending:  "bg-yellow-900/20 text-yellow-400 border-yellow-800",
  approved: "bg-blue-900/20 text-blue-400 border-blue-800",
  paid:     "bg-green-900/20 text-green-400 border-green-800",
  rejected: "bg-red-900/20 text-red-400 border-red-800",
};

export default function CreatorDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("30d");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [activeChart, setActiveChart] = useState<"views" | "earnings" | "followers" | "likes">("views");
  const [activeTab, setActiveTab] = useState<"analytics" | "tokens" | "requests" | "live">("analytics");
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [respondingId, setRespondingId]   = useState<number | null>(null);
  const [responseNote, setResponseNote]   = useState("");
  const [responseAction, setResponseAction] = useState<"accept" | "reject" | "complete" | null>(null);
  const [tokenData, setTokenData] = useState<any>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("bank");
  const [withdrawDetails, setWithdrawDetails] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState("");

  const { data: earnings, refetch: refetchEarnings } = useGetCreatorEarnings({
    query: { enabled: !!user },
  });
  const { data: analytics, refetch: refetchAnalytics } = useGetCreatorAnalytics(
    user?.id || 0,
    { query: { enabled: !!user, queryKey: ["creator-analytics", user?.id, period] } }
  );

  const loadTokenData = () =>
    apiFetch("/tokens/creator-earnings").then(setTokenData).catch(() => {});

  const loadRequests = () => {
    setRequestsLoading(true);
    apiFetch("/custom-requests/received").then(d => setRequests(d.requests || [])).catch(() => {}).finally(() => setRequestsLoading(false));
  };

  const handleRequestAction = async (id: number, action: "accept" | "reject" | "complete") => {
    setRespondingId(id); setResponseAction(action);
    try {
      await apiFetch(`/custom-requests/${id}/${action}`, { method: "POST", body: JSON.stringify({ responseNote }) });
      setResponseNote(""); setRespondingId(null); setResponseAction(null);
      loadRequests();
    } catch (e: any) { alert(e.message); setRespondingId(null); setResponseAction(null); }
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchEarnings(), refetchAnalytics()]);
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  useEffect(() => {
    if (user) { loadTokenData(); loadRequests(); }
  }, [user]);

  const handleWithdraw = async () => {
    const amt = parseInt(withdrawAmount);
    if (!amt || amt < 100) { setWithdrawMsg("Min 100 token (≈ $1)"); return; }
    setWithdrawing(true); setWithdrawMsg("");
    try {
      await apiFetch("/tokens/withdraw", { method: "POST", body: JSON.stringify({ tokenAmount: amt, method: withdrawMethod, details: withdrawDetails }) });
      setWithdrawMsg("✓ Çekim talebi alındı!");
      setWithdrawAmount(""); setWithdrawDetails("");
      loadTokenData();
    } catch (e: any) { setWithdrawMsg(e.message); }
    finally { setWithdrawing(false); }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-[#555]">Giriş yapmanız gerekiyor.</p>
        </div>
      </AppLayout>
    );
  }

  const chartData = analytics?.[activeChart] ?? [];
  const topVideos = analytics?.topVideos ?? [];
  const totalViews = analytics?.views?.reduce((a: number, d: any) => a + (d.value || 0), 0) || 0;
  const totalEarnings = analytics?.earnings?.reduce((a: number, d: any) => a + (d.value || 0), 0) || 0;
  const totalFollowers = analytics?.followers?.reduce((a: number, d: any) => a + (d.value || 0), 0) || 0;
  const totalLikes = analytics?.likes?.reduce((a: number, d: any) => a + (d.value || 0), 0) || 0;
  const avgViews = chartData.length ? Math.round(totalViews / chartData.length) : 0;
  const topVideo = topVideos[0];
  const conversionRate = totalViews > 0 ? ((totalLikes + totalFollowers) / totalViews) * 100 : 0;

  // Gelir dağılımı (pie chart verisi)
  const earningsBreakdown = [
    { name: "Abonelik", value: Math.round((earnings?.thisMonth || 0) * 0.6 * 100) / 100 },
    { name: "PPV Video", value: Math.round((earnings?.thisMonth || 0) * 0.25 * 100) / 100 },
    { name: "Bahşiş", value: Math.round((earnings?.thisMonth || 0) * 0.1 * 100) / 100 },
    { name: "Reklam", value: Math.round((earnings?.thisMonth || 0) * 0.05 * 100) / 100 },
  ];

  const creatorShop = {
    title: "Özel Creator Mağazası",
    description: "Dijital ürünler, paketler ve özel tekliflerin yer alacağı mağaza alanı.",
  };

  const chartColor = COLORS[activeChart];

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#0e0e0e]">
        <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">İçerik Paneli</h1>
              <p className="text-[#666] text-sm mt-0.5">
                @{user.username} •
                <span className="text-[#555] ml-1">
                  Son güncelleme: {lastUpdated.toLocaleTimeString("tr", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Ana sekme geçişi */}
              <div className="flex bg-[#161616] border border-[#222] rounded-xl p-1 gap-0.5">
                <button onClick={() => setActiveTab("analytics")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all", activeTab === "analytics" ? "bg-[#2a2a2a] text-white shadow" : "text-[#555] hover:text-[#aaa]")}>
                  <TrendingUp className="h-3.5 w-3.5" /> Analitik
                </button>
                <button onClick={() => setActiveTab("tokens")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all", activeTab === "tokens" ? "bg-yellow-500/20 text-yellow-400 shadow" : "text-[#555] hover:text-[#aaa]")}>
                  <Coins className="h-3.5 w-3.5" /> Token Kazanç
                  {tokenData?.balance > 0 && <span className="bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{tokenData.balance}</span>}
                </button>
                <button onClick={() => { setActiveTab("requests"); loadRequests(); }} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all", activeTab === "requests" ? "bg-primary/20 text-primary shadow" : "text-[#555] hover:text-[#aaa]")}>
                  <FileText className="h-3.5 w-3.5" /> Özel İstekler
                  {requests.filter(r => r.status === "pending").length > 0 && (
                    <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">{requests.filter(r => r.status === "pending").length}</span>
                  )}
                </button>
                <button onClick={() => setActiveTab("live")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all", activeTab === "live" ? "bg-red-600/20 text-red-400 shadow" : "text-[#555] hover:text-[#aaa]")}>
                  <Radio className="h-3.5 w-3.5" /> Canlı Yayın
                </button>
              </div>
              {activeTab === "analytics" && (
                <>
                  <div className="flex bg-[#161616] border border-[#222] rounded-xl p-1 gap-0.5">
                    {PERIODS.map(p => (
                      <button key={p.id} onClick={() => setPeriod(p.id)}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          period === p.id ? "bg-[#2a2a2a] text-white shadow" : "text-[#555] hover:text-[#aaa]"
                        )}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={refresh} disabled={refreshing}
                    className="flex items-center gap-1.5 bg-[#161616] border border-[#222] hover:border-[#333] text-[#888] hover:text-white px-3 py-2 rounded-xl text-xs transition-all disabled:opacity-50">
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                    Yenile
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── ÖZEL İSTEKLER PANELİ ─────────────────────────────────── */}
          {activeTab === "requests" && (
            <div className="space-y-4">
              {/* Özet kartlar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Bekleyen",    val: requests.filter(r => r.status === "pending").length,   color: "text-yellow-400",  bg: "bg-yellow-500/10", Icon: Clock },
                  { label: "Kabul",       val: requests.filter(r => r.status === "accepted").length,  color: "text-blue-400",    bg: "bg-blue-500/10",   Icon: CheckCircle },
                  { label: "Tamamlanan",  val: requests.filter(r => r.status === "completed").length, color: "text-green-400",   bg: "bg-green-500/10",  Icon: CheckCheck },
                  { label: "Reddedilen",  val: requests.filter(r => r.status === "rejected").length,  color: "text-red-400",     bg: "bg-red-500/10",    Icon: Ban },
                ].map(({ label, val, color, bg, Icon }) => (
                  <div key={label} className="bg-[#161616] border border-[#222] rounded-2xl p-5">
                    <div className={cn("p-2 rounded-xl w-fit mb-3", bg)}><Icon className={cn("h-4 w-4", color)} /></div>
                    <p className="text-[#666] text-xs mb-1">{label}</p>
                    <p className={cn("text-2xl font-bold", color)}>{val}</p>
                  </div>
                ))}
              </div>

              {/* İstekler listesi */}
              <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Gelen İstekler</h3>
                    <span className="text-xs text-[#555]">({requests.length})</span>
                  </div>
                  <button onClick={loadRequests} disabled={requestsLoading} className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors">
                    <RefreshCw className={cn("h-3.5 w-3.5", requestsLoading && "animate-spin")} /> Yenile
                  </button>
                </div>

                {requestsLoading ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-[#555]">
                    <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Yükleniyor...</span>
                  </div>
                ) : requests.length === 0 ? (
                  <div className="py-14 text-center text-[#444]">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Henüz özel istek yok</p>
                    <p className="text-xs text-[#333] mt-1">İzleyiciler profilinizden istek gönderebilir</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1a1a1a]">
                    {requests.map(r => {
                      const statusMap: Record<string, { label: string; cls: string }> = {
                        pending:   { label: "Bekliyor",   cls: "bg-yellow-900/20 text-yellow-400 border-yellow-800" },
                        accepted:  { label: "Kabul",      cls: "bg-blue-900/20 text-blue-400 border-blue-800" },
                        completed: { label: "Tamamlandı", cls: "bg-green-900/20 text-green-400 border-green-800" },
                        rejected:  { label: "Reddedildi", cls: "bg-red-900/20 text-red-400 border-red-800" },
                        cancelled: { label: "İptal",      cls: "bg-[#222] text-[#666] border-[#333]" },
                        expired:   { label: "Süresi Doldu", cls: "bg-[#222] text-[#555] border-[#333]" },
                      };
                      const st = statusMap[r.status] || { label: r.status, cls: "bg-[#222] text-[#666] border-[#333]" };
                      const isResponding = respondingId === r.id;

                      return (
                        <div key={r.id} className="px-5 py-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                              <AvatarImage src={r.sender?.avatarUrl || ""} />
                              <AvatarFallback className="text-xs">{r.sender?.username?.substring(0,2).toUpperCase() ?? "?"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">@{r.sender?.username}</span>
                                <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold", st.cls)}>{st.label}</span>
                                {r.tokenOffer > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-yellow-900/20 border border-yellow-800 text-yellow-400 text-[10px] font-bold">
                                    {r.tokenOffer} 🪙 teklif
                                  </span>
                                )}
                                <span className="text-[#555] text-[10px] ml-auto">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                              </div>
                              <p className="font-semibold text-white mt-1">{r.title}</p>
                              <p className="text-sm text-[#888] mt-0.5 whitespace-pre-wrap">{r.description}</p>
                              {r.responseNote && (
                                <div className="mt-2 flex items-start gap-1.5 bg-[#1a1a1a] rounded-lg px-3 py-2 text-xs text-[#888]">
                                  <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#555]" />
                                  {r.responseNote}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Aksiyon alanı */}
                          {r.status === "pending" && (
                            <div className="pl-12 space-y-2">
                              <Input
                                value={isResponding ? responseNote : ""}
                                onChange={e => { setRespondingId(r.id); setResponseNote(e.target.value); }}
                                placeholder="Yanıt notu (isteğe bağlı)..."
                                className="bg-[#1a1a1a] border-[#2a2a2a] text-sm h-9"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleRequestAction(r.id, "accept")}
                                  disabled={isResponding && responseAction === "accept"}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-1.5 text-xs">
                                  {isResponding && responseAction === "accept" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                  Kabul Et
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleRequestAction(r.id, "reject")}
                                  disabled={isResponding && responseAction === "reject"}
                                  className="flex-1 gap-1.5 text-xs">
                                  {isResponding && responseAction === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                  Reddet
                                </Button>
                              </div>
                            </div>
                          )}

                          {r.status === "accepted" && (
                            <div className="pl-12 space-y-2">
                              <Input
                                value={isResponding ? responseNote : ""}
                                onChange={e => { setRespondingId(r.id); setResponseNote(e.target.value); }}
                                placeholder="Tamamlama notu (video linki vs)..."
                                className="bg-[#1a1a1a] border-[#2a2a2a] text-sm h-9"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleRequestAction(r.id, "complete")}
                                  disabled={isResponding && responseAction === "complete"}
                                  className="flex-1 bg-green-600 hover:bg-green-700 gap-1.5 text-xs">
                                  {isResponding && responseAction === "complete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                                  Tamamlandı olarak işaretle
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleRequestAction(r.id, "reject")}
                                  disabled={isResponding && responseAction === "reject"}
                                  className="gap-1.5 text-xs">
                                  <XCircle className="h-3.5 w-3.5" /> İptal
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <Store className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white">{creatorShop.title}</h3>
                  <span className="text-[11px] px-2 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-semibold">Pasif</span>
                </div>
                <p className="text-sm text-[#666] mt-1">{creatorShop.description}</p>
                <Button disabled variant="outline" className="mt-3 rounded-full">Yakında aktif</Button>
              </div>
            </div>
          )}

          {/* ── CANLI YAYIN PANELİ ────────────────────────────────────── */}
          {activeTab === "live" && (
            <div className="space-y-5">
              <CreatorLivePanel />
            </div>
          )}

          {/* ── TOKEN KAZANÇ PANELİ ───────────────────────────────────── */}
          {activeTab === "tokens" && (
            <div className="space-y-5">
              {/* Özet kartlar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3"><div className="p-2 bg-yellow-500/10 rounded-xl"><Coins className="h-4 w-4 text-yellow-400" /></div></div>
                  <p className="text-[#666] text-xs mb-1">Mevcut Bakiye</p>
                  <p className="text-2xl font-bold text-yellow-400">{(tokenData?.balance ?? 0).toLocaleString("tr")} 🪙</p>
                  <p className="text-xs text-[#555] mt-1">≈ ${((tokenData?.balance ?? 0) * 0.01).toFixed(2)}</p>
                </div>
                <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3"><div className="p-2 bg-green-500/10 rounded-xl"><Wallet className="h-4 w-4 text-green-400" /></div></div>
                  <p className="text-[#666] text-xs mb-1">Toplam Kazanılan</p>
                  <p className="text-2xl font-bold text-white">{(tokenData?.totalEarned ?? 0).toLocaleString("tr")} 🪙</p>
                  <p className="text-xs text-[#555] mt-1">Tüm zamanlar</p>
                </div>
                <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3"><div className="p-2 bg-primary/10 rounded-xl"><TrendingUp className="h-4 w-4 text-primary" /></div></div>
                  <p className="text-[#666] text-xs mb-1">Bu Ay</p>
                  <p className="text-2xl font-bold text-white">{(tokenData?.thisMonth ?? 0).toLocaleString("tr")} 🪙</p>
                  <p className="text-xs text-[#555] mt-1">≈ ${((tokenData?.thisMonth ?? 0) * 0.01).toFixed(2)}</p>
                </div>
                <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3"><div className="p-2 bg-blue-500/10 rounded-xl"><DollarSign className="h-4 w-4 text-blue-400" /></div></div>
                  <p className="text-[#666] text-xs mb-1">Çekilebilir USD</p>
                  <p className="text-2xl font-bold text-green-400">${(tokenData?.availableUsd ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-[#555] mt-1">%20 komisyon sonrası</p>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                {/* Son bahşişler */}
                <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
                    <Heart className="h-4 w-4 text-pink-400" />
                    <h3 className="font-semibold text-sm">Son Bahşişler</h3>
                  </div>
                  <div className="divide-y divide-[#1a1a1a]">
                    {!tokenData?.recentTips?.length ? (
                      <div className="py-10 text-center text-[#444] text-sm">
                        <Coins className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Henüz bahşiş yok
                      </div>
                    ) : tokenData.recentTips.map((tip: any) => (
                      <div key={tip.id} className="flex items-center gap-3 px-5 py-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={tip.sender?.avatarUrl || ""} />
                          <AvatarFallback className="text-xs">{tip.sender?.username?.substring(0,2).toUpperCase() ?? "?"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">@{tip.sender?.username ?? "Anonim"}</p>
                          <p className="text-xs text-[#555] truncate">{tip.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-yellow-400">+{tip.amount} 🪙</p>
                          <p className="text-[10px] text-[#555]">{formatDistanceToNow(new Date(tip.createdAt), { addSuffix: true })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Çekim talebi formu */}
                <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Para Çek</h3>
                    <span className="ml-auto text-xs text-[#555]">Min: 100 🪙 (≈ $1)</span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="text-xs text-[#666] mb-1.5 block">Token Miktarı</label>
                      <div className="flex gap-2">
                        <Input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} type="number" min={100} placeholder="100" className="bg-[#1e1e1e] border-[#2a2a2a]" />
                        <div className="flex items-center px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-xs text-[#666] whitespace-nowrap">
                          ≈ ${((parseInt(withdrawAmount || "0") || 0) * 0.01).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#666] mb-1.5 block">Ödeme Yöntemi</label>
                      <select value={withdrawMethod} onChange={e => setWithdrawMethod(e.target.value)} className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                        <option value="bank">Banka Transferi (IBAN)</option>
                        <option value="paypal">PayPal</option>
                        <option value="crypto">Kripto (USDT/BTC)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[#666] mb-1.5 block">Hesap Bilgileri</label>
                      <Input value={withdrawDetails} onChange={e => setWithdrawDetails(e.target.value)} placeholder={withdrawMethod === "bank" ? "TR00 0000 0000..." : withdrawMethod === "paypal" ? "email@example.com" : "0x... veya TRC20 adres"} className="bg-[#1e1e1e] border-[#2a2a2a]" />
                    </div>
                    {withdrawMsg && (
                      <p className={cn("text-xs px-3 py-2 rounded-lg", withdrawMsg.startsWith("✓") ? "bg-green-900/20 text-green-400 border border-green-800" : "bg-red-900/20 text-red-400 border border-red-800")}>
                        {withdrawMsg}
                      </p>
                    )}
                    <Button onClick={handleWithdraw} disabled={withdrawing || !withdrawAmount || parseInt(withdrawAmount) < 100} className="w-full bg-primary hover:bg-primary/90 gap-2">
                      {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Çekim Talebi Gönder
                    </Button>
                  </div>

                  {/* Geçmiş çekimler */}
                  {tokenData?.withdrawals?.length > 0 && (
                    <div className="border-t border-[#1e1e1e] px-5 py-4">
                      <p className="text-xs text-[#555] font-bold uppercase mb-3">Geçmiş Talepler</p>
                      <div className="space-y-2">
                        {tokenData.withdrawals.map((w: any) => (
                          <div key={w.id} className="flex items-center justify-between text-xs">
                            <div>
                              <span className="text-white font-medium">{w.tokenAmount} 🪙</span>
                              <span className="text-[#555] ml-1">({w.method})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[#666]">${w.usdAmount}</span>
                              <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold", WITHDRAW_STATUS_STYLE[w.status] || "bg-[#222] text-[#666] border-[#333]")}>
                                {w.status === "pending" ? "Bekliyor" : w.status === "approved" ? "Onaylandı" : w.status === "paid" ? "Ödendi" : "Reddedildi"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ANALİTİK PANELİ ─────────────────────────────────────── */}
          {activeTab === "analytics" && <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={DollarSign} label="Toplam Kazanç"
              value={`$${(earnings?.totalEarnings || 0).toLocaleString("tr")}`}
              sub="Tüm zamanlar" color="bg-green-500" trend={8} />
            <StatCard icon={Calendar} label="Bu Ay"
              value={`$${(earnings?.thisMonth || 0).toLocaleString("tr")}`}
              sub="Ödeme bekliyor" color="bg-primary" trend={12} />
            <StatCard icon={Eye} label="Toplam İzlenme"
              value={totalViews.toLocaleString("tr")}
              sub={`Son ${period}`} color="bg-purple-500" trend={5} />
            <StatCard icon={Users} label="Takipçi"
              value={(user.followerCount || 0).toLocaleString("tr")}
              sub="Aktif aboneler" color="bg-blue-500" trend={3} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Video} label="Toplam Video"
              value={(topVideos.length || 0).toLocaleString("tr")}
              sub="Analizde görünen" color="bg-cyan-500" />
            <StatCard icon={Heart} label="Toplam Beğeni"
              value={totalLikes.toLocaleString("tr")}
              sub="Tüm içerikler" color="bg-red-500" />
            <StatCard icon={TrendingUp} label="Ortalama İzlenme"
              value={avgViews.toLocaleString("tr")}
              sub={`Seçili ${period}`} color="bg-amber-500" />
            <StatCard icon={DollarSign} label="Dönüşüm"
              value={`%${conversionRate.toFixed(1)}`}
              sub="İzlenme → etkileşim" color="bg-emerald-500" />
          </div>

          {/* Chart seçici */}
          <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
              <div className="flex gap-1 bg-[#111] p-1 rounded-xl">
                {(["views", "earnings", "followers", "likes"] as const).map(key => (
                  <button key={key} onClick={() => setActiveChart(key)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      activeChart === key ? "bg-[#222] text-white shadow" : "text-[#555] hover:text-[#aaa]"
                    )}
                    style={activeChart === key ? { color: COLORS[key] } : {}}>
                    {key === "views" ? "İzlenme" : key === "earnings" ? "Kazanç" : key === "followers" ? "Takipçi" : "Beğeni"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#555]">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: chartColor }} />
                Canlı
              </div>
            </div>
            <div className="p-5 h-[260px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="date" stroke="#333" tick={{ fill: "#555", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#333" tick={{ fill: "#555", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone" dataKey="value" name={
                        activeChart === "views" ? "İzlenme" :
                        activeChart === "earnings" ? "Kazanç ($)" :
                        activeChart === "followers" ? "Takipçi" : "Beğeni"
                      }
                      stroke={chartColor} strokeWidth={2.5} dot={false}
                      activeDot={{ r: 4, fill: chartColor, stroke: "#0e0e0e", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[#444] text-sm">
                  Henüz yeterli veri yok
                </div>
              )}
            </div>
          </div>

          {/* Alt satır: Gelir dağılımı + Top videolar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Gelir dağılımı */}
            <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-400" />
                <h3 className="font-semibold text-white text-sm">Bu Ay Gelir Dağılımı</h3>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className="h-[160px] w-[160px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={earningsBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                          dataKey="value" paddingAngle={3}>
                          {earningsBreakdown.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i]} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2.5">
                    {earningsBreakdown.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i] }} />
                          <span className="text-xs text-[#aaa]">{item.name}</span>
                        </div>
                        <span className="text-xs font-bold text-white">${item.value}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-[#222]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#666]">Toplam</span>
                        <span className="text-sm font-bold text-green-400">${earnings?.thisMonth || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ödeme durumu */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="bg-[#111] rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Crown className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="text-[11px] text-[#555]">Bekleyen</span>
                    </div>
                    <p className="text-lg font-bold text-white">${earnings?.pendingPayout || 0}</p>
                  </div>
                  <div className="bg-[#111] rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-[11px] text-[#555]">Toplam</span>
                    </div>
                    <p className="text-lg font-bold text-white">${earnings?.totalEarnings || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top videolar */}
            <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-white text-sm">En Çok İzlenen Videolar</h3>
              </div>
              <div className="divide-y divide-[#1a1a1a]">
                {topVideos.length === 0 ? (
                  <div className="py-12 text-center text-[#444] text-sm">
                    <Video className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Henüz video yok
                  </div>
                ) : (
                  topVideos.map((video: any, i: number) => (
                    <div key={video.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#1a1a1a] transition-colors">
                      <span className={cn("text-lg font-black w-6 text-center shrink-0",
                        i === 0 ? "text-yellow-400" : i === 1 ? "text-[#aaa]" : i === 2 ? "text-orange-700" : "text-[#444]"
                      )}>{i + 1}</span>
                      <div className="w-20 aspect-video bg-[#111] rounded-lg overflow-hidden shrink-0">
                        {video.thumbnailUrl
                          ? <img src={video.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full flex items-center justify-center"><Video className="h-4 w-4 text-[#333]" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white line-clamp-1">{video.title}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] text-[#555] flex items-center gap-1">
                            <Eye className="h-3 w-3" />{(video.viewCount || 0).toLocaleString("tr")}
                          </span>
                          <span className="text-[11px] text-[#555] flex items-center gap-1">
                            <Heart className="h-3 w-3" />{(video.likeCount || 0).toLocaleString("tr")}
                          </span>
                          {video.isPPV && (
                            <span className="text-[10px] bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded-md">PPV</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-white">En İyi Video</h3>
                <span className="text-xs text-[#666]">Genel performans</span>
              </div>
              {topVideo ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-white line-clamp-2">{topVideo.title}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#111] rounded-xl p-3">
                      <p className="text-[#666] mb-1">İzlenme</p>
                      <p className="text-white font-bold">{(topVideo.viewCount || 0).toLocaleString("tr")}</p>
                    </div>
                    <div className="bg-[#111] rounded-xl p-3">
                      <p className="text-[#666] mb-1">Beğeni</p>
                      <p className="text-white font-bold">{(topVideo.likeCount || 0).toLocaleString("tr")}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[#444] text-sm">Veri yok</p>
              )}
            </div>

            <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-white">Performans Notu</h3>
                <span className="text-xs text-[#666]">Son 30 gün</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#666]">İzlenme gücü</span>
                    <span className="text-white font-semibold">{Math.min(100, Math.round((totalViews / 1000) * 10))}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#111] overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Math.round((totalViews / 1000) * 10))}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#666]">Etkileşim</span>
                    <span className="text-white font-semibold">{Math.min(100, Math.round(conversionRate * 5))}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#111] overflow-hidden"><div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(100, Math.round(conversionRate * 5))}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#666]">Kazanç potansiyeli</span>
                    <span className="text-white font-semibold">{Math.min(100, Math.round(totalEarnings / 10))}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#111] overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, Math.round(totalEarnings / 10))}%` }} /></div>
                </div>
              </div>
            </div>

            <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-white">Özet</h3>
                <span className="text-xs text-[#666]">Hızlı bakış</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#666]">Toplam takipçi</span><span className="text-white font-semibold">{totalFollowers.toLocaleString("tr")}</span></div>
                <div className="flex justify-between"><span className="text-[#666]">Toplam beğeni</span><span className="text-white font-semibold">{totalLikes.toLocaleString("tr")}</span></div>
                <div className="flex justify-between"><span className="text-[#666]">Ortalama izlenme</span><span className="text-white font-semibold">{avgViews.toLocaleString("tr")}</span></div>
                <div className="flex justify-between"><span className="text-[#666]">En iyi video</span><span className="text-white font-semibold">{topVideo ? "Var" : "Yok"}</span></div>
              </div>
            </div>
          </div>

          {/* Son 7 gün bar chart */}
          <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
              <BarChart className="h-4 w-4 text-[#888]" />
              <h3 className="font-semibold text-white text-sm">İzlenme & Kazanç Karşılaştırması</h3>
            </div>
            <div className="p-5 h-[220px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(-14)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="date" stroke="#333" tick={{ fill: "#555", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#333" tick={{ fill: "#555", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="İzlenme" fill="#a855f7" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[#444] text-sm">Veri yükleniyor...</div>
              )}
            </div>
          </div>

          </> /* analytics panel sonu */}

        </div>
      </div>
    </AppLayout>
  );
}
