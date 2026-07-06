import { AppLayout } from "@/components/layout/app-layout";
import { useParams, useLocation } from "wouter";
import { useGetVideo, useGetRelatedVideos, useLikeVideo, useListComments, useCreateComment, getGetVideoQueryKey, getListCommentsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, Share2, Bookmark, Flag, ChevronDown, ChevronUp, Globe, Crown, Coins, FileText, Languages, Download, Check, SlidersHorizontal, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { ReportModal } from "@/components/report-modal";
import { TokenTipModal } from "@/components/token-tip-modal";
import { CustomRequestModal } from "@/components/custom-request-modal";
import { formatDistanceToNow } from "date-fns";
import { VideoCard } from "@/components/video/video-card";
import { PremiumPaywall } from "@/components/video/premium-paywall";
import { WatermarkOverlay } from "@/components/video/watermark-overlay";
import { SubtitleOverlay } from "@/components/video/subtitle-overlay";
import { SubtitleManager } from "@/components/video/subtitle-manager";
import { ScreenProtectionOverlay, getVideoProtectionProps } from "@/components/video/screen-protection-overlay";
import { useScreenProtectionState } from "@/lib/use-screen-protection";
import { CustomVideoPlayer } from "@/components/video/custom-video-player";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ResumeBanner } from "@/components/video/resume-banner";
import { clearWatchProgress, loadWatchProgress, markVideoFinished, saveWatchProgress, touchWatchHistory } from "@/lib/watch-progress";

interface PlayerSource {
  id: number;
  playerName: string;
  embedCode?: string;
  directUrl?: string;
  isDefault: boolean;
  quality: string;
  language: string;
}

/** Video ID'sinin geçerli format olup olmadığını kontrol eder (dict/JSON karışmasını önler) */
function isValidId(id: string | undefined): boolean {
  if (!id) return false;
  // Geçerli ID: UUID, slug veya integer pk — { } ' " : gibi JSON kalıntıları içermez
  return /^[A-Za-z0-9_\-]{1,300}$/.test(id);
}

/** Streaming platformu URL'sini embed iframe koduna dönüştürür */
function resolveEmbedFromUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  // Bozuk URL koruması: dict string karışmış URL'leri filtrele
  if (rawUrl.includes("{'") || rawUrl.includes('{"') || rawUrl.includes("': '")) return null;

  const iframe = (src: string, extra = '') =>
    `<iframe src="${src}" width="100%" height="100%" frameborder="0" scrolling="no" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer-when-downgrade" ${extra} style="width:100%;height:100%;border:0;pointer-events:all"></iframe>`;

  // Doğrudan video dosyası ise embed gerekmez
  const lower = rawUrl.toLowerCase().split('?')[0];
  if (/\.(mp4|webm|ogg|ogv|m3u8|mpd|mov|mkv|flv|ts)(\?|$)/.test(lower)) return null;
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, '');
    const parts = u.pathname.split('/').filter(Boolean);

    // StreamTape: /v/ID/... veya /e/ID → /e/ID
    if (host === 'streamtape.com' || host === 'streamtape.to' || host === 'streamtape.net' || host === 'streamta.pe') {
      const id = parts[0] === 'e' ? (parts[1] || parts[0]) : (parts[1] || parts[0]);
      if (!isValidId(id)) return null;
      return iframe(`https://streamtape.com/e/${id}`);
    }
    // DoodStream çeşitleri
    if (/dood\.(pm|watch|la|sh|ws|re|cx|so|to|stream|wf)/.test(host) || host === 'doodstream.com') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // Mixdrop
    if (host === 'mixdrop.ag' || host === 'mixdrop.co' || host === 'mixdrop.bz') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // FileMoon
    if (host === 'filemoon.sx' || host === 'filemoon.to') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // StreamWish
    if (host === 'streamwish.com' || host === 'streamwish.to') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // VidHide
    if (host === 'vidhide.com' || host === 'vidhide.to') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // Voe.sx
    if (host === 'voe.sx') {
      const id = parts[1] || parts[0];
      return iframe(`https://voe.sx/e/${id}`);
    }
    // Upstream
    if (host === 'upstream.to') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/embed-${id}.html`);
    }
    // Luluvdo
    if (host === 'luluvdo.com') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // Vidoza
    if (host === 'vidoza.net') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/embed-${id}.html`);
    }
    // Supervideo
    if (host === 'supervideo.tv' || host === 'supervideo.cc') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // FileLions
    if (host === 'filelions.com' || host === 'filelions.to') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // VidMoly
    if (host === 'vidmoly.to' || host === 'vidmoly.me') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // StreamHub
    if (host === 'streamhub.to' || host === 'streamhub.bz') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // VTube
    if (host === 'vtube.network' || host === 'vtube.to') {
      const id = parts[1] || parts[0];
      return iframe(`${u.origin}/e/${id}`);
    }
    // Genel /v/ veya /d/ → /e/ deseni
    if (parts[0] && ['v', 'd', 'f'].includes(parts[0]) && parts[1]) {
      return iframe(`${u.origin}/e/${parts[1]}`);
    }
  } catch {/* geçersiz URL */}
  return null;
}

