import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import type Hls from "hls.js";
import { cn } from "@/lib/utils";
import {
  Play, Pause,
  Volume2, VolumeX, Maximize2, Minimize2,
  Captions, Loader2, AlertCircle, RotateCcw, RotateCw, WifiOff, Settings,
} from "lucide-react";

interface HlsLevel { height: number; bitrate: number; }

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  protected?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onLoadedMetadata?: (duration: number) => void;
  onError?: () => void;
  className?: string;
  videoId?: string | number;
  token?: string;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBandwidth(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${Math.round(bps / 1000)} kbps`;
  return `${Math.round(bps)} bps`;
}

/** Tahmini bant genişliğine göre 0-3 sinyal seviyesi döner */
function signalLevel(bps: number): 0 | 1 | 2 | 3 {
  if (bps >= 3_000_000) return 3;
  if (bps >= 1_000_000) return 2;
  if (bps >= 300_000)  return 1;
  return 0;
}

export const CustomVideoPlayer = forwardRef<HTMLVideoElement, CustomVideoPlayerProps>(
  function CustomVideoPlayer({ src, poster, protected: isProtected, onTimeUpdate, onEnded, onLoadedMetadata, onError: onErrorProp, className, videoId, token }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    useImperativeHandle(ref, () => videoRef.current!);

    const hlsRef         = useRef<Hls | null>(null);
    const containerRef   = useRef<HTMLDivElement>(null);
    const progressRef    = useRef<HTMLDivElement>(null);
    const hideTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekingTouchRef = useRef(false);
    const stallTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const proxyTriedRef  = useRef(false);
    const recoveryCount  = useRef(0);

    const [playing, setPlaying]           = useState(false);
    const [currentTime, setCurrentTime]   = useState(0);
    const [duration, setDuration]         = useState(0);
    const [buffered, setBuffered]         = useState(0);
    const [volume, setVolume]             = useState(1);
    const [muted, setMuted]               = useState(false);
    const [fullscreen, setFullscreen]     = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState<string | null>(null);
    const [hlsLevels, setHlsLevels]       = useState<HlsLevel[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1);
    const [showQuality, setShowQuality]   = useState(false);
    const [showVolume, setShowVolume]     = useState(false);
    const [seeking, setSeeking]           = useState(false);
    const [centerFlash, setCenterFlash]   = useState<"play" | "pause" | null>(null);
    const [skipFlash, setSkipFlash]       = useState<"back" | "forward" | null>(null);
    const [bandwidth, setBandwidth]       = useState(0);          // bps
    const [slowConn, setSlowConn]         = useState(false);
    const [bufferPct, setBufferPct]       = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);

    /* ── Heatmap / izleme takibi ────────────────────────────────── */
    const [heatmapData, setHeatmapData]   = useState<number[]>([]);
    const watchedSegRef   = useRef<boolean[]>(new Array(100).fill(false));
    const milestonesHitRef = useRef<Set<number>>(new Set());
    const newMilestonesRef = useRef<number[]>([]);
    const durationRef      = useRef(0);
    const currentTimeRef   = useRef(0);
    const postHeatmapFnRef = useRef<() => void>(() => {});

    /* ── Kontrol gizleme zamanlayıcısı ─────────────────────────── */
    const resetHideTimer = useCallback(() => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!seeking && !showQuality && !showVolume) setShowControls(false);
      }, 3500);
    }, [seeking, showQuality, showVolume]);

    /* ── Takılma (stall) kurtarma ───────────────────────────────── */
    const clearStallTimer = useCallback(() => {
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    }, []);

    const triggerStallRecovery = useCallback(() => {
      const vid = videoRef.current;
      const hls = hlsRef.current;
      if (!vid || vid.paused || vid.ended) return;

      setSlowConn(true);
      recoveryCount.current += 1;

      if (hls) {
        if (recoveryCount.current === 1) {
          hls.recoverMediaError();
        } else if (recoveryCount.current === 2) {
          hls.startLoad(vid.currentTime);
        } else {
          // Mevcut zamanı koru, yükü sıfırla
          const t = vid.currentTime;
          hls.stopLoad();
          setTimeout(() => {
            hls.startLoad(Math.max(0, t - 0.5));
          }, 300);
        }
      } else {
        // Native HLS (Safari): küçük bir nudge
        vid.currentTime = Math.max(0, vid.currentTime + 0.1);
      }

      // 6 saniye sonra hâlâ takılıysa tekrar dene
      stallTimerRef.current = setTimeout(triggerStallRecovery, 6000);
    }, []);

    /* ── Heatmap: POST fonksiyonu ref'i ────────────────────────── */
    useEffect(() => {
      postHeatmapFnRef.current = () => {
        if (!videoId) return;
        const dur = durationRef.current;
        const ct  = currentTimeRef.current;
        if (dur <= 0) return;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        fetch(`/api/videos/${videoId}/heatmap`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            segments: [...watchedSegRef.current],
            watchTime: Math.round(ct),
            completionRate: Math.round((ct / dur) * 100),
            milestones: [...newMilestonesRef.current],
          }),
        }).catch(() => {});
        newMilestonesRef.current = [];
      };
    }, [videoId, token]);

    /* ── Heatmap: fetch (yeni video yüklendiğinde) ──────────────── */
    useEffect(() => {
      if (!videoId) return;
      watchedSegRef.current   = new Array(100).fill(false);
      milestonesHitRef.current = new Set();
      newMilestonesRef.current = [];
      fetch(`/api/videos/${videoId}/heatmap`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.segments) setHeatmapData(d.segments); })
        .catch(() => {});
    }, [videoId, src]);

    /* ── Heatmap: 15 saniyede bir + sayfa kapanmadan gönder ─────── */
    useEffect(() => {
      if (!videoId) return;
      const timer = setInterval(() => postHeatmapFnRef.current(), 15000);
      const onUnload = () => postHeatmapFnRef.current();
      window.addEventListener('beforeunload', onUnload);
      return () => {
        clearInterval(timer);
        window.removeEventListener('beforeunload', onUnload);
      };
    }, [videoId, src]);

    /* ── Yükleme timeout temizle ────────────────────────────────── */
    const clearLoadTimer = useCallback(() => {
      if (loadTimerRef.current) { clearTimeout(loadTimerRef.current); loadTimerRef.current = null; }
    }, []);

    /* ── URL analizi: format türü tespit ─────────────────────────── */
    const getUrlExtension = (url: string) => url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? '';

    /* ── HLS başlatma ───────────────────────────────────────────── */
    useEffect(() => {
      const vid = videoRef.current;
      if (!vid || !src) return;

      setLoading(true);
      setError(null);
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      setHlsLevels([]);
      setCurrentLevel(-1);
      setBandwidth(0);
      setSlowConn(false);
      setBufferPct(0);
      recoveryCount.current = 0;
      proxyTriedRef.current = false;
      clearStallTimer();
      clearLoadTimer();

      hlsRef.current?.destroy();
      hlsRef.current = null;

      let cancelled = false;

      const ext = getUrlExtension(src);

      // Tarayıcının natively oynatamayacağı formatlar → stream proxy'e yönlendir
      const unsupportedFormats = ['mkv', 'avi', 'mov', 'flv', 'wmv', 'mpeg', 'mpg', '3gp', '3g2', 'rm', 'rmvb', 'ts'];
      const isUnsupportedFormat = unsupportedFormats.includes(ext);

      // HLS stream mi?
      const isHlsStream = ext === 'm3u8' || src.includes('.m3u8');

      // Backend stream endpoint'leri (/api/videos/X/stream) native MP4 döner —
      // URL uzantısı "stream" olduğu için isBrowserNative false çıkmasın.
      const isBackendStream = /\/api\/videos\/[^/]+\/stream/.test(src);

      // Doğrudan oynatılabilen format mı?
      const isBrowserNative = ['mp4', 'webm', 'ogg', 'ogv'].includes(ext) || isBackendStream;

      if (isUnsupportedFormat && videoId) {
        // Desteklenmeyen format → backend proxy üzerinden aktar
        proxyTriedRef.current = true;
        vid.src = `/api/videos/${videoId}/stream`;
        vid.load();
      } else if (vid.canPlayType("application/vnd.apple.mpegurl") && isHlsStream) {
        // iOS Safari — native HLS, HLS.js gerekmez
        vid.src = src;
        vid.load();
      } else if (isHlsStream || !isBrowserNative) {
        // HLS.js gerekli — yalnızca kullanıldığında dinamik yükle (158KB tasarruf)
        import("hls.js").then(({ default: Hls }) => {
          if (cancelled) return;
          const v = videoRef.current;
          if (!v) return;

          if (!Hls.isSupported()) {
            v.src = src;
            v.load();
            return;
          }

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,

            // ── Hızlı başlangıç: önce en düşük kaliteyi yükle ──────
            startLevel: 0,               // her zaman en düşük kaliteden başla → ilk kare hızlı gelir
            startFragPrefetch: true,     // manifest parse edilirken bile ilk segment indirilmeye başlar
            autoStartLoad: true,

            // ── Buffer: yeterince doldur ama başlangıcı yavaşlatma ─
            maxBufferLength: 30,         // 30s yeterli (eski 120s başlangıcı geciktiriyordu)
            maxMaxBufferLength: 120,
            maxBufferSize: 60 * 1000 * 1000,   // 60 MB
            maxBufferHole: 0.3,
            backBufferLength: 30,
            highBufferWatchdogPeriod: 3,

            // ── Takılma: küçük atlamalar yerine daha seyrek ama büyük ──
            // (küçük çok sayıda nudge video hızlıymış hissi yaratır)
            nudgeMaxRetry: 5,
            nudgeOffset: 0.3,

            // ── ABR: muhafazakâr başla, yavaşça kaliteyi artır ─────
            abrEwmaDefaultEstimate: 300_000,   // 300 kbps varsayım → düşük kaliteden güvenle başlar
            abrBandWidthFactor: 0.85,           // bant genişliğinin %85'ini kullan (güvenlik payı)
            abrBandWidthUpFactor: 0.5,          // kalite artışında temkinli ol
            abrEwmaFastHalf: 2.0,
            abrEwmaSlowHalf: 8.0,
            capLevelToPlayerSize: true,         // oynatıcı boyutundan büyük kaliteye çıkma

            // ── Retry: kötü ağda pes etme ───────────────────────────
            fragLoadingMaxRetry: 15,
            fragLoadingRetryDelay: 500,
            fragLoadingMaxRetryTimeout: 10_000,
            manifestLoadingMaxRetry: 4,
            manifestLoadingRetryDelay: 500,
            manifestLoadingMaxRetryTimeout: 8_000,
            levelLoadingMaxRetry: 10,
            levelLoadingRetryDelay: 500,
          });

          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(v);

          hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            setHlsLevels(data.levels.map(l => ({ height: l.height, bitrate: l.bitrate })));
            setLoading(false);
            clearLoadTimer();
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setCurrentLevel(data.level));

          // Gerçek zamanlı bant genişliği ölçümü
          hls.on(Hls.Events.FRAG_LOADED, () => {
            const bw = hls.bandwidthEstimate;
            if (bw && isFinite(bw)) {
              setBandwidth(bw);
              setSlowConn(bw < 300_000);
            }
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              // Manifest yüklenemedi/parse edilemedi → bu URL HLS değil, native'e düş
              const isManifestError =
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
                data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;

              if (isManifestError) {
                hls.destroy();
                hlsRef.current = null;
                v.src = src;
                v.load();
                return;
              }

              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  // Kurtarılamaz — native oynatmaya düş
                  hls.destroy();
                  hlsRef.current = null;
                  v.src = src;
                  v.load();
              }
            }
          });
        });
      } else {
        // Native oynatıcı (MP4, WebM vb.)
        vid.src = src;
        vid.load();
      }

      // 25 saniye içinde oynatılmazsa takılı sayılır
      loadTimerRef.current = setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        if (v.readyState === 0 || v.readyState === 1) {
          // Hiç veri gelmedi — hata göster
          setLoading(false);
          setError("Video yüklenemedi. Bağlantınızı kontrol edin.");
        }
      }, 25000);

      return () => {
        cancelled = true;
        clearStallTimer();
        clearLoadTimer();
        hlsRef.current?.destroy();
        hlsRef.current = null;
      };
    }, [src, clearStallTimer, clearLoadTimer, videoId]);

    /* ── Video olayları ─────────────────────────────────────────── */
    useEffect(() => {
      const vid = videoRef.current;
      if (!vid) return;

      const onPlay      = () => { setPlaying(true); clearStallTimer(); recoveryCount.current = 0; setSlowConn(false); };
      const onPause     = () => { setPlaying(false); clearStallTimer(); };
      const onWaiting   = () => setLoading(true);
      const onCanPlay   = () => { setLoading(false); clearStallTimer(); clearLoadTimer(); };
      const onLoadStart = () => setLoading(true);
      const onEnded_    = () => {
        setPlaying(false);
        clearStallTimer();
        // %100 milestone + son heatmap raporu
        if (!milestonesHitRef.current.has(100)) {
          milestonesHitRef.current.add(100);
          newMilestonesRef.current.push(100);
        }
        postHeatmapFnRef.current();
        onEnded?.();
      };

      // Takılma tespiti — tarayıcının stalled event'i
      const onStalled   = () => {
        if (!vid.paused && !vid.ended) {
          clearStallTimer();
          // 5s bekle — kötü ağda 3s çok erken tetiklenip gereksiz kurtarma yapıyordu
          stallTimerRef.current = setTimeout(triggerStallRecovery, 5000);
        }
      };

      const onError = () => {
        const code = vid.error?.code;
        clearLoadTimer();

        // Kod 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) → stream proxy ile tekrar dene
        if (code === 4 && videoId && !proxyTriedRef.current) {
          proxyTriedRef.current = true;
          hlsRef.current?.destroy();
          hlsRef.current = null;
          setLoading(true);
          vid.src = `/api/videos/${videoId}/stream`;
          vid.load();
          return;
        }

        let msg: string;
        if (code === 4) msg = "Video bu kaynaktan oynatılamadı.";
        else if (code === 2) msg = "Ağ hatası — video yüklenemedi.";
        else msg = "Video oynatılamadı.";
        setError(msg);
        setLoading(false);
        clearStallTimer();
        onErrorProp?.();
      };

      const onTimeUpdate_ = () => {
        setCurrentTime(vid.currentTime);
        onTimeUpdate?.(vid.currentTime, vid.duration);

        // Ref'leri güncelle (stale closure olmadan heatmap POST kullanır)
        currentTimeRef.current = vid.currentTime;
        durationRef.current    = isFinite(vid.duration) ? vid.duration : 0;

        // Segment takibi (100 dilim)
        if (durationRef.current > 0) {
          const idx = Math.min(99, Math.floor((vid.currentTime / durationRef.current) * 100));
          watchedSegRef.current[idx] = true;

          // Milestone takibi: 25 / 50 / 75 / 100
          const pct = (vid.currentTime / durationRef.current) * 100;
          for (const ms of [25, 50, 75, 100]) {
            if (pct >= ms && !milestonesHitRef.current.has(ms)) {
              milestonesHitRef.current.add(ms);
              newMilestonesRef.current.push(ms);
            }
          }
        }

        // Buffer yüzdesi güncelle
        if (vid.buffered.length > 0 && vid.duration > 0) {
          const end = vid.buffered.end(vid.buffered.length - 1);
          setBuffered(end);
          setBufferPct(Math.round((end / vid.duration) * 100));
        }
      };

      const onLoadedMetadata_ = () => {
        setDuration(vid.duration);
        setLoading(false);
        onLoadedMetadata?.(vid.duration);
      };

      vid.addEventListener("play",            onPlay);
      vid.addEventListener("pause",           onPause);
      vid.addEventListener("waiting",         onWaiting);
      vid.addEventListener("canplay",         onCanPlay);
      vid.addEventListener("canplaythrough",  onCanPlay);
      vid.addEventListener("loadstart",       onLoadStart);
      vid.addEventListener("stalled",         onStalled);
      vid.addEventListener("ended",           onEnded_);
      vid.addEventListener("error",           onError);
      vid.addEventListener("timeupdate",      onTimeUpdate_);
      vid.addEventListener("loadedmetadata",  onLoadedMetadata_);

      return () => {
        vid.removeEventListener("play",           onPlay);
        vid.removeEventListener("pause",          onPause);
        vid.removeEventListener("waiting",        onWaiting);
        vid.removeEventListener("canplay",        onCanPlay);
        vid.removeEventListener("canplaythrough", onCanPlay);
        vid.removeEventListener("loadstart",      onLoadStart);
        vid.removeEventListener("stalled",        onStalled);
        vid.removeEventListener("ended",          onEnded_);
        vid.removeEventListener("error",          onError);
        vid.removeEventListener("timeupdate",     onTimeUpdate_);
        vid.removeEventListener("loadedmetadata", onLoadedMetadata_);
      };
    }, [onEnded, onTimeUpdate, onLoadedMetadata, onErrorProp, clearStallTimer, clearLoadTimer, triggerStallRecovery, videoId]);

    /* ── playbackRate: src değişince ve kullanıcı ayarında uygula ── */
    useEffect(() => {
      const vid = videoRef.current;
      if (!vid) return;
      // Yeni kaynak yüklendiğinde hız sıfırlanır; state'i geri uygula
      const onLoadedMeta = () => { vid.playbackRate = playbackRate; };
      vid.addEventListener("loadedmetadata", onLoadedMeta);
      // Hemen de uygula (zaten yüklüyse)
      vid.playbackRate = playbackRate;
      return () => vid.removeEventListener("loadedmetadata", onLoadedMeta);
    }, [playbackRate, src]);

    /* ── Fullscreen değişim ─────────────────────────────────────── */
    useEffect(() => {
      const onFsChange = () => setFullscreen(
        !!(document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement)
      );
      document.addEventListener("fullscreenchange",       onFsChange);
      document.addEventListener("webkitfullscreenchange", onFsChange);
      document.addEventListener("mozfullscreenchange",    onFsChange);
      return () => {
        document.removeEventListener("fullscreenchange",       onFsChange);
        document.removeEventListener("webkitfullscreenchange", onFsChange);
        document.removeEventListener("mozfullscreenchange",    onFsChange);
      };
    }, []);

    /* ── Klavye kısayolları ─────────────────────────────────────── */
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        const vid = videoRef.current;
        if (!vid) return;
        if (e.code === "Space")       { e.preventDefault(); togglePlay(); }
        if (e.code === "ArrowRight")  { e.preventDefault(); skipForward(); }
        if (e.code === "ArrowLeft")   { e.preventDefault(); skipBack(); }
        if (e.code === "ArrowUp")     { e.preventDefault(); const v = Math.min(vid.volume + 0.1, 1); vid.volume = v; setVolume(v); }
        if (e.code === "ArrowDown")   { e.preventDefault(); const v = Math.max(vid.volume - 0.1, 0); vid.volume = v; setVolume(v); }
        if (e.code === "KeyF")        { e.preventDefault(); toggleFullscreen(); }
        if (e.code === "KeyM")        { e.preventDefault(); toggleMute(); }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [resetHideTimer]);

    /* ── 10s ileri / geri ──────────────────────────────────────── */
    const skipBack = useCallback(() => {
      const vid = videoRef.current;
      if (!vid) return;
      vid.currentTime = Math.max(0, vid.currentTime - 10);
      setSkipFlash("back");
      setTimeout(() => setSkipFlash(null), 600);
      resetHideTimer();
    }, [resetHideTimer]);

    const skipForward = useCallback(() => {
      const vid = videoRef.current;
      if (!vid) return;
      vid.currentTime = Math.min(vid.duration, vid.currentTime + 10);
      setSkipFlash("forward");
      setTimeout(() => setSkipFlash(null), 600);
      resetHideTimer();
    }, [resetHideTimer]);

    /* ── Oynat/Duraklat ─────────────────────────────────────────── */
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
      const el = containerRef.current as any;
      if (!el) return;
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (!fsEl) {
        (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen)?.call(el);
      } else {
        (document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).mozCancelFullScreen)?.call(document);
      }
    }, []);

    /* ── İlerleme çubuğu — mouse + touch ───────────────────────── */
    const seekToPosition = useCallback((clientX: number) => {
      const vid = videoRef.current;
      const bar = progressRef.current;
      if (!vid || !bar || !duration) return;
      const rect  = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      vid.currentTime = ratio * duration;
    }, [duration]);

    const handleProgressClick  = useCallback((e: React.MouseEvent<HTMLDivElement>)  => seekToPosition(e.clientX), [seekToPosition]);
    const handleProgressDrag   = useCallback((e: React.MouseEvent<HTMLDivElement>)  => { if (e.buttons !== 1) return; seekToPosition(e.clientX); }, [seekToPosition]);

    const handleProgressTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
      seekingTouchRef.current = true; setSeeking(true);
      seekToPosition(e.touches[0].clientX); resetHideTimer();
    }, [seekToPosition, resetHideTimer]);

    const handleProgressTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
      if (!seekingTouchRef.current) return;
      e.preventDefault();
      seekToPosition(e.touches[0].clientX);
    }, [seekToPosition]);

    const handleProgressTouchEnd = useCallback(() => {
      seekingTouchRef.current = false; setSeeking(false);
    }, []);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const vid = videoRef.current;
      if (!vid) return;
      const v = parseFloat(e.target.value);
      vid.volume = v; vid.muted = v === 0;
      setVolume(v); setMuted(v === 0);
    }, []);

    const setQuality = useCallback((level: number) => {
      const hls = hlsRef.current;
      if (!hls) return;
      hls.currentLevel = level;
      setCurrentLevel(level);
      setShowQuality(false);
    }, []);

    /* ── Hesaplamalar ───────────────────────────────────────────── */
    const progress       = duration > 0 ? currentTime / duration : 0;
    const bufferProgress = duration > 0 ? buffered   / duration : 0;
    const qualityLabel   = currentLevel === -1
      ? "AUTO"
      : (hlsLevels[currentLevel] ? `${hlsLevels[currentLevel].height}p` : "AUTO");
    const sig            = signalLevel(bandwidth);

    return (
      <div
        ref={containerRef}
        className={cn("relative w-full h-full bg-black select-none overflow-hidden group", className)}
        onMouseMove={resetHideTimer}
        onMouseLeave={() => { if (!seeking) setShowControls(false); }}
        onMouseEnter={() => setShowControls(true)}
        onTouchStart={resetHideTimer}
        onClick={(e) => { if ((e.target as HTMLElement).closest("[data-controls]")) return; togglePlay(); }}
        onDoubleClick={toggleFullscreen}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          poster={poster}
          playsInline
          preload="auto"
          {...(isProtected ? {
            controlsList: "nodownload noremoteplayback",
            disablePictureInPicture: true,
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          } : {})}
        />

        {/* Yükleniyor spinner */}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 rounded-full p-4">
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            </div>
          </div>
        )}

        {/* Yavaş bağlantı uyarısı */}
        {slowConn && playing && !loading && !error && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/70 text-yellow-400 text-[11px] font-semibold px-3 py-1 rounded-full border border-yellow-500/30">
              <WifiOff className="h-3 w-3" />
              Yavaş bağlantı — kalite düşürüldü
            </div>
          </div>
        )}

        {/* Hata */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4">
            <AlertCircle className="h-12 w-12 text-red-400 shrink-0" />
            <p className="text-white text-sm font-medium text-center">{error}</p>
            <p className="text-[#888] text-xs text-center">Yukarıdan farklı bir kaynak seçmeyi deneyin.</p>
            <button
              data-controls
              onClick={(e) => {
                e.stopPropagation();
                proxyTriedRef.current = false;
                setError(null); setLoading(true);
                recoveryCount.current = 0;
                const v = videoRef.current;
                if (v) { v.src = src; v.load(); v.play().catch(() => {}); }
              }}
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
                : <Pause className="h-10 w-10 text-white fill-white" />}
            </div>
          </div>
        )}

        {/* Skip flash — sol/sağ tarafta ±10s animasyon */}
        {skipFlash && (
          <div className={`absolute inset-y-0 flex items-center pointer-events-none ${skipFlash === "back" ? "left-0 pl-8" : "right-0 pr-8"}`}>
            <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in-90 duration-150">
              <div className="bg-white/15 backdrop-blur-sm rounded-full p-4 border border-white/20">
                {skipFlash === "back"
                  ? <RotateCcw className="h-7 w-7 text-white" />
                  : <RotateCw className="h-7 w-7 text-white" />}
              </div>
              <span className="text-white text-xs font-bold drop-shadow">
                {skipFlash === "back" ? "−10s" : "+10s"}
              </span>
            </div>
          </div>
        )}

        {/* Büyük play butonu */}
        {!playing && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-sm">
              <Play className="h-7 w-7 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {/* ─── ALT KONTROLLER ─────────────────────────────────────── */}
        <div
          data-controls
          className={cn(
            "absolute bottom-0 left-0 right-0 transition-opacity duration-300",
            showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

          <div className="relative px-3 pb-2 pt-1">
            {/* İlerleme + Buffer çubuğu */}
            <div
              ref={progressRef}
              className="w-full h-5 flex items-center cursor-pointer relative group/bar touch-none mb-1"
              onClick={handleProgressClick}
              onMouseMove={handleProgressDrag}
              onMouseDown={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onMouseLeave={() => setSeeking(false)}
              onTouchStart={handleProgressTouchStart}
              onTouchMove={handleProgressTouchMove}
              onTouchEnd={handleProgressTouchEnd}
            >
              <div className="w-full h-[3px] group-hover/bar:h-1.5 transition-all rounded-full bg-white/15 relative">
                {/* Isı haritası overlay — en çok izlenen segmentler */}
                {heatmapData.length === 100 && (
                  <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                    {heatmapData.map((v, i) =>
                      v > 0.05 ? (
                        <div
                          key={i}
                          className="absolute top-0 h-full"
                          style={{
                            left: `${i}%`,
                            width: '1.2%',
                            opacity: 0.55 + v * 0.4,
                            background: v > 0.7
                              ? '#f97316'
                              : v > 0.4
                              ? '#facc15'
                              : 'rgba(255,255,255,0.5)',
                          }}
                        />
                      ) : null
                    )}
                  </div>
                )}
                {/* Buffer göstergesi */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-white/25 transition-none"
                  style={{ width: `${bufferProgress * 100}%` }}
                />
                {/* Oynatma ilerlemesi */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-white transition-none"
                  style={{ width: `${progress * 100}%` }}
                />
                {/* Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow opacity-0 group-hover/bar:opacity-100 transition-opacity"
                  style={{ left: `calc(${progress * 100}% - 7px)` }}
                />
              </div>
            </div>

            {/* Kontrol satırı */}
            <div className="flex items-center gap-1.5">
              {/* Oynat/Duraklat */}
              <button onClick={togglePlay} className="text-white hover:text-white/80 transition-colors p-1 shrink-0">
                {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
              </button>

              {/* 10s geri */}
              <button
                onClick={skipBack}
                className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors shrink-0 group/skip"
                title="10 saniye geri (←)"
              >
                <RotateCcw className="h-[18px] w-[18px] text-white group-hover/skip:text-white/90" />
                <span className="absolute text-[8px] font-bold text-white leading-none" style={{ bottom: 6 }}>10</span>
              </button>

              {/* 10s ileri */}
              <button
                onClick={skipForward}
                className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors shrink-0 group/skip"
                title="10 saniye ileri (→)"
              >
                <RotateCw className="h-[18px] w-[18px] text-white group-hover/skip:text-white/90" />
                <span className="absolute text-[8px] font-bold text-white leading-none" style={{ bottom: 6 }}>10</span>
              </button>

              {/* Ses */}
              <div className="relative flex items-center" onMouseLeave={() => setShowVolume(false)}>
                <button onClick={toggleMute} onMouseEnter={() => setShowVolume(true)} className="text-white hover:text-white/80 transition-colors p-1 shrink-0">
                  {muted || volume === 0
                    ? <VolumeX style={{ width: 18, height: 18 }} />
                    : <Volume2 style={{ width: 18, height: 18 }} />}
                </button>
                {showVolume && (
                  <div className="absolute bottom-9 left-1/2 -translate-x-1/2 bg-black/80 rounded-lg px-3 py-2 border border-white/10">
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={muted ? 0 : volume} onChange={handleVolumeChange}
                      className="accent-white cursor-pointer"
                      style={{ writingMode: "vertical-lr", direction: "rtl", height: 72, width: 4, appearance: "slider-vertical" } as React.CSSProperties}
                    />
                  </div>
                )}
              </div>

              {/* Süre */}
              <span className="text-white text-xs font-mono tabular-nums shrink-0">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="flex-1" />

              {/* Ağ kalitesi göstergesi (HLS varsa) */}
              {bandwidth > 0 && (
                <div className="flex items-end gap-[2px] px-1.5" title={formatBandwidth(bandwidth)}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="rounded-sm transition-colors"
                      style={{
                        width: 3,
                        height: 5 + i * 3,
                        background: i <= sig - 1
                          ? (sig === 1 ? "#f87171" : sig === 2 ? "#facc15" : "#4ade80")
                          : "rgba(255,255,255,0.2)",
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Buffer yüzdesi — yalnızca yüklenirken */}
              {loading && bufferPct > 0 && (
                <span className="text-white/50 text-[10px] font-mono">
                  %{bufferPct}
                </span>
              )}

              {/* Kalite seçici */}
              {hlsLevels.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => { setShowQuality(v => !v); setShowVolume(false); }}
                    className="text-white text-[11px] font-bold px-2 py-0.5 rounded border border-white/20 hover:border-white/40 transition-colors bg-white/5 hover:bg-white/10"
                  >
                    {qualityLabel}
                  </button>
                  {showQuality && (
                    <div className="absolute bottom-8 right-0 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[110px]">
                      <div className="px-3 py-1.5 text-[10px] text-white/40 font-semibold border-b border-white/5 tracking-wider">KALİTE</div>
                      <button
                        onClick={() => setQuality(-1)}
                        className={cn("w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors flex items-center justify-between", currentLevel === -1 ? "text-white font-semibold" : "text-[#aaa]")}
                      >
                        <span>Otomatik</span>
                        {currentLevel === -1 && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                      </button>
                      {[...hlsLevels].reverse().map((lvl, ri) => {
                        const i = hlsLevels.length - 1 - ri;
                        return (
                          <button
                            key={i}
                            onClick={() => setQuality(i)}
                            className={cn("w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors flex items-center justify-between", currentLevel === i ? "text-white font-semibold" : "text-[#aaa]")}
                          >
                            <span>{lvl.height}p</span>
                            <span className="text-[10px] text-white/30">{Math.round(lvl.bitrate / 1000)}k</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Otomatik badge (non-HLS) */}
              {hlsLevels.length === 0 && (
                <span className="text-white/50 text-[11px] font-bold px-2 py-0.5 rounded border border-white/10 bg-white/5">
                  AUTO
                </span>
              )}

              {/* Altyazı */}
              <button className="text-white/50 hover:text-white transition-colors p-1" title="Altyazı" onClick={() => {}}>
                <Captions className="h-4 w-4" />
              </button>

              {/* Ayarlar — oynatma hızı */}
              <div className="relative">
                <button
                  onClick={() => { setShowSettings(v => !v); setShowQuality(false); setShowVolume(false); }}
                  className={cn(
                    "transition-colors p-1",
                    showSettings ? "text-white" : "text-white/50 hover:text-white"
                  )}
                  title="Ayarlar"
                >
                  <Settings className="h-4 w-4" />
                </button>
                {showSettings && (
                  <div className="absolute bottom-8 right-0 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[140px]">
                    <div className="px-3 py-1.5 text-[10px] text-white/40 font-semibold border-b border-white/5 tracking-wider">HIZ</div>
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => {
                          const vid = videoRef.current;
                          if (vid) vid.playbackRate = rate;
                          setPlaybackRate(rate);
                          setShowSettings(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors flex items-center justify-between",
                          playbackRate === rate ? "text-white font-semibold" : "text-[#aaa]"
                        )}
                      >
                        <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                        {playbackRate === rate && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tam ekran */}
              <button onClick={toggleFullscreen} className="text-white hover:text-white/80 transition-colors p-1 shrink-0" title="Tam ekran (F)">
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
