import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useFeatureFlags, useFeatureState } from "@/lib/feature-flags";
import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { format, isToday, isYesterday } from "date-fns";
import {
  MessageCircle, Send, Loader2, ArrowLeft, Search, Trash2,
  Check, CheckCheck, RefreshCw, Plus, X, Mic, Phone, Video,
  StopCircle, Play, Pause, PhoneCall, Ban,
} from "lucide-react";
import { CallModal, type CallPeer } from "@/components/call-modal";
import { toast } from "sonner";

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

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Dün " + format(d, "HH:mm");
  return format(d, "d MMM HH:mm");
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function FeatureButton({ feature, onClick, children, className }: { feature: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  const state = useFeatureState(feature);
  if (state === "disabled") return null;
  return <button onClick={state === "maintenance" ? () => toast("Bu özellik bakımdadır") : onClick} className={className}>{children}</button>;
}

function VoicePlayer({ audioData, isMe }: { audioData: string; isMe: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioData);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(Math.round(audio.duration));
    audio.ontimeupdate = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    audio.onended = () => { setPlaying(false); setProgress(0); };
    return () => { audio.pause(); audio.src = ""; };
  }, [audioData]);

  return (
    <div className={cn("flex items-center gap-2.5 min-w-[160px]", isMe ? "flex-row-reverse" : "flex-row")}>
      <button onClick={() => { const a = audioRef.current; if (!a) return; if (playing) { a.pause(); setPlaying(false); } else { a.play().catch(() => {}); setPlaying(true); } }} className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors", isMe ? "bg-white/20 hover:bg-white/30" : "bg-primary/20 hover:bg-primary/30")}>
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <div className="flex-1 space-y-1">
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white/60 rounded-full transition-all" style={{ width: `${progress * 100}%` }} /></div>
        <p className="text-[10px] opacity-60">{formatDuration(playing ? Math.round(audioRef.current?.currentTime || 0) : duration)}</p>
      </div>
      <Mic className="h-3.5 w-3.5 opacity-50 shrink-0" />
    </div>
  );
}

function VoiceRecordButton({ onSend, disabled }: { onSend: (audioDataUrl: string, duration: number) => void; disabled: boolean }) {
  const state = useFeatureState("voice_messages");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopRecording = () => { recorderRef.current?.stop(); setRecording(false); if (timerRef.current) clearInterval(timerRef.current); };
  const startRecording = async () => {
    if (state === "maintenance") return toast("Bu özellik bakımdadır");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg" });
      recorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunksRef.current, { type: recorder.mimeType }); const duration = Math.round((Date.now() - startTimeRef.current) / 1000); const reader = new FileReader(); reader.onloadend = () => { onSend(reader.result as string, duration); }; reader.readAsDataURL(blob); };
      recorder.start(200);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => { if (e >= 60) { stopRecording(); return e; } return e + 1; }), 1000);
    } catch {}
  };

  if (state === "disabled") return null;
  if (recording) {
    return (
      <div className="flex items-center gap-2 flex-1 bg-[#1a1a1a] border border-red-500/30 rounded-full px-4 py-1.5">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-xs text-red-400 font-mono">{formatDuration(elapsed)}</span>
        <span className="flex-1 text-xs text-[#777]">Kayıt yapılıyor...</span>
        <button onClick={() => { recorderRef.current?.stream.getTracks().forEach(t => t.stop()); setRecording(false); if (timerRef.current) clearInterval(timerRef.current); }} className="text-[#555] hover:text-red-400 p-1"><X className="h-4 w-4" /></button>
        <button onClick={stopRecording} className="text-white bg-red-500 rounded-full p-1.5 hover:bg-red-600"><StopCircle className="h-4 w-4" /></button>
      </div>
    );
  }

  return <button onMouseDown={startRecording} onTouchStart={startRecording} disabled={disabled} title="Sesli mesaj kaydet" className="p-2 rounded-full text-[#555] hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 shrink-0"><Mic className="h-5 w-5" /></button>;
}

