import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare, Mic, Users, GraduationCap, ShieldCheck, Shuffle,
  X, Send, Volume2, VolumeX, Video, VideoOff, RefreshCw, AlertTriangle,
  Smile, ThumbsUp, Heart, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { processMessage } from "@/lib/link-filter";

const ROOM_TOPICS = [
  { id: "genel",  label: "Genel Sohbet",  emoji: "💬", online: 142, color: "from-blue-600 to-indigo-600" },
  { id: "film",   label: "Film & Dizi",   emoji: "🎬", online: 87,  color: "from-purple-600 to-pink-600" },
  { id: "muzik",  label: "Müzik",         emoji: "🎵", online: 63,  color: "from-pink-600 to-rose-600" },
  { id: "oyun",   label: "Oyun",          emoji: "🎮", online: 201, color: "from-green-600 to-emerald-600" },
  { id: "spor",   label: "Spor",          emoji: "⚽", online: 54,  color: "from-orange-600 to-amber-500" },
  { id: "edu",    label: "Eğitim",        emoji: "📚", online: 38,  color: "from-cyan-600 to-blue-600" },
  { id: "sanat",  label: "Sanat & Tasarım", emoji: "🎨", online: 29, color: "from-violet-600 to-purple-600" },
  { id: "haber",  label: "Haber & Gündem", emoji: "📰", online: 71, color: "from-red-600 to-rose-600" },
];

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface ChatMsg {
  id: number;
  user: string;
  text: string;
  edu: boolean;
  verified: boolean;
  ts: number;
  reaction?: string;
  hadLink?: boolean;
}

type MatchMode = "idle" | "searching" | "matched" | "voice";

