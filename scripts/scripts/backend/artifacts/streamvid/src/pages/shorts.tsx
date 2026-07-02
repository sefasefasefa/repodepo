import { AppLayout } from "@/components/layout/app-layout";
import { useListShorts, useLikeVideo } from "@workspace/api-client-react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Heart, MessageCircle, Share2, Bookmark,
  Play, Pause, Gauge, ChevronUp, ChevronDown,
  Volume2, VolumeX,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ScreenProtectionOverlay, getVideoProtectionProps } from "@/components/video/screen-protection-overlay";
import { useScreenProtectionState } from "@/lib/use-screen-protection";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function Shorts() {
  const { data, isLoading } = useListShorts({ limit: 20 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Snap scroll ile aktif index takibi
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    setCurrentIndex(idx);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollTo = (dir: "up" | "down") => {
    if (!containerRef.current) return;
    const h = containerRef.current.clientHeight;
    containerRef.current.scrollBy({ top: dir === "down" ? h : -h, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-[100dvh] w-full bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const shorts = data?.videos ?? [];

  return (
    <AppLayout>
      <div className="relative bg-black h-[100dvh] overflow-hidden">
        {/* Scroll container — scrollbar tamamen gizli */}
        <div
          ref={containerRef}
          className="h-full w-full snap-y snap-mandatory overflow-y-scroll scrollbar-hide"
          style={{ scrollSnapType: "y mandatory" }}
        >
          {shorts.length === 0 ? (
            <div className="h-full flex items-center justify-center text-white/40 text-sm snap-start">
              Henüz kısa video yok
            </div>
          ) : (
            shorts.map((short, index) => (
              <ShortPlayer
                key={short.id}
                short={short}
                isActive={index === currentIndex}
              />
            ))
          )}
        </div>

        {/* Yukarı / Aşağı nav okları */}
        {shorts.length > 1 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30 pointer-events-none">
            <button
              onClick={() => scrollTo("up")}
              disabled={currentIndex === 0}
              className="pointer-events-auto w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/70 transition disabled:opacity-20"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollTo("down")}
              disabled={currentIndex >= shorts.length - 1}
              className="pointer-events-auto w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/70 transition disabled:opacity-20"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function ShortPlayer({ short, isActive }: { short: any; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenProt = useScreenProtectionState();
  const videoProps = getVideoProtectionProps(screenProt);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [isMuted, setIsMuted]         = useState(false);
  const [progress, setProgress]       = useState(0);          // 0–100
  const [duration, setDuration]       = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed]             = useState(1);
  const [showSpeed, setShowSpeed]     = useState(false);
  const [liked, setLiked]             = useState(false);
  const [saved, setSaved]             = useState(false);
  const [likeCount, setLikeCount]     = useState(short.likeCount ?? 0);
  const [showPause, setShowPause]     = useState(false);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const likeMutation = useLikeVideo({});

  // Aktif olmayan videoları durdur
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  // Hız değişince uygula
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // Progress güncelle
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setCurrentTime(v.currentTime);
    setProgress((v.currentTime / v.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  // İlerleme çubuğuna tıklayarak seek
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * v.duration;
  };

  // Play/Pause toggle + animasyon
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      v.play().catch(() => {});
      setIsPlaying(true);
    }
    setShowPause(true);
    clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => setShowPause(false), 700);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c: number) => c + (newLiked ? 1 : -1));
    likeMutation.mutate({ id: short.id });
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved((s) => !s);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({ title: short.title, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted((m) => !m);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="relative h-[100dvh] w-full snap-start flex justify-center bg-black"
      style={{ scrollSnapAlign: "start" }}
    >
      {/* Video */}
      <ScreenProtectionOverlay className="h-full w-full flex justify-center">
        <video
          ref={videoRef}
          src={short.videoUrl || ""}
          className="h-full w-full object-cover max-w-lg"
          loop
          playsInline
          muted={isMuted}
          poster={short.thumbnailUrl || undefined}
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          {...videoProps}
        />
      </ScreenProtectionOverlay>

      {/* Play/Pause animasyonu */}
      {showPause && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-black/50 rounded-full p-5 animate-ping-once">
            {isPlaying
              ? <Play className="h-10 w-10 text-white fill-white" />
              : <Pause className="h-10 w-10 text-white fill-white" />}
          </div>
        </div>
      )}

      {/* ── Sağ aksiyon butonları (TikTok stili) ── */}
      <div className="absolute right-3 bottom-28 flex flex-col gap-5 items-center z-10">

        {/* Like */}
        <ActionBtn
          onClick={handleLike}
          label={formatCount(likeCount)}
          active={liked}
          activeColor="text-red-500"
        >
          <Heart className={cn("h-7 w-7", liked ? "fill-red-500 text-red-500" : "text-white")} />
        </ActionBtn>

        {/* Yorum */}
        <ActionBtn label={formatCount(short.commentCount ?? 0)}>
          <MessageCircle className="h-7 w-7 text-white" />
        </ActionBtn>

        {/* Kaydet */}
        <ActionBtn
          onClick={handleSave}
          label={saved ? "Kaydedildi" : "Kaydet"}
          active={saved}
          activeColor="text-yellow-400"
        >
          <Bookmark className={cn("h-7 w-7", saved ? "fill-yellow-400 text-yellow-400" : "text-white")} />
        </ActionBtn>

        {/* Paylaş */}
        <ActionBtn onClick={handleShare} label="Paylaş">
          <Share2 className="h-7 w-7 text-white" />
        </ActionBtn>

        {/* Ses */}
        <ActionBtn onClick={toggleMute} label={isMuted ? "Açık" : "Sessiz"}>
          {isMuted
            ? <VolumeX className="h-6 w-6 text-white" />
            : <Volume2 className="h-6 w-6 text-white" />}
        </ActionBtn>

        {/* Hız */}
        <div className="relative flex flex-col items-center">
          <button
            onClick={(e) => { e.stopPropagation(); setShowSpeed((s) => !s); }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={cn(
              "bg-black/50 p-2.5 rounded-full backdrop-blur-sm transition",
              showSpeed ? "bg-primary/60" : "group-hover:bg-black/70"
            )}>
              <Gauge className="h-6 w-6 text-white" />
            </div>
            <span className="text-white text-[11px] font-bold">{speed}x</span>
          </button>

          {/* Hız menüsü */}
          {showSpeed && (
            <div className="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 min-w-[80px]">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); setSpeed(s); setShowSpeed(false); }}
                  className={cn(
                    "w-full px-4 py-2 text-sm text-center transition",
                    speed === s
                      ? "bg-primary text-white font-bold"
                      : "text-white/80 hover:bg-white/10"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Alt bilgi + progress ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 max-w-lg mx-auto">
        {/* Metin + avatar */}
        <div className="px-4 pb-4 pt-10 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-end gap-3">
            <Avatar className="h-10 w-10 border-2 border-white/30 shrink-0">
              <AvatarImage src={short.creator?.avatarUrl || ""} />
              <AvatarFallback>{(short.creator?.username ?? "?").substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold text-sm">@{short.creator?.username}</span>
                <button className="text-[11px] border border-white/50 text-white px-2.5 py-0.5 rounded-full hover:bg-white/10 transition">
                  Takip Et
                </button>
              </div>
              <p className="text-white/85 text-sm mt-0.5 line-clamp-2">{short.title}</p>
            </div>
          </div>
        </div>

        {/* Progress bar — TikTok stili */}
        <div className="px-0 pb-0 bg-black/30">
          {/* Zaman göstergesi */}
          <div className="flex justify-between px-3 pb-1 text-[10px] text-white/50 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Tıklanabilir progress çubuğu */}
          <div
            className="relative h-1 w-full bg-white/20 cursor-pointer group"
            onClick={handleSeek}
          >
            {/* Buffer bar (dekoratif) */}
            <div
              className="absolute top-0 left-0 h-full bg-white/20 pointer-events-none"
              style={{ width: `${Math.min(progress + 10, 100)}%` }}
            />
            {/* Playback bar */}
            <div
              className="absolute top-0 left-0 h-full bg-white transition-all pointer-events-none"
              style={{ width: `${progress}%` }}
            />
            {/* Seek thumb — hover'da büyüsün */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition pointer-events-none"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children, label, onClick, active, activeColor,
}: {
  children: React.ReactNode;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group"
    >
      <div className="bg-black/50 p-2.5 rounded-full backdrop-blur-sm group-hover:bg-black/70 transition active:scale-90">
        {children}
      </div>
      {label !== undefined && (
        <span className={cn("text-[11px] font-semibold", active && activeColor ? activeColor : "text-white")}>
          {label}
        </span>
      )}
    </button>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
