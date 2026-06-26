import { AppLayout } from "@/components/layout/app-layout";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useRef, useCallback } from "react";
import { ScreenProtectionOverlay, getVideoProtectionProps } from "@/components/video/screen-protection-overlay";
import { isScreenProtectionEnabled } from "@/lib/use-screen-protection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Hls from "hls.js";
import {
  Radio, Users, Send, Loader2, Heart, Share2,
  Volume2, VolumeX, Maximize2, RefreshCw, Clock,
  MessageSquare, X, Copy, CheckCheck, AlertCircle, Gift, Trophy,
} from "lucide-react";
import { LiveGiftPicker, GiftToastStack, LiveLeaderboard, GIFT_ITEMS } from "@/components/live/live-gifts";
import type { GiftEvent } from "@/components/live/live-gifts";
import { formatDistanceToNow } from "date-fns";
import { processMessage } from "@/lib/link-filter";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return json;
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
      CANLI
    </span>
  );
}

function ChatMessage({ msg, onDelete, canDelete }: { msg: any; onDelete?: (id: number) => void; canDelete?: boolean }) {
  return (
    <div className="group flex items-start gap-2 px-3 py-1.5 hover:bg-white/3 rounded-lg transition-colors">
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarImage src={msg.user?.avatarUrl || ""} />
        <AvatarFallback className="text-[9px]">{msg.user?.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-bold text-primary mr-1.5">
          {msg.user?.displayName || msg.user?.username}
        </span>
        <span className="text-[12px] text-[#ccc] break-words">{msg.message}</span>
      </div>
      {canDelete && onDelete && (
        <button onClick={() => onDelete(msg.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[#444] hover:text-red-400 shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function LiveWatchPage() {
  const { id } = useParams<{ id: string }>();
  const streamId = parseInt(id || "0");
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([]);
  const [tokenBalance] = useState(350);
  const [leaderboard, setLeaderboard] = useState([
    { rank: 1, username: "ali_fan_01", totalTokens: 840, topGift: "👑" },
    { rank: 2, username: "zeynep_k", totalTokens: 450, topGift: "💎" },
    { rank: 3, username: "mert_92", totalTokens: 220, topGift: "🔥" },
  ]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [sessionToken] = useState(() => `anon_${Math.random().toString(36).substring(2, 10)}`);

  const videoRef = useRef<HTMLVideoElement>(null);
  const screenProt = isScreenProtectionEnabled();
  const videoProtProps = getVideoProtectionProps(screenProt);
  const hlsRef = useRef<Hls | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await apiFetch(`/live/${streamId}`);
        setStream(d);
        setViewerCount(d.viewerCount || 0);
        if (d.status === "ended") setStreamEnded(true);
      } catch { setLocation("/live"); }
      setLoading(false);
    };
    load();
  }, [streamId]);

  useEffect(() => {
    if (!stream?.hlsUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(stream.hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      return () => { hls.destroy(); };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = stream.hlsUrl;
      video.play().catch(() => {});
    }
    return undefined;
  }, [stream?.hlsUrl]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (!streamId) return;
    const token = localStorage.getItem("token");
    const url = `/api/live/${streamId}/chat/stream${token ? `?token=${token}` : ""}`;
    const es = new EventSource(url);
    sseRef.current = es;

    es.addEventListener("history", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setChatMessages(data.messages || []);
      } catch {}
    });

    es.addEventListener("message", (e) => {
      try {
        const msg = JSON.parse((e as MessageEvent).data);
        setChatMessages(prev => [...prev.slice(-199), msg]);
      } catch {}
    });

    es.addEventListener("viewers", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setViewerCount(data.count);
      } catch {}
    });

    es.addEventListener("stream_end", () => {
      setStreamEnded(true);
    });

    es.addEventListener("stream_start", () => {
      setStreamEnded(false);
      setStream((prev: any) => prev ? { ...prev, status: "live" } : prev);
    });

    es.addEventListener("delete_message", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setChatMessages(prev => prev.filter(m => m.id !== data.id));
      } catch {}
    });

    return () => { es.close(); };
  }, [streamId]);

  useEffect(() => {
    if (!streamId || !stream) return;
    const beat = async () => {
      try {
        const d = await apiFetch(`/live/${streamId}/view`, {
          method: "POST",
          body: JSON.stringify({ sessionToken }),
        });
        setViewerCount(d.viewerCount || 0);
      } catch {}
    };
    beat();
    heartbeatRef.current = setInterval(beat, 15_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [streamId, stream, sessionToken]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() || !user || sending) return;
    setSending(true);
    const raw = chatText.trim();
    const { filtered, hadLinks } = processMessage(raw, (user as any).username ?? "user", "chat", `live_${streamId}`);
    setChatText("");
    try {
      await apiFetch(`/live/${streamId}/chat`, { method: "POST", body: JSON.stringify({ message: filtered }) });
      if (hadLinks) {
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          message: "⚠️ Mesajındaki link engellendi — admin onayı bekleniyor.",
          userId: (user as any).id,
          username: (user as any).username,
          userAvatarUrl: (user as any).avatarUrl,
          isCreator: false,
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch (err: any) { setChatText(raw); }
    setSending(false);
  };

  const deleteMsg = async (msgId: number) => {
    try {
      await apiFetch(`/live/${streamId}/chat/${msgId}`, { method: "DELETE" });
      setChatMessages(prev => prev.filter(m => m.id !== msgId));
    } catch {}
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fullscreen = () => { videoRef.current?.requestFullscreen?.(); };

  const sendGift = useCallback((gift: typeof GIFT_ITEMS[0], count: number) => {
    const ev: GiftEvent = {
      id: `${Date.now()}_${Math.random()}`,
      senderName: (user as any)?.displayName || (user as any)?.username || "Sen",
      gift,
      count,
      timestamp: Date.now(),
    };
    setGiftEvents(prev => [...prev.slice(-4), ev]);
    setLeaderboard(prev => {
      const existing = prev.find(e => e.username === ev.senderName);
      if (existing) {
        return prev.map(e => e.username === ev.senderName
          ? { ...e, totalTokens: e.totalTokens + gift.tokens * count }
          : e
        ).sort((a, b) => b.totalTokens - a.totalTokens).map((e, i) => ({ ...e, rank: i + 1 }));
      }
      return [...prev, { rank: prev.length + 1, username: ev.senderName, totalTokens: gift.tokens * count, topGift: gift.emoji }]
        .sort((a, b) => b.totalTokens - a.totalTokens)
        .map((e, i) => ({ ...e, rank: i + 1 }));
    });
    setTimeout(() => {
      setGiftEvents(p => p.filter(e => e.id !== ev.id));
    }, 4000);
  }, [user]);

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96 gap-2 text-[#555]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    </AppLayout>
  );

  if (!stream) return null;
  const isCreator = user?.id === stream.userId || user?.role === "admin";

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-[#0e0e0e]">

        {/* Video Bölümü */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="relative bg-black" style={{ aspectRatio: "16/9", maxHeight: "calc(100vh - 56px - 80px)" }}>
            {stream.status === "live" && stream.hlsUrl ? (
              <ScreenProtectionOverlay className="w-full h-full">
                <video
                  ref={videoRef}
                  className="w-full h-full"
                  autoPlay
                  playsInline
                  muted={muted}
                  {...videoProtProps}
                />
              </ScreenProtectionOverlay>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className={cn(
                  "p-6 rounded-full",
                  stream.status === "live" ? "bg-red-600/20" : "bg-[#1a1a1a]"
                )}>
                  <Radio className={cn(
                    "h-16 w-16",
                    stream.status === "live" ? "text-red-500 animate-pulse" : "text-[#333]"
                  )} />
                </div>
                {stream.status === "live" ? (
                  <>
                    <p className="text-white font-bold text-lg">Yayın Devam Ediyor</p>
                    <p className="text-[#555] text-sm">HLS URL bağlanıyor...</p>
                  </>
                ) : stream.status === "idle" ? (
                  <>
                    <p className="text-[#555] font-medium">Yayın Henüz Başlamadı</p>
                    <p className="text-[#333] text-sm">Creator yayını başlattığında otomatik başlayacak</p>
                  </>
                ) : (
                  <>
                    <p className="text-[#555] font-medium">Yayın Sona Erdi</p>
                    <Button variant="secondary" onClick={() => setLocation("/live")} className="mt-2">
                      Diğer Yayınlara Bak
                    </Button>
                  </>
                )}
              </div>
            )}

            <GiftToastStack events={giftEvents} />

            {stream.status === "live" && stream.hlsUrl && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                  <button onClick={() => setMuted(!muted)} className="text-white hover:text-primary transition-colors">
                    {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                </div>
                <button onClick={fullscreen} className="text-white hover:text-primary transition-colors">
                  <Maximize2 className="h-5 w-5" />
                </button>
              </div>
            )}

            {streamEnded && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
                <AlertCircle className="h-12 w-12 text-[#555]" />
                <p className="text-white font-bold text-lg">Yayın Sona Erdi</p>
                <Button variant="secondary" onClick={() => setLocation("/live")}>Diğer Yayınlara Bak</Button>
              </div>
            )}
          </div>

          {/* Stream info bar */}
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={stream.creator?.avatarUrl || ""} />
                <AvatarFallback className="text-xs">{stream.creator?.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-white text-sm truncate">{stream.title}</h2>
                  {stream.status === "live" && <LiveBadge />}
                </div>
                <p className="text-xs text-[#555]">@{stream.creator?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 text-sm text-[#aaa]">
                <Users className="h-4 w-4 text-red-400" />
                <span className="font-bold text-white">{viewerCount.toLocaleString("tr")}</span>
                <span className="text-[#555]">izleyici</span>
              </div>
              {stream.startedAt && stream.status === "live" && (
                <div className="flex items-center gap-1 text-xs text-[#555]">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDistanceToNow(new Date(stream.startedAt))}
                </div>
              )}
              <button onClick={copyLink}
                className="flex items-center gap-1.5 text-xs text-[#666] hover:text-white transition-colors border border-[#2a2a2a] hover:border-[#444] rounded-lg px-3 py-1.5">
                {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-400" /> : <Share2 className="h-3.5 w-3.5" />}
                {copied ? "Kopyalandı" : "Paylaş"}
              </button>
              <button
                onClick={() => setChatOpen(p => !p)}
                className={cn("p-1.5 rounded-lg border transition-colors",
                  chatOpen ? "border-primary/40 text-primary bg-primary/10" : "border-[#2a2a2a] text-[#555] hover:text-white"
                )}>
                <MessageSquare className="h-4 w-4" />
              </button>
            </div>
          </div>

          {stream.description && (
            <div className="px-4 py-2">
              <p className="text-sm text-[#666] line-clamp-2">{stream.description}</p>
            </div>
          )}
        </div>

        {/* Sohbet Bölümü */}
        {chatOpen && (
          <div className="w-80 shrink-0 border-l border-[#1a1a1a] flex flex-col bg-[#111] hidden md:flex">
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1">
                <button onClick={() => setShowLeaderboard(false)}
                  className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all",
                    !showLeaderboard ? "bg-primary/15 text-primary" : "text-[#555] hover:text-white")}>
                  <MessageSquare className="h-3.5 w-3.5" /> Sohbet
                </button>
                <button onClick={() => setShowLeaderboard(true)}
                  className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all",
                    showLeaderboard ? "bg-amber-500/15 text-amber-400" : "text-[#555] hover:text-white")}>
                  <Trophy className="h-3.5 w-3.5" /> Sıralama
                </button>
              </div>
              {!stream.chatEnabled && (
                <span className="text-[10px] text-[#555] bg-[#222] px-2 py-0.5 rounded-full">Kapalı</span>
              )}
            </div>

            {showLeaderboard && (
              <div className="flex-1 overflow-y-auto p-3">
                <LiveLeaderboard entries={leaderboard} />
              </div>
            )}

            {!showLeaderboard && <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
              {chatMessages.length === 0 ? (
                <div className="py-8 text-center text-[#444]">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">İlk mesajı sen at!</p>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <ChatMessage
                    key={msg.id}
                    msg={msg}
                    canDelete={isCreator}
                    onDelete={deleteMsg}
                  />
                ))
              )}
              <div ref={chatBottomRef} />
            </div>}

            {!showLeaderboard && stream.chatEnabled ? (
              user ? (
                <form onSubmit={sendChat}
                  className="px-3 py-3 border-t border-[#1a1a1a] flex gap-2 shrink-0 relative">
                  <Input
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    placeholder="Mesaj yaz..."
                    className="flex-1 bg-[#1a1a1a] border-[#2a2a2a] text-sm rounded-xl h-9 px-3 focus-visible:ring-1 focus-visible:ring-primary"
                    maxLength={300}
                    disabled={sending}
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => setGiftPickerOpen(p => !p)}
                    className={cn("h-9 w-9 shrink-0 rounded-xl flex items-center justify-center transition-all",
                      giftPickerOpen ? "bg-pink-600 text-white" : "bg-[#222] text-[#888] hover:bg-[#2a2a2a] hover:text-pink-400")}>
                    <Gift className="h-4 w-4" />
                  </button>
                  <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-xl"
                    disabled={!chatText.trim() || sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                  <LiveGiftPicker
                    open={giftPickerOpen}
                    onClose={() => setGiftPickerOpen(false)}
                    onSend={sendGift}
                    tokenBalance={tokenBalance}
                  />
                </form>
              ) : (
                <div className="px-3 py-3 border-t border-[#1a1a1a] shrink-0 text-center">
                  <p className="text-xs text-[#555] mb-2">Sohbet için giriş yapın</p>
                  <Button variant="outline" size="sm" onClick={() => setLocation("/login")} className="text-xs h-7">
                    Giriş Yap
                  </Button>
                </div>
              )
            ) : (
              <div className="px-3 py-3 border-t border-[#1a1a1a] shrink-0 text-center">
                <p className="text-xs text-[#444]">Sohbet devre dışı</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