function EduVerifyModal({ open, onClose, onVerify }: {
  open: boolean; onClose: () => void; onVerify: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);

  const sendCode = async () => {
    if (!email.match(/\.(edu|edu\.tr|ac\.|k12)/)) {
      alert("Lütfen geçerli bir eğitim e-postası girin (.edu, .edu.tr, .ac.*)");
      return;
    }
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    setStep("code");
  };

  const verify = async () => {
    if (code.length < 4) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 600));
    setSending(false);
    setStep("done");
    setTimeout(() => { onVerify(email); onClose(); }, 1200);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-900/30 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-blue-400" />
            </div>
            <h3 className="font-bold text-white">Öğrenci Doğrulama</h3>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "form" && (
          <div className="space-y-3">
            <p className="text-sm text-[#888]">
              Edu e-postan ile doğrula, özel{" "}
              <span className="text-blue-400 font-medium">🎓 Öğrenci Rozeti</span> kazan.
            </p>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ornek@ogrenci.edu.tr"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            <button
              onClick={sendCode}
              disabled={!email || sending}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 transition-all"
            >
              {sending ? "Gönderiliyor..." : "Doğrulama Kodu Gönder"}
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="space-y-3">
            <p className="text-sm text-[#888]">
              <span className="text-white">{email}</span> adresine 6 haneli kod gönderildi.
            </p>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              maxLength={6}
              placeholder="123456"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white text-center font-mono tracking-widest focus:outline-none focus:border-blue-500/50"
            />
            <button
              onClick={verify}
              disabled={code.length < 4 || sending}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 transition-all"
            >
              {sending ? "Doğrulanıyor..." : "Doğrula"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-4 space-y-3">
            <div className="text-5xl">🎓</div>
            <p className="text-green-400 font-bold text-lg">Doğrulandı!</p>
            <p className="text-sm text-[#888]">Öğrenci rozeti profiline eklendi.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LinkWarnBanner() {
  return (
    <div className="mx-3 mb-2 flex items-center gap-2 bg-amber-900/10 border border-amber-500/20 rounded-lg px-3 py-2 text-[11px] text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      Link paylaşımı engellendi — admin inceleyecek.
    </div>
  );
}

function MatchScreen({ mode, username, onSkip, onEnd }: {
  mode: MatchMode; username: string; onSkip: () => void; onEnd: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [msgs, setMsgs] = useState([
    { id: 1, me: false, text: "Merhaba! 👋" },
    { id: 2, me: true, text: "Selam, nasılsın?" },
  ]);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [linkWarn, setLinkWarn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = () => {
    const trimmed = msg.trim();
    if (!trimmed) return;
    const { filtered, hadLinks } = processMessage(trimmed, username, "match", `match_${Date.now()}`);
    if (hadLinks) setLinkWarn(true);
    setMsgs(p => [...p, { id: Date.now(), me: true, text: filtered }]);
    setMsg("");
    setTimeout(() => setLinkWarn(false), 4000);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div className="flex flex-col h-[560px] bg-[#0f0f0f] border border-[#1e1e1e] rounded-2xl overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] bg-[#111] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-purple-600/40 flex items-center justify-center text-base">
              😀
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#111]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Anonim Kullanıcı</p>
            <p className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {mode === "voice" ? "Sesli eşleşme" : "Metin eşleşme"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {mode === "voice" && (
            <>
              <button onClick={() => setMuted(!muted)}
                className={cn("p-2 rounded-xl transition-all text-sm",
                  muted ? "bg-red-900/30 text-red-400 border border-red-500/20" : "bg-[#1e1e1e] text-[#666] hover:text-white border border-[#2a2a2a]")}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button onClick={() => setCamOn(!camOn)}
                className={cn("p-2 rounded-xl transition-all",
                  camOn ? "bg-primary/20 text-primary border border-primary/20" : "bg-[#1e1e1e] text-[#666] hover:text-white border border-[#2a2a2a]")}>
                {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
            </>
          )}
          <button onClick={onSkip}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium transition-all">
            <RefreshCw className="h-3.5 w-3.5" /> Sonraki
          </button>
          <button onClick={onEnd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-900/20 hover:bg-red-900/30 border border-red-500/20 text-red-400 text-xs font-medium transition-all">
            <X className="h-3.5 w-3.5" /> Bitir
          </button>
        </div>
      </div>

      {mode === "voice" && (
        <div className="bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] px-4 py-5 flex items-center justify-center gap-10 border-b border-[#1a1a1a] shrink-0">
          <div className="text-center space-y-2">
            <div className="w-[72px] h-[72px] rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-3xl shadow-lg shadow-primary/10">
              👤
            </div>
            <p className="text-xs text-[#555] font-medium">Sen</p>
          </div>
          <div className="flex items-center gap-1 h-12">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-1 bg-primary rounded-full animate-pulse"
                style={{ height: `${10 + Math.sin(i) * 20 + 10}px`, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="text-center space-y-2">
            <div className="w-[72px] h-[72px] rounded-full bg-[#1e1e1e] border-2 border-[#2a2a2a] flex items-center justify-center text-3xl shadow-lg">
              😀
            </div>
            <p className="text-xs text-[#555] font-medium">Anonim</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {msgs.map(m => (
          <div key={m.id} className={cn("flex", m.me ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed",
              m.me
                ? "bg-primary text-white rounded-br-sm"
                : "bg-[#1e1e1e] text-[#ddd] rounded-bl-sm border border-[#2a2a2a]"
            )}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {linkWarn && <LinkWarnBanner />}

      <div className="flex items-center gap-2 px-3 py-3 border-t border-[#1a1a1a] bg-[#0f0f0f] shrink-0">
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Mesaj yaz..."
          maxLength={500}
          className="flex-1 bg-[#1a1a1a] border border-[#252525] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary/40 transition-colors"
        />
        <button
          onClick={send}
          disabled={!msg.trim()}
          className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-white disabled:opacity-30 transition-all flex items-center justify-center shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function MatchRoomsPage() {
  const { user } = useAuth();
  const username = (user as any)?.username ?? "anonim";

  const [activeTab, setActiveTab] = useState<"rooms" | "match">("rooms");
  const [matchMode, setMatchMode] = useState<MatchMode>("idle");
  const [matchType, setMatchType] = useState<"text" | "voice">("text");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMsg[]>([
    { id: 1, user: "burak_92",  text: "Herkese merhaba! 👋",            edu: false, verified: false, ts: Date.now() - 900000 },
    { id: 2, user: "zeynep_edu",text: "Bugün sınav var bilenler? 😅",  edu: true,  verified: true,  ts: Date.now() - 720000 },
    { id: 3, user: "mert_k",    text: "Yeni sezon çıktı mı?",          edu: false, verified: false, ts: Date.now() - 540000 },
    { id: 4, user: "selin_itu", text: "ITÜ öğrencileri var mı burada?",edu: true,  verified: true,  ts: Date.now() - 120000 },
  ]);
  const [roomMsg, setRoomMsg] = useState("");
  const [linkWarn, setLinkWarn] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);
  const [isEduVerified, setIsEduVerified] = useState(false);
  const [filterEdu, setFilterEdu] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomMessages]);

  const startMatch = () => {
    setMatchMode("searching");
    setTimeout(
      () => setMatchMode(matchType === "voice" ? "voice" : "matched"),
      1800 + Math.random() * 1500
    );
  };

  const sendRoomMsg = () => {
    const trimmed = roomMsg.trim();
    if (!trimmed) return;
    const { filtered, hadLinks } = processMessage(trimmed, username, "chat", selectedRoom ?? undefined);
    if (hadLinks) { setLinkWarn(true); setTimeout(() => setLinkWarn(false), 4000); }
    setRoomMessages(prev => [...prev, {
      id: Date.now(),
      user: username,
      text: filtered,
      edu: isEduVerified,
      verified: isEduVerified,
      ts: Date.now(),
      hadLink: hadLinks,
    }]);
    setRoomMsg("");
  };

  const addReaction = (msgId: number, emoji: string) => {
    setRoomMessages(p => p.map(m => m.id === msgId ? { ...m, reaction: emoji } : m));
    setReactionTarget(null);
  };

  const displayedMessages = filterEdu ? roomMessages.filter(m => m.edu) : roomMessages;
  const currentRoom = ROOM_TOPICS.find(r => r.id === selectedRoom);

  return (
    <AppLayout>
      <EduVerifyModal open={eduOpen} onClose={() => setEduOpen(false)} onVerify={() => setIsEduVerified(true)} />

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              Sohbet & Eşleşme
            </h1>
            <p className="text-[#666] text-sm mt-1 ml-[52px]">
              Konu odaları veya rastgele eşleşme ile yeni insanlar tanı.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isEduVerified ? (
              <button
                onClick={() => setEduOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-500/30 bg-blue-900/10 text-blue-400 text-sm font-medium hover:bg-blue-900/20 transition-all"
              >
                <GraduationCap className="h-4 w-4" />
                <span className="hidden sm:inline">Öğrenci Doğrula</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-500/30 bg-blue-900/10 text-blue-400 text-sm font-medium">
                <ShieldCheck className="h-4 w-4" /> 🎓 Doğrulandı
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#111] border border-[#1e1e1e] rounded-2xl w-fit">
          {[
            { id: "rooms", label: "Sohbet Odaları", icon: Users },
            { id: "match", label: "Rastgele Eşleşme", icon: Shuffle },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all font-medium",
                activeTab === t.id
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-[#666] hover:text-white"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Rooms Tab */}
        {activeTab === "rooms" && (
          <div className="grid lg:grid-cols-[280px_1fr] gap-4">
            {/* Room list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-[#444] uppercase tracking-widest">Odalar</p>
                <button
                  onClick={() => setFilterEdu(!filterEdu)}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all",
                    filterEdu
                      ? "border-blue-500/30 bg-blue-900/10 text-blue-400"
                      : "border-[#1e1e1e] text-[#555] hover:text-white"
                  )}
                >
                  <GraduationCap className="h-3 w-3" /> Edu Filtre
                </button>
              </div>
              <div className="space-y-1.5">
                {ROOM_TOPICS.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoom(room.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all",
                      selectedRoom === room.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-[#1e1e1e] bg-[#111] hover:border-[#2a2a2a] hover:bg-[#161616]"
                    )}
                  >
                    <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg shrink-0 shadow-md", room.color)}>
                      {room.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-semibold">{room.label}</p>
                      <p className="text-[11px] text-[#555]">{room.online} çevrimiçi</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Chat area */}
            <div>
              {!selectedRoom ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl text-center gap-3">
                  <div className="text-5xl opacity-30">💬</div>
                  <p className="text-[#444] font-medium">Sol taraftan bir oda seç</p>
                  <p className="text-[#333] text-sm">Konuşmaya katıl, yeni insanlar tanı</p>
                </div>
              ) : (
                <div className="flex flex-col h-[520px] bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden shadow-xl">
                  {/* Room header */}
                  <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#111] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center text-base shadow-md", currentRoom?.color)}>
                        {currentRoom?.emoji}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{currentRoom?.label}</p>
                        <p className="text-[10px] text-green-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                          {currentRoom?.online} çevrimiçi
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[#555] bg-[#1a1a1a] px-2.5 py-1 rounded-lg border border-[#252525]">
                      <AlertTriangle className="h-3 w-3 text-amber-500/70" /> Linkler engelleniyor
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {displayedMessages.map(m => (
                      <div
                        key={m.id}
                        className="flex items-start gap-2 group"
                        onMouseLeave={() => setReactionTarget(null)}
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-purple-600/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-[#2a2a2a]">
                          {m.user[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="text-[11px] font-bold text-primary">{m.user}</span>
                            {m.edu && (
                              <span className="text-[9px] bg-blue-900/20 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-medium">
                                🎓 Öğrenci
                              </span>
                            )}
                            {m.verified && !m.edu && (
                              <span className="text-[9px] bg-green-900/20 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full font-medium">
                                ✓ Doğrulandı
                              </span>
                            )}
                            {m.hadLink && (
                              <span className="text-[9px] bg-amber-900/20 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-medium">
                                🔗 link engellendi
                              </span>
                            )}
                          </div>
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-[#ccc] break-words leading-relaxed">{m.text}</p>
                            {m.reaction && (
                              <span className="shrink-0 text-base mt-0.5">{m.reaction}</span>
                            )}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity relative shrink-0">
                          <button
                            onClick={() => setReactionTarget(reactionTarget === m.id ? null : m.id)}
                            className="p-1 rounded-lg text-[#555] hover:text-white hover:bg-[#222] transition-all"
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                          {reactionTarget === m.id && (
                            <div className="absolute right-0 bottom-7 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-1.5 flex gap-1 shadow-xl z-10">
                              {REACTIONS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(m.id, emoji)}
                                  className="text-base hover:scale-125 transition-transform"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>

                  {linkWarn && <LinkWarnBanner />}

                  {/* Input */}
                  {user ? (
                    <div className="flex items-center gap-2 p-3 border-t border-[#1a1a1a] bg-[#0f0f0f] shrink-0">
                      <input
                        value={roomMsg}
                        onChange={e => setRoomMsg(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && sendRoomMsg()}
                        placeholder={`${currentRoom?.label} odasına yaz...`}
                        maxLength={500}
                        className="flex-1 bg-[#1a1a1a] border border-[#252525] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary/40 transition-colors"
                      />
                      <button
                        onClick={sendRoomMsg}
                        disabled={!roomMsg.trim()}
                        className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-white disabled:opacity-30 transition-all flex items-center justify-center shrink-0"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 border-t border-[#1a1a1a] text-center shrink-0">
                      <p className="text-sm text-[#555]">
                        Sohbet için{" "}
                        <a href="/login" className="text-primary hover:underline">giriş yap</a>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Match Tab */}
        {activeTab === "match" && (
          <div className="space-y-4 max-w-xl mx-auto">
            {matchMode === "idle" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "text",  icon: MessageSquare, label: "Metin",  desc: "Yazılı anonim sohbet",    emoji: "💬" },
                    { id: "voice", icon: Mic,           label: "Sesli",  desc: "Ses + metin sohbet",      emoji: "🎙️" },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMatchType(m.id as any)}
                      className={cn(
                        "flex flex-col items-center gap-3 py-7 rounded-2xl border transition-all",
                        matchType === m.id
                          ? "border-primary/50 bg-primary/10 shadow-lg shadow-primary/10"
                          : "border-[#1e1e1e] bg-[#0f0f0f] hover:border-[#2a2a2a]"
                      )}
                    >
                      <span className="text-3xl">{m.emoji}</span>
                      <div className="text-center">
                        <p className={cn("text-sm font-bold", matchType === m.id ? "text-white" : "text-[#666]")}>{m.label}</p>
                        <p className="text-[11px] text-[#444] mt-0.5">{m.desc}</p>
                      </div>
                      {matchType === m.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-[#444] uppercase tracking-widest">Eşleşme Kuralları</p>
                  {[
                    "18+ platform — uygunsuz davranış yasaktır",
                    "Linkler otomatik engellenir ve loglanır",
                    "Kimlik bilgisi istemek yasaktır",
                    "Raporlanan kullanıcılar incelenir",
                  ].map((rule, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-[#555]">
                      <span className="text-amber-500 shrink-0 mt-0.5">•</span> {rule}
                    </div>
                  ))}
                </div>

                <button
                  onClick={startMatch}
                  className="w-full py-4 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-base transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20"
                >
                  <Shuffle className="h-5 w-5" /> Eşleşme Başlat
                </button>
              </div>
            )}

            {matchMode === "searching" && (
              <div className="flex flex-col items-center justify-center py-20 space-y-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  <div className="w-16 h-16 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin absolute inset-0 m-auto" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                  <Shuffle className="h-6 w-6 text-primary absolute inset-0 m-auto" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-white font-bold text-lg">Eşleşme aranıyor...</p>
                  <p className="text-[#555] text-sm">Uygun kullanıcı bekleniyor</p>
                </div>
                <button
                  onClick={() => setMatchMode("idle")}
                  className="text-sm text-[#555] hover:text-white transition-colors px-5 py-2.5 rounded-xl border border-[#222] hover:border-[#333]"
                >
                  İptal
                </button>
              </div>
            )}

            {(matchMode === "matched" || matchMode === "voice") && (
              <MatchScreen
                mode={matchMode}
                username={username}
                onSkip={startMatch}
                onEnd={() => setMatchMode("idle")}
              />
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
