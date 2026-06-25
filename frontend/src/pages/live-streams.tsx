import { AppLayout } from "@/components/layout/app-layout";
import { useFeatureState } from "@/lib/feature-flags";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Radio, Users, Clock, RefreshCw, Loader2, Calendar, Ban } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

async function apiFetch(path: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return res.json();
}

function ActionButton({ feature, children, className, onClick }: { feature: string; children: React.ReactNode; className?: string; onClick: () => void }) {
  const state = useFeatureState(feature);
  if (state === "disabled") return null;
  return <button onClick={state === "maintenance" ? () => toast("Bu özellik bakımdadır") : onClick} className={className}>{children}</button>;
}

function LiveBadge() { return <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide"><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />CANLI</span>; }
function StreamCard({ stream, live }: { stream: any; live?: boolean }) { const duration = stream.startedAt ? formatDistanceToNow(new Date(stream.startedAt)) : null; return <Link href={`/live/${stream.id}`}><div className="group cursor-pointer"><div className="relative aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#222] group-hover:border-primary/40 transition-colors">{stream.thumbnail ? <img src={stream.thumbnail} alt={stream.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e]"><Radio className={cn("h-12 w-12", live ? "text-red-500 animate-pulse" : "text-[#333]")} /></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />{live && <div className="absolute top-2 left-2 flex items-center gap-1.5"><LiveBadge /></div>}{live && <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-white text-[11px] px-2 py-1 rounded-full"><Users className="h-3 w-3" /><span className="font-bold">{stream.viewerCount.toLocaleString("tr")}</span></div>}{duration && live && <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-white text-[11px] px-2 py-1 rounded-full"><Clock className="h-3 w-3" />{duration}</div>}</div><div className="mt-2.5 flex gap-2"><Avatar className="h-8 w-8 shrink-0 mt-0.5"><AvatarImage src={stream.creator?.avatarUrl || ""} /><AvatarFallback className="text-[10px]">{stream.creator?.username?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><p className="font-semibold text-sm text-[#eee] line-clamp-2 leading-tight">{stream.title}</p><p className="text-xs text-[#888] mt-0.5">{stream.creator?.displayName || stream.creator?.username}</p>{!live && stream.endedAt && <p className="text-xs text-[#555] mt-0.5 flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(stream.endedAt), "d MMM yyyy")}</p>}</div></div></div></Link>; }

export default function LiveStreamsPage() {
  const state = useFeatureState("live_streams");
  const [, setLocation] = useLocation();
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [pastStreams, setPastStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"live" | "past">("live");

  useEffect(() => { if (state === "disabled") { setLocation("/"); return; } const load = async () => { setLoading(true); const [live, past] = await Promise.all([apiFetch("/live").catch(() => ({ streams: [] })), apiFetch("/live/history").catch(() => ({ streams: [] }))]); setLiveStreams(live.streams || []); setPastStreams(past.streams || []); setLoading(false); }; load(); }, [state]);
  if (state === "disabled") return null;

  return <AppLayout><div className="max-w-6xl mx-auto px-4 py-6"><div className="flex items-center justify-between mb-6"><div className="flex items-center gap-3"><div className="p-2 bg-red-500/10 rounded-lg"><Radio className="h-6 w-6 text-red-500" /></div><div><h1 className="text-xl font-bold">Canlı Yayınlar</h1><p className="text-[#666] text-sm">Gerçek zamanlı içerik</p></div></div><ActionButton feature="live_streams" onClick={() => { setLoading(true); apiFetch(tab === "live" ? "/live" : "/live/history").then(d => { if (tab === "live") setLiveStreams(d.streams || []); else setPastStreams(d.streams || []); setLoading(false); }); }} className="text-[#555] hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></ActionButton></div><div className="flex gap-1 mb-6 border-b border-[#222]"><div className="flex gap-1">{(["live", "past"] as const).map(t => <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px", tab === t ? "border-primary text-primary" : "border-transparent text-[#888] hover:text-white")}>{t === "live" ? "🔴 Şu An Canlı" : "📼 Geçmiş Yayınlar"}</button>)}</div></div>{loading ? <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#444]" /></div> : tab === "live" ? (liveStreams.length === 0 ? <div className="flex flex-col items-center justify-center py-20 gap-4 text-center"><div className="p-5 bg-[#1a1a1a] rounded-full"><Radio className="h-10 w-10 text-[#333]" /></div><p className="text-[#555]">Şu an canlı yayın bulunmuyor</p><p className="text-[#444] text-sm">Geçmiş yayınları inceleyebilirsiniz</p></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{liveStreams.map(s => <StreamCard key={s.id} stream={s} live />)}</div>) : (pastStreams.length === 0 ? <div className="flex flex-col items-center justify-center py-20 gap-4"><div className="p-5 bg-[#1a1a1a] rounded-full"><Clock className="h-10 w-10 text-[#333]" /></div><p className="text-[#555]">Geçmiş yayın bulunamadı</p></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{pastStreams.map(s => <StreamCard key={s.id} stream={s} />)}</div>)}</div></AppLayout>;
}
