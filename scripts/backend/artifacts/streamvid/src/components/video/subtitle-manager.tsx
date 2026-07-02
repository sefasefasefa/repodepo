import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Languages, Trash2, Loader2, Check, ChevronDown, Wand2,
  FileText, AlertCircle, Sparkles, Download, Copy, Eye,
  PenTool, Users, RefreshCw, Upload, X, CheckCircle2,
  ArrowRight, BookOpen, Mic, Presentation, Newspaper,
  GraduationCap, MessageSquare, Globe, ChevronRight
} from "lucide-react";

const SUPPORTED_LANGUAGES: Record<string, string> = {
  tr: "Türkçe", en: "English", de: "Deutsch", fr: "Français",
  es: "Español", it: "Italiano", pt: "Português", ru: "Русский",
  ja: "日本語", ko: "한국어", zh: "中文", ar: "العربية",
  nl: "Nederlands", pl: "Polski", sv: "Svenska", no: "Norsk",
  da: "Dansk", fi: "Suomi", el: "Ελληνικά", ro: "Română",
};

const FLAG: Record<string, string> = {
  tr: "🇹🇷", en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹",
  pt: "🇵🇹", ru: "🇷🇺", ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳", ar: "🇸🇦",
  nl: "🇳🇱", pl: "🇵🇱", sv: "🇸🇪", no: "🇳🇴", da: "🇩🇰", fi: "🇫🇮",
  el: "🇬🇷", ro: "🇷🇴",
};

const TEMPLATES = [
  { id: "general", label: "Genel", icon: FileText },
  { id: "tutorial", label: "Eğitim", icon: GraduationCap },
  { id: "review", label: "İnceleme", icon: BookOpen },
  { id: "story", label: "Hikaye", icon: MessageSquare },
  { id: "presentation", label: "Sunum", icon: Presentation },
  { id: "news", label: "Haber", icon: Newspaper },
];

interface SubTrack {
  id: number;
  language: string;
  langName: string;
  isAuto: boolean;
  isOriginal: boolean;
  status: string;
}

interface VttCue { start: string; end: string; text: string; }

function parseVtt(raw: string): VttCue[] {
  const cues: VttCue[] = [];
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const timeLine = lines.find(l => l.includes("-->"));
    if (!timeLine) continue;
    const [start, end] = timeLine.split("-->").map(s => s.trim().split(".")[0]);
    const text = lines.slice(lines.indexOf(timeLine) + 1).join(" ").trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

function vttToSrt(vtt: string): string {
  let i = 1;
  const blocks = vtt.replace(/\r\n/g, "\n").split(/\n\n+/);
  const srtBlocks: string[] = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const timeLine = lines.find(l => l.includes("-->"));
    if (!timeLine) continue;
    const srtTime = timeLine.replace(/\./g, ",");
    const text = lines.slice(lines.indexOf(timeLine) + 1).join("\n").trim();
    if (text) srtBlocks.push(`${i++}\n${srtTime}\n${text}`);
  }
  return srtBlocks.join("\n\n");
}

function vttToTxt(vtt: string): string {
  return parseVtt(vtt).map(c => c.text).join(" ");
}

