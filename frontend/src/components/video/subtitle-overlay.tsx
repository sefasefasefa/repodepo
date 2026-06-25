import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Subtitles, ChevronDown, Check, X, Loader2, Languages } from "lucide-react";

interface SubtitleTrack {
  id: number;
  language: string;
  langName: string;
  isAuto: boolean;
  isOriginal: boolean;
  status: string;
}

interface ParsedCue {
  start: number;
  end: number;
  text: string;
}

function parseVTT(vtt: string): ParsedCue[] {
  const cues: ParsedCue[] = [];
  const blocks = vtt.replace(/\r\n/g, "\n").split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const timeLine = lines.find(l => l.includes("-->"));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split("-->").map(s => s.trim());
    const toSec = (t: string) => {
      const parts = t.replace(",", ".").split(":");
      if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
      if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
      return parseFloat(parts[0]);
    };
    const textLines = lines.slice(lines.indexOf(timeLine) + 1).filter(l => l && !l.match(/^\d+$/));
    if (textLines.length > 0) {
      cues.push({ start: toSec(startStr), end: toSec(endStr), text: textLines.join("\n") });
    }
  }
  return cues;
}

interface Props {
  videoId: number;
  currentTime?: number;          // video'nun anlık zamanı (saniye)
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export function SubtitleOverlay({ videoId, videoRef }: Props) {
  const [tracks, setTracks]         = useState<SubtitleTrack[]>([]);
  const [activeLang, setActiveLang] = useState<string | null>(null);
  const [cues, setCues]             = useState<ParsedCue[]>([]);
  const [currentCue, setCurrentCue] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Track listesini yükle — hazırsa Türkçe'yi otomatik aç
  useEffect(() => {
    fetch(`/api/videos/${videoId}/subtitles`)
      .then(r => r.json())
      .then(d => {
        const ready: SubtitleTrack[] = (d.subtitles ?? []).filter((s: SubtitleTrack) => s.status === "ready");
        setTracks(ready);
        // Kullanıcı henüz bir seçim yapmadıysa Türkçe altyazıyı otomatik aç
        setActiveLang(prev => {
          if (prev !== null) return prev; // kullanıcı zaten seçti
          const tr = ready.find(t => t.language === "tr");
          return tr ? "tr" : null;
        });
      });
  }, [videoId]);

  // Video zamanını takip et
  useEffect(() => {
    const vid = videoRef?.current;
    if (!vid) return;
    const tick = () => {
      setCurrentTime(vid.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [videoRef]);

  // Seçilen dile ait VTT'yi yükle
  useEffect(() => {
    if (!activeLang) { setCues([]); return; }
    setLoading(true);
    fetch(`/api/videos/${videoId}/subtitles/${activeLang}`)
      .then(r => r.text())
      .then(vtt => setCues(parseVTT(vtt)))
      .finally(() => setLoading(false));
  }, [videoId, activeLang]);

  // Anlık cue'yu bul
  useEffect(() => {
    const active = cues.find(c => currentTime >= c.start && currentTime <= c.end);
    setCurrentCue(active?.text ?? null);
  }, [currentTime, cues]);

  if (tracks.length === 0 && !activeLang) return null;

  return (
    <>
      {/* Altyazı metni — video üstünde, alttan 12% yukarda */}
      {activeLang && currentCue && (
        <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-none px-4 z-20">
          <div className="bg-black/80 text-white text-sm md:text-base px-4 py-2 rounded-lg text-center max-w-[85%] leading-relaxed whitespace-pre-line">
            {currentCue}
          </div>
        </div>
      )}

      {/* CC butonu */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(p => !p)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
            activeLang
              ? "bg-primary/20 border-primary text-primary"
              : "bg-[#1e1e1e] border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444]"
          )}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Subtitles className="h-3 w-3" />}
          {activeLang ? tracks.find(t => t.language === activeLang)?.langName ?? activeLang : "Altyazı"}
          <ChevronDown className="h-2.5 w-2.5" />
        </button>

        {showPicker && (
          <div className="absolute bottom-full mb-2 left-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-2xl z-50 min-w-[180px]">
            <div className="px-3 py-2 border-b border-[#222] flex items-center gap-2">
              <Languages className="h-3.5 w-3.5 text-[#555]" />
              <span className="text-[11px] font-bold text-[#555] uppercase tracking-wider">Altyazı Dili</span>
            </div>

            {/* Kapalı seçeneği */}
            <button
              onClick={() => { setActiveLang(null); setShowPicker(false); }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#222] transition-colors",
                !activeLang ? "text-white" : "text-[#888]"
              )}
            >
              <span>Kapalı</span>
              {!activeLang && <Check className="h-3 w-3 text-primary" />}
            </button>

            {tracks.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#555] text-center">Altyazı yok</div>
            ) : (
              tracks.map(t => (
                <button
                  key={t.language}
                  onClick={() => { setActiveLang(t.language); setShowPicker(false); }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#222] transition-colors",
                    activeLang === t.language ? "text-white" : "text-[#aaa]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{t.langName}</span>
                    {t.isAuto && (
                      <span className="text-[9px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-medium">AI</span>
                    )}
                    {t.isOriginal && (
                      <span className="text-[9px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded font-medium">ORJ</span>
                    )}
                  </div>
                  {activeLang === t.language && <Check className="h-3 w-3 text-primary" />}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
