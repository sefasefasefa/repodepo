import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  Radio, Play, Square, RefreshCw, Copy, CheckCheck, Eye, Loader2,
  Settings, Key, ExternalLink, AlertTriangle, CheckCircle, Clock,
  Users, TrendingUp, Video,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return json;
}

const STATUS_CONFIG = {
  idle:  { label: "Hazır",    cls: "bg-[#222] text-[#888] border-[#333]",   dot: "bg-[#555]" },
  live:  { label: "CANLI",    cls: "bg-red-900/30 text-red-400 border-red-700", dot: "bg-red-500 animate-pulse" },
  ended: { label: "Bitti",    cls: "bg-[#1a1a1a] text-[#444] border-[#222]", dot: "bg-[#333]" },
};

export function CreatorLivePanel() {
  const [, setLocation] = useLocation();
  const [streams, setStreams] = useState<any[]>([]);
  const [activeStream, setActiveStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [ending, setEnding] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [msg, setMsg] = useState("");

  // Form alanları
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hlsUrl, setHlsUrl] = useState("");
  const [chatEnabled, setChatEnabled] = useState(true);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOption1, setPollOption1] = useState("");
  const [pollOption2, setPollOption2] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalProgress, setGoalProgress] = useState("");

  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const loadStreams = async () => {
    setLoading(true);
    try {
      const d = await apiFetch("/live/my/streams");
      const list = d.streams || [];
      setStreams(list);
      // Aktif olanı bul
      const live = list.find((s: any) => s.status === "live");
      const idle = list.find((s: any) => s.status === "idle");
      setActiveStream(live || idle || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadStreams(); }, []);

  const createStream = async () => {
    if (!title.trim()) { setMsg("Başlık giriniz"); return; }
    setCreating(true); setMsg("");
    try {
      const d = await apiFetch("/live", {
        method: "POST",
        body: JSON.stringify({ title, description, hlsUrl: hlsUrl || undefined, chatEnabled, pollQuestion: pollQuestion || undefined, pollOptions: [pollOption1, pollOption2].filter(Boolean), goalTitle: goalTitle || undefined, goalTarget: goalTarget ? Number(goalTarget) : undefined, goalProgress: goalProgress ? Number(goalProgress) : undefined }),
      });
      setActiveStream(d.stream);
      setStreams(prev => [d.stream, ...prev]);
      setTitle(""); setDescription(""); setHlsUrl("");
      setPollQuestion(""); setPollOption1(""); setPollOption2(""); setGoalTitle(""); setGoalTarget(""); setGoalProgress("");
      setMsg("✓ Yayın oluşturuldu!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e: any) { setMsg(e.message); }
    setCreating(false);
  };

  const goLive = async () => {
    if (!activeStream) return;
    setGoingLive(true); setMsg("");
    try {
      const d = await apiFetch(`/live/${activeStream.id}/go-live`, { method: "POST" });
      setActiveStream(d.stream);
      setStreams(prev => prev.map(s => s.id === d.stream.id ? d.stream : s));
      setMsg("🔴 Yayın başladı!");
    } catch (e: any) { setMsg(e.message); }
    setGoingLive(false);
  };

  const endStream = async () => {
    if (!activeStream || !confirm("Yayını bitirmek istediğinizden emin misiniz?")) return;
    setEnding(true); setMsg("");
    try {
      const d = await apiFetch(`/live/${activeStream.id}/end`, { method: "POST" });
      setActiveStream(null);
      setStreams(prev => prev.map(s => s.id === d.stream.id ? d.stream : s));
      setMsg("Yayın sonlandırıldı.");
    } catch (e: any) { setMsg(e.message); }
    setEnding(false);
  };

  const rotateKey = async () => {
    if (!activeStream || !confirm("Stream key yenilenecek. Emin misiniz?")) return;
    setRotatingKey(true);
    try {
      const d = await apiFetch(`/live/${activeStream.id}/rotate-key`, { method: "POST" });
      setActiveStream((p: any) => ({ ...p, streamKey: d.stream.streamKey }));
    } catch (e: any) { setMsg(e.message); }
    setRotatingKey(false);
  };

  const copyKey = () => {
    navigator.clipboard.writeText(activeStream?.streamKey || "");
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-[#555]">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );

  const sc = activeStream ? STATUS_CONFIG[activeStream.status as keyof typeof STATUS_CONFIG] : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 text-red-500" />
        <h2 className="text-xl font-bold text-white">Canlı Yayın Yönetimi</h2>
      </div>

      {msg && (
        <div className={cn("px-4 py-3 rounded-xl text-sm border",
          msg.startsWith("✓") || msg.startsWith("🔴")
            ? "bg-green-900/20 text-green-400 border-green-800"
            : "bg-red-900/20 text-red-400 border-red-800"
        )}>
          {msg}
        </div>
      )}

      {/* Aktif yayın paneli */}
      {activeStream ? (
        <div className="space-y-4">
          {/* Durum kartı */}
          <div className={cn(
            "border-2 rounded-2xl p-5 transition-all",
            activeStream.status === "live"
              ? "border-red-600/40 bg-red-900/10"
              : "border-[#2a2a2a] bg-[#161616]"
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={cn("p-2.5 rounded-xl mt-0.5", activeStream.status === "live" ? "bg-red-500/20" : "bg-[#222]")}>
                  <Radio className={cn("h-5 w-5", activeStream.status === "live" ? "text-red-500 animate-pulse" : "text-[#555]")} />
                </div>
                <div>
                  <p className="font-bold text-white text-base">{activeStream.title}</p>
                  {sc && (
                    <span className={cn("inline-flex items-center gap-1.5 mt-1 text-xs font-bold px-2 py-0.5 rounded-full border", sc.cls)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                      {sc.label}
                    </span>
                  )}
                  {activeStream.startedAt && activeStream.status === "live" && (
                    <p className="text-xs text-[#555] mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(activeStream.startedAt))} süredir yayında
                    </p>
                  )}
                </div>
              </div>
              {/* İzleyici sayısı */}
              {activeStream.status === "live" && (
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-red-400">{activeStream.viewerCount || 0}</p>
                  <p className="text-xs text-[#555]">izleyici</p>
                </div>
              )}
            </div>

            {/* Yayın istatistikleri */}
            {(activeStream.peakViewers > 0 || activeStream.totalViews > 0) && (
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#2a2a2a]">
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{activeStream.viewerCount}</p>
                  <p className="text-[10px] text-[#555]">Anlık</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-yellow-400">{activeStream.peakViewers}</p>
                  <p className="text-[10px] text-[#555]">Zirve</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-400">{activeStream.totalViews}</p>
                  <p className="text-[10px] text-[#555]">Toplam</p>
                </div>
              </div>
            )}
          </div>

          {/* Stream Key */}
          <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-[#888]" />
              <h3 className="font-semibold text-sm">Stream Key</h3>
              <span className="text-xs text-[#444]">(OBS, vb. yazılımlar için)</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 font-mono text-sm text-[#888] overflow-hidden">
                {showKey ? activeStream.streamKey : "sk_" + "•".repeat(30)}
              </div>
              <button onClick={() => setShowKey(p => !p)}
                className="px-3 py-2.5 bg-[#222] border border-[#333] rounded-xl text-xs text-[#888] hover:text-white transition-colors shrink-0">
                {showKey ? "Gizle" : "Göster"}
              </button>
              <button onClick={copyKey}
                className="p-2.5 bg-[#222] border border-[#333] rounded-xl text-[#888] hover:text-white transition-colors shrink-0">
                {copiedKey ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={rotateKey} disabled={rotatingKey || activeStream.status === "live"}
                className="text-xs text-[#555] hover:text-red-400 flex items-center gap-1 transition-colors disabled:opacity-40">
                {rotatingKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Key Yenile
              </button>
              <span className="text-[#333]">•</span>
              <p className="text-xs text-[#444]">RTMP URL: <code className="text-[#666]">rtmp://ingest.prnhbbbb.com/live</code></p>
            </div>
          </div>

          {/* HLS URL (isteğe bağlı) */}
          {activeStream.status !== "live" && (
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#888]" />
                <h3 className="font-semibold text-sm">HLS Yayın URL'si</h3>
                <span className="text-xs text-[#444]">(opsiyonel — dış kaynak)</span>
              </div>
              <Input
                value={hlsUrl}
                onChange={e => setHlsUrl(e.target.value)}
                placeholder="https://... .m3u8"
                className="bg-[#1a1a1a] border-[#2a2a2a] font-mono text-sm"
              />
              <Button
                onClick={async () => {
                  try {
                    await apiFetch(`/live/${activeStream.id}`, { method: "PATCH", body: JSON.stringify({ hlsUrl: hlsUrl || null }) });
                    setActiveStream((p: any) => ({ ...p, hlsUrl }));
                    setMsg("✓ HLS URL güncellendi");
                    setTimeout(() => setMsg(""), 3000);
                  } catch (e: any) { setMsg(e.message); }
                }}
                size="sm" variant="secondary">
                Kaydet
              </Button>
            </div>
          )}

          {/* Eylem butonları */}
          <div className="flex gap-3 flex-wrap">
            {activeStream.status === "idle" && (
              <Button onClick={goLive} disabled={goingLive}
                className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                {goingLive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Yayını Başlat
              </Button>
            )}
            {activeStream.status === "live" && (
              <>
                <Button onClick={() => setLocation(`/live/${activeStream.id}`)} variant="secondary" className="gap-2">
                  <ExternalLink className="h-4 w-4" /> Yayını İzle
                </Button>
                <Button onClick={endStream} disabled={ending}
                  className="gap-2 bg-gray-700 hover:bg-gray-600 text-white">
                  {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  Yayını Bitir
                </Button>
              </>
            )}
            <Button onClick={loadStreams} variant="ghost" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        /* Yeni Yayın Oluştur */
        <div className="bg-[#161616] border border-[#222] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1e1e1e]">
            <Video className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Yeni Yayın Kur</h3>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Yayın Başlığı *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Yayın başlığını yaz..."
              className="bg-[#1e1e1e] border-[#2a2a2a]" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Açıklama</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Kısa açıklama..."
              className="bg-[#1e1e1e] border-[#2a2a2a]" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">HLS URL <span className="text-[#444]">(opsiyonel — boş bırakılabilir)</span></label>
            <Input value={hlsUrl} onChange={e => setHlsUrl(e.target.value)} placeholder="https://... .m3u8"
              className="bg-[#1e1e1e] border-[#2a2a2a] font-mono text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setChatEnabled(p => !p)}
              className={cn("relative w-10 h-5 rounded-full transition-colors border", chatEnabled ? "bg-primary border-primary" : "bg-[#2a2a2a] border-[#333]")}>
              <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow", chatEnabled ? "left-5" : "left-0.5")} />
            </button>
            <span className="text-sm text-[#888]">Sohbet Aktif</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold">Anket</p>
              <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Anket sorusu" className="bg-[#1e1e1e] border-[#2a2a2a]" />
              <Input value={pollOption1} onChange={e => setPollOption1(e.target.value)} placeholder="Seçenek 1" className="bg-[#1e1e1e] border-[#2a2a2a]" />
              <Input value={pollOption2} onChange={e => setPollOption2(e.target.value)} placeholder="Seçenek 2" className="bg-[#1e1e1e] border-[#2a2a2a]" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Hedef</p>
              <Input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="Hedef başlığı" className="bg-[#1e1e1e] border-[#2a2a2a]" />
              <Input value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="Hedef sayı" type="number" className="bg-[#1e1e1e] border-[#2a2a2a]" />
              <Input value={goalProgress} onChange={e => setGoalProgress(e.target.value)} placeholder="İlerleme" type="number" className="bg-[#1e1e1e] border-[#2a2a2a]" />
            </div>
          </div>
          <Button onClick={createStream} disabled={creating || !title.trim()} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            Yayın Oluştur
          </Button>
        </div>
      )}

      {/* Geçmiş yayınlar */}
      {streams.filter(s => s.status === "ended").length > 0 && (
        <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#888]" />
            <h3 className="font-semibold text-sm">Geçmiş Yayınlar</h3>
          </div>
          <div className="divide-y divide-[#1a1a1a]">
            {streams.filter(s => s.status === "ended").slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-[10px] text-[#555] mt-0.5">{s.endedAt ? format(new Date(s.endedAt), "d MMM yyyy HH:mm") : "—"}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-yellow-400 font-bold">{s.peakViewers} zirve</p>
                  <p className="text-[#555]">{s.totalViews} görüntülenme</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