function downloadFile(content: string, filename: string, mime = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

type OwnerTab = "list" | "ai-write" | "ai-generate" | "translate" | "view" | "upload" | "community";
type UserTab = "view" | "contribute";

interface Props { videoId: number; token: string; isOwner?: boolean; }

export function SubtitleManager({ videoId, token, isOwner = false }: Props) {
  const [tracks, setTracks] = useState<SubTrack[]>([]);
  const [ownerTab, setOwnerTab] = useState<OwnerTab>("list");
  const [userTab, setUserTab] = useState<UserTab>("view");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const loadTracks = useCallback(() => {
    fetch(`/api/videos/${videoId}/subtitles`, { headers })
      .then(r => r.json()).then(d => setTracks(d.subtitles ?? []));
  }, [videoId]);

  useEffect(() => { loadTracks(); }, [loadTracks]);
  useEffect(() => {
    if (!tracks.some(t => t.status === "generating")) return;
    const id = setTimeout(loadTracks, 5000);
    return () => clearTimeout(id);
  }, [tracks, loadTracks]);

  const deleteLang = async (lang: string) => {
    if (!confirm("Bu altyazıyı silmek istediğinizden emin misiniz?")) return;
    await fetch(`/api/videos/${videoId}/subtitles/${lang}/delete`, { method: "DELETE", headers });
    loadTracks();
  };

  const readyTracks = tracks.filter(t => t.status === "ready");

  if (isOwner) {
    return (
      <OwnerSubtitleManager
        videoId={videoId} token={token} tracks={tracks} readyTracks={readyTracks}
        tab={ownerTab} setTab={setOwnerTab} headers={headers}
        deleteLang={deleteLang} reloadTracks={loadTracks}
      />
    );
  }

  return (
    <UserTranscriptView
      videoId={videoId} token={token} tracks={readyTracks}
      tab={userTab} setTab={setUserTab} headers={headers}
    />
  );
}

/* ─────────────────────────── OWNER PANEL ─────────────────────────── */

function OwnerSubtitleManager({ videoId, token, tracks, readyTracks, tab, setTab, headers, deleteLang, reloadTracks }: {
  videoId: number; token: string; tracks: SubTrack[]; readyTracks: SubTrack[];
  tab: OwnerTab; setTab: (t: OwnerTab) => void; headers: Record<string, string>;
  deleteLang: (lang: string) => void; reloadTracks: () => void;
}) {
  const TABS: { id: OwnerTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "list",        label: "Altyazılar",  icon: Languages },
    { id: "ai-write",    label: "AI Yaz",      icon: PenTool },
    { id: "ai-generate", label: "AI Üret",     icon: Wand2 },
    { id: "translate",   label: "Çevir",       icon: Globe },
    { id: "view",        label: "Görüntüle",   icon: Eye },
    { id: "upload",      label: "VTT Yükle",   icon: Upload },
    { id: "community",   label: "Topluluk",    icon: Users },
  ];

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2 flex-wrap">
        <Languages className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">Altyazı & Transcript Yönetimi</span>
        {tracks.some(t => t.status === "generating") && (
          <span className="flex items-center gap-1 text-xs text-blue-400 ml-auto">
            <Loader2 className="h-3 w-3 animate-spin" /> Üretiliyor...
          </span>
        )}
      </div>

      <div className="flex border-b border-[#1a1a1a] overflow-x-auto scrollbar-none">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap shrink-0",
              tab === id ? "border-primary text-primary" : "border-transparent text-[#666] hover:text-[#aaa]"
            )}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "list"        && <TabList tracks={tracks} readyTracks={readyTracks} deleteLang={deleteLang} videoId={videoId} headers={headers} setTab={setTab} />}
        {tab === "ai-write"    && <TabAiWrite videoId={videoId} headers={headers} setTab={setTab} />}
        {tab === "ai-generate" && <TabAiGenerate videoId={videoId} headers={headers} reloadTracks={reloadTracks} setTab={setTab} />}
        {tab === "translate"   && <TabTranslate videoId={videoId} headers={headers} readyTracks={readyTracks} reloadTracks={reloadTracks} setTab={setTab} />}
        {tab === "view"        && <TabView videoId={videoId} readyTracks={readyTracks} />}
        {tab === "upload"      && <TabUpload videoId={videoId} headers={headers} reloadTracks={reloadTracks} setTab={setTab} />}
        {tab === "community"   && <TabCommunity videoId={videoId} headers={headers} reloadTracks={reloadTracks} />}
      </div>
    </div>
  );
}

/* ─────────────────────────── USER PANEL ─────────────────────────── */

