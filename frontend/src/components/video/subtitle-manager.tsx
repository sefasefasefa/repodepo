import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Languages, Plus, Trash2, Loader2, Check, ChevronDown,
  Wand2, RefreshCw, FileText, AlertCircle, Sparkles
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

interface SubTrack { id: number; language: string; langName: string; isAuto: boolean; isOriginal: boolean; status: string; }

interface Props { videoId: number; token: string; }

export function SubtitleManager({ videoId, token }: Props) {
  const [tracks, setTracks]         = useState<SubTrack[]>([]);
  const [loading, setLoading]       = useState(false);
  const [tab, setTab]               = useState<"list" | "generate" | "translate" | "upload" | "transcript">("list");
  const [transcriptSubmitLoading, setTranscriptSubmitLoading] = useState(false);
  const [transcriptSubmitDone, setTranscriptSubmitDone] = useState(false);

  // Generate form
  const [genLang, setGenLang]       = useState("tr");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration]     = useState("120");
  const [genLoading, setGenLoading] = useState(false);
  const [genDone, setGenDone]       = useState(false);

  // Translate form
  const [srcLang, setSrcLang]       = useState("tr");
  const [tgtLang, setTgtLang]       = useState("en");
  const [transLoading, setTransLoading] = useState(false);
  const [transDone, setTransDone]   = useState(false);

  // Upload form
  const [upLang, setUpLang]         = useState("tr");
  const [vttContent, setVttContent] = useState("");
  const [upLoading, setUpLoading]   = useState(false);
  const [upDone, setUpDone]         = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const loadTracks = () => {
    fetch(`/api/videos/${videoId}/subtitles`, { headers })
      .then(r => r.json())
      .then(d => setTracks(d.subtitles ?? []));
  };

  useEffect(() => { loadTracks(); }, [videoId]);

  // Poll "generating" tracks
  useEffect(() => {
    const generating = tracks.some(t => t.status === "generating");
    if (!generating) return;
    const id = setTimeout(() => loadTracks(), 5000);
    return () => clearTimeout(id);
  }, [tracks]);

  const deleteLang = async (lang: string) => {
    if (!confirm("Bu altyazıyı silmek istediğinizden emin misiniz?")) return;
    await fetch(`/api/videos/${videoId}/subtitles/${lang}`, { method: "DELETE", headers });
    loadTracks();
  };

  const handleGenerate = async () => {
    if (!transcript.trim()) return;
    setGenLoading(true);
    try {
      await fetch(`/api/videos/${videoId}/subtitles/generate`, {
        method: "POST", headers,
        body: JSON.stringify({ transcript, language: genLang, duration: parseInt(duration) }),
      });
      setGenDone(true);
      setTimeout(() => { setGenDone(false); setTab("list"); loadTracks(); }, 2000);
    } finally { setGenLoading(false); }
  };

  const handleTranslate = async () => {
    if (srcLang === tgtLang) return;
    setTransLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/subtitles/translate`, {
        method: "POST", headers,
        body: JSON.stringify({ sourceLang: srcLang, targetLang: tgtLang }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setTransDone(true);
      setTimeout(() => { setTransDone(false); setTab("list"); loadTracks(); }, 2000);
    } finally { setTransLoading(false); }
  };

  const handleUpload = async () => {
    if (!vttContent.trim()) return;
    setUpLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/subtitles`, {
        method: "POST", headers,
        body: JSON.stringify({ language: upLang, content: vttContent }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setUpDone(true);
      setTimeout(() => { setUpDone(false); setTab("list"); loadTracks(); }, 2000);
    } finally { setUpLoading(false); }
  };

  const handleTranscriptSubmit = async () => {
    if (!pendingTranscript.trim()) return;
    setTranscriptSubmitLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/subtitles/transcript`, {
        method: "POST", headers,
        body: JSON.stringify({ language: genLang, content: pendingTranscript, langName: SUPPORTED_LANGUAGES[genLang] }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setTranscriptSubmitDone(true);
      setTimeout(() => { setTranscriptSubmitDone(false); setTab("list"); loadTracks(); }, 2000);
    } finally { setTranscriptSubmitLoading(false); }
  };

  const existingLangs = new Set(tracks.map(t => t.language));
  const readyTracks   = tracks.filter(t => t.status === "ready");

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
        <Languages className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Altyazı Yönetimi</span>
        {tracks.some(t => t.status === "generating") && (
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Üretiliyor...
          </span>
        )}
      </div>

      {/* Sekmeler */}
      <div className="flex border-b border-[#1a1a1a]">
          {([
          { id: "list",      label: "Altyazılar",  icon: Languages },
          { id: "generate",  label: "AI Üret",     icon: Wand2 },
          { id: "translate", label: "Çevir",       icon: Sparkles },
          { id: "transcript", label: "Transcript", icon: FileText },
          { id: "upload",    label: "VTT Yükle",   icon: FileText },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2",
              tab === id ? "border-primary text-primary" : "border-transparent text-[#666] hover:text-[#aaa]"
            )}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="p-4">

        {/* ── ALTYAZI LİSTESİ ── */}
        {tab === "list" && (
          <div className="space-y-2">
            {tracks.length === 0 ? (
              <div className="text-center py-6 text-[#555] text-sm">
                <Languages className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Henüz altyazı yok. "AI Üret" veya "Çevir" sekmesinden altyazı ekleyin.
              </div>
            ) : (
              tracks.map(t => (
                <div key={t.language} className="flex items-center gap-3 bg-[#1a1a1a] rounded-lg px-3 py-2.5">
                  <span className="text-xl shrink-0">{FLAG[t.language] ?? "🌐"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{t.langName}</span>
                      {t.isAuto && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-bold">AI</span>}
                      {t.isOriginal && <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded font-bold">ORJİNAL</span>}
                    </div>
                    <span className="text-[11px] font-mono text-[#555]">{t.language.toUpperCase()}</span>
                  </div>
                  {t.status === "generating" ? (
                    <div className="flex items-center gap-1 text-xs text-blue-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Üretiliyor
                    </div>
                  ) : t.status === "error" ? (
                    <div className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" /> Hata
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <Check className="h-3.5 w-3.5" /> Hazır
                    </span>
                  )}
                  <button onClick={() => deleteLang(t.language)}
                    className="text-[#444] hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── AI İLE ÜRET ── */}
        {tab === "generate" && (
          <div className="space-y-4">
            <p className="text-xs text-[#666]">
              Video transkriptini (konuşma metnini) yapıştırın. AI otomatik olarak zaman damgalı VTT altyazı üretecek.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#666] block mb-1">Altyazı Dili</label>
                <select value={genLang} onChange={e => setGenLang(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444]">
                  {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>{FLAG[code]} {name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#666] block mb-1">Video Süresi (saniye)</label>
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="10"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444]" />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#666] block mb-1">Transkript / Konuşma Metni</label>
              <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={6}
                placeholder="Videodaki konuşmaları buraya yapıştırın..."
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444] resize-none placeholder:text-[#444]"
              />
            </div>

            <button onClick={handleGenerate} disabled={genLoading || !transcript.trim() || genDone}
              className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                genDone ? "bg-green-900/40 text-green-400" :
                "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-50"
              )}>
              {genDone ? <><Check className="h-4 w-4" /> Üretim başlatıldı!</> :
               genLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</> :
               <><Wand2 className="h-4 w-4" /> AI ile Altyazı Üret</>}
            </button>
          </div>
        )}

        {/* ── ÇEVİR ── */}
        {tab === "translate" && (
          <div className="space-y-4">
            <p className="text-xs text-[#666]">
              Mevcut bir altyazıyı seçin ve hedef dile AI ile çevirin.
            </p>

            {readyTracks.length === 0 ? (
              <div className="text-center py-6 text-[#555] text-sm">
                Çeviri için önce en az bir altyazı eklemeniz gerekiyor.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#666] block mb-1">Kaynak Dil</label>
                    <select value={srcLang} onChange={e => setSrcLang(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444]">
                      {readyTracks.map(t => (
                        <option key={t.language} value={t.language}>{FLAG[t.language]} {t.langName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#666] block mb-1">Hedef Dil</label>
                    <select value={tgtLang} onChange={e => setTgtLang(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444]">
                      {Object.entries(SUPPORTED_LANGUAGES).filter(([c]) => c !== srcLang).map(([code, name]) => (
                        <option key={code} value={code}>{FLAG[code]} {name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-[#1a1a1a] rounded-lg p-3 text-xs text-[#888]">
                  <Sparkles className="h-3.5 w-3.5 inline mr-1 text-primary" />
                  <strong>{SUPPORTED_LANGUAGES[srcLang]}</strong> → <strong>{SUPPORTED_LANGUAGES[tgtLang]}</strong> çevirisi yapılacak.
                  Mevcut zaman damgaları korunur, yalnızca metin çevrilir.
                </div>

                <button onClick={handleTranslate} disabled={transLoading || srcLang === tgtLang || transDone}
                  className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    transDone ? "bg-green-900/40 text-green-400" :
                    "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-50"
                  )}>
                  {transDone ? <><Check className="h-4 w-4" /> Çeviri başlatıldı!</> :
                   transLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</> :
                   <><Sparkles className="h-4 w-4" /> Çeviriye Başla</>}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── VTT YÜKLE ── */}
        {tab === "transcript" && (
          <div className="space-y-4">
            <p className="text-xs text-[#666]">
              Çeviri/transcript önerinizi gönderin. Yalnızca creator onayladıktan sonra kullanılabilir.
            </p>
            <div className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-500/20 rounded-lg px-3 py-2">
              Gönderilen içerik önce beklemeye alınır.
            </div>
            <div>
              <label className="text-xs text-[#666] block mb-1">Dil</label>
              <select value={genLang} onChange={e => setGenLang(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444]">
                {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>{FLAG[code]} {name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#666] block mb-1">Öneri / VTT İçeriği</label>
              <textarea value={pendingTranscript} onChange={e => setPendingTranscript(e.target.value)} rows={8}
                placeholder="WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n..."
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#444] resize-none placeholder:text-[#333]"
              />
            </div>
            <button onClick={handleTranscriptSubmit} disabled={transcriptSubmitLoading || !pendingTranscript.trim() || transcriptSubmitDone}
              className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                transcriptSubmitDone ? "bg-green-900/40 text-green-400" :
                "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-50"
              )}>
              {transcriptSubmitDone ? <><Check className="h-4 w-4" /> Gönderildi!</> :
               transcriptSubmitLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</> :
               <><FileText className="h-4 w-4" /> Transkript Gönder</>}
            </button>
          </div>
        )}

        {/* ── VTT YÜKLE ── */}
        {tab === "upload" && (
          <div className="space-y-4">
            <p className="text-xs text-[#666]">
              Hazır bir WebVTT (.vtt) dosyasının içeriğini yapıştırın.
            </p>

            <div>
              <label className="text-xs text-[#666] block mb-1">Dil</label>
              <select value={upLang} onChange={e => setUpLang(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444]">
                {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>{FLAG[code]} {name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#666] block mb-1">VTT İçeriği</label>
              <textarea value={vttContent} onChange={e => setVttContent(e.target.value)} rows={8}
                placeholder={`WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nMerhaba, bu videoya hoş geldiniz.\n\n00:00:05.000 --> 00:00:09.000\nBugün size önemli bir konudan bahsedeceğim.`}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#444] resize-none placeholder:text-[#333]"
              />
            </div>

            <button onClick={handleUpload} disabled={upLoading || !vttContent.trim() || upDone}
              className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                upDone ? "bg-green-900/40 text-green-400" :
                "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 disabled:opacity-50"
              )}>
              {upDone ? <><Check className="h-4 w-4" /> Kaydedildi!</> :
               upLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Kaydediliyor...</> :
               <><FileText className="h-4 w-4" /> VTT Yükle</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
