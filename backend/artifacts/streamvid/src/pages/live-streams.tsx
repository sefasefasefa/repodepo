import { AppLayout } from "@/components/layout/app-layout";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Radio, Users, Clock, RefreshCw, Loader2, Calendar } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

async function apiFetch(path: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
      CANLI
    </span>
  );
}

function StreamCard({ stream, live }: { stream: any; live?: boolean }) {
  const duration = stream.startedAt
    ? formatDistanceToNow(new Date(stream.startedAt))
    : null;

  return (
    <Link href={`/live/${stream.id}`}>
      <div className="group cursor-pointer">
        <div className="relative aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#222] group-hover:border-primary/40 transition-colors">
          {stream.thumbnail ? (
            <img src={stream.thumbnail} alt={stream.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e]">
              <Radio className={cn("h-12 w-12", live ? "text-red-500 animate-pulse" : "text-[#333]")} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            {live && <LiveBadge />}
          </div>
          {live && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-white text-[11px] px-2 py-1 rounded-full">
              <Users className="h-3 w-3" />
              <span className="font-bold">{stream.viewerCount.toLocaleString("tr")}</span>
            </div>
          )}
          {duration && live && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-white text-[11px] px-2 py-1 rounded-full">
              <Clock className="h-3 w-3" />
              {duration}
            </div>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
            <AvatarImage src={stream.creator?.avatarUrl || ""} />
            <AvatarFallback className="text-[10px]">{stream.creator?.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white line-clamp-1">{stream.title}</p>
            <p className="text-xs text-[#666]">@{stream.creator?.username}</p>
            {!live && stream.endedAt && (
              <p className="text-[10px] text-[#444] mt-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(stream.endedAt), "d MMM yyyy")}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LiveStreamsPage() {
  const [live, setLive] = useState<any[]>([]);
  const [past, setPast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"live" | "past">("live");

  const load = async () => {
    setLoading(true);
    try {
      const [l, p] = await Promise.all([
        apiFetch("/live"),
        apiFetch("/live/history"),
      ]);
      setLive(l.streams || []);
      setPast(p.streams || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); document.title = "Canlı Yayınlar"; }, []);

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/10 rounded-xl">
              <Radio className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Canlı Yayınlar
                {live.length > 0 && (
                  <span className="text-base bg-red-600/20 text-red-400 border border-red-600/30 px-2 py-0.5 rounded-full text-sm font-bold">
                    {live.length} Canlı
                  </span>
                )}
              </h1>
              <p className="text-[#555] text-sm">Şu an yayında olan içerik üreticilerini izle</p>
            </div>
          </div>
          <button onClick={load} className="text-[#555] hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[#222] mb-6">
          {[
            { id: "live", label: "🔴 Şu An Yayında", count: live.length },
            { id: "past", label: "Geçmiş Yayınlar", count: past.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5",
                tab === t.id ? "border-red-500 text-red-400" : "border-transparent text-[#666] hover:text-white"
              )}>
              {t.label}
              {t.count > 0 && <span className="bg-[#222] text-[#888] text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#555]" />
          </div>
        ) : (
          <>
            {tab === "live" && (
              live.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <Radio className="h-12 w-12 mx-auto text-[#333]" />
                  <p className="text-[#555]">Şu an aktif canlı yayın yok</p>
                  <p className="text-sm text-[#333]">Creator'lar yayın başlattığında burada görünecek</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                  {live.map(s => <StreamCard key={s.id} stream={s} live />)}
                </div>
              )
            )}

            {tab === "past" && (
              past.length === 0 ? (
                <div className="py-20 text-center text-[#555]">
                  <p>Henüz geçmiş yayın yok</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                  {past.map(s => <StreamCard key={s.id} stream={s} />)}
                </div>
              )
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