function UserTranscriptView({ videoId, token, tracks, tab, setTab, headers }: {
  videoId: number; token: string; tracks: SubTrack[];
  tab: UserTab; setTab: (t: UserTab) => void; headers: Record<string, string>;
}) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Transcript</span>
      </div>
      <div className="flex border-b border-[#1a1a1a]">
        {([
          { id: "view" as UserTab, label: "Görüntüle", icon: Eye },
          { id: "contribute" as UserTab, label: "Katkıda Bulun", icon: Users },
        ]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2",
              tab === id ? "border-primary text-primary" : "border-transparent text-[#666] hover:text-[#aaa]"
            )}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "view"       && <TabView videoId={videoId} readyTracks={tracks} />}
        {tab === "contribute" && <TabContribute videoId={videoId} headers={headers} />}
      </div>
    </div>
  );
}

/* ─────────────────────────── TAB: LIST ─────────────────────────── */

function TabList({ tracks, readyTracks, deleteLang, videoId, headers, setTab }: {
  tracks: SubTrack[]; readyTracks: SubTrack[]; deleteLang: (l: string) => void;
  videoId: number; headers: Record<string, string>; setTab: (t: OwnerTab) => void;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchVtt = async (lang: string): Promise<string | null> => {
    setDownloading(lang);
    try {
      const res = await fetch(`/api/videos/${videoId}/subtitles/${lang}`, { headers });
      return res.ok ? await res.text() : null;
    } finally { setDownloading(null); }
  };

  return (
    <div className="space-y-2">
      {tracks.length === 0 ? (
        <div className="text-center py-8 text-[#555] text-sm">
          <Languages className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p>Henüz altyazı yok.</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <button onClick={() => setTab("ai-write")} className="text-xs text-primary hover:underline flex items-center gap-1">
              <PenTool className="h-3 w-3" /> AI ile yaz
            </button>
            <span className="text-[#444]">•</span>
            <button onClick={() => setTab("upload")} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Upload className="h-3 w-3" /> VTT yükle
            </button>
          </div>
        </div>
      ) : (
        tracks.map(t => (
          <div key={t.language} className="flex items-center gap-3 bg-[#1a1a1a] rounded-xl px-3 py-3 group">
            <span className="text-xl shrink-0">{FLAG[t.language] ?? "🌐"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{t.langName}</span>
                {t.isAuto && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-bold">AI</span>}
                {t.isOriginal && <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded font-bold">ORJİNAL</span>}
              </div>
              <span className="text-[10px] font-mono text-[#555]">{t.language.toUpperCase()}</span>
            </div>
            {t.status === "generating" ? (
              <span className="flex items-center gap-1 text-xs text-blue-400"><Loader2 className="h-3 w-3 animate-spin" /> Üretiliyor</span>
            ) : t.status === "error" ? (
              <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="h-3 w-3" /> Hata</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-green-400"><Check className="h-3 w-3" /> Hazır</span>
            )}
            {t.status === "ready" && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button title="VTT indir" onClick={async () => { const v = await fetchVtt(t.language); if (v) downloadFile(v, `${t.language}.vtt`, "text/vtt"); }}
                  className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#666] hover:text-white transition-colors" disabled={!!downloading}>
                  {downloading === t.language ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                </button>
                <button title="SRT indir" onClick={async () => { const v = await fetchVtt(t.language); if (v) downloadFile(vttToSrt(v), `${t.language}.srt`); }}
                  className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#666] hover:text-white transition-colors text-[10px] font-bold">SRT</button>
                <button title="TXT indir" onClick={async () => { const v = await fetchVtt(t.language); if (v) downloadFile(vttToTxt(v), `${t.language}.txt`); }}
                  className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#666] hover:text-white transition-colors text-[10px] font-bold">TXT</button>
              </div>
            )}
            <button onClick={() => deleteLang(t.language)} className="text-[#3a3a3a] hover:text-red-400 transition-colors shrink-0 p-1">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}
      {readyTracks.length > 0 && (
        <button onClick={() => setTab("view")} className="w-full flex items-center justify-center gap-2 text-xs text-[#666] hover:text-primary transition-colors py-2 border border-[#1e1e1e] rounded-lg mt-1">
          <Eye className="h-3.5 w-3.5" /> Transkript İçeriğini Görüntüle
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── TAB: AI YAZ ─────────────────────────── */

function TabAiWrite({ videoId, headers, setTab }: {
  videoId: number; headers: Record<string, string>; setTab: (t: OwnerTab) => void;
}) {
  const [notes, setNotes] = useState("");
  const [template, setTemplate] = useState("general");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"notes" | "improve">("notes");

  const handleGenerate = async () => {
    if (!notes.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch(`/api/videos/${videoId}/subtitles/ai-write`, {
        method: "POST", headers,
        body: JSON.stringify({ notes: mode === "improve" ? `İYİLEŞTİR:\n${notes}` : notes, template }),
      });
      const data = await res.json();
      if (res.ok) setResult(data.transcript || "");
      else setResult(`Hata: ${data.error || "Bilinmeyen hata"}`);
    } finally { setLoading(false); }
  };

  const sendToGenerate = () => {
    sessionStorage.setItem(`ai_transcript_${videoId}`, result);
    setTab("ai-generate");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-gradient-to-r from-primary/10 to-purple-900/10 border border-primary/20 rounded-xl p-3">
        <PenTool className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-primary mb-0.5">AI Transcript Yazarı</p>
          <p className="text-xs text-[#888]">Notlarınızı veya anahtar kelimeleri yapıştırın. AI bunları düzgün bir transcript metnine dönüştürür. Ardından altyazı üretimine gönderebilirsiniz.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["notes", "improve"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border",
              mode === m ? "bg-primary/20 border-primary/40 text-primary" : "border-[#2a2a2a] text-[#666] hover:text-[#aaa]"
            )}>
            {m === "notes" ? "🔤 Notlardan Oluştur" : "✨ Mevcut Metni İyileştir"}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-[#666] block mb-2">İçerik Şablonu</label>
        <div className="grid grid-cols-3 gap-1.5">
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setTemplate(t.id)}
              className={cn("flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-all border",
                template === t.id ? "bg-primary/15 border-primary/40 text-primary" : "border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a] hover:text-[#aaa]"
              )}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-[#666]">{mode === "notes" ? "Notlar / Anahtar Kelimeler" : "İyileştirilecek Metin"}</label>
          <span className="text-[10px] text-[#555]">{notes.length} karakter</span>
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
          placeholder={mode === "notes" ? "Örn: Kamera kurulumu, ışık ayarı, tripod kullanımı, çekim teknikleri..." : "Mevcut transcript metnini buraya yapıştırın..."}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 resize-none placeholder:text-[#333] transition-colors"
        />
      </div>

      <button onClick={handleGenerate} disabled={loading || !notes.trim()}
        className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
          "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-40"
        )}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Yazıyor...</> : <><PenTool className="h-4 w-4" /> AI ile Yaz</>}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#aaa]">Oluşturulan Transcript</span>
            <div className="flex gap-2">
              <button onClick={() => copyToClipboard(result, setCopied)}
                className="flex items-center gap-1 text-xs text-[#666] hover:text-white transition-colors">
                {copied ? <><Check className="h-3 w-3 text-green-400" /> Kopyalandı</> : <><Copy className="h-3 w-3" /> Kopyala</>}
              </button>
            </div>
          </div>
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-3 text-xs text-[#ccc] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
            {result}
          </div>
          <button onClick={sendToGenerate}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium bg-violet-900/30 border border-violet-500/30 text-violet-400 hover:bg-violet-900/50 transition-all">
            <Wand2 className="h-3.5 w-3.5" /> AI Altyazı Üretimine Gönder <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── TAB: AI ÜRET ─────────────────────────── */

function TabAiGenerate({ videoId, headers, reloadTracks, setTab }: {
  videoId: number; headers: Record<string, string>; reloadTracks: () => void; setTab: (t: OwnerTab) => void;
}) {
  const [transcript, setTranscript] = useState(() => sessionStorage.getItem(`ai_transcript_${videoId}`) || "");
  const [genLang, setGenLang] = useState("tr");
  const [duration, setDuration] = useState("120");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(`ai_transcript_${videoId}`);
    if (saved) { setTranscript(saved); sessionStorage.removeItem(`ai_transcript_${videoId}`); }
  }, [videoId]);

  const handleGenerate = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      await fetch(`/api/videos/${videoId}/subtitles/generate`, {
        method: "POST", headers,
        body: JSON.stringify({ transcript, language: genLang, duration: parseInt(duration) || 120 }),
      });
      setDone(true);
      reloadTracks();
      setTimeout(() => { setDone(false); setTab("list"); }, 2500);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-[#1a1a1a] rounded-xl p-3 text-xs text-[#888]">
        <Wand2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p>Transcript metnini (konuşma içeriğini) yapıştırın. AI otomatik olarak zaman damgalı VTT altyazı üretir. <button onClick={() => setTab("ai-write")} className="text-primary hover:underline">AI Yaz</button> sekmesinden de transcript oluşturabilirsiniz.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#666] block mb-1">Altyazı Dili</label>
          <select value={genLang} onChange={e => setGenLang(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{FLAG[code]} {name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#666] block mb-1">Video Süresi (saniye)</label>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="10"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-[#666]">Transcript / Konuşma Metni</label>
          <span className="text-[10px] text-[#555]">{transcript.length} karakter</span>
        </div>
        <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={7}
          placeholder="Videodaki konuşmaları buraya yapıştırın..."
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 resize-none placeholder:text-[#333]"
        />
      </div>
      <button onClick={handleGenerate} disabled={loading || !transcript.trim() || done}
        className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
          done ? "bg-green-900/30 text-green-400 border border-green-500/30" :
          "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-40"
        )}>
        {done ? <><CheckCircle2 className="h-4 w-4" /> Altyazı üretim kuyruğuna alındı!</> :
         loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</> :
         <><Wand2 className="h-4 w-4" /> AI ile Altyazı Üret</>}
      </button>
    </div>
  );
}

/* ─────────────────────────── TAB: ÇEVİR ─────────────────────────── */

function TabTranslate({ videoId, headers, readyTracks, reloadTracks, setTab }: {
  videoId: number; headers: Record<string, string>; readyTracks: SubTrack[];
  reloadTracks: () => void; setTab: (t: OwnerTab) => void;
}) {
  const [srcLang, setSrcLang] = useState(readyTracks[0]?.language || "tr");
  const [tgtLang, setTgtLang] = useState("en");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleTranslate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/subtitles/translate`, {
        method: "POST", headers,
        body: JSON.stringify({ sourceLang: srcLang, targetLang: tgtLang }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setDone(true);
      reloadTracks();
      setTimeout(() => { setDone(false); setTab("list"); }, 2500);
    } finally { setLoading(false); }
  };

  if (readyTracks.length === 0) return (
    <div className="text-center py-8 text-[#555] text-sm">
      <Globe className="h-8 w-8 mx-auto mb-2 opacity-20" />
      Çeviri için önce bir altyazı eklemeniz gerekiyor.
      <button onClick={() => setTab("upload")} className="block mx-auto mt-2 text-xs text-primary hover:underline">VTT Yükle</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-xl p-3 text-xs text-[#888]">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        Mevcut altyazının zaman damgaları korunur, yalnızca metin çevrilir.
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div>
          <label className="text-xs text-[#666] block mb-1">Kaynak Dil</label>
          <select value={srcLang} onChange={e => setSrcLang(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
            {readyTracks.map(t => <option key={t.language} value={t.language}>{FLAG[t.language]} {t.langName}</option>)}
          </select>
        </div>
        <ChevronRight className="h-4 w-4 text-[#555] mb-2" />
        <div>
          <label className="text-xs text-[#666] block mb-1">Hedef Dil</label>
          <select value={tgtLang} onChange={e => setTgtLang(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
            {Object.entries(SUPPORTED_LANGUAGES).filter(([c]) => c !== srcLang).map(([code, name]) => (
              <option key={code} value={code}>{FLAG[code]} {name}</option>
            ))}
          </select>
        </div>
      </div>
      <button onClick={handleTranslate} disabled={loading || srcLang === tgtLang || done}
        className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
          done ? "bg-green-900/30 text-green-400 border border-green-500/30" :
          "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-40"
        )}>
        {done ? <><CheckCircle2 className="h-4 w-4" /> Çeviri başlatıldı!</> :
         loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Çeviriliyor...</> :
         <><Globe className="h-4 w-4" /> Çeviriye Başla</>}
      </button>
    </div>
  );
}

/* ─────────────────────────── TAB: GÖRÜNTÜLE ─────────────────────────── */

function TabView({ videoId, readyTracks }: { videoId: number; readyTracks: SubTrack[]; }) {
  const [selectedLang, setSelectedLang] = useState(readyTracks[0]?.language || "");
  const [vttRaw, setVttRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"cues" | "raw">("cues");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selectedLang) return;
    setLoading(true); setVttRaw(null);
    fetch(`/api/videos/${videoId}/subtitles/${selectedLang}`)
      .then(r => r.ok ? r.text() : null)
      .then(t => { setVttRaw(t); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedLang, videoId]);

  const cues = vttRaw ? parseVtt(vttRaw) : [];
  const txtContent = vttRaw ? vttToTxt(vttRaw) : "";

  if (readyTracks.length === 0) return (
    <div className="text-center py-8 text-[#555] text-sm">
      <Eye className="h-8 w-8 mx-auto mb-2 opacity-20" />
      Görüntülenecek transcript yok.
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)}
          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
          {readyTracks.map(t => <option key={t.language} value={t.language}>{FLAG[t.language]} {t.langName}</option>)}
        </select>
        <div className="flex border border-[#2a2a2a] rounded-xl overflow-hidden">
          {(["cues", "raw"] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={cn("px-3 py-2 text-xs font-medium transition-all",
                viewMode === m ? "bg-[#2a2a2a] text-white" : "text-[#666] hover:text-[#aaa]"
              )}>
              {m === "cues" ? "Okuma" : "Ham VTT"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#555]" /></div>
      ) : vttRaw ? (
        <>
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl overflow-hidden">
            {viewMode === "cues" ? (
              <div className="divide-y divide-[#1a1a1a] max-h-64 overflow-y-auto">
                {cues.length === 0 ? (
                  <p className="text-xs text-[#555] text-center py-4">Altyazı satırı bulunamadı.</p>
                ) : cues.map((cue, i) => (
                  <div key={i} className="flex gap-3 px-3 py-2 hover:bg-[#1a1a1a] transition-colors">
                    <span className="text-[10px] font-mono text-[#555] shrink-0 mt-0.5 w-16">{cue.start}</span>
                    <p className="text-xs text-[#ccc] leading-relaxed">{cue.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="text-[10px] font-mono text-[#888] p-3 max-h-64 overflow-y-auto whitespace-pre-wrap">{vttRaw}</pre>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => copyToClipboard(txtContent, setCopied)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white transition-colors">
              {copied ? <><Check className="h-3 w-3 text-green-400" /> Kopyalandı</> : <><Copy className="h-3 w-3" /> Metni Kopyala</>}
            </button>
            <button onClick={() => downloadFile(txtContent, `transcript-${selectedLang}.txt`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white transition-colors">
              <Download className="h-3 w-3" /> TXT
            </button>
            <button onClick={() => downloadFile(vttRaw, `transcript-${selectedLang}.vtt`, "text/vtt")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white transition-colors">
              <Download className="h-3 w-3" /> VTT
            </button>
            <button onClick={() => downloadFile(vttToSrt(vttRaw), `transcript-${selectedLang}.srt`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white transition-colors">
              <Download className="h-3 w-3" /> SRT
            </button>
            <span className="ml-auto text-[10px] text-[#555] flex items-center">{cues.length} satır</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-[#555] text-center py-4">İçerik yüklenemedi.</p>
      )}
    </div>
  );
}

/* ─────────────────────────── TAB: VTT YÜKLE ─────────────────────────── */

function TabUpload({ videoId, headers, reloadTracks, setTab }: {
  videoId: number; headers: Record<string, string>; reloadTracks: () => void; setTab: (t: OwnerTab) => void;
}) {
  const [lang, setLang] = useState("tr");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setContent(ev.target?.result as string || "");
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!content.trim()) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/subtitles`, {
        method: "POST", headers,
        body: JSON.stringify({ language: lang, content }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Hata oluştu"); return; }
      setDone(true); reloadTracks();
      setTimeout(() => { setDone(false); setTab("list"); }, 2000);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label className="text-xs text-[#666] block mb-1">Dil</label>
          <select value={lang} onChange={e => setLang(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{FLAG[code]} {name}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-xs text-[#888] hover:text-white cursor-pointer transition-colors h-[38px]">
          <Upload className="h-3.5 w-3.5" /> Dosya Seç
          <input type="file" accept=".vtt,.srt" onChange={handleFile} className="hidden" />
        </label>
      </div>
      <div>
        <label className="text-xs text-[#666] block mb-1">VTT İçeriği</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={8}
          placeholder={"WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nMerhaba, bu videoya hoş geldiniz.\n\n00:00:05.000 --> 00:00:09.000\nBugün önemli bir konuyu ele alacağız."}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-primary/50 resize-none placeholder:text-[#2a2a2a]"
        />
      </div>
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
      <button onClick={handleUpload} disabled={loading || !content.trim() || done}
        className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
          done ? "bg-green-900/30 text-green-400 border border-green-500/30" :
          "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-40"
        )}>
        {done ? <><CheckCircle2 className="h-4 w-4" /> Kaydedildi!</> :
         loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Kaydediliyor...</> :
         <><Upload className="h-4 w-4" /> VTT Yükle</>}
      </button>
    </div>
  );
}

/* ─────────────────────────── TAB: TOPLULUK (OWNER) ─────────────────────────── */

function TabCommunity({ videoId, headers, reloadTracks }: {
  videoId: number; headers: Record<string, string>; reloadTracks: () => void;
}) {
  const [pending, setPending] = useState<{ language: string; langName: string; preview: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const loadPending = () => {
    fetch(`/api/videos/${videoId}/subtitles/pending`, { headers })
      .then(r => r.json()).then(d => setPending(d.pending ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPending(); }, [videoId]);

  const approve = async (lang: string) => {
    setActing(lang);
    try {
      await fetch(`/api/videos/${videoId}/subtitles/${lang}/approve`, { method: "POST", headers });
      reloadTracks(); loadPending();
    } finally { setActing(null); }
  };

  const reject = async (lang: string) => {
    setActing(lang);
    try {
      await fetch(`/api/videos/${videoId}/subtitles/${lang}/delete`, { method: "DELETE", headers });
      loadPending();
    } finally { setActing(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-[#888] bg-[#1a1a1a] rounded-xl p-3">
        <Users className="h-4 w-4 text-primary shrink-0" />
        İzleyicilerin gönderdiği transcript önerileri. Onayladığınızda altyazı listesine eklenir.
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#555]" /></div>
      ) : pending.length === 0 ? (
        <div className="text-center py-8 text-[#555] text-sm">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
          Bekleyen topluluk katkısı yok.
        </div>
      ) : (
        pending.map(p => (
          <div key={p.language} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{p.langName}</span>
              <span className="text-[10px] bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded font-bold">BEKLEMEDE</span>
            </div>
            <pre className="text-[10px] text-[#777] bg-[#0d0d0d] rounded-lg p-2 max-h-20 overflow-y-auto whitespace-pre-wrap font-mono">{p.preview}...</pre>
            <div className="flex gap-2">
              <button onClick={() => approve(p.language)} disabled={acting === p.language}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs bg-green-900/30 border border-green-500/30 text-green-400 hover:bg-green-900/50 transition-all disabled:opacity-50">
                {acting === p.language ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Onayla
              </button>
              <button onClick={() => reject(p.language)} disabled={acting === p.language}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs bg-red-900/30 border border-red-500/30 text-red-400 hover:bg-red-900/50 transition-all disabled:opacity-50">
                <X className="h-3 w-3" /> Reddet
              </button>
            </div>
          </div>
        ))
      )}
      <button onClick={loadPending} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-[#555] hover:text-[#888] transition-colors">
        <RefreshCw className="h-3 w-3" /> Yenile
      </button>
    </div>
  );
}

/* ─────────────────────────── TAB: KATKI (USER) ─────────────────────────── */

function TabContribute({ videoId, headers }: { videoId: number; headers: Record<string, string>; }) {
  const [lang, setLang] = useState("tr");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"vtt" | "plain">("plain");

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setError(""); setLoading(true);
    let submitContent = content.trim();
    if (mode === "plain") {
      submitContent = `WEBVTT\n\nNOTE Topluluk katkısı\n\n${submitContent}`;
    }
    try {
      const res = await fetch(`/api/videos/${videoId}/subtitles/community-submit`, {
        method: "POST", headers,
        body: JSON.stringify({ language: lang, content: submitContent }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Hata oluştu"); return; }
      setDone(true);
    } finally { setLoading(false); }
  };

  if (done) return (
    <div className="text-center py-8">
      <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
      <p className="text-sm font-semibold text-white mb-1">Katkınız alındı!</p>
      <p className="text-xs text-[#666]">İçerik sahibi inceledikten sonra yayınlanacak.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-[#1a1a1a] rounded-xl p-3 text-xs text-[#888]">
        <Users className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p>Bu video için transcript yazarak topluluğa katkıda bulunun. İçerik sahibi onayladıktan sonra altyazı olarak kullanılacak.</p>
      </div>
      <div className="flex gap-2">
        {(["plain", "vtt"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border",
              mode === m ? "bg-primary/15 border-primary/40 text-primary" : "border-[#2a2a2a] text-[#666] hover:text-[#aaa]"
            )}>
            {m === "plain" ? "📝 Düz Metin" : "🕐 VTT Formatlı"}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs text-[#666] block mb-1">Dil</label>
        <select value={lang} onChange={e => setLang(e.target.value)}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
          {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
            <option key={code} value={code}>{FLAG[code]} {name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-[#666] block mb-1">
          {mode === "plain" ? "Transcript Metni" : "VTT İçeriği"}
        </label>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={7}
          placeholder={mode === "plain"
            ? "Videodaki konuşmaları yazın..."
            : "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nMerhaba..."}
          className={cn("w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 resize-none placeholder:text-[#333]",
            mode === "vtt" && "font-mono"
          )}
        />
      </div>
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
      <button onClick={handleSubmit} disabled={loading || !content.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-40 transition-all">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</> : <><Users className="h-4 w-4" /> Katkı Gönder</>}
      </button>
    </div>
  );
}
