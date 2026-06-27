import { AppLayout } from "@/components/layout/app-layout";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useFeatureState } from "@/lib/feature-flags";
import { useState, useEffect, useRef, useCallback } from "react";
import { ScreenProtectionOverlay, getVideoProtectionProps } from "@/components/video/screen-protection-overlay";
import { useScreenProtectionState } from "@/lib/use-screen-protection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Hls from "hls.js";
import { Radio, Users, Send, Loader2, Heart, Share2, Volume2, VolumeX, Maximize2, RefreshCw, Clock, MessageSquare, X, Copy, CheckCheck, AlertCircle, Gift, Trophy, Target, BarChart3 } from "lucide-react";
import { LiveGiftPicker, GiftToastStack, LiveLeaderboard, GIFT_ITEMS } from "@/components/live/live-gifts";
import type { GiftEvent } from "@/components/live/live-gifts";
import { formatDistanceToNow } from "date-fns";
import { processMessage } from "@/lib/link-filter";
import { toast } from "sonner";

async function apiFetch(path: string, opts: RequestInit = {}) { const token = localStorage.getItem("token"); const res = await fetch(`/api${path}`, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) } }); const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || res.statusText); return json; }
function LiveBadge() { return <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide"><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />CANLI</span>; }
function ChatMessage({ msg, onDelete, canDelete }: { msg: any; onDelete?: (id: number) => void; canDelete?: boolean }) { return <div className="group flex items-start gap-2 px-3 py-1.5 hover:bg-white/3 rounded-lg transition-colors"><Avatar className="h-6 w-6 shrink-0 mt-0.5"><AvatarImage src={msg.user?.avatarUrl || ""} /><AvatarFallback className="text-[9px]">{msg.user?.username?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><span className="text-[11px] font-bold text-primary mr-1.5">{msg.user?.displayName || msg.user?.username}</span><span className="text-[12px] text-[#ccc] break-words">{msg.message}</span></div>{canDelete && onDelete && <button onClick={() => onDelete(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#444] hover:text-red-400 shrink-0"><X className="h-3.5 w-3.5" /></button>}</div>; }

export default function LiveWatchPage() { const { id } = useParams<{ id: string }>(); const streamId = parseInt(id || "0"); const { user } = useAuth(); const [, setLocation] = useLocation(); const state = useFeatureState("live_streams"); const chatState = useFeatureState("live_chat"); const [stream, setStream] = useState<any>(null); const [loading, setLoading] = useState(true); const [chatMessages, setChatMessages] = useState<any[]>([]); const [chatText, setChatText] = useState(""); const [sending, setSending] = useState(false); const [viewerCount, setViewerCount] = useState(0); const [muted, setMuted] = useState(false); const [chatOpen, setChatOpen] = useState(true); const [copied, setCopied] = useState(false); const [streamEnded, setStreamEnded] = useState(false); const [giftPickerOpen, setGiftPickerOpen] = useState(false); const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([]); const [tokenBalance, setTokenBalance] = useState(0); const [leaderboard, setLeaderboard] = useState<any[]>([]); const [showLeaderboard, setShowLeaderboard] = useState(false); const [pollChoice, setPollChoice] = useState<number | null>(null); const [sessionToken] = useState(() => `anon_${Math.random().toString(36).substring(2, 10)}`); const videoRef = useRef<HTMLVideoElement>(null); const screenProt = isScreenProtectionEnabled(); const videoProtProps = getVideoProtectionProps(screenProt); const hlsRef = useRef<Hls | null>(null); const chatBottomRef = useRef<HTMLDivElement>(null); const sseRef = useRef<EventSource | null>(null); const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { if (state === "disabled") { setLocation("/"); return; } }, [state]);
  useEffect(() => { if (!user) return; apiFetch("/tokens/balance").then(d => setTokenBalance(d.balance ?? 0)).catch(() => {}); }, [user]);
  useEffect(() => { const load = async () => { try { const d = await apiFetch(`/live/${streamId}`); setStream(d); setViewerCount(d.viewerCount || 0); if (d.status === "ended") setStreamEnded(true); } catch { setLocation("/live"); } setLoading(false); }; load(); }, [streamId]);
  useEffect(() => { if (!stream?.hlsUrl || !videoRef.current) return; const video = videoRef.current; if (Hls.isSupported()) { const hls = new Hls({ enableWorker: false }); hlsRef.current = hls; hls.loadSource(stream.hlsUrl); hls.attachMedia(video); hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); }); return () => { hls.destroy(); }; } else if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = stream.hlsUrl; video.play().catch(() => {}); } return undefined; }, [stream?.hlsUrl]);
  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);
  useEffect(() => { if (!streamId || chatState === "disabled") return; const token = localStorage.getItem("token"); const url = `/api/live/${streamId}/chat/stream${token ? `?token=${token}` : ""}`; const es = new EventSource(url); sseRef.current = es; es.addEventListener("history", (e) => { try { const data = JSON.parse((e as MessageEvent).data); setChatMessages(data.messages || []); } catch {} }); es.addEventListener("message", (e) => { try { const msg = JSON.parse((e as MessageEvent).data); setChatMessages(prev => [...prev.slice(-199), msg]); } catch {} }); es.addEventListener("viewers", (e) => { try { const data = JSON.parse((e as MessageEvent).data); setViewerCount(data.count); } catch {} }); es.addEventListener("poll_update", (e) => { try { const data = JSON.parse((e as MessageEvent).data); setStream((prev: any) => prev ? { ...prev, pollVotes: data.pollVotes } : prev); } catch {} }); es.addEventListener("goal_update", (e) => { try { const data = JSON.parse((e as MessageEvent).data); setStream((prev: any) => prev ? { ...prev, ...data } : prev); } catch {} }); es.addEventListener("stream_end", () => { setStreamEnded(true); }); es.addEventListener("stream_start", () => { setStreamEnded(false); setStream((prev: any) => prev ? { ...prev, status: "live" } : prev); }); es.addEventListener("delete_message", (e) => { try { const data = JSON.parse((e as MessageEvent).data); setChatMessages(prev => prev.filter(m => m.id !== data.id)); } catch {} }); return () => { es.close(); }; }, [streamId, chatState]);
  useEffect(() => { if (!streamId || !stream) return; const beat = async () => { try { const d = await apiFetch(`/live/${streamId}/view`, { method: "POST", body: JSON.stringify({ sessionToken }) }); setViewerCount(d.viewerCount || 0); } catch {} }; beat(); heartbeatRef.current = setInterval(beat, 15_000); return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); }; }, [streamId, stream, sessionToken]);
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  const sendChat = async (e: React.FormEvent) => { e.preventDefault(); if (!chatText.trim() || !user || sending || chatState === "maintenance") { if (chatState === "maintenance") toast("Bu özellik bakımdadır"); return; } setSending(true); const raw = chatText.trim(); const { filtered } = processMessage(raw, (user as any)?.username || "sen", "chat", `live_${streamId}`); setChatText(""); try { await apiFetch(`/live/${streamId}/chat`, { method: "POST", body: JSON.stringify({ message: filtered }) }); } catch (err: any) { setChatText(raw); } setSending(false); };
  const sendPollVote = async (optionIndex: number) => { if (!user) return; setPollChoice(optionIndex); try { const d = await apiFetch(`/live/${streamId}/poll`, { method: "POST", body: JSON.stringify({ optionIndex, sessionToken }) }); setStream((prev: any) => prev ? { ...prev, pollVotes: d.pollVotes } : prev); } catch {} };
  const deleteMsg = async (msgId: number) => { try { await apiFetch(`/live/${streamId}/chat/${msgId}`, { method: "DELETE" }); setChatMessages(prev => prev.filter(m => m.id !== msgId)); } catch {} };
  const copyLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const fullscreen = () => { videoRef.current?.requestFullscreen?.(); };
  const openCreatorProfile = () => { const creatorId = stream?.creator?.id || stream?.user?.id || stream?.owner?.id; if (creatorId) setLocation(`/creators/${creatorId}`); };
  const sendGift = useCallback((gift: typeof GIFT_ITEMS[0], count: number) => { const ev: GiftEvent = { id: `${Date.now()}_${Math.random()}`, senderName: (user as any)?.displayName || (user as any)?.username || "Sen", gift, count, timestamp: Date.now() }; setGiftEvents(prev => [...prev.slice(-4), ev]); setLeaderboard(prev => { const existing = prev.find(e => e.username === ev.senderName); if (existing) return prev.map(e => e.username === ev.senderName ? { ...e, totalTokens: e.totalTokens + gift.tokens * count } : e).sort((a, b) => b.totalTokens - a.totalTokens).map((e, i) => ({ ...e, rank: i + 1 })); return [...prev, { rank: prev.length + 1, username: ev.senderName, totalTokens: gift.tokens * count, topGift: gift.emoji }].sort((a, b) => b.totalTokens - a.totalTokens).map((e, i) => ({ ...e, rank: i + 1 })); }); setTimeout(() => { setGiftEvents(p => p.filter(e => e.id !== ev.id)); }, 4000); }, [user]);
  if (loading) return <AppLayout><div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-[#444]" /></div></AppLayout>;
  if (!stream) return <AppLayout><div className="flex flex-col items-center justify-center h-96 gap-3"><AlertCircle className="h-10 w-10 text-[#444]" /><p className="text-[#555]">Yayın bulunamadı</p></div></AppLayout>;
  const isOwner = user && (stream.userId === user.id || (user as any).role === "admin");
  const showChat = chatState !== "disabled" && stream.chatEnabled && chatOpen;
  const pollVotes = Array.isArray(stream?.pollVotes) ? stream.pollVotes : [];
  const pollTotal = pollVotes.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
  const pollOptions = Array.isArray(stream?.pollOptions) ? stream.pollOptions : [];
  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-[#0a0a0a]">
        <div className="flex-1 flex flex-col min-w-0 relative">
          <GiftToastStack events={giftEvents} />
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold text-white">{stream?.goalTitle || "Yayın hedefi"}</p>
                {stream?.goalTarget ? (
                  <p className="text-[11px] text-[#666]">{stream.goalProgress || 0} / {stream.goalTarget}</p>
                ) : (
                  <p className="text-[11px] text-[#666]">Henüz hedef ayarlanmadı</p>
                )}
              </div>
            </div>
            <div className="w-40 h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
              <div className="h-full bg-primary" style={{ width: stream?.goalTarget ? `${Math.min(100, Math.round(((stream.goalProgress || 0) / stream.goalTarget) * 100))}%` : "0%" }} />
            </div>
          </div>
          {pollOptions.length > 0 && (
            <div className="mx-4 mt-4 bg-[#111] border border-[#222] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm text-white">{stream?.pollQuestion || "Anket"}</p>
              </div>
              <div className="space-y-2">
                {pollOptions.map((opt: string, idx: number) => {
                  const votes = Number(pollVotes[idx] || 0);
                  const pct = pollTotal ? Math.round((votes / pollTotal) * 100) : 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendPollVote(idx)}
                      className={cn("w-full text-left rounded-xl border px-3 py-2 transition-colors", pollChoice === idx ? "border-primary bg-primary/10" : "border-[#222] bg-[#151515] hover:border-[#333]")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-white">{opt}</span>
                        <span className="text-[11px] text-[#666]">{votes} oy • %{pct}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[#222] overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
