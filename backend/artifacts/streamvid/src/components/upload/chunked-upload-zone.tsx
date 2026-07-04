import { useRef, useState, useCallback, useEffect } from "react";
import { useChunkedUpload, formatBytes, formatEta, type UploadMeta } from "@/hooks/use-chunked-upload";
import { useAuth } from "@/lib/auth";
import { useListCategories } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Upload, FileVideo, X, Pause, Play, CheckCircle2,
  AlertTriangle, Loader2, Zap, Clock, Layers,
  Camera, RefreshCw, ImageIcon, CalendarClock, Share2,
  Gauge, TrendingUp, FolderOpen
} from "lucide-react";
import { Link } from "wouter";
import { ProviderSelector } from "./provider-selector";

const ACCEPTED = ".mp4,.m4v,.mkv,.avi,.mov,.wmv,.flv,.webm,.ts";

interface Props {
  onDone?: (videoId: number) => void;
}

// ── Thumbnail extractor ──────────────────────────────────────────────────────
function extractFrame(file: File, timeSec: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      try { URL.revokeObjectURL(url); } catch {}
    };
    const done = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };
    const capture = () => {
      if (video.readyState < 2 || video.videoWidth === 0) { done(null); return; }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) { done(null); return; }
        const vw = video.videoWidth, vh = video.videoHeight;
        const scale = Math.min(1280 / vw, 720 / vh);
        const dw = Math.round(vw * scale), dh = Math.round(vh * scale);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 1280, 720);
        ctx.drawImage(video, Math.round((1280 - dw) / 2), Math.round((720 - dh) / 2), dw, dh);
        canvas.toBlob((blob) => done(blob), "image/jpeg", 0.88);
      } catch { done(null); }
    };
    video.addEventListener("loadedmetadata", () => {
      const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      video.currentTime = dur ? Math.min(timeSec, dur * 0.9) : timeSec;
    });
    video.addEventListener("seeked", capture);
    video.addEventListener("error", () => done(null));
    timeout = setTimeout(() => done(null), 10000);
    video.src = url;
    video.load();
  });
}

