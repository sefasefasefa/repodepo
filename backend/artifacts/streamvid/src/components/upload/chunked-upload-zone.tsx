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
  AlertTriangle, Loader2, Zap, Clock, BarChart2, Layers,
  Camera, RefreshCw, ImageIcon, CalendarClock, Share2
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
    const done = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = url;

    const cleanup = () => { try { URL.revokeObjectURL(url); } catch {} };

    // Timeout: bazı tarayıcı/format kombinasyonlarında seeked hiç tetiklenmez
    const timeout = setTimeout(() => done(null), 8000);

    const capture = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) { done(null); return; }
        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;
        const scale = Math.min(1280 / vw, 720 / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 1280, 720);
        ctx.drawImage(video, (1280 - dw) / 2, (720 - dh) / 2, dw, dh);
        canvas.toBlob((blob) => done(blob), "image/jpeg", 0.88);
      } catch { done(null); }
    };

    video.addEventListener("loadedmetadata", () => {
      const t = Math.min(timeSec, video.duration * 0.9 || 0);
      if (t === 0) {
        // Süre bilinmiyorsa mevcut kareyi al
        capture();
      } else {
        video.currentTime = t;
      }
    });

    video.addEventListener("seeked", capture);

    // Seek olmadan veri gelirse de yakala
    video.addEventListener("loadeddata", () => {
      if (!settled && video.readyState >= 2) {
        capture();
      }
    });

    video.addEventListener("error", () => { clearTimeout(timeout); done(null); });

    video.load();
  });
}