function VideoPlayer({ video, players, onRefreshPlayers }: { video: any; players: PlayerSource[]; onRefreshPlayers?: () => void }) {
  const showWatermark: boolean = !!video.watermarkEnabled;
  const screenProt = useScreenProtectionState();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [resumePrompt, setResumePrompt] = useState<{ currentTime: number; progress: number } | null>(null);
  const resumeSeeked = useRef(false);
  const token = typeof window !== "undefined" ? (localStorage.getItem("token") ?? "") : "";

  // ── Tüm harici URL'ler için otomatik indirme + polling ──────────
  const rawVideoUrl = video.hlsUrl || video.videoUrl || "";
  const isExternalUrl = rawVideoUrl.startsWith("http://") || rawVideoUrl.startsWith("https://");
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(
    rawVideoUrl.startsWith("/media/") ? rawVideoUrl : null
  );
  const [dlStatus, setDlStatus] = useState<string | null>(null);
  const [dlPct, setDlPct] = useState(0);
  const dlPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Zaten yerelleştirilmişse ya da URL yoksa polling gerekmez
    if (!isExternalUrl || localVideoUrl) return;
    const tok = localStorage.getItem("token");

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/videos/${video.id}/fetch-status`);
        if (!res.ok) return;
        const d = await res.json();

        if (d.isLocal && d.videoUrl) {
          setLocalVideoUrl(d.videoUrl);
          setDlStatus("done");
          if (dlPollRef.current) { clearInterval(dlPollRef.current); dlPollRef.current = null; }
          return;
        }

        setDlStatus(d.status ?? null);
        setDlPct(d.percent ?? 0);

        // Henüz başlamadıysa admin/creator ise otomatik başlat
        if (!d.status && tok) {
          await fetch(`/api/videos/${video.id}/fetch-from-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          }).catch(() => {});
        }
      } catch { /* sessizce geç */ }
    };

    checkStatus();
    dlPollRef.current = setInterval(checkStatus, 2500);
    return () => { if (dlPollRef.current) clearInterval(dlPollRef.current); };
  }, [video.id, isExternalUrl, localVideoUrl]);
  // ────────────────────────────────────────────────────────────────

  const allSources: PlayerSource[] = (() => {
    const effectiveUrl = localVideoUrl || rawVideoUrl;
    if (!effectiveUrl) return [...players];

    const isExternal = effectiveUrl.startsWith("http://") || effectiveUrl.startsWith("https://");

    // Yerel dosya → stream endpoint üzerinden sun (range request + doğru MIME)
    if (!isExternal) {
      const streamUrl = `/api/videos/${video.id}/stream`;
      const ownSrc: PlayerSource = { id: 0, playerName: "Kendi Oynatıcı", directUrl: streamUrl, isDefault: true, quality: "HD", language: "TR" };
      return [ownSrc, ...players];
    }

    // Harici URL → Kendi Oynatıcı yok, sadece CDN sekmeler göster
    return [...players];
  })();

  const defaultSource = allSources.find(p => p.isDefault) || allSources[0];
  const [active, setActive] = useState(defaultSource?.id ?? 0);
  const activeSource = allSources.find(p => p.id === active) || allSources[0];

  // Yerel dosya hazır olunca Kendi Oynatıcı'ya geç
  useEffect(() => {
    if (localVideoUrl && active !== 0) setActive(0);
  }, [localVideoUrl]);

  // Players asenkron yüklenince active'i varsayılana sıfırla
  // (mount'ta allSources boştu, şimdi doldu — active hâlâ eski değerde)
  useEffect(() => {
    if (allSources.length === 0) return;
    const currentlyActive = allSources.find(p => p.id === active);
    if (!currentlyActive) {
      const def = allSources.find(p => p.isDefault) || allSources[0];
      if (def) setActive(def.id);
    }
  }, [allSources.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const saved = loadWatchProgress(video.id);
    if (saved && saved.currentTime > 8 && saved.duration > 0 && saved.currentTime < saved.duration - 10) {
      setResumePrompt({ currentTime: saved.currentTime, progress: saved.currentTime / saved.duration });
    }
  }, [video.id]);

  useEffect(() => { resumeSeeked.current = false; }, [activeSource?.directUrl]);

  const handleTimeUpdate = useCallback((ct: number, dur: number) => {
    if (!Number.isNaN(ct) && dur > 0) {
      saveWatchProgress(video.id, ct, dur);
      touchWatchHistory(video.id, video.title, video.thumbnailUrl || null, video.creator?.displayName || video.creator?.username || null);
    }
  }, [video.id, video.title, video.thumbnailUrl, video.creator?.displayName, video.creator?.username]);

  const handleLoadedMetadata = useCallback((dur: number) => {
    if (dur && Number.isFinite(dur) && dur > 0 && !video.duration) {
      const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (tok) {
        fetch(`/api/videos/${video.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ duration: Math.round(dur) }),
        }).catch(() => {});
      }
    }
    if (resumeSeeked.current) return;
    const saved = loadWatchProgress(video.id);
    if (!saved || saved.currentTime < 8 || saved.currentTime >= dur - 10) return;
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = saved.currentTime;
    resumeSeeked.current = true;
    setResumePrompt({ currentTime: saved.currentTime, progress: saved.currentTime / Math.max(saved.duration || dur || 1, 1) });
  }, [video.id, video.duration]);

  const handleEnded = useCallback(() => {
    const saved = loadWatchProgress(video.id);
    markVideoFinished(video.id, saved?.duration ?? 0);
  }, [video.id]);

  if (!allSources.length) {
    return (
      <div className="aspect-video bg-[#111] rounded-xl flex items-center justify-center">
        <p className="text-[#555]">Oynatıcı bulunamadı</p>
      </div>
    );
  }

  // Doğrudan video oynatıcıda oynatılabilen formatlar
  const NATIVE_EXTS = ['mp4', 'webm', 'm3u8', 'ogg', 'ogv', 'mov', 'mkv', 'avi', 'flv', 'ts', 'wmv', 'mpg', 'mpeg'];
  function isNativePlayable(url: string): boolean {
    const clean = url.split('?')[0].split('#')[0].toLowerCase();
    const ext = clean.split('.').pop() ?? '';
    if (NATIVE_EXTS.includes(ext)) return true;
    // Stream endpoint de native
    if (clean.includes('/stream')) return true;
    return false;
  }

  function toIframeHtml(url: string): string {
    return `<iframe src="${url}" width="100%" height="100%" frameborder="0" scrolling="no" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer-when-downgrade" style="width:100%;height:100%;border:0;"></iframe>`;
  }

  // activeSource'u normalize et: ham URL → iframe html
  const effectiveDirectUrl = (() => {
    if (!activeSource) return null;
    if (activeSource.directUrl && isNativePlayable(activeSource.directUrl)) return activeSource.directUrl;
    return null;
  })();

  const effectiveEmbedHtml = (() => {
    if (!activeSource) return null;
    // directUrl var ama native oynatılamıyor → iframe yap
    if (activeSource.directUrl && !isNativePlayable(activeSource.directUrl)) {
      return toIframeHtml(activeSource.directUrl);
    }
    // embedCode var
    if (activeSource.embedCode) {
      const code = activeSource.embedCode.trim();
      // Ham URL ise iframe'e sar
      if (code.startsWith('http://') || code.startsWith('https://')) {
        return toIframeHtml(code);
      }
      return code;
    }
    return null;
  })();

  const isDirectVideo = !!effectiveDirectUrl;

  return (
    <div className="space-y-2">
      {resumePrompt && isDirectVideo && (
        <ResumeBanner
          title={video.title}
          progress={resumePrompt.progress}
          onContinue={() => { const vid = videoRef.current; if (vid) vid.currentTime = resumePrompt.currentTime; setResumePrompt(null); }}
          onDismiss={() => { clearWatchProgress(video.id); setResumePrompt(null); }}
        />
      )}

      {/* KAYNAK sekmeler */}
      {allSources.length > 0 && (
        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl px-3 py-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-[#444] uppercase tracking-widest shrink-0">KAYNAK</span>
          {allSources.map((src) => (
            <button
              key={src.id}
              onClick={() => setActive(src.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all border",
                active === src.id
                  ? "bg-white text-black border-white"
                  : "bg-transparent border-[#2a2a2a] text-[#666] hover:text-white hover:border-[#444]"
              )}
            >
              <span>{src.playerName}</span>
              {src.quality && (
                <span className={cn(
                  "text-[9px] font-bold px-[5px] py-px rounded border tracking-wide",
                  active === src.id ? "border-black/20 text-black/55" : "border-[#333] text-[#555]"
                )}>{src.quality}</span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          {onRefreshPlayers && (
            <button onClick={onRefreshPlayers} title="Yenile" className="text-[#444] hover:text-white transition-colors p-1">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Harici URL indirme ilerlemesi — yalnızca aktif indirme varken göster */}
      {isExternalUrl && !localVideoUrl && (dlStatus === 'downloading' || dlStatus === 'pending') && (
        <div className="bg-[#0a1628] border border-blue-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-blue-300 text-xs font-semibold">Video sunucuya indiriliyor...</p>
            <div className="mt-1.5 h-1 bg-blue-900/40 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${dlStatus === 'pending' ? 2 : dlPct}%` }} />
            </div>
          </div>
          {dlPct > 0 && (
            <span className="text-blue-400 text-xs font-bold tabular-nums shrink-0">{dlPct}%</span>
          )}
        </div>
      )}

      {/* Video alanı */}
      <div className="w-full max-w-[960px] mx-auto">
        <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <ScreenProtectionOverlay className="w-full h-full">
            <div className="w-full h-full bg-black relative">
              {effectiveDirectUrl ? (
                <CustomVideoPlayer
                  ref={videoRef}
                  key={effectiveDirectUrl}
                  src={effectiveDirectUrl}
                  poster={video.thumbnailUrl || undefined}
                  protected={screenProt}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleEnded}
                  className="w-full h-full"
                  videoId={video.id}
                  token={token}
                />
              ) : effectiveEmbedHtml ? (
                <div
                  key={effectiveEmbedHtml}
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: effectiveEmbedHtml }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-[#555] text-sm">Video kaynağı bulunamadı</p>
                </div>
              )}
              <WatermarkOverlay videoWatermarkEnabled={showWatermark} />
              <SubtitleOverlay videoId={video.id} videoRef={videoRef} />
              {(video as any).hlsStatus === 'processing' && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 text-blue-400 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-blue-500/30 pointer-events-none z-10">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  HLS işleniyor...
                </div>
              )}
            </div>
          </ScreenProtectionOverlay>
        </div>
      </div>
    </div>
  );
}

export default function VideoWatch() {
  const params = useParams();
  const videoId = (params.id || "") as string;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: video, isLoading, error: videoError } = useGetVideo(videoId as any, { query: { enabled: !!videoId, queryKey: getGetVideoQueryKey(videoId as any), retry: 2 } });
  const { data: relatedVideos } = useGetRelatedVideos(videoId as any, { queryKey: ["relatedVideos", videoId] as any, enabled: !!videoId } as any);
  const { data: comments } = useListComments(videoId as any, { queryKey: getListCommentsQueryKey(videoId as any) as any, enabled: !!videoId } as any);

  const [players, setPlayers] = useState<PlayerSource[]>([]);
  const [descExpanded, setDescExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "video" | "comment"; commentId?: number } | null>(null);
  const [showSubManager, setShowSubManager] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [autoCategory, setAutoCategory] = useState<{ categoryId: number; name: string; slug: string } | null>(null);
  const [guestLiked, setGuestLiked] = useState(false);
  const [guestLikeCount, setGuestLikeCount] = useState(0);

  const token = typeof window !== "undefined" ? (localStorage.getItem("token") ?? "") : "";

  // Kick off access check in parallel with useGetVideo — re-runs when auth state changes
  useEffect(() => {
    const t = localStorage.getItem("token") ?? "";
    const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
    fetch("/api/subscriptions/has-access", { headers })
      .then(r => r.json())
      .then(d => setHasAccess(d.hasAccess ?? false))
      .catch(() => setHasAccess(false)); // fail-closed — don't unlock on network error
  }, [(user as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCreatorOrAdmin = user && video && ((user as any).role === "admin" || (video.creator && (user as any).id === video.creator.id));

  /* ── URL normalizasyonu: /videos/7 veya /videos/<uuid> → /videos/slug ──── */
  useEffect(() => {
    if (!video) return;
    const slug: string = (video as any).slug || "";
    if (!slug || videoId === slug) return;
    window.history.replaceState(null, "", `/videos/${slug}`);
  }, [video, videoId]);

  /* ── HLS dönüştürme polling: tamamlanınca video'yu yenile ────────────── */
  useEffect(() => {
    const status = (video as any)?.hlsStatus;
    if (status !== "processing" && status !== "pending") return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/videos/${videoId}/hls-status`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.status === "ready") {
          queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId as any) });
        }
      } catch { /* sessizce yoksay */ }
    }, 5000);
    return () => clearInterval(iv);
  }, [(video as any)?.hlsStatus, videoId, queryClient]);

  /* ── Otomatik kategori tespiti ─────────────────────────────────────────── */
  useEffect(() => {
    if (!video) return;
    fetch("/api/auto-categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: video.title || "",
        description: (video as any).description || "",
        tags: (video as any).tags || [],
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.suggestion) setAutoCategory(d.suggestion);
      })
      .catch(() => {});
  }, [video?.id]);

  /* ── SEO meta tag'leri ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!video) return;
    const title: string = video.title || "Video";
    const desc: string = ((video as any).description || title).slice(0, 160);
    const image: string = video.thumbnailUrl || "";
    const slug: string = (video as any).slug || videoId;
    const canonical = `${window.location.origin}/videos/${slug}`;

    document.title = `${title} — Soci`;

    const setMeta = (sel: string, attr: string, key: string, val: string) => {
      let el = document.querySelector(sel);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", val);
    };

    setMeta('meta[name="description"]', "name", "description", desc);
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", desc);
    setMeta('meta[property="og:type"]', "property", "og:type", "video.other");
    setMeta('meta[property="og:url"]', "property", "og:url", canonical);
    if (image) setMeta('meta[property="og:image"]', "property", "og:image", image);
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", desc);
    if (image) setMeta('meta[name="twitter:image"]', "name", "twitter:image", image);

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;

    return () => {
      document.title = "Soci";
      document.querySelector('link[rel="canonical"]')?.remove();
    };
  }, [video, videoId]);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) return;
    fetch("/api/tokens/balance", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => setTokenBalance(d.balance ?? 0)).catch(() => {});
  }, [user]);

  const likeMutation = useLikeVideo();
  const commentMutation = useCreateComment();

  useEffect(() => {
    if (video) {
      setIsBookmarked(!!(video as any).isBookmarked);
      setGuestLikeCount((video as any).guestLikeCount ?? 0);
      const likedIds: number[] = JSON.parse(localStorage.getItem("guest_liked_videos") ?? "[]");
      setGuestLiked(likedIds.includes(video.id as number));
    }
  }, [video]);

  const handleBookmark = async () => {
    if (!user) { setLocation("/login"); return; }
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    const method = isBookmarked ? "DELETE" : "POST";
    const endpoint = isBookmarked
      ? `/api/videos/${videoId}/unbookmark`
      : `/api/videos/${videoId}/bookmark`;
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setIsBookmarked(b => !b);
    } finally {
      setBookmarkBusy(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: video?.title || "Video", url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      prompt("Linki kopyala:", url);
    }
  };

  const fetchPlayers = () => {
    if (!videoId) return;
    fetch(`/api/videos/${videoId}/players`).then(r => r.json()).then(d => setPlayers(d.players || [])).catch(() => {});
  };

  useEffect(() => {
    fetchPlayers();
    fetch(`/api/videos/${videoId}/view`, { method: "POST" }).catch(() => {});
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // isFollowing is now provided by the video detail API — no separate round-trip needed
  useEffect(() => {
    if (video) setIsFollowing(!!(video as any).isFollowing);
  }, [video?.id, (video as any)?.isFollowing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFollow = async () => {
    if (!user) { setLocation("/login"); return; }
    if (!video?.creator?.id || followBusy) return;
    setFollowBusy(true);
    const t = localStorage.getItem("token") ?? "";
    const endpoint = isFollowing
      ? `/api/users/${video.creator.id}/unfollow`
      : `/api/users/${video.creator.id}/follow`;
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setIsFollowing(f => !f);
    } finally {
      setFollowBusy(false);
    }
  };

  useEffect(() => {
    if (!videoId || !user) return;
    fetch(`/api/downloads/check/${videoId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setIsDownloaded(d.downloaded); setIsPremiumUser(d.isPremium); })
      .catch(() => {});
  }, [videoId, user]);

  const handleDownload = async () => {
    if (!video || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/downloads/${videoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setIsDownloaded(true);
      const url = data.videoUrl;
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${video.title}.mp4`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } finally {
      setDownloading(false);
    }
  };

  // Access check now fires in parallel on mount (see earlier useEffect) — removed old sequential version

  const handleLike = async () => {
    if (!video) return;
    if (!user) {
      if (guestLiked) return;
      try {
        const res = await fetch(`/api/videos/${videoId}/guest-like`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setGuestLiked(true);
          setGuestLikeCount(data.guestLikeCount ?? guestLikeCount + 1);
          const likedIds: number[] = JSON.parse(localStorage.getItem("guest_liked_videos") ?? "[]");
          likedIds.push(video.id as number);
          localStorage.setItem("guest_liked_videos", JSON.stringify(likedIds));
        }
      } catch { /* sessizce yoksay */ }
      return;
    }
    likeMutation.mutate({ id: videoId }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetVideoQueryKey(videoId), (old: any) => old ? { ...old, isLiked: !old.isLiked, likeCount: old.isLiked ? old.likeCount - 1 : old.likeCount + 1 } : old);
      }
    });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate({ id: videoId, data: { content: commentText } }, {
      onSuccess: () => {
        setCommentText("");
        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(videoId) });
      }
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-6 max-w-7xl">
          <Skeleton className="w-full aspect-video rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (videoError || !video) {
    const is404 = (videoError as any)?.status === 404;
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
          <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]">
            <svg className="h-12 w-12 text-[#444] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-white">
              {is404 ? "Video bulunamadı" : "Video yüklenemedi"}
            </p>
            <p className="text-sm text-[#666] mt-1 max-w-sm">
              {is404
                ? "Bu video silinmiş veya hiç yüklenmemiş olabilir."
                : "Sunucuya bağlanırken hata oluştu. İnternet bağlantını kontrol et."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-xl bg-[#7c3aed] text-white text-sm font-medium hover:bg-[#6d28d9] transition-colors"
            >
              Tekrar Dene
            </button>
            <button
              onClick={() => history.back()}
              className="px-5 py-2 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] text-sm font-medium hover:text-white transition-colors"
            >
              Geri Dön
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isLocked = (video.isPremium || video.isPPV) && hasAccess === false;
  const accessLoading = (video.isPremium || video.isPPV) && hasAccess === null;

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4 min-w-0">
          {accessLoading ? (
            <Skeleton className="w-full aspect-video rounded-xl" />
          ) : isLocked ? (
            <PremiumPaywall video={video} isPPV={!!video.isPPV} isLoggedIn={!!user} onLoginClick={() => setLocation("/login")} />
          ) : (
            <VideoPlayer key={video.id} video={video} players={players} onRefreshPlayers={fetchPlayers} />
          )}
          <div className="flex items-start gap-2">
            <h1 className="text-xl md:text-2xl font-bold flex-1">{video.title}</h1>
            {video.isPremium && <span className="shrink-0 flex items-center gap-1 bg-primary/15 border border-primary/30 text-primary text-xs font-bold px-2.5 py-1 rounded-full mt-1"><Crown className="h-3 w-3" /> Premium</span>}
            {video.isPPV && <span className="shrink-0 flex items-center gap-1 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-full mt-1">PPV ${Number(video.ppvPrice || 0).toFixed(2)}</span>}
          </div>
          <p className="text-sm text-[#666]">
            {(video.viewCount || 0).toLocaleString("tr-TR")} izlenme
            {" · "}
            {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
          </p>
          {/* Creator row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                <AvatarImage src={video.creator?.avatarUrl || ""} />
                <AvatarFallback>{video.creator?.username?.substring(0, 2) ?? "CR"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="font-bold text-sm flex items-center gap-1 truncate">
                  {video.creator?.displayName || video.creator?.username}
                  {video.creator?.isVerified && <span className="text-primary text-xs shrink-0">✓</span>}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {video.creator?.followerCount?.toLocaleString()} takipçi
                </p>
              </div>
              {user && video.creator && (user as any).id !== video.creator.id && (
                <Button
                  className={cn(
                    "rounded-full shrink-0 transition-all touch-manipulation",
                    isFollowing
                      ? "bg-[#2a2a2a] border border-[#3a3a3a] text-[#aaa] hover:bg-red-900/20 hover:border-red-500/30 hover:text-red-400"
                      : "bg-primary hover:bg-primary/90 text-white"
                  )}
                  size="sm"
                  onClick={handleFollow}
                  disabled={followBusy}
                >
                  {isFollowing ? "Takip Ediliyor" : "Takip Et"}
                </Button>
              )}
            </div>
            {/* Action buttons — icon-only on mobile, icon+label on sm+ */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <div className="flex items-center gap-0.5">
                <Button
                  variant="secondary" size="sm"
                  className={cn(
                    "rounded-full px-2.5 sm:px-3 touch-manipulation",
                    (!user && guestLiked) ? "opacity-60 cursor-default" : ""
                  )}
                  onClick={handleLike}
                  disabled={!user && guestLiked}
                >
                  <Heart className={cn("h-4 w-4 sm:mr-1.5", (user ? video.isLiked : guestLiked) ? "fill-red-500 text-red-500" : "")} />
                  <span className="text-xs hidden sm:inline">
                    {user ? (video.likeCount ?? 0).toLocaleString() : (guestLiked ? "Beğenildi" : "Beğen")}
                  </span>
                  <span className="text-xs sm:hidden">{user ? (video.likeCount ?? 0).toLocaleString() : (guestLiked ? "✓" : "")}</span>
                </Button>
                {((video.likeCount ?? 0) > 0 || guestLikeCount > 0) && (
                  <div className="flex items-center gap-1 ml-1 text-[10px] text-[#555]">
                    {(video.likeCount ?? 0) > 0 && (
                      <span title="Üye beğenisi" className="flex items-center gap-0.5">
                        <span>👤</span>{(video.likeCount ?? 0).toLocaleString()}
                      </span>
                    )}
                    {guestLikeCount > 0 && (
                      <span title="Misafir beğenisi" className="flex items-center gap-0.5">
                        <span>👁️</span>{guestLikeCount.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="secondary" size="sm"
                className={cn(
                  "rounded-full px-2.5 sm:px-3 touch-manipulation transition-all",
                  isBookmarked
                    ? "bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                    : ""
                )}
                onClick={handleBookmark}
                disabled={bookmarkBusy}
              >
                <Bookmark className={cn("h-4 w-4 sm:mr-1.5", isBookmarked ? "fill-current" : "")} />
                <span className="hidden sm:inline text-xs">{isBookmarked ? "Kaydedildi" : "Kaydet"}</span>
              </Button>
              <Button
                variant="secondary" size="sm"
                className={cn(
                  "rounded-full px-2.5 sm:px-3 touch-manipulation transition-all",
                  shareCopied ? "bg-green-900/30 border border-green-500/40 text-green-400" : ""
                )}
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline text-xs">{shareCopied ? "Kopyalandı!" : "Paylaş"}</span>
              </Button>
              {user && isPremiumUser && (
                <Button
                  variant="secondary" size="sm"
                  onClick={handleDownload}
                  disabled={downloading}
                  className={cn(
                    "rounded-full px-2.5 sm:px-3 transition-all touch-manipulation",
                    isDownloaded && "bg-green-900/30 border border-green-500/40 text-green-400 hover:bg-green-900/40"
                  )}
                >
                  {downloading
                    ? <><Download className="h-4 w-4 sm:mr-1.5 animate-bounce" /><span className="hidden sm:inline text-xs">İndiriliyor…</span></>
                    : isDownloaded
                      ? <><Check className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline text-xs">İndirildi</span></>
                      : <><Download className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline text-xs">İndir</span></>
                  }
                </Button>
              )}
              {user && !isPremiumUser && (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setLocation("/pricing")}
                  className="rounded-full px-2.5 text-[#555] hover:text-amber-400 hover:bg-amber-900/15 border border-transparent hover:border-amber-500/30 transition-all touch-manipulation"
                  title="Premium üyelik ile indirin"
                >
                  <Download className="h-4 w-4 sm:mr-1" />
                  <Crown className="h-3 w-3" />
                </Button>
              )}
              {user && video.creator && (user as any).id !== video.creator.id && (
                <>
                  <Button
                    onClick={() => setShowTip(true)}
                    size="sm"
                    className="rounded-full px-2.5 sm:px-3 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25 hover:border-yellow-500/50 touch-manipulation"
                  >
                    <Coins className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline text-xs">Bahşiş</span>
                  </Button>
                  <Button
                    onClick={() => setShowRequest(true)}
                    size="sm"
                    className="rounded-full px-2.5 sm:px-3 bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 hover:border-primary/50 touch-manipulation"
                  >
                    <FileText className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline text-xs">Özel İstek</span>
                  </Button>
                </>
              )}
              {user && (
                <Button
                  variant="ghost" size="sm"
                  className="rounded-full px-2.5 text-[#666] hover:text-red-400 touch-manipulation"
                  onClick={() => { setReportTarget({ type: "video" }); setShowReport(true); }}
                  title="Şikayet et"
                >
                  <Flag className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl text-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <p className="text-[#888] font-medium">{video.viewCount?.toLocaleString()} görüntülenme • {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</p>
            </div>
            {(video.category || autoCategory) && (
              <div className="border-t border-[#2a2a2a] px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                {video.category && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#666] text-xs shrink-0">Kategori</span>
                    <button
                      onClick={() => setLocation(`/categories/${video.category.id}`)}
                      className="inline-flex items-center gap-1 bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1 rounded-full border border-primary/25 hover:bg-primary/25 transition-colors"
                    >
                      {video.category.name}
                    </button>
                  </div>
                )}
                {autoCategory && autoCategory.categoryId !== video.category?.id && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#666] text-xs shrink-0">Otomatik</span>
                    <button
                      onClick={() => setLocation(`/categories/${autoCategory.categoryId}`)}
                      className="inline-flex items-center gap-1 bg-[#2a2a2a] text-[#aaa] text-xs font-semibold px-2.5 py-1 rounded-full border border-[#333] hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      {autoCategory.name}
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="px-4 pb-4 pt-2">
              <p className={cn("whitespace-pre-wrap text-[#ccc] text-sm leading-relaxed", !descExpanded && "line-clamp-3")}>{video.description}</p>
              {video.description && video.description.length > 150 && <button onClick={() => setDescExpanded(p => !p)} className="flex items-center gap-1 text-xs text-primary mt-2 hover:text-primary/80">{descExpanded ? <><ChevronUp className="h-3 w-3" />Daha az</> : <><ChevronDown className="h-3 w-3" />Daha fazla</>}</button>}
            </div>
          </div>
          {isLocked && <div className="flex items-center justify-between gap-4 bg-primary/10 border border-primary/20 rounded-xl px-5 py-4"><div className="flex items-center gap-3"><Crown className="h-5 w-5 text-primary shrink-0" /><p className="text-sm text-white">{user ? "Bu içeriği izlemek için Premium üyelik gerekiyor." : "Giriş yap veya abone ol."}</p></div><Button size="sm" onClick={() => setLocation("/pricing")} className="shrink-0 bg-primary hover:bg-primary/90">{user ? "Premium'a Geç" : "Abone Ol"}</Button></div>}
          <div className="flex items-center gap-3 flex-wrap">
            {isCreatorOrAdmin && (
              <button
                onClick={() => setShowSubManager(p => !p)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#888] hover:text-white transition-colors touch-manipulation py-1"
              >
                <Languages className="h-4 w-4 shrink-0" />
                <span>Altyazı</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", showSubManager && "rotate-180")} />
              </button>
            )}
            {user && !isCreatorOrAdmin && (
              <button
                onClick={() => setShowTranscript(p => !p)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#888] hover:text-white transition-colors touch-manipulation py-1"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>Transcript</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", showTranscript && "rotate-180")} />
              </button>
            )}
          </div>
          {(isCreatorOrAdmin ? (showSubManager) : (showTranscript && !!user)) && (
            <SubtitleManager videoId={videoId} token={token} isOwner={!!isCreatorOrAdmin} />
          )}
          <div className="pt-2">
            <h3 className="text-base font-bold mb-4">{video.commentCount ?? 0} Yorum</h3>

            {user ? (
              <form onSubmit={handleComment} className="flex gap-2 sm:gap-3 mb-6">
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-0.5">
                  <AvatarFallback className="text-[10px]">
                    {(user as any).username?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Yorum yaz..."
                    className="bg-[#1e1e1e] border-[#2a2a2a] rounded-lg focus-visible:ring-primary text-sm"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!commentText.trim() || commentMutation.isPending}
                    className="shrink-0 touch-manipulation"
                  >
                    Gönder
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-[#666] mb-4">
                Yorum yapmak için{" "}
                <a href="/login" className="text-primary hover:underline">giriş yap</a>
              </p>
            )}

            <div className="space-y-4">
              {comments?.comments?.map(comment => (
                <div key={comment.id} className="flex gap-2 sm:gap-3">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-0.5">
                    <AvatarImage src={comment.author?.avatarUrl || ""} />
                    <AvatarFallback className="text-[10px]">
                      {comment.author?.username?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>@{comment.author?.username}</span>
                      <span className="text-muted-foreground font-normal text-[10px]">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                    </p>
                    <p className="text-sm text-[#ccc] break-words">{comment.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button className="text-xs text-[#666] hover:text-red-400 flex items-center gap-1 transition-colors touch-manipulation">
                        <Heart className="h-3 w-3" />
                        {comment.likeCount}
                      </button>
                      <button className="text-xs text-[#666] hover:text-white transition-colors touch-manipulation">
                        Yanıtla
                      </button>
                      {user && (user as any).id !== comment.author?.id && (
                        <button
                          onClick={() => { setReportTarget({ type: "comment", commentId: comment.id }); setShowReport(true); }}
                          className="text-xs text-[#444] hover:text-red-400 flex items-center gap-1 transition-colors touch-manipulation"
                          title="Yorumu şikayet et"
                        >
                          <Flag className="h-2.5 w-2.5" /> Şikayet
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:w-[360px] shrink-0">
          <h3 className="font-bold text-base mb-3">İlgili Videolar</h3>
          {/* Mobile: 2-column grid; desktop: vertical list */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {relatedVideos?.videos?.map(relVideo => (
              <VideoCard key={relVideo.id} video={relVideo} />
            ))}
          </div>
        </div>
      </div>
      {showTip && video.creator && <TokenTipModal creator={{ id: video.creator.id, username: video.creator.username, displayName: video.creator.displayName ?? undefined, avatarUrl: video.creator.avatarUrl ?? undefined }} videoId={videoId} onClose={() => setShowTip(false)} />}
      {showRequest && video.creator && <CustomRequestModal creator={{ id: video.creator.id, username: video.creator.username, displayName: video.creator.displayName ?? undefined, avatarUrl: video.creator.avatarUrl ?? undefined }} currentBalance={tokenBalance} onClose={() => setShowRequest(false)} onSent={() => setShowRequest(false)} />}
      <ReportModal open={showReport} onClose={() => { setShowReport(false); setReportTarget(null); }} contentType={reportTarget?.type ?? "video"} videoId={reportTarget?.type === "video" ? videoId : undefined} commentId={reportTarget?.commentId} contentLabel={reportTarget?.type === "video" ? video.title : undefined} />
    </AppLayout>
  );
}