// ── Speed history sparkline ──────────────────────────────────────────────────
function SpeedSparkline({ samples }: { samples: number[] }) {
  if (samples.length < 2) return null;
  const max = Math.max(...samples);
  if (max === 0) return null;
  const w = 64, h = 24;
  const step = w / (samples.length - 1);
  const pts = samples.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="opacity-50">
      <polyline points={pts} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ChunkedUploadZone({ onDone }: Props) {
  const { token, user } = useAuth() as any;
  const { state, start, pause, resume, cancel, reset } = useChunkedUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbFileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);

  const [meta, setMeta] = useState<UploadMeta & { title: string; description: string; crosspostMode: "all" | "select" | "none" }>({
    title: "", description: "",
    isPremium: false, isPPV: false, watermarkEnabled: false, isAdult: false, type: "video",
    categoryId: undefined, scheduledPublishAt: null,
    crosspostSiteIds: [], crosspostMode: "all",
  });

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");

  // ── Thumbnail state ──────────────────────────────────────────────────────
  const [thumbBlob, setThumbBlob] = useState<Blob | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [thumbTime, setThumbTime] = useState(5);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbDone, setThumbDone] = useState(false);
  const [thumbSource, setThumbSource] = useState<"auto" | "manual">("auto");

  const { data: catData } = useListCategories();
  const categories: any[] = (catData as any)?.categories ?? [];

  // Track speed history for sparkline
  useEffect(() => {
    if (state.speed > 0) {
      setSpeedHistory(prev => [...prev.slice(-15), state.speed]);
    }
  }, [state.speed]);

  const getVideoDuration = (file: File) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata"; v.src = url;
    v.addEventListener("loadedmetadata", () => {
      setVideoDuration(v.duration || 0);
      URL.revokeObjectURL(url);
    });
    v.load();
  };

  const generateThumbnail = useCallback(async (file: File, t: number) => {
    setThumbLoading(true);
    if (thumbPreview && thumbSource === "auto") URL.revokeObjectURL(thumbPreview);
    setThumbPreview(null);
    try {
      const blob = await extractFrame(file, t);
      if (blob) {
        setThumbBlob(blob);
        setThumbPreview(URL.createObjectURL(blob));
        setThumbSource("auto");
      }
    } finally {
      setThumbLoading(false);
    }
  }, [thumbPreview, thumbSource]);

  const pickFile = useCallback((file: File) => {
    setMeta((m) => ({ ...m, title: file.name.replace(/\.[^.]+$/, "") }));
    setThumbBlob(null);
    setThumbPreview(null);
    setThumbTime(5);
    setVideoDuration(0);
    setThumbDone(false);
    setSpeedHistory([]);
    getVideoDuration(file);
    generateThumbnail(file, 5);
  }, [generateThumbnail]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      pickFile(file);
      if (fileRef.current) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileRef.current.files = dt.files;
      }
    }
  }, [pickFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) pickFile(file);
  };

  const handleManualThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (thumbPreview && thumbSource === "auto") URL.revokeObjectURL(thumbPreview);
    const blob = f.slice(0, f.size, f.type);
    setThumbBlob(blob);
    setThumbPreview(URL.createObjectURL(f));
    setThumbSource("manual");
  };

  const selectedFile = fileRef.current?.files?.[0] ?? state.file ?? null;

  const handleStart = () => {
    const file = fileRef.current?.files?.[0] ?? state.file;
    if (!file) return;
    setSpeedHistory([]);
    start(file, {
      ...meta,
      scheduledPublishAt: scheduleEnabled && scheduleValue ? new Date(scheduleValue).toISOString() : null,
    });
  };

  // Upload thumbnail after video done
  useEffect(() => {
    if (state.status === "done" && state.videoId && thumbBlob && !thumbDone && !thumbUploading) {
      setThumbUploading(true);
      const fd = new FormData();
      fd.append("videoId", String(state.videoId));
      fd.append("thumbnail", thumbBlob, "thumbnail.jpg");
      fetch("/api/upload/thumbnail", {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: fd,
      })
        .then(() => setThumbDone(true))
        .catch(() => {})
        .finally(() => setThumbUploading(false));
    }
  }, [state.status, state.videoId, thumbBlob, thumbDone, thumbUploading, token]);

  useEffect(() => {
    return () => { if (thumbPreview && thumbSource === "auto") URL.revokeObjectURL(thumbPreview); };
  }, []);

  const s = state;

  // ── Done ─────────────────────────────────────────────────────────────────
  if (s.status === "done" && s.videoId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
        <div className="relative w-full max-w-xs aspect-video rounded-xl overflow-hidden border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
          {thumbPreview
            ? <img src={thumbPreview} alt="Thumbnail" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-[#111] flex items-center justify-center"><FileVideo className="h-10 w-10 text-[#333]" /></div>
          }
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-500/20 border border-green-500/40 backdrop-blur-sm">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>
        <div>
          <p className="text-lg font-bold text-white">Yükleme Tamamlandı!</p>
          <p className="text-sm text-[#888] mt-1 max-w-xs truncate">{s.file?.name}</p>
          {thumbUploading && (
            <p className="text-xs text-primary mt-2 flex items-center justify-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Thumbnail kaydediliyor...
            </p>
          )}
          {thumbDone && (
            <p className="text-xs text-green-400 mt-2 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Thumbnail eklendi
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Link href={`/videos/${s.videoId}`}>
            <Button className="bg-primary hover:bg-primary/90 gap-2">
              <Play className="h-4 w-4" fill="currentColor" /> Videoyu İzle
            </Button>
          </Link>
          <Button variant="outline" onClick={reset} className="border-[#333] text-[#aaa] hover:text-white">
            Yeni Yükleme
          </Button>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (s.status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-10 w-10 text-red-400" />
        </div>
        <div>
          <p className="text-base font-bold text-white">Yükleme Başarısız</p>
          <p className="text-sm text-red-400/80 mt-1 max-w-sm">{s.error}</p>
        </div>
        <Button variant="outline" onClick={reset} className="border-[#333] text-[#aaa] hover:text-white gap-2">
          <Upload className="h-4 w-4" /> Tekrar Dene
        </Button>
      </div>
    );
  }

  // ── Active Upload ─────────────────────────────────────────────────────────
  if (s.status !== "idle" && s.status !== "canceled") {
    const isAssembling = s.status === "assembling";
    const isInitializing = s.status === "initializing";
    const isPaused = s.status === "paused";
    const speedMbps = s.speed / (1024 * 1024);

    return (
      <div className="space-y-4 py-2">
        {/* ── Thumbnail + Progress Overlay ─────────────────────────────── */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0d0d0d]">
          {thumbPreview
            ? <img src={thumbPreview} alt="Thumbnail" className={cn("w-full h-full object-cover transition-opacity duration-500", isPaused ? "opacity-50" : "opacity-100")} />
            : <div className="w-full h-full flex items-center justify-center"><FileVideo className="h-12 w-12 text-[#2a2a2a]" /></div>
          }

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

          {/* Center status badge */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isInitializing && (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <span className="text-xs text-[#aaa] font-medium">Başlatılıyor...</span>
              </div>
            )}
            {isAssembling && (
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <Loader2 className="h-10 w-10 text-yellow-400 animate-spin" />
                  <div className="absolute inset-0 rounded-full border-2 border-yellow-400/20 animate-ping" />
                </div>
                <span className="text-xs text-yellow-400 font-semibold">Birleştiriliyor...</span>
              </div>
            )}
            {isPaused && (
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
                  <Pause className="h-8 w-8 text-white" fill="currentColor" />
                </div>
                <span className="text-sm text-white font-semibold">Duraklatıldı</span>
              </div>
            )}
            {s.status === "uploading" && (
              <div className="text-center">
                <p className="text-5xl font-black text-white tabular-nums drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  {s.progress}%
                </p>
              </div>
            )}
          </div>

          {/* Bottom bar — progress + speed */}
          {!isInitializing && (
            <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
              {/* Progress bar */}
              <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isAssembling ? "bg-gradient-to-r from-yellow-500 to-orange-400 animate-pulse" :
                    isPaused    ? "bg-[#555]" :
                                  "bg-gradient-to-r from-primary to-violet-400"
                  )}
                  style={{ width: `${s.progress}%` }}
                />
                {/* Shimmer effect while uploading */}
                {s.status === "uploading" && (
                  <div
                    className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse"
                    style={{ left: `${Math.max(0, s.progress - 5)}%` }}
                  />
                )}
              </div>

              {/* Stats row */}
              {!isAssembling && !isInitializing && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-primary" />
                    <span className={cn("text-xs font-bold tabular-nums", speedMbps > 10 ? "text-green-400" : speedMbps > 2 ? "text-yellow-400" : "text-[#aaa]")}>
                      {s.speed > 0 ? `${speedMbps.toFixed(1)} MB/s` : "--"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#888] tabular-nums">
                      {formatBytes(s.uploadedBytes)} / {formatBytes(s.totalBytes)}
                    </span>
                    <span className="text-[11px] text-[#888]">
                      {isPaused ? "Duraklatıldı" : formatEta(s.eta)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Detay kartları ───────────────────────────────────────────────── */}
        {!isAssembling && !isInitializing && (
          <div className="grid grid-cols-3 gap-2">
            {/* Hız */}
            <div className="bg-[#161616] border border-[#222] rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] text-[#666] font-medium uppercase tracking-wider">Hız</span>
                </div>
                <SpeedSparkline samples={speedHistory} />
              </div>
              <p className={cn("text-base font-bold tabular-nums", speedMbps > 10 ? "text-green-400" : speedMbps > 2 ? "text-yellow-400" : "text-[#aaa]")}>
                {s.speed > 0 ? `${speedMbps.toFixed(1)} MB/s` : "--"}
              </p>
              <p className="text-[10px] text-[#555]">{s.speed > 0 ? `${formatBytes(s.speed)}/s` : "hesaplanıyor"}</p>
            </div>

            {/* Kalan Süre */}
            <div className="bg-[#161616] border border-[#222] rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-[11px] text-[#666] font-medium uppercase tracking-wider">Kalan</span>
              </div>
              <p className="text-base font-bold text-yellow-400 tabular-nums">
                {isPaused ? "—" : formatEta(s.eta)}
              </p>
              <p className="text-[10px] text-[#555]">{formatBytes(s.totalBytes - s.uploadedBytes)} kaldı</p>
            </div>

            {/* Parça */}
            <div className="bg-[#161616] border border-[#222] rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[11px] text-[#666] font-medium uppercase tracking-wider">Parça</span>
              </div>
              <p className="text-base font-bold text-violet-400 tabular-nums">
                {s.currentChunk} / {s.totalChunks}
              </p>
              {/* Mini parça progress */}
              <div className="flex gap-px flex-wrap">
                {Array.from({ length: Math.min(s.totalChunks, 20) }).map((_, i) => (
                  <div
                    key={i}
                    className={cn("h-1 rounded-full flex-1 min-w-[2px]", i < Math.floor(s.currentChunk / s.totalChunks * Math.min(s.totalChunks, 20)) ? "bg-violet-500" : "bg-[#333]")}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* File info */}
        <div className="flex items-center gap-3 bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl px-4 py-3">
          <FileVideo className="h-4 w-4 text-[#555] shrink-0" />
          <p className="text-sm text-[#888] truncate flex-1">{s.file?.name}</p>
          <span className="text-xs text-[#555] shrink-0">{formatBytes(s.totalBytes)}</span>
        </div>

        {/* Controls */}
        {!isAssembling && !isInitializing && (
          <div className="flex gap-3">
            {isPaused ? (
              <Button onClick={resume} className="flex-1 bg-primary hover:bg-primary/90 gap-2">
                <Play className="h-4 w-4" fill="currentColor" /> Devam Et
              </Button>
            ) : (
              <Button onClick={pause} variant="outline" className="flex-1 border-[#2a2a2a] text-[#aaa] hover:text-white gap-2">
                <Pause className="h-4 w-4" fill="currentColor" /> Duraklat
              </Button>
            )}
            <Button onClick={cancel} variant="ghost" className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10 gap-2 px-4">
              <X className="h-4 w-4" /> İptal
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Idle / File picker ────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-10 px-6 text-center group",
          dragging    ? "border-primary bg-primary/5 scale-[1.01]" :
          selectedFile? "border-primary/40 bg-primary/5" :
                        "border-[#2a2a2a] bg-[#111] hover:border-[#444] hover:bg-[#161616]"
        )}
      >
        <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleFileChange} />
        {selectedFile ? (
          <>
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
              <FileVideo className="h-10 w-10 text-primary" />
            </div>
            <div>
              <p className="font-bold text-white text-base truncate max-w-xs">{selectedFile.name}</p>
              <p className="text-sm text-[#777] mt-1">{formatBytes(selectedFile.size)}</p>
            </div>
            <p className="text-xs text-[#555]">Farklı dosya seçmek için tıkla</p>
          </>
        ) : (
          <>
            <div className="p-4 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
              <Upload className="h-10 w-10 text-[#444] group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="font-bold text-[#aaa] group-hover:text-white transition-colors">Dosyayı buraya sürükle veya tıkla</p>
              <p className="text-sm text-[#555] mt-1">MP4, MKV, AVI, MOV, WebM · Maks. 10 GB</p>
            </div>
          </>
        )}
      </label>

      {/* Meta form — only when file selected */}
      {selectedFile && (
        <div className="space-y-5 bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
          <p className="text-xs text-[#555] font-bold uppercase tracking-widest">Video Bilgileri</p>

          {/* ── Thumbnail ──────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#888] flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Thumbnail
                {thumbSource === "manual" && <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Manuel</span>}
                {thumbSource === "auto" && thumbPreview && <span className="ml-1 text-[10px] bg-[#222] text-[#666] px-1.5 py-0.5 rounded-full">Otomatik</span>}
              </label>
              <div className="flex items-center gap-2">
                {thumbPreview && thumbSource === "auto" && (
                  <button
                    type="button"
                    onClick={() => generateThumbnail(selectedFile, thumbTime)}
                    className="text-[11px] text-[#666] hover:text-primary flex items-center gap-1 transition-colors"
                    disabled={thumbLoading}
                  >
                    <RefreshCw className={cn("h-3 w-3", thumbLoading && "animate-spin")} /> Yenile
                  </button>
                )}
                {/* Manuel thumbnail yükle butonu */}
                <button
                  type="button"
                  onClick={() => thumbFileRef.current?.click()}
                  className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  <FolderOpen className="h-3 w-3" /> Görsel Seç
                </button>
                <input
                  ref={thumbFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleManualThumb}
                />
              </div>
            </div>

            {/* Preview area */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0d0d0d] border border-[#2a2a2a]">
              {thumbLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d0d0d]">
                  <div className="relative">
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                    <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
                  </div>
                  <span className="text-xs text-[#666]">Kare çıkarılıyor...</span>
                </div>
              )}
              {thumbPreview && !thumbLoading && (
                <>
                  <img src={thumbPreview} alt="Thumbnail" className="w-full h-full object-contain" />
                  {/* Overlay hint */}
                  <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-black/50 flex items-center justify-center gap-3">
                    {thumbSource === "auto" && (
                      <button
                        type="button"
                        onClick={() => generateThumbnail(selectedFile, thumbTime)}
                        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-2 rounded-lg backdrop-blur-sm transition-all"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Yenile
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => thumbFileRef.current?.click()}
                      className="flex items-center gap-1.5 bg-primary/80 hover:bg-primary text-white text-xs px-3 py-2 rounded-lg backdrop-blur-sm transition-all"
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Görsel Değiştir
                    </button>
                  </div>
                </>
              )}
              {!thumbPreview && !thumbLoading && (
                <label className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#555] cursor-pointer hover:text-[#888] transition-colors group/thumb">
                  <input type="file" accept="image/*" className="hidden" onChange={handleManualThumb} />
                  <div className="p-3 rounded-xl border border-dashed border-[#333] group-hover/thumb:border-primary/40 group-hover/thumb:bg-primary/5 transition-all">
                    <Camera className="h-8 w-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium">Thumbnail ekle</p>
                    <p className="text-[11px] text-[#444] mt-0.5">Tıklayarak görsel seç</p>
                  </div>
                </label>
              )}
            </div>

            {/* Time scrubber — only for auto mode */}
            {videoDuration > 0 && thumbSource === "auto" && (
              <div className="space-y-1.5 bg-[#0d0d0d] rounded-lg p-3 border border-[#1e1e1e]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#555]">Kare zamanı</span>
                  <span className="text-[#888] font-mono">
                    {Math.floor(thumbTime / 60)}:{String(Math.round(thumbTime % 60)).padStart(2, "0")}
                    {" / "}
                    {Math.floor(videoDuration / 60)}:{String(Math.round(videoDuration % 60)).padStart(2, "0")}
                  </span>
                </div>
                <input
                  type="range"
                  min={0} max={Math.floor(videoDuration)} step={1} value={thumbTime}
                  onChange={(e) => setThumbTime(Number(e.target.value))}
                  onMouseUp={() => generateThumbnail(selectedFile, thumbTime)}
                  onTouchEnd={() => generateThumbnail(selectedFile, thumbTime)}
                  className="w-full accent-primary h-1.5 cursor-pointer rounded-full"
                />
              </div>
            )}
          </div>

          {/* Title + Description */}
          <div className="border-t border-[#1e1e1e] pt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#888]">Başlık <span className="text-red-400">*</span></label>
              <Input
                value={meta.title}
                onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
                placeholder="Video başlığı..."
                className="bg-[#161616] border-[#2a2a2a] focus:border-primary text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#888]">Açıklama</label>
              <Textarea
                value={meta.description}
                onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
                placeholder="Video hakkında kısa bir açıklama..."
                className="bg-[#161616] border-[#2a2a2a] focus:border-primary text-white resize-none h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#888]">Tür</label>
                <select
                  value={meta.type}
                  onChange={(e) => setMeta((m) => ({ ...m, type: e.target.value as any }))}
                  className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="video">Normal Video</option>
                  <option value="short">Short</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#888]">Kategori</label>
                <select
                  value={meta.categoryId ?? ""}
                  onChange={(e) => setMeta((m) => ({ ...m, categoryId: e.target.value ? Number(e.target.value) : undefined }))}
                  className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Kategori seç</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={meta.isPremium}
                  onChange={(e) => setMeta((m) => ({ ...m, isPremium: e.target.checked }))}
                  className="accent-primary h-4 w-4 rounded"
                />
                <span className="text-sm text-[#aaa]">Premium</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={meta.isAdult}
                  onChange={(e) => setMeta((m) => ({ ...m, isAdult: e.target.checked }))}
                  className="accent-primary h-4 w-4 rounded"
                />
                <span className="text-sm text-[#aaa]">18+</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={meta.watermarkEnabled}
                  onChange={(e) => setMeta((m) => ({ ...m, watermarkEnabled: e.target.checked }))}
                  className="accent-primary h-4 w-4 rounded"
                />
                <span className="text-sm text-[#aaa]">Filigran</span>
              </label>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="accent-primary h-4 w-4 rounded"
                />
                <span className="text-sm text-[#aaa] flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" /> Zamanlanmış Yayın
                </span>
              </label>
              {scheduleEnabled && (
                <input
                  type="datetime-local"
                  value={scheduleValue}
                  onChange={(e) => setScheduleValue(e.target.value)}
                  className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              )}
            </div>

            {/* Crosspost */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#888] flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5" /> Crosspost
              </label>
              <ProviderSelector
                mode={meta.crosspostMode ?? "all"}
                selectedIds={meta.crosspostSiteIds ?? []}
                onModeChange={(m) => setMeta((s) => ({ ...s, crosspostMode: m }))}
                onSelectedChange={(ids) => setMeta((s) => ({ ...s, crosspostSiteIds: ids }))}
              />
            </div>
          </div>

          {/* Start button */}
          <Button
            onClick={handleStart}
            disabled={!meta.title.trim()}
            className="w-full bg-primary hover:bg-primary/90 gap-2 h-12 text-base font-semibold shadow-[0_0_20px_rgba(168,85,247,0.3)]"
          >
            <Upload className="h-5 w-5" />
            Yüklemeyi Başlat
          </Button>
        </div>
      )}
    </div>
  );
}