function UserSearchModal({ onSelect, onClose }: { onSelect: (u: any) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => { setLoading(true); try { const d = await apiFetch(`/users/search?q=${encodeURIComponent(q)}&limit=10`); setResults(d.users || d || []); } catch { setResults([]); } setLoading(false); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"><div className="bg-[#1b1b1b] border border-[#2a2a2a] rounded-2xl w-full max-w-md overflow-hidden"><div className="flex items-center justify-between px-5 py-4 border-b border-[#222]"><h3 className="font-bold">Yeni Mesaj</h3><button onClick={onClose} className="text-[#555] hover:text-white"><X className="h-5 w-5" /></button></div><div className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" /><Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Kullanıcı ara..." className="pl-9 bg-[#111] border-[#333]" /></div><div className="mt-3 space-y-1 max-h-72 overflow-y-auto">{loading && <div className="py-6 text-center text-[#555]"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}{!loading && results.length === 0 && q.trim() && <p className="py-6 text-center text-[#555] text-sm">Kullanıcı bulunamadı</p>}{results.map(u => <button key={u.id} onClick={() => onSelect(u)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left transition-colors"><Avatar className="h-9 w-9 shrink-0"><AvatarImage src={u.avatarUrl || ""} /><AvatarFallback className="text-xs">{u.username?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><div><p className="text-sm font-semibold">{u.displayName || u.username}</p><p className="text-xs text-[#555]">@{u.username}</p></div></button>)}</div></div></div></div>;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { flags } = useFeatureFlags();
  const [, setLocation] = useLocation();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [activeCall, setActiveCall] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const incomingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationsRef = useRef<any[]>([]);
  const activeCallRef = useRef<any>(null);

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  useEffect(() => { if (flags.dm_messages === "disabled") setLocation("/"); }, [flags.dm_messages]);

  const loadConversations = useCallback(async () => { if (!user) return; try { const d = await apiFetch("/conversations"); setConversations(d.conversations || []); } catch {} setLoadingConvs(false); }, [user]);
  const loadMessages = useCallback(async (convId: number) => { setLoadingMsgs(true); try { const d = await apiFetch(`/conversations/${convId}/messages`); setMessages(d.messages || []); setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c)); } catch {} setLoadingMsgs(false); }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (!activeConvId) return; loadMessages(activeConvId); if (pollRef.current) clearInterval(pollRef.current); pollRef.current = setInterval(() => loadMessages(activeConvId), 3000); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, [activeConvId, loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (!user || (flags.audio_calls === "disabled" && flags.video_calls === "disabled")) return;
    const checkIncoming = async () => {
      if (activeCallRef.current) return;
      try {
        const d = await apiFetch("/calls/incoming");
        if (d.call) {
          const call = d.call;
          if (call.callType === "audio" && flags.audio_calls === "disabled") return;
          if (call.callType === "video" && flags.video_calls === "disabled") return;
          const conv = conversationsRef.current.find((c: any) => c.id === call.conversationId);
          const peer: CallPeer = call.caller || conv?.other || { id: call.callerId, username: "Kullanıcı" };
          setActiveCall({ peer, convId: call.conversationId, callType: call.callType, mode: "incoming", callId: call.id, sdpOffer: call.sdpOffer });
        }
      } catch {}
    };
    incomingPollRef.current = setInterval(checkIncoming, 4000);
    return () => { if (incomingPollRef.current) clearInterval(incomingPollRef.current); };
  }, [user, flags.audio_calls, flags.video_calls]);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const sendMessage = async (e: React.FormEvent) => { e.preventDefault(); if (!text.trim() || !activeConvId || sending) return; setSending(true); const content = text.trim(); setText(""); try { const d = await apiFetch(`/conversations/${activeConvId}/messages`, { method: "POST", body: JSON.stringify({ content }) }); setMessages(prev => [...prev, d.message]); } catch { setText(content); } setSending(false); };
  const sendVoiceMessage = async (audioDataUrl: string, duration: number) => { if (!activeConvId) return; const d = await apiFetch(`/conversations/${activeConvId}/messages`, { method: "POST", body: JSON.stringify({ content: `[Sesli mesaj — ${duration}sn]`, messageType: "voice", audioData: audioDataUrl }) }); setMessages(prev => [...prev, d.message]); };
  const deleteMessage = async (msgId: number) => { await apiFetch(`/messages/${msgId}`, { method: "DELETE" }); setMessages(prev => prev.filter(m => m.id !== msgId)); };
  const startCall = (callType: "audio" | "video") => { if (!activeConv) return; if (callType === "audio" && flags.audio_calls === "disabled") return; if (callType === "video" && flags.video_calls === "disabled") return; setActiveCall({ peer: activeConv.other, convId: activeConv.id, callType, mode: "outgoing" }); };

  if (!user) return <AppLayout><div className="flex flex-col items-center justify-center h-96 gap-4"><MessageCircle className="h-12 w-12 text-[#333]" /><p className="text-[#555]">Mesajlaşmak için giriş yapın</p><Button onClick={() => setLocation("/login")}>Giriş Yap</Button></div></AppLayout>;
  if (flags.dm_messages === "disabled") return null;

  return <AppLayout>{showNewMsg && <UserSearchModal onSelect={async (u) => { setShowNewMsg(false); const d = await apiFetch("/conversations", { method: "POST", body: JSON.stringify({ userId: u.id }) }); setConversations(prev => [{ ...d.conversation, unreadCount: 0, lastMessage: null }, ...prev]); setActiveConvId(d.conversation.id); setMobileView("chat"); }} onClose={() => setShowNewMsg(false)} />}{activeCall && <CallModal peer={activeCall.peer} conversationId={activeCall.convId} callType={activeCall.callType} mode={activeCall.mode} incomingCallId={activeCall.callId} incomingSdpOffer={activeCall.sdpOffer} onClose={() => setActiveCall(null)} />}<div className="flex h-[calc(100vh-56px)] overflow-hidden"><div className={cn("w-full md:w-80 lg:w-96 border-r border-[#1e1e1e] flex flex-col bg-[#111] shrink-0", mobileView === "chat" ? "hidden md:flex" : "flex")}><div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e] shrink-0"><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /><h1 className="font-bold text-base">Mesajlar</h1></div><div className="flex items-center gap-1"><button onClick={loadConversations} className="p-1.5 rounded-lg hover:bg-white/5 text-[#555] hover:text-white transition-colors"><RefreshCw className="h-4 w-4" /></button><button onClick={() => setShowNewMsg(true)} className="p-1.5 rounded-lg hover:bg-primary/20 text-[#555] hover:text-primary transition-colors"><Plus className="h-4 w-4" /></button></div></div><div className="flex-1 overflow-y-auto">{loadingConvs ? <div className="py-10 text-center text-[#555]"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : conversations.map(conv => <button key={conv.id} onClick={() => { setActiveConvId(conv.id); setMobileView("chat"); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"><Avatar className="h-10 w-10 shrink-0"><AvatarImage src={conv.other?.avatarUrl || ""} /><AvatarFallback>{conv.other?.username?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold truncate">{conv.other?.displayName || conv.other?.username}</p>{conv.unreadCount > 0 && <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{conv.unreadCount}</span>}</div><p className="text-xs text-[#777] truncate">{conv.lastMessage?.content || "Yeni sohbet"}</p></div></button>)}</div></div><div className={cn("flex-1 flex flex-col min-w-0 bg-[#0f0f0f]", mobileView === "list" ? "hidden md:flex" : "flex")}>{activeConv ? <><div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e] bg-[#111] shrink-0"><div className="flex items-center gap-3 min-w-0"><button onClick={() => setMobileView("list")} className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-[#777]"><ArrowLeft className="h-5 w-5" /></button><Avatar className="h-9 w-9 shrink-0"><AvatarImage src={activeConv.other?.avatarUrl || ""} /><AvatarFallback>{activeConv.other?.username?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="font-semibold text-sm truncate">{activeConv.other?.displayName || activeConv.other?.username}</p><p className="text-xs text-[#777] truncate">@{activeConv.other?.username}</p></div></div><div className="flex items-center gap-1 shrink-0">{flags.audio_calls !== "disabled" && <FeatureButton feature="audio_calls" onClick={() => startCall("audio")} className="p-2 rounded-full text-[#555] hover:text-white hover:bg-white/5 transition-colors"><Phone className="h-4 w-4" /></FeatureButton>}{flags.video_calls !== "disabled" && <FeatureButton feature="video_calls" onClick={() => startCall("video")} className="p-2 rounded-full text-[#555] hover:text-white hover:bg-white/5 transition-colors"><Video className="h-4 w-4" /></FeatureButton>}{activeConv.other?.id && <button className="p-2 rounded-full text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-colors"><Ban className="h-4 w-4" /></button>}</div></div><div className="flex-1 overflow-y-auto p-4 space-y-3">{loadingMsgs ? <div className="py-10 text-center text-[#555]"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : messages.map(msg => <div key={msg.id} className={cn("flex gap-3", msg.isMe ? "justify-end" : "justify-start")}>{!msg.isMe && <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={msg.sender?.avatarUrl || ""} /><AvatarFallback>{msg.sender?.username?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>}<div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5", msg.isMe ? "bg-primary text-white rounded-br-md" : "bg-[#1a1a1a] text-[#ddd] rounded-bl-md")}><p className="text-sm leading-relaxed">{msg.messageType === "voice" && msg.audioData ? <VoicePlayer audioData={msg.audioData} isMe={msg.isMe} /> : processMessage(msg.content || msg.text || "").processed}</p><div className="flex items-center justify-end gap-2 mt-1"><span className="text-[10px] opacity-50">{formatMsgTime(msg.createdAt || msg.ts)}</span>{msg.isMe && <button onClick={() => deleteMessage(msg.id)} className="text-[10px] opacity-40 hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>}</div></div></div>)}<div ref={bottomRef} /></div><form onSubmit={sendMessage} className="p-3 border-t border-[#1e1e1e] bg-[#111]"><div className="flex items-center gap-2"><VoiceRecordButton onSend={sendVoiceMessage} disabled={!activeConvId} /><Input value={text} onChange={e => setText(e.target.value)} placeholder="Mesaj yaz..." className="flex-1 bg-[#161616] border-[#2a2a2a] rounded-full px-4" /><Button type="submit" disabled={!text.trim() || sending} className="rounded-full px-4"><Send className="h-4 w-4 mr-2" />Gönder</Button></div></form></> : <div className="flex-1 flex items-center justify-center text-center p-6"><div><MessageCircle className="h-12 w-12 mx-auto text-[#333] mb-3" /><p className="text-[#555]">Sohbet seçin</p></div></div>}</div></div></AppLayout>;
}
