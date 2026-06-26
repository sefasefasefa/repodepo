import { useRef, useState, useCallback } from "react";
import { useChunkedUpload, formatBytes, formatEta, type UploadMeta } from "@/hooks/use-chunked-upload";
import { useListCategories } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Upload, FileVideo, X, Pause, Play, CheckCircle2,
  AlertTriangle, Loader2, Zap, Clock, BarChart2, Layers
} from "lucide-react";
import { Link } from "wouter";

const ACCEPTED = ".mp4,.m4v,.mkv,.avi,.mov,.wmv,.flv,.webm,.ts";

interface Props {
  onDone?: (videoId: number) => void;
}

export function ChunkedUploadZone({ onDone }: Props) {
  const { state, start, pause, resume, cancel, reset } = useChunkedUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const [meta, setMeta] = useState<UploadMeta & { title: string; description: string }>({
    title: "",
    description: "",
    isPremium: false,
    type: "video",
    categoryId: undefined,
  });

  const { data: catData } = useListCategories();
  const categories: any[] = (catData as any)?.categories ?? [];

  const pickFile = useCallback((file: File) => {
    setMeta((m) => ({ ...m, title: file.name.replace(/\.[^.]+$/, "") }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        pickFile(file);
        fileRef.current && (fileRef.current.files = e.dataTransfer.files);
      }
    },
    [pickFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) pickFile(file);
  };

  const selectedFile = fileRef.current?.files?.[0] ?? state.file ?? null;

  const handleStart = () => {
    const file = fileRef.current?.files?.[0] ?? state.file;
    if (!file) return;
    start(file, meta);
  };

  const s = state;

  // ── Done ────────────────────────────────────────────────────────────
  if (s.status === "done" && s.videoId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">Yükleme Tamamlandı!</p>
          <p className="text-sm text-[#888] mt-1">
            {s.file?.name} başarıyla yüklendi ve işleme alındı.
          </p>
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

  // ── Error ────────────────────────────────────────────────────────────
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

  // ── Active Upload ─────────────────────────────────────────────────────
  if (s.status !== "idle" && s.status !== "canceled") {
    const isAssembling = s.status === "assembling";
    const isPaused = s.status === "paused";

    return (
      <div className="space-y-5 py-2">
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
            <button
              onClick={cancel}
              className="p-1.5 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="İptal et"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#666]">
            <span className="font-semibold text-white text-sm">{s.progress}%</span>
            <span>
              {isAssembling
                ? "Birleştiriliyor..."
                : s.status === "initializing"
                ? "Başlatılıyor..."
                : `${formatBytes(s.uploadedBytes)} / ${formatBytes(s.totalBytes)}`}
            </span>
          </div>
          <div className="relative h-2.5 bg-[#1e1e1e] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isAssembling
                  ? "bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse"
                  : isPaused
                  ? "bg-[#444]"
                  : "bg-gradient-to-r from-primary to-violet-500"
              )}
              style={{ width: `${s.progress}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        {!isAssembling && s.status !== "initializing" && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={Zap}
              label="Hız"
              value={s.speed > 0 ? `${formatBytes(s.speed)}/s` : "--"}
              color="text-primary"
            />
            <StatCard
              icon={Clock}
              label="Kalan"
              value={isPaused ? "Duraklatıldı" : formatEta(s.eta)}
              color={isPaused ? "text-[#888]" : "text-yellow-400"}
            />
            <StatCard
              icon={Layers}
              label="Parça"
              value={`${s.currentChunk} / ${s.totalChunks}`}
              color="text-violet-400"
            />
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

  // ── Idle / File picker ────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-12 px-6 text-center group",
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : selectedFile
            ? "border-primary/50 bg-primary/5"
            : "border-[#2a2a2a] bg-[#111] hover:border-[#444] hover:bg-[#161616]"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleFileChange}
        />

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
              <p className="font-bold text-[#aaa] group-hover:text-white transition-colors">
                Dosyayı buraya sürükle veya tıkla
              </p>
              <p className="text-sm text-[#555] mt-1">MP4, MKV, AVI, MOV, WebM · Maks. 10 GB</p>
            </div>
          </>
        )}
      </div>

      {/* Meta form — only when file selected */}
      {selectedFile && (
        <div className="space-y-4 bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
          <p className="text-xs text-[#555] font-bold uppercase tracking-widest">Video Bilgileri</p>

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

          <label className="flex items-center gap-2.5 cursor-pointer">
            <button
              type="button"
              onClick={() => setMeta((m) => ({ ...m, isPremium: !m.isPremium }))}
              className={cn(
                "relative w-10 h-5 rounded-full transition-all shrink-0",
                meta.isPremium ? "bg-primary" : "bg-[#333]"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                meta.isPremium ? "left-5" : "left-0.5"
              )} />
            </button>
            <span className="text-sm text-[#aaa]">Premium içerik (sadece aboneler görebilir)</span>
          </label>

          <Button
            onClick={handleStart}
            disabled={!meta.title.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-white gap-2 h-11 rounded-xl font-bold shadow-[0_0_20px_rgba(168,85,247,0.25)]"
          >
            <Upload className="h-4 w-4" /> Yüklemeyi Başlat
          </Button>

          <div className="flex items-center gap-2 text-xs text-[#555]">
            <BarChart2 className="h-3.5 w-3.5" />
            5 MB'lık parçalar halinde yüklenir · Duraklat / devam et desteklenir · Otomatik yeniden deneme
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Zap;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3 text-center">
      <Icon className={cn("h-4 w-4 mx-auto mb-1.5", color ?? "text-[#666]")} />
      <p className="text-[10px] text-[#555] uppercase tracking-widest font-bold">{label}</p>
      <p className="text-sm font-bold text-white mt-0.5 leading-none">{value}</p>
    </div>
  );
}
