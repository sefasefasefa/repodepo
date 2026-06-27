import { AppLayout } from "@/components/layout/app-layout";
import { useParams, useLocation } from "wouter";
import { useGetVideo, useGetRelatedVideos, useLikeVideo, useListComments, useCreateComment, getGetVideoQueryKey, getListCommentsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, Share2, Bookmark, Flag, ChevronDown, ChevronUp, Globe, Crown, Coins, FileText, Languages, Download, Check, SlidersHorizontal } from "lucide-react";
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
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ResumeBanner } from "@/components/video/resume-banner";
import { clearWatchProgress, loadWatchProgress, saveWatchProgress, touchWatchHistory } from "@/lib/watch-progress";

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
  // Geçerli ID: sadece harf, rakam, tire, alt çizgi — { } ' " : içermez
  return /^[A-Za-z0-9_\-]{4,64}$/.test(id);
}

/** Streaming platformu URL'sini embed iframe koduna dönüştürür */
function resolveEmbedFromUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  // Bozuk URL koruması: dict string karışmış URL'leri filtrele
  if (rawUrl.includes("{'") || rawUrl.includes('{"') || rawUrl.includes("': '")) return null;
  // Doğrudan video dosyası ise embed gerekmez
  const lower = rawUrl.toLowerCase().split('?')[0];
  if (/\.(mp4|webm|ogg|ogv|m3u8|mpd|mov|mkv|flv|ts)(\?|$)/.test(lower)) return null;
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, '');
    const parts = u.pathname.split('/').filter(Boolean);
    const iframe = (src: string) =>
      `<iframe src="${src}" width="100%" height="100%" frameborder="0" scrolling="no" allow="autoplay;fullscreen" allowfullscreen style="width:100%;height:100%;border:0;pointer-events:all"></iframe>`;

    // StreamTape: /v/ID/... → /e/ID
    if (host === 'streamtape.com' || host === 'streamtape.to') {
      const id = parts[1] || parts[0];
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

function VideoPlayer({ video, players }: { video: any; players: PlayerSource[] }) {
  const showWatermark: boolean = !!video.watermarkEnabled;
  const screenProt = useScreenProtectionState();
  const videoProps = getVideoProtectionProps(screenProt);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayControlsRef = useRef<HTMLDivElement | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [activeQuality, setActiveQuality] = useState<string>("auto");
  const [subtitleOpen, setSubtitleOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [resumePrompt, setResumePrompt] = useState<{ currentTime: number; progress: number } | null>(null);
  const resumeSeeked = useRef(false);
  const speeds = [0.75, 1, 1.25, 1.5, 1.75, 2];

  const allSources: PlayerSource[] = (() => {
    const rawUrl = video.hlsUrl || video.videoUrl;
    const ownSource: PlayerSource | null = rawUrl ? (() => {
      const embedCode = resolveEmbedFromUrl(rawUrl);
      return {
        id: 0,
        playerName: "Kendi Oynatıcı",
        ...(embedCode ? { embedCode } : { directUrl: rawUrl }),
        isDefault: players.length === 0,
        quality: "HD",
        language: "TR",
      };
    })() : null;
    return [...(ownSource ? [ownSource] : []), ...players];
  })();

  const defaultSource = allSources.find(p => p.isDefault) || allSources[0];
  const [active, setActive] = useState(defaultSource?.id ?? 0);
  const activeSource = allSources.find(p => p.id === active) || allSources[0];
  const qualities = Array.from(new Set(allSources.map(s => s.quality))).filter(Boolean);
  const hasSubtitles = true;

  useEffect(() => {
    const saved = loadWatchProgress(video.id);
    if (saved && saved.currentTime > 8 && saved.duration > 0 && saved.currentTime < saved.duration - 10) {
      setResumePrompt({ currentTime: saved.currentTime, progress: saved.currentTime / saved.duration });
    }
  }, [video.id]);

  useEffect(() => {
    resumeSeeked.current = false;
  }, [activeSource?.directUrl]);

  useEffect(() => {
    const vid = videoRef.current;
    if (vid) vid.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Video yüklenince ve her oynatmada hızı yeniden uygula (bazı tarayıcılar sıfırlar)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const applyRate = () => { vid.playbackRate = playbackSpeed; };
    vid.addEventListener('play', applyRate);
    vid.addEventListener('loadeddata', applyRate);
    vid.addEventListener('ratechange', () => {
      if (vid.playbackRate !== playbackSpeed) vid.playbackRate = playbackSpeed;
    });
    return () => {
      vid.removeEventListener('play', applyRate);
      vid.removeEventListener('loadeddata', applyRate);
    };
  }, [activeSource?.directUrl, playbackSpeed]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!overlayControlsRef.current?.contains(event.target as Node)) {
        setQualityOpen(false);
        setSpeedOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !activeSource?.directUrl) return;

    const onTimeUpdate = () => {
      if (!vid.duration || Number.isNaN(vid.currentTime)) return;
      saveWatchProgress(video.id, vid.currentTime, vid.duration);
      touchWatchHistory(video.id, video.title, video.thumbnailUrl || null, video.creator?.displayName || video.creator?.username || null);
    };

    const onLoadedMetadata = () => {
      // Auto-save duration to backend if not set yet
      if (vid.duration && Number.isFinite(vid.duration) && vid.duration > 0 && !video.duration) {
        const _tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        fetch(`/api/videos/${video.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(_tok ? { Authorization: `Bearer ${_tok}` } : {}) },
          body: JSON.stringify({ duration: Math.round(vid.duration) }),
        }).catch(() => {/* silent */});
      }
      if (resumeSeeked.current) return;
      const saved = loadWatchProgress(video.id);
      if (!saved || saved.currentTime < 8 || saved.currentTime >= vid.duration - 10) return;
      vid.currentTime = saved.currentTime;
      resumeSeeked.current = true;
      setResumePrompt({ currentTime: saved.currentTime, progress: saved.currentTime / Math.max(saved.duration || vid.duration || 1, 1) });
    };

    const onEnded = () => clearWatchProgress(video.id);

    vid.addEventListener("timeupdate", onTimeUpdate);
    vid.addEventListener("loadedmetadata", onLoadedMetadata);
    vid.addEventListener("ended", onEnded);
    return () => {
      vid.removeEventListener("timeupdate", onTimeUpdate);
      vid.removeEventListener("loadedmetadata", onLoadedMetadata);
      vid.removeEventListener("ended", onEnded);
    };
  }, [activeSource?.directUrl, video.id, video.creator?.displayName, video.creator?.username, video.thumbnailUrl, video.title]);

  if (!allSources.length) {
    return (
      <div className="aspect-video bg-[#111] rounded-xl flex items-center justify-center">
        <p className="text-[#555]">Oynatıcı bulunamadı</p>
      </div>
    );
  }

  const isDirectVideo = !activeSource?.embedCode && !!activeSource?.directUrl;

  return (
    <div className="space-y-2">
      {resumePrompt && isDirectVideo && (
        <ResumeBanner
          title={video.title}
          progress={resumePrompt.progress}
          onContinue={() => {
            const vid = videoRef.current;
            if (vid) vid.currentTime = resumePrompt.currentTime;
            setResumePrompt(null);
          }}
          onDismiss={() => {
            clearWatchProgress(video.id);
            setResumePrompt(null);
          }}
        />
      )}
      {/* Sağlayıcılar — videonun ÜSTÜNDE */}
      {allSources.length > 1 && (
        <div className="bg-[#161616] border border-[#252525] rounded-xl p-3">
          <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-2">Sağlayıcılar</p>
          <div className="flex items-center gap-2 flex-wrap">
            {allSources.map((src, idx) => (
              <button
                key={src.id}
                onClick={() => setActive(src.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all border touch-manipulation",
                  active === src.id
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                    : "bg-[#1e1e1e] border-[#2e2e2e] text-[#999] hover:text-white hover:border-[#444] hover:bg-[#242424]"
                )}
              >
                <Globe className={cn("h-3.5 w-3.5 shrink-0", active === src.id ? "text-white" : "text-[#555]")} />
                <span>{src.playerName}</span>
                {src.quality && src.quality !== "HD" && (
                  <span className={cn("text-[9px] px-1 py-0.5 rounded font-bold", active === src.id ? "bg-white/20" : "bg-[#333] text-[#666]")}>{src.quality}</span>
                )}
                {idx === 0 && allSources.length > 1 && (
                  <span className={cn("text-[9px] px-1 py-0.5 rounded font-bold", active === src.id ? "bg-white/20" : "bg-[#2a2a2a] text-[#555]")}>Varsayılan</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Video oynatıcı — sabit 16:9 oranı, max genişlik sınırlı */}
      <div className="w-full max-w-[960px] mx-auto rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <ScreenProtectionOverlay className="w-full h-full">
          <div className="w-full h-full bg-black relative group">
            {activeSource?.embedCode ? (
              <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: activeSource.embedCode.replace(/width=\"[^\"]*\"/g, 'width=\"100%\"').replace(/height=\"[^\"]*\"/g, 'height=\"100%\"').replace(/<iframe/g, '<iframe style=\"width:100%;height:100%;border:0;pointer-events:all\" allow=\"autoplay;fullscreen\" allowfullscreen') }} />
            ) : activeSource?.directUrl ? (
              <video ref={videoRef} key={activeSource.directUrl} src={activeSource.directUrl} className="w-full h-full object-contain" controls autoPlay={false} poster={video.thumbnailUrl || undefined} controlsList="nodownload noremoteplayback" disablePictureInPicture {...videoProps} />
            ) : null}
            {isDirectVideo && (
              <div ref={overlayControlsRef} className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex items-start gap-1 sm:gap-2">
                {/* CC */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setSubtitleOpen(v => !v); setQualityOpen(false); setSpeedOpen(false); }}
                    className={cn(
                      "flex items-center gap-1 rounded-full backdrop-blur px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold border touch-manipulation",
                      subtitleOpen ? "bg-primary/20 text-primary border-primary/30" : "bg-black/70 text-white border-white/10 hover:bg-black/80"
                    )}
                  >
                    <Languages className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">CC</span>
                  </button>
                  {subtitleOpen && hasSubtitles && (
                    <div className="absolute right-0 mt-1.5 w-36 sm:w-44 rounded-xl border border-white/10 bg-[#111] shadow-xl overflow-hidden">
                      <button type="button" onClick={() => setSubtitleOpen(false)} className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 text-white touch-manipulation">Kapalı</button>
                      <button type="button" onClick={() => setSubtitleOpen(false)} className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 text-primary touch-manipulation">Türkçe</button>
                      <button type="button" onClick={() => setSubtitleOpen(false)} className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 text-white touch-manipulation">English</button>
                    </div>
                  )}
                </div>
                {/* Quality */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setQualityOpen(v => !v); setSubtitleOpen(false); setSpeedOpen(false); }}
                    className="flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold text-white border border-white/10 hover:bg-black/80 touch-manipulation"
                  >
                    <SlidersHorizontal className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">{activeQuality === "auto" ? "Otomatik" : activeQuality}</span>
                  </button>
                  {qualityOpen && (
                    <div className="absolute right-0 mt-1.5 w-36 sm:w-40 rounded-xl border border-white/10 bg-[#111] shadow-xl overflow-hidden">
                      <button type="button" onClick={() => { setActiveQuality("auto"); setQualityOpen(false); }} className={cn("w-full px-3 py-2 text-left text-xs hover:bg-white/5 touch-manipulation", activeQuality === "auto" ? "text-primary" : "text-white")}>Otomatik</button>
                      {qualities.map(q => (
                        <button key={q} type="button" onClick={() => { setActiveQuality(q); setQualityOpen(false); }} className={cn("w-full px-3 py-2 text-left text-xs hover:bg-white/5 touch-manipulation", activeQuality === q ? "text-primary" : "text-white")}>{q}</button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Speed */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setSpeedOpen(v => !v); setSubtitleOpen(false); setQualityOpen(false); }}
                    className="flex items-center rounded-full bg-black/70 backdrop-blur px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold text-white border border-white/10 hover:bg-black/80 touch-manipulation min-w-[28px] justify-center"
                  >
                    {playbackSpeed}x
                  </button>
                  {speedOpen && (
                    <div className="absolute right-0 mt-1.5 w-28 sm:w-32 rounded-xl border border-white/10 bg-[#111] shadow-xl overflow-hidden">
                      {speeds.map(speed => (
                        <button key={speed} type="button" onClick={() => { setPlaybackSpeed(speed); setSpeedOpen(false); }} className={cn("w-full px-3 py-2 text-left text-xs hover:bg-white/5 touch-manipulation", playbackSpeed === speed ? "text-primary" : "text-white")}>
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <WatermarkOverlay videoWatermarkEnabled={showWatermark} />
            {isDirectVideo && <SubtitleOverlay videoId={video.id} videoRef={videoRef} />}
          </div>
        </ScreenProtectionOverlay>
      </div>
    </div>
  );
}

export default function VideoWatch() {
  const params = useParams();
  const videoId = parseInt(params.id || "0");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: video, isLoading, error: videoError } = useGetVideo(videoId, { query: { enabled: !!videoId, queryKey: getGetVideoQueryKey(videoId), retry: 2 } });
  const { data: relatedVideos } = useGetRelatedVideos(videoId, { queryKey: ["relatedVideos", videoId] as any, enabled: !!videoId } as any);
  const { data: comments } = useListComments(videoId, { queryKey: getListCommentsQueryKey(videoId) as any, enabled: !!videoId } as any);

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

  const token = typeof window !== "undefined" ? (localStorage.getItem("token") ?? "") : "";

  const isCreatorOrAdmin = user && video && ((user as any).role === "admin" || (video.creator && (user as any).id === video.creator.id));

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) return;
    fetch("/api/tokens/balance", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => setTokenBalance(d.balance ?? 0)).catch(() => {});
  }, [user]);

  const likeMutation = useLikeVideo();
  const commentMutation = useCreateComment();

  useEffect(() => {
    if (video) setIsBookmarked(!!(video as any).isBookmarked);
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

  useEffect(() => {
    if (!videoId) return;
    fetch(`/api/videos/${videoId}/players`).then(r => r.json()).then(d => setPlayers(d.players || []));
    fetch(`/api/videos/${videoId}/view`, { method: "POST" }).catch(() => {});
  }, [videoId]);

  useEffect(() => {
    if (!user || !video?.creator?.id) return;
    const t = localStorage.getItem("token");
    if (!t) return;
    fetch(`/api/users/${video.creator.id}/followers?limit=1&offset=0`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        const followers: any[] = d.users || [];
        setIsFollowing(followers.some((f: any) => f.id === (user as any).id));
      })
      .catch(() => {});
  }, [user, video?.creator?.id]);

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

  useEffect(() => {
    if (!video) return;
    const needsCheck = video.isPremium || video.isPPV;
    if (!needsCheck) {
      setHasAccess(true);
      return;
    }
    fetch("/api/subscriptions/has-access")
      .then(r => r.json())
      .then(d => setHasAccess(d.hasAccess))
      .catch(() => setHasAccess(false));
  }, [video]);

  const handleLike = () => {
    if (!video) return;
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
            <VideoPlayer video={video} players={players} />
          )}
          <div className="flex items-start gap-2">
            <h1 className="text-xl md:text-2xl font-bold flex-1">{video.title}</h1>
            {video.isPremium && <span className="shrink-0 flex items-center gap-1 bg-primary/15 border border-primary/30 text-primary text-xs font-bold px-2.5 py-1 rounded-full mt-1"><Crown className="h-3 w-3" /> Premium</span>}
            {video.isPPV && <span className="shrink-0 flex items-center gap-1 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-full mt-1">PPV ${Number(video.ppvPrice || 0).toFixed(2)}</span>}
          </div>
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
              <Button
                variant="secondary" size="sm"
                className="rounded-full px-2.5 sm:px-3 touch-manipulation"
                onClick={handleLike}
              >
                <Heart className={cn("h-4 w-4 sm:mr-1.5", video.isLiked ? "fill-red-500 text-red-500" : "")} />
                <span className="text-xs">{video.likeCount?.toLocaleString()}</span>
              </Button>
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
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-4 rounded-xl text-sm">
            <p className="text-[#888] font-medium mb-1.5">{video.viewCount?.toLocaleString()} görüntülenme • {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}{video.category && <span className="ml-2 text-primary">• {video.category.name}</span>}</p>
            <p className={cn("whitespace-pre-wrap text-[#ccc] text-sm leading-relaxed", !descExpanded && "line-clamp-3")}>{video.description}</p>
            {video.description && video.description.length > 150 && <button onClick={() => setDescExpanded(p => !p)} className="flex items-center gap-1 text-xs text-primary mt-2 hover:text-primary/80">{descExpanded ? <><ChevronUp className="h-3 w-3" />Daha az</> : <><ChevronDown className="h-3 w-3" />Daha fazla</>}</button>}
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
