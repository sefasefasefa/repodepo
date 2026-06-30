import { Link } from "wouter";
import { useRef, useState, useCallback, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Video } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Play, Volume2, VolumeX } from "lucide-react";
import Hls from "hls.js";

interface VideoCardProps {
  video: Video;
}

function isPlayableUrl(url: string): boolean {
  if (!url) return false;
  // Sadece lokal dosyalar veya doğrudan video stream URL'leri
  if (url.startsWith("/media/")) return true;
  // Harici ama doğrudan MP4/webm olan URL'ler
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".ogg")) return true;
  if (lower.endsWith(".m3u8")) return true;
  return false;
}

function isHlsUrl(url: string): boolean {
  return url.toLowerCase().split("?")[0].endsWith(".m3u8");
}

export function VideoCard({ video }: VideoCardProps) {
  const [previewing, setPreviewing] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActive = useRef(false);

  const formatDuration = (seconds?: number | null): string | null => {
    if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const rawUrl = (video as any).videoUrl || (video as any).hlsUrl || "";
  const previewUrl = isPlayableUrl(rawUrl) ? rawUrl : "";
  const canPreview = !!previewUrl;

  // HLS kurulumu / temizliği
  useEffect(() => {
    if (!previewing || !videoRef.current || !previewUrl) return;

    const el = videoRef.current;
    let destroyed = false;

    const tryPlay = () => {
      if (destroyed) return;
      el.play().catch(() => {});
    };

    if (isHlsUrl(previewUrl) && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 10, startLevel: 0 });
      hlsRef.current = hls;
      hls.loadSource(previewUrl);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        el.muted = true;
        tryPlay();
      });
    } else {
      // Native (Safari HLS veya MP4/WebM)
      el.muted = true;
      el.src = previewUrl;
      el.load();
      // canplay: ilk kare hazır → oynat
      el.addEventListener("canplay", tryPlay, { once: true });
      // Yedek: loadedmetadata sonra da dene
      el.addEventListener("loadedmetadata", tryPlay, { once: true });
    }

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [previewing, previewUrl]);

  const startPreview = useCallback(() => {
    if (!canPreview) return;
    setPreviewing(true);
  }, [canPreview]);

  const stopPreview = useCallback(() => {
    setPreviewing(false);
  }, []);

  // Desktop: hover
  const handleMouseEnter = useCallback(() => {
    if (canPreview) startPreview();
  }, [canPreview, startPreview]);

  const handleMouseLeave = useCallback(() => {
    stopPreview();
  }, [stopPreview]);

  // Mobile: basılı tut (long-press)
  const handleTouchStart = useCallback(() => {
    longPressActive.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressActive.current = true;
      startPreview();
    }, 500);
  }, [startPreview]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (longPressActive.current) {
      stopPreview();
      longPressActive.current = false;
    }
  }, [stopPreview]);

  const toggleMute = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  }, [muted]);

  const videoHref = `/videos/${(video as any).slug || (video as any).uuid || video.id}`;

  return (
    <div className="flex flex-col gap-2 group">
      <Link href={videoHref}>
        <div
          className="relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer touch-manipulation select-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {/* Thumbnail */}
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${previewing ? "opacity-0" : "opacity-100"}`}
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-secondary/50 transition-colors ${previewing ? "opacity-0" : "opacity-100 group-hover:bg-secondary"}`}>
              <Play className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground opacity-50" />
            </div>
          )}

          {/* Video önizleme */}
          {canPreview && (
            <video
              ref={videoRef}
              muted={muted}
              loop
              playsInline
              preload="none"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${previewing ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            />
          )}

          {/* Ses butonu — önizleme aktifken */}
          {previewing && canPreview && (
            <button
              onClick={toggleMute}
              onTouchEnd={toggleMute}
              className="absolute bottom-7 right-1.5 z-10 bg-black/60 backdrop-blur-sm rounded-full p-1 hover:bg-black/80 transition-colors"
              aria-label={muted ? "Sesi aç" : "Sesi kapat"}
            >
              {muted
                ? <VolumeX className="h-3 w-3 text-white" />
                : <Volume2 className="h-3 w-3 text-white" />
              }
            </button>
          )}

          {/* Süre */}
          {formatDuration(video.duration) && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium text-white backdrop-blur-sm">
              {formatDuration(video.duration)}
            </div>
          )}

          {video.isPremium && (
            <div className="absolute top-1.5 right-1.5">
              <Badge variant="default" className="bg-primary text-primary-foreground border-none text-[10px] px-1.5 py-0">
                Premium
              </Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="flex gap-2 items-start">
        <Link href={`/creators/${video.creator.id}`}>
          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 mt-0.5 cursor-pointer border border-border/50 shrink-0 touch-manipulation">
            <AvatarImage src={video.creator.avatarUrl || ""} alt={video.creator.username} />
            <AvatarFallback className="text-[10px]">{video.creator.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-col overflow-hidden min-w-0">
          <Link href={videoHref}>
            <h3 className="font-semibold text-xs sm:text-sm leading-snug line-clamp-2 hover:text-primary transition-colors cursor-pointer touch-manipulation" title={video.title}>
              {video.title}
            </h3>
          </Link>
          <Link href={`/creators/${video.creator.id}`}>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 hover:text-foreground transition-colors cursor-pointer touch-manipulation flex items-center gap-1 truncate">
              {video.creator.displayName || video.creator.username}
              {video.creator.isVerified && (
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-primary rounded-full inline-flex items-center justify-center shrink-0">
                  <span className="text-[7px] sm:text-[8px] text-primary-foreground font-bold">✓</span>
                </span>
              )}
            </p>
          </Link>
          <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 truncate">
            <span>{formatViews(video.viewCount)} views</span>
            <span>•</span>
            <span className="truncate">{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
