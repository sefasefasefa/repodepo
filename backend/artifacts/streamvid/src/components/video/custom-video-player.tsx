import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize2, Minimize2,
  Settings, Captions, Loader2, AlertCircle, RotateCcw,
} from "lucide-react";

interface HlsLevel { height: number; bitrate: number; }

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  protected?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onLoadedMetadata?: (duration: number) => void;
  className?: string;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const CustomVideoPlayer = forwardRef<HTMLVideoElement, CustomVideoPlayerProps>(
  function CustomVideoPlayer({ src, poster, protected: isProtected, onTimeUpdate, onEnded, onLoadedMetadata, className }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    useImperativeHandle(ref, () => videoRef.current!);

    const hlsRef = useRef<Hls | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hlsLevels, setHlsLevels] = useState<HlsLevel[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1);
    const [showQuality, setShowQuality] = useState(false);
    const [showVolume, setShowVolume] = useState(false);
    const [seeking, setSeeking] = useState(false);
    const [centerFlash, setCenterFlash] = useState<"play" | "pause" | null>(null);

    const resetHideTimer = useCallback(() => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!seeking && !showQuality && !showVolume) setShowControls(false);
      }, 3000);
    }, [seeking, showQuality, showVolume]);

    useEffect(() => {
      const vid = videoRef.current;
      if (!vid || !src) return;

      setLoading(true);
      setError(null);
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      hlsRef.current?.destroy();
      hlsRef.current = null;

      const isHls = /\.m3u8(\?|$)/i.test(src);

      if (isHls) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: false,
            lowLatencyMode: false,
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
          });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(vid);
          hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            setHlsLevels(data.levels.map(l => ({ height: l.height, bitrate: l.bitrate })));
            setLoading(false);
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setCurrentLevel(data.level));
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) setError("Video yüklenemedi. Lütfen tekrar deneyin.");
          });
        } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
          vid.src = src;
        }
      } else {
        vid.src = src;
      }

      return () => {
        hlsRef.current?.destroy();
        hlsRef.current = null;
      };
    }, [src]);

    useEffect(() => {
      const vid = videoRef.current;
      if (!vid) return;

      const onPlay = () => setPlaying(true);
      const onPause = () => setPlaying(false);
      const onWaiting = () => setLoading(true);
      const onCanPlay = () => setLoading(false);
      const onEnded_ = () => { setPlaying(false); onEnded?.(); };
      const onError = () => setError("Video oynatılamadı.");

      const onTimeUpdate_ = () => {
        setCurrentTime(vid.currentTime);
        onTimeUpdate?.(vid.currentTime, vid.duration);
        if (vid.buffered.length > 0) {
          setBuffered(vid.buffered.end(vid.buffered.length - 1));
        }
      };

      const onLoadedMetadata_ = () => {
        setDuration(vid.duration);
        setLoading(false);
        onLoadedMetadata?.(vid.duration);
      };

      vid.addEventListener("play", onPlay);
      vid.addEventListener("pause", onPause);
      vid.addEventListener("waiting", onWaiting);
      vid.addEventListener("canplay", onCanPlay);
      vid.addEventListener("canplaythrough", onCanPlay);
      vid.addEventListener("ended", onEnded_);
      vid.addEventListener("error", onError);
      vid.addEventListener("timeupdate", onTimeUpdate_);
      vid.addEventListener("loadedmetadata", onLoadedMetadata_);

      return () => {
        vid.removeEventListener("play", onPlay);
        vid.removeEventListener("pause", onPause);
        vid.removeEventListener("waiting", onWaiting);
        vid.removeEventListener("canplay", onCanPlay);
        vid.removeEventListener("canplaythrough", onCanPlay);
        vid.removeEventListener("ended", onEnded_);
        vid.removeEventListener("error", onError);
        vid.removeEventListener("timeupdate", onTimeUpdate_);
        vid.removeEventListener("loadedmetadata", onLoadedMetadata_);
      };
    }, [onEnded, onTimeUpdate, onLoadedMetadata]);

    useEffect(() => {
      const onFsChange = () => setFullscreen(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", onFsChange);
      return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        const vid = videoRef.current;
        if (!vid) return;
        if (e.code === "Space") { e.preventDefault(); togglePlay(); }
        if (e.code === "ArrowRight") { e.preventDefault(); vid.currentTime = Math.min(vid.currentTime + 10, vid.duration); resetHideTimer(); }
        if (e.code === "ArrowLeft") { e.preventDefault(); vid.currentTime = Math.max(vid.currentTime - 10, 0); resetHideTimer(); }
        if (e.code === "ArrowUp") { e.preventDefault(); const v = Math.min(vid.volume + 0.1, 1); vid.volume = v; setVolume(v); }
        if (e.code === "ArrowDown") { e.preventDefault(); const v = Math.max(vid.volume - 0.1, 0); vid.volume = v; setVolume(v); }
        if (e.code === "KeyF") { e.preventDefault(); toggleFullscreen(); }
        if (e.code === "KeyM") { e.preventDefault(); toggleMute(); }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [resetHideTimer]);

    const togglePlay = useCallback(() => {
      const vid = videoRef.current;
      if (!vid) return;
      if (vid.paused) {
        vid.play().catch(() => {});
        setCenterFlash("play");
      } else {
        vid.pause();
        setCenterFlash("pause");
      }
      setTimeout(() => setCenterFlash(null), 600);
      resetHideTimer();
    }, [resetHideTimer]);

    const toggleMute = useCallback(() => {
      const vid = videoRef.current;
      if (!vid) return;
      vid.muted = !vid.muted;
      setMuted(vid.muted);
    }, []);

    const toggleFullscreen = useCallback(() => {
      if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }, []);

    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const vid = videoRef.current;
      const bar = progressRef.current;
      if (!vid || !bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      vid.currentTime = ratio * duration;
    }, [duration]);

    const handleProgressDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      handleProgressClick(e);
    }, [handleProgressClick]);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const vid = videoRef.current;
      if (!vid) return;
      const v = parseFloat(e.target.value);
      vid.volume = v;
      vid.muted = v === 0;
      setVolume(v);
      setMuted(v === 0);
    }, []);

    const setQuality = useCallback((level: number) => {
      if (!hlsRef.current) return;
      hlsRef.current.currentLevel = level;
      setCurrentLevel(level);
      setShowQuality(false);
    }, []);

    const progress = duration > 0 ? currentTime / duration : 0;
    const bufferProgress = duration > 0 ? buffered / duration : 0;
    const qualityLabel = currentLevel === -1 ? "AUTO" : hlsLevels[currentLevel] ? `${hlsLevels[currentLevel].height}p` : "AUTO";

    return (
      <div
        ref={containerRef}
        className={cn("relative w-full h-full bg-black select-none overflow-hidden group", className)}
        onMouseMove={resetHideTimer}
        onMouseLeave={() => { if (!seeking) setShowControls(false); }}
        onMouseEnter={() => setShowControls(true)}
        onClick={(e) => { if ((e.target as HTMLElement).closest("[data-controls]")) return; togglePlay(); }}
        onDoubleClick={toggleFullscreen}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          poster={poster}
          playsInline
          preload="metadata"
          {...(isProtected ? {
            controlsList: "nodownload noremoteplayback",
            disablePictureInPicture: true,
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          } : {})}
        />

        {/* Yükleniyor */}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 rounded-full p-4">
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            </div>
          </div>
        )}

        {/* Hata */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="text-white text-sm font-medium">{error}</p>
            <button
              data-controls
              onClick={(e) => { e.stopPropagation(); setError(null); setLoading(true); const v = videoRef.current; if (v) { v.load(); v.play().catch(() => {}); } }}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-2 rounded-full border border-white/20 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tekrar Dene
            </button>
          </div>
        )}

        {/* Merkez play/pause flash */}
        {centerFlash && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-5 animate-in fade-in zoom-in-75 duration-150">
              {centerFlash === "play"
                ? <Play className="h-10 w-10 text-white fill-white" />
                : <Pause className="h-10 w-10 text-white fill-white" />
              }
            </div>
          </div>
        )}

        {/* Merkez büyük play butonu (duraklatıldığında ve kontroller görünürken) */}
        {!playing && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-sm">
              <Play className="h-7 w-7 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {/* ALT KONTROLLER */}
        <div
          data-controls
          className={cn(
            "absolute bottom-0 left-0 right-0 transition-opacity duration-300",
            showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

          <div className="relative px-3 pb-2 pt-1">
            {/* Progress Bar */}
            <div
              ref={progressRef}
              className="w-full h-1 mb-3 rounded-full bg-white/20 cursor-pointer relative group/bar"
              onClick={handleProgressClick}
              onMouseMove={handleProgressDrag}
              onMouseDown={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onMouseLeave={() => setSeeking(false)}
            >
              {/* Buffer */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-white/30 transition-none"
                style={{ width: `${bufferProgress * 100}%` }}
              />
              {/* Progress */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-white transition-none"
                style={{ width: `${progress * 100}%` }}
              />
              {/* Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/bar:opacity-100 transition-opacity"
                style={{ left: `calc(${progress * 100}% - 6px)` }}
              />
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="text-white hover:text-white/80 transition-colors p-1 shrink-0"
                title={playing ? "Duraklat (Boşluk)" : "Oynat (Boşluk)"}
              >
                {playing
                  ? <Pause className="h-5 w-5 fill-white" />
                  : <Play className="h-5 w-5 fill-white" />
                }
              </button>

              {/* Skip Back */}
              <button
                onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 10); }}
                className="text-white hover:text-white/80 transition-colors p-1 shrink-0"
                title="10s geri"
              >
                <SkipBack className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration, v.currentTime + 10); }}
                className="text-white hover:text-white/80 transition-colors p-1 shrink-0"
                title="10s ileri"
              >
                <SkipForward className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
              </button>

              {/* Volume */}
              <div className="relative flex items-center" onMouseLeave={() => setShowVolume(false)}>
                <button
                  onClick={toggleMute}
                  onMouseEnter={() => setShowVolume(true)}
                  className="text-white hover:text-white/80 transition-colors p-1 shrink-0"
                  title="Ses (M)"
                >
                  {muted || volume === 0
                    ? <VolumeX className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
                    : <Volume2 className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
                  }
                </button>
                {showVolume && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 rounded-lg px-3 py-2 border border-white/10">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-20 accent-white cursor-pointer"
                      style={{ writingMode: "vertical-lr", direction: "rtl", height: "72px", width: "4px", appearance: "slider-vertical" } as React.CSSProperties}
                    />
                  </div>
                )}
              </div>

              {/* Time */}
              <span className="text-white text-xs font-mono tabular-nums shrink-0 ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="flex-1" />

              {/* Quality */}
              {hlsLevels.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => { setShowQuality(v => !v); setShowVolume(false); }}
                    className="text-white text-[11px] font-bold px-2 py-0.5 rounded border border-white/20 hover:border-white/40 transition-colors bg-white/5 hover:bg-white/10"
                  >
                    {qualityLabel}
                  </button>
                  {showQuality && (
                    <div className="absolute bottom-8 right-0 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[100px]">
                      <button
                        onClick={() => setQuality(-1)}
                        className={cn("w-full px-4 py-2 text-left text-xs hover:bg-white/5 transition-colors", currentLevel === -1 ? "text-white font-semibold" : "text-[#aaa]")}
                      >
                        Otomatik
                      </button>
                      {hlsLevels.map((lvl, i) => (
                        <button
                          key={i}
                          onClick={() => setQuality(i)}
                          className={cn("w-full px-4 py-2 text-left text-xs hover:bg-white/5 transition-colors", currentLevel === i ? "text-white font-semibold" : "text-[#aaa]")}
                        >
                          {lvl.height}p
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AUTO badge (non-HLS) */}
              {hlsLevels.length === 0 && (
                <span className="text-white text-[11px] font-bold px-2 py-0.5 rounded border border-white/20 bg-white/5">
                  AUTO
                </span>
              )}

              {/* CC placeholder */}
              <button
                className="text-white/60 hover:text-white transition-colors p-1"
                title="Altyazı"
                onClick={() => {}}
              >
                <Captions className="h-4 w-4" />
              </button>

              {/* Settings placeholder */}
              <button
                className="text-white/60 hover:text-white transition-colors p-1"
                title="Ayarlar"
              >
                <Settings className="h-4 w-4" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-white/80 transition-colors p-1 shrink-0"
                title="Tam ekran (F)"
              >
                {fullscreen
                  ? <Minimize2 className="h-4 w-4" />
                  : <Maximize2 className="h-4 w-4" />
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