// ── Main component ────────────────────────────────────────────────────────────
export function ChunkedUploadZone({ onDone }: Props) {
  const { token, user } = useAuth() as any;
  const isAdmin = user?.role === "admin";
  const { state, start, pause, resume, cancel, reset } = useChunkedUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const [meta, setMeta] = useState<UploadMeta & { title: string; description: string }>({
    title: "",
    description: "",
    isPremium: false,
    isAdult: false,
    type: "video",
    categoryId: undefined,
    scheduledPublishAt: null,
    crosspostSiteIds: [],
    crosspostMode: "all" as "all" | "select" | "none",
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

  const { data: catData } = useListCategories();
  const categories: any[] = (catData as any)?.categories ?? [];

  // Extract duration when file selected
  const getVideoDuration = (file: File) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.addEventListener("loadedmetadata", () => {
      setVideoDuration(v.duration || 0);
      URL.revokeObjectURL(url);
    });
    v.load();
  };

  const generateThumbnail = useCallback(async (file: File, t: number) => {
    setThumbLoading(true);
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
    setThumbPreview(null);
    try {
      const blob = await extractFrame(file, t);
      if (blob) {
        setThumbBlob(blob);
        setThumbPreview(URL.createObjectURL(blob));
      }
    } finally {
      setThumbLoading(false);
    }
  }, []);

  const pickFile = useCallback((file: File) => {
    setMeta((m) => ({ ...m, title: file.name.replace(/\.[^.]+$/, "") }));
    setThumbBlob(null);
    setThumbPreview(null);
    setThumbTime(5);
    setVideoDuration(0);
    setThumbDone(false);
    getVideoDuration(file);
    generateThumbnail(file, 5);
  }, [generateThumbnail]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
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
    },
    [pickFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) pickFile(file);
  };

  const selectedFile = (() => {
    if (fileRef.current?.files?.[0]) return fileRef.current.files[0];
    if (state.file) return state.file;
    return null;
  })();

  const handleStart = () => {
    const file = fileRef.current?.files?.[0] ?? state.file;
    if (!file) return;
    const finalMeta = {
      ...meta,
      scheduledPublishAt: scheduleEnabled && scheduleValue ? new Date(scheduleValue).toISOString() : null,
    };
    start(file, finalMeta);
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

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => { if (thumbPreview) URL.revokeObjectURL(thumbPreview); };
  }, [thumbPreview]);

  const s = state;

  // ── Done ─────────────────────────────────────────────────────────────────
  if (s.status === "done" && s.videoId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
        </div>
        {thumbPreview && (
          <img src={thumbPreview} alt="Thumbnail" className="w-48 h-28 object-cover rounded-xl border border-[#333] shadow-xl" />
        )}
        <div>
          <p className="text-lg font-bold text-white">Yükleme Tamamlandı!</p>
          <p className="text-sm text-[#888] mt-1">{s.file?.name} başarıyla yüklendi.</p>
          {thumbUploading && <p className="text-xs text-primary mt-1 flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Thumbnail kaydediliyor...</p>}
          {thumbDone && <p className="text-xs text-green-400 mt-1 flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3" /> Thumbnail eklendi</p>}
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
    const isPaused = s.status === "paused";

    return (
      <div className="space-y-5 py-2">
        {/* Thumbnail preview while uploading */}
        {thumbPreview && (
          <div className="relative w-full aspect-video max-h-44 rounded-xl overflow-hidden border border-[#2a2a2a]">
            <img src={thumbPreview} alt="Thumbnail" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-2 left-3 text-xs text-[#aaa] font-medium flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> Thumbnail
            </div>
          </div>
        )}

        {/* File info */}
        <div className="flex items-center gap-3 bg-[#161616] border border-[#222] rounded-xl p-4">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
            <FileVideo className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{s.file?.name}</p>
            <p className="text-xs text-[#666] mt-0.5">{formatBytes(s.totalBytes)}</p>
          </div>
          {!isAssembling && (
            <button onClick={cancel} className="p-1.5 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-all" title="İptal et">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#666]">
            <span className="font-semibold text-white text-sm">{s.progress}%</span>
            <span>
              {isAssembling ? "Birleştiriliyor..." : s.status === "initializing" ? "Başlatılıyor..." : `${formatBytes(s.uploadedBytes)} / ${formatBytes(s.totalBytes)}`}
            </span>
          </div>
          <div className="relative h-2.5 bg-[#1e1e1e] rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300", isAssembling ? "bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse" : isPaused ? "bg-[#444]" : "bg-gradient-to-r from-primary to-violet-500")}
              style={{ width: `${s.progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        {!isAssembling && s.status !== "initializing" && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={Zap} label="Hız" value={s.speed > 0 ? `${formatBytes(s.speed)}/s` : "--"} color="text-primary" />
            <StatCard icon={Clock} label="Kalan" value={isPaused ? "Duraklatıldı" : formatEta(s.eta)} color={isPaused ? "text-[#888]" : "text-yellow-400"} />
            <StatCard icon={Layers} label="Parça" value={`${s.currentChunk} / ${s.totalChunks}`} color="text-violet-400" />
          </div>
        )}

        {/* Controls */}
        {!isAssembling && s.status !== "initializing" && (
          <div className="flex gap-3">
            {isPaused ? (
              <Button onClick={resume} className="flex-1 bg-primary hover:bg-primary/90 gap-2">
                <Play className="h-4 w-4" fill="currentColor" /> Devam Et
              </Button>
            ) : (
              <Button onClick={pause} variant="outline" className="flex-1 border-[#333] text-[#aaa] hover:text-white gap-2">
                <Pause className="h-4 w-4" fill="currentColor" /> Duraklat
              </Button>
            )}
            <Button onClick={cancel} variant="ghost" className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10 gap-2">
              <X className="h-4 w-4" /> İptal
            </Button>
          </div>
        )}

        {isAssembling && (
          <div className="flex items-center justify-center gap-2 text-[#888] text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Parçalar birleştiriliyor, lütfen bekle...
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
          "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-12 px-6 text-center group",
          dragging ? "border-primary bg-primary/5 scale-[1.01]" : selectedFile ? "border-primary/50 bg-primary/5" : "border-[#2a2a2a] bg-[#111] hover:border-[#444] hover:bg-[#161616]"
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

          {/* Thumbnail preview + scrubber */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#888] flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Thumbnail Önizleme</label>
              {thumbPreview && (
                <button
                  type="button"
                  onClick={() => generateThumbnail(selectedFile, thumbTime)}
                  className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  disabled={thumbLoading}
                >
                  <RefreshCw className={cn("h-3 w-3", thumbLoading && "animate-spin")} />
                  Yenile
                </button>
              )}
            </div>

            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0d0d0d] border border-[#2a2a2a]">
              {thumbLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                </div>
              )}
              {thumbPreview && !thumbLoading && (
                <img src={thumbPreview} alt="Thumbnail" className="w-full h-full object-contain" />
              )}
              {!thumbPreview && !thumbLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#444]">
                  <Camera className="h-8 w-8" />
                  <span className="text-xs">Thumbnail oluşturuluyor...</span>
                </div>
              )}
            </div>

            {/* Time scrubber */}
            {videoDuration > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#555]">
                  <span>Kare zamanı</span>
                  <span className="text-[#888] font-mono">{Math.floor(thumbTime / 60)}:{String(Math.round(thumbTime % 60)).padStart(2, "0")} / {Math.floor(videoDuration / 60)}:{String(Math.round(videoDuration % 60)).padStart(2, "0")}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.floor(videoDuration)}
                  step={1}
                  value={thumbTime}
                  onChange={(e) => setThumbTime(Number(e.target.value))}
                  onMouseUp={() => generateThumbnail(selectedFile, thumbTime)}
                  onTouchEnd={() => generateThumbnail(selectedFile, thumbTime)}
                  className="w-full accent-primary h-1.5 cursor-pointer rounded-full"
                />
              </div>
            )}
          </div>

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

            <div className="flex gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                <button
                  type="button"
                  onClick={() => setMeta((m) => ({ ...m, isPremium: !m.isPremium }))}
                  className={cn("relative w-10 h-5 rounded-full transition-all shrink-0", meta.isPremium ? "bg-primary" : "bg-[#333]")}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", meta.isPremium ? "left-5" : "left-0.5")} />
                </button>
                <span className="text-sm text-[#aaa]">Premium içerik</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                <button
                  type="button"
                  onClick={() => setMeta((m) => ({ ...m, isAdult: !m.isAdult }))}
                  className={cn("relative w-10 h-5 rounded-full transition-all shrink-0", meta.isAdult ? "bg-red-500" : "bg-[#333]")}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", meta.isAdult ? "left-5" : "left-0.5")} />
                </button>
                <span className="text-sm text-[#aaa]">+18 İçerik</span>
              </label>
            </div>

            {/* Zamanlanmış yayın */}
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => setScheduleEnabled(v => !v)}>
                <span className={cn("relative w-10 h-5 rounded-full transition-all shrink-0", scheduleEnabled ? "bg-primary" : "bg-[#333]")}>
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", scheduleEnabled ? "left-5" : "left-0.5")} />
                </span>
                <CalendarClock className="h-3.5 w-3.5 text-[#888]" />
                <span className="text-sm text-[#aaa]">Zamanlanmış yayın</span>
              </label>
              {scheduleEnabled && (
                <div className="space-y-1">
                  <input
                    type="datetime-local"
                    value={scheduleValue}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    onChange={(e) => setScheduleValue(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary [color-scheme:dark]"
                  />
                  {scheduleValue && (
                    <p className="text-[11px] text-primary flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      Video {new Date(scheduleValue).toLocaleString("tr-TR")} tarihinde yayınlanacak
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sağlayıcı seçimi — sadece admin */}
            {isAdmin ? (
              <div className="border border-[#1e1e1e] rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                  <Share2 className="h-4 w-4 text-[#666]" />
                  <span className="text-sm text-[#aaa] font-medium">Çapraz Yayın (Cross-post)</span>
                </div>
                <div className="flex gap-2 px-4 pb-3">
                  {(["all", "select", "none"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMeta((m) => ({ ...m, crosspostMode: mode }))}
                      className={cn(
                        "flex-1 text-xs py-2 rounded-lg border transition-all font-medium",
                        (meta.crosspostMode ?? "all") === mode
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-[#aaa]"
                      )}
                    >
                      {mode === "all" ? "🔁 Tüme At" : mode === "select" ? "☑ Seç" : "✕ Gönderme"}
                    </button>
                  ))}
                </div>
                {(meta.crosspostMode ?? "all") === "all" && (
                  <p className="text-xs text-[#555] px-4 pb-3">Tüm aktif sağlayıcılara otomatik gönderilir.</p>
                )}
                {(meta.crosspostMode ?? "all") === "select" && (
                  <div className="p-4 border-t border-[#1e1e1e] bg-[#0d0d0d]">
                    <ProviderSelector
                      isAdult={meta.isAdult ?? false}
                      selectedIds={meta.crosspostSiteIds ?? []}
                      onChange={(ids) => setMeta((m) => ({ ...m, crosspostSiteIds: ids }))}
                    />
                  </div>
                )}
                {(meta.crosspostMode ?? "all") === "none" && (
                  <p className="text-xs text-[#555] px-4 pb-3">Bu video hiçbir sağlayıcıya gönderilmez.</p>
                )}
              </div>
            ) : null}

            <Button
              onClick={handleStart}
              disabled={!meta.title.trim() || (scheduleEnabled && !scheduleValue)}
              className="w-full bg-primary hover:bg-primary/90 text-white gap-2 h-11 rounded-xl font-bold shadow-[0_0_20px_rgba(168,85,247,0.25)]"
            >
              {scheduleEnabled && scheduleValue ? (
                <><CalendarClock className="h-4 w-4" /> Zamanla ve Yükle</>
              ) : (
                <><Upload className="h-4 w-4" /> Yüklemeyi Başlat</>
              )}
            </Button>

            <div className="flex items-center gap-2 text-xs text-[#555]">
              <BarChart2 className="h-3.5 w-3.5" />
              5 MB parçalar · Duraklat/devam desteklenir · Otomatik thumbnail
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Zap; label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3 text-center">
      <Icon className={cn("h-4 w-4 mx-auto mb-1.5", color ?? "text-[#666]")} />
      <p className="text-[10px] text-[#555] uppercase tracking-widest font-bold">{label}</p>
      <p className="text-sm font-bold text-white mt-0.5 leading-none">{value}</p>
    </div>
  );
}
