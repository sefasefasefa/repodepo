import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { FileText, Plus, Loader2, RefreshCw, Clock, CheckCircle, CheckCheck, XCircle, Ban, MessageSquare, Coins, Link } from "lucide-react";
import { useLocation } from "wouter";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

const STATUS_MAP: Record<string, { label: string; cls: string; Icon: any }> = {
  pending:   { label: "Bekliyor",     cls: "bg-yellow-900/20 text-yellow-400 border-yellow-800",  Icon: Clock },
  accepted:  { label: "Kabul Edildi", cls: "bg-blue-900/20 text-blue-400 border-blue-800",        Icon: CheckCircle },
  completed: { label: "Tamamlandı",   cls: "bg-green-900/20 text-green-400 border-green-800",     Icon: CheckCheck },
  rejected:  { label: "Reddedildi",   cls: "bg-red-900/20 text-red-400 border-red-800",           Icon: XCircle },
  cancelled: { label: "İptal",        cls: "bg-[#222] text-[#666] border-[#333]",                 Icon: Ban },
  expired:   { label: "Süresi Doldu", cls: "bg-[#222] text-[#555] border-[#333]",                 Icon: Clock },
};

export default function MyRequests() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [requests, setRequests]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const load = () => {
    setLoading(true);
    apiFetch("/custom-requests/sent").then(d => setRequests(d.requests || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleCancel = async (id: number) => {
    if (!confirm("Bu isteği iptal etmek istediğinize emin misiniz?")) return;
    setCancellingId(id);
    try {
      await apiFetch(`/custom-requests/${id}/cancel`, { method: "POST" });
      load();
    } catch (e: any) { alert(e.message); }
    finally { setCancellingId(null); }
  };

  if (!user) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <FileText className="h-12 w-12 text-[#333]" />
        <p className="text-[#555]">Giriş yapmanız gerekiyor</p>
        <Button onClick={() => setLocation("/login")}>Giriş Yap</Button>
      </div>
    </AppLayout>
  );

  const FILTERS = [
    { id: "all",       label: "Tümü" },
    { id: "pending",   label: "Bekleyen" },
    { id: "accepted",  label: "Kabul" },
    { id: "completed", label: "Tamamlanan" },
    { id: "rejected",  label: "Reddedilen" },
  ];

  const filtered = activeFilter === "all" ? requests : requests.filter(r => r.status === activeFilter);

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" /> Özel İsteklerim
            </h1>
            <p className="text-[#555] text-sm mt-0.5">İçerik yaratıcılarına gönderdiğiniz özel istekler</p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Filtreler */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all",
                activeFilter === f.id
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-[#161616] text-[#666] border-[#222] hover:border-[#333] hover:text-white"
              )}
            >
              {f.label}
              {f.id !== "all" && (
                <span className="ml-1.5 opacity-70">({requests.filter(r => f.id === "all" || r.status === f.id).length})</span>
              )}
            </button>
          ))}
        </div>

        {/* İstekler */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#555]">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Yükleniyor...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center bg-[#161616] border border-[#222] rounded-2xl">
            <FileText className="h-12 w-12 mx-auto mb-3 text-[#333]" />
            <p className="text-[#555] text-sm">
              {activeFilter === "all" ? "Henüz özel istek göndermediniz" : `${FILTERS.find(f => f.id === activeFilter)?.label} istek yok`}
            </p>
            <p className="text-xs text-[#333] mt-1">Bir yaratıcının profiline veya videosuna giderek istek gönderin</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const st = STATUS_MAP[r.status] || { label: r.status, cls: "bg-[#222] text-[#666] border-[#333]", Icon: Clock };
              const StatusIcon = st.Icon;
              const isExpiringSoon = r.expiresAt && new Date(r.expiresAt) < new Date(Date.now() + 24 * 60 * 60 * 1000) && r.status === "pending";

              return (
                <div key={r.id} className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden hover:border-[#2a2a2a] transition-colors">
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={r.creator?.avatarUrl || ""} />
                        <AvatarFallback className="text-sm">{r.creator?.username?.substring(0,2).toUpperCase() ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">@{r.creator?.username}</span>
                          <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold", st.cls)}>
                            <StatusIcon className="h-3 w-3" /> {st.label}
                          </span>
                          {r.tokenOffer > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-900/20 border border-yellow-800 text-yellow-400 text-[10px] font-bold">
                              <Coins className="h-3 w-3" /> {r.tokenOffer} token teklif
                            </span>
                          )}
                          <span className="text-[#555] text-[10px] ml-auto">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                        </div>
                        <h3 className="font-semibold text-white">{r.title}</h3>
                        <p className="text-sm text-[#888] mt-0.5 line-clamp-2 whitespace-pre-wrap">{r.description}</p>

                        {r.responseNote && (
                          <div className="mt-3 flex items-start gap-2 bg-[#1a1a1a] border border-[#222] rounded-xl px-3 py-2.5">
                            <MessageSquare className="h-3.5 w-3.5 text-[#555] shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-[#555] font-bold mb-0.5">Yaratıcı yanıtı:</p>
                              <p className="text-xs text-[#999]">{r.responseNote}</p>
                            </div>
                          </div>
                        )}

                        {isExpiringSoon && (
                          <div className="mt-2 flex items-center gap-1.5 text-orange-400 text-xs">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Sona eriyor: {formatDistanceToNow(new Date(r.expiresAt), { addSuffix: true })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {r.status === "pending" && (
                    <div className="px-5 pb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(r.id)}
                        disabled={cancellingId === r.id}
                        className="text-xs text-[#555] hover:text-red-400 hover:bg-red-900/10 gap-1.5"
                      >
                        {cancellingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                        İsteği İptal Et
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
