import { AppLayout } from "@/components/layout/app-layout";
import { useParams, useLocation } from "wouter";
import { useGetVideo, useGetRelatedVideos, useLikeVideo, useListComments, useCreateComment, getGetVideoQueryKey, getListCommentsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, Share2, Bookmark, Flag, ChevronDown, ChevronUp, Globe, Crown, Coins, FileText, MoreHorizontal, Languages, Download, Check, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { ReportModal } from "@/components/report-modal";
import { TokenTipModal } from "@/components/token-tip-modal";
import { CustomRequestModal } from "@/components/custom-request-modal";
import { formatDistanceToNow } from "date-fns";
import { VideoCard } from "@/components/video/video-card";
import { PremiumPaywall } from "@/components/video/premium-paywall";
import { WatermarkOverlay } from "@/components/video/watermark-overlay";
import { SubtitleOverlay } from "@/components/video/subtitle-overlay";
import { CrosspostDispatchModal } from "@/components/crosspost/dispatch-modal";
import { SubtitleManager } from "@/components/video/subtitle-manager";
import { ScreenProtectionOverlay, getVideoProtectionProps } from "@/components/video/screen-protection-overlay";
import { isScreenProtectionEnabled } from "@/lib/use-screen-protection";
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

function VideoPlayer({ video, players }: { video: any; players: PlayerSource[] }) {
  const showWatermark: boolean = !!video.watermarkEnabled;
  const [screenProt] = useState(isScreenProtectionEnabled);
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

  const allSources: PlayerSource[] = [
    ...(video.hlsUrl || video.videoUrl ? [{
      id: 0,
      playerName: "Kendi Oynatıcı",
      directUrl: video.hlsUrl || video.videoUrl,
      isDefault: players.length === 0,
      quality: "HD",
      language: "TR",
    }] : []),
    ...players,
  ];

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
      <ScreenProtectionOverlay className="aspect-video rounded-xl overflow-hidden">
        <div className="w-full h-full bg-black relative group">
          {activeSource?.embedCode ? (
            <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: activeSource.embedCode.replace(/width=\"[^\"]*\"/g, 'width=\"100%\"').replace(/height=\"[^\"]*\"/g, 'height=\"100%\"').replace(/<iframe/g, '<iframe style=\"width:100%;height:100%;border:0;pointer-events:all\" allow=\"autoplay;fullscreen\" allowfullscreen') }} />
          ) : activeSource?.directUrl ? (
            <video ref={videoRef} key={activeSource.directUrl} src={activeSource.directUrl} className="w-full h-full object-contain" controls autoPlay={false} poster={video.thumbnailUrl || undefined} {...videoProps} />
          ) : null}
          {isDirectVideo && (
            <div ref={overlayControlsRef} className="absolute top-3 right-3 z-20 flex items-start gap-2">
              <div className="relative">
                <button type="button" onClick={() => { setSubtitleOpen(v => !v); setQualityOpen(false); setSpeedOpen(false); }} className={cn("flex items-center gap-1.5 rounded-full backdrop-blur px-3 py-1.5 text-xs font-semibold border", subtitleOpen ? "bg-primary/20 text-primary border-primary/30" : "bg-black/70 text-white border-white/10 hover:bg-black/80")}>
                  <Languages className="h-3.5 w-3.5" />
                  CC
                </button>
                {subtitleOpen && hasSubtitles && (
                  <div className="absolute right-0 mt-2 w-44 rounded-xl border border-white/10 bg-[#111] shadow-xl overflow-hidden">
                    <button type="button" onClick={() => { setSubtitleOpen(false); }} className={cn("w-full px-3 py-2 text-left text-xs hover:bg-white/5", "text-white")}>Kapalı</button>
                    <button type="button" onClick={() => { setSubtitleOpen(false); }} className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 text-primary">Türkçe</button>
                    <button type="button" onClick={() => { setSubtitleOpen(false); }} className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 text-white">English</button>
                  </div>
                )}
              </div>
              <div className="relative">
                <button type="button" onClick={() => { setQualityOpen(v => !v); setSubtitleOpen(false); setSpeedOpen(false); }} className="flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-3 py-1.5 text-xs font-semibold text-white border border-white/10 hover:bg-black/80">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {activeQuality === "auto" ? "Otomatik" : activeQuality}
                </button>
                {qualityOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-[#111] shadow-xl overflow-hidden">
                    <button type="button" onClick={() => { setActiveQuality("auto"); setQualityOpen(false); }} className={cn("w-full px-3 py-2 text-left text-xs hover:bg-white/5", activeQuality === "auto" ? "text-primary" : "text-white")}>Otomatik</button>
                    {qualities.map(q => (
                      <button key={q} type="button" onClick={() => { setActiveQuality(q); setQualityOpen(false); }} className={cn("w-full px-3 py-2 text-left text-xs hover:bg-white/5", activeQuality === q ? "text-primary" : "text-white")}>{q}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button type="button" onClick={() => { setSpeedOpen(v => !v); setSubtitleOpen(false); setQualityOpen(false); }} className="flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-3 py-1.5 text-xs font-semibold text-white border border-white/10 hover:bg-black/80">
                  <span>{playbackSpeed}x</span>
                </button>
                {speedOpen && (
                  <div className="absolute right-0 mt-2 w-32 rounded-xl border border-white/10 bg-[#111] shadow-xl overflow-hidden">
                    {speeds.map(speed => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => { setPlaybackSpeed(speed); setSpeedOpen(false); }}
                        className={cn("w-full px-3 py-2 text-left text-xs hover:bg-white/5", playbackSpeed === speed ? "text-primary" : "text-white")}
                      >
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
      <div className="flex items-center gap-2 flex-wrap">
        {allSources.length > 1 && allSources.map(src => (
          <button key={src.id} onClick={() => setActive(src.id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border", active === src.id ? "bg-primary/15 border-primary text-primary" : "bg-[#1e1e1e] border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444]") }>
            <Globe className="h-3 w-3" />
            {src.playerName}
            <span className="text-[10px] opacity-60">{src.quality}</span>
          </button>
        ))}
        {qualities.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-[#888]">
            <ChevronLeft className="h-3 w-3" />
            Kalite: {activeQuality === "auto" ? "Otomatik" : activeQuality}
            <ChevronRight className="h-3 w-3" />
          </div>
        )}
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

  const { data: video, isLoading } = useGetVideo(videoId, { query: { enabled: !!videoId, queryKey: getGetVideoQueryKey(videoId) } });
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
  const [showCrosspost, setShowCrosspost] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [downloading, setDownloading] = useState(false);

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
    if (!videoId) return;
    fetch(`/api/videos/${videoId}/players`).then(r => r.json()).then(d => setPlayers(d.players || []));
    fetch(`/api/videos/${videoId}/view`, { method: "POST" }).catch(() => {});
  }, [videoId]);

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

  if (!video) return <AppLayout><div className="p-8 text-[#888]">Video bulunamadı</div></AppLayout>;

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
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={video.creator?.avatarUrl || ""} />
                <AvatarFallback>{video.creator?.username?.substring(0, 2) ?? "CR"}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold flex items-center gap-1">{video.creator?.displayName || video.creator?.username}{video.creator?.isVerified && <span className="text-primary text-xs">✓</span>}</h3>
                <p className="text-xs text-muted-foreground">{video.creator?.followerCount?.toLocaleString()} takipçi</p>
              </div>
              <Button className="ml-2 rounded-full" variant="secondary" size="sm">Takip Et</Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" size="sm" className="rounded-full" onClick={handleLike}><Heart className={cn("h-4 w-4 mr-1.5", video.isLiked ? "fill-red-500 text-red-500" : "")} />{video.likeCount?.toLocaleString()}</Button>
              <Button variant="secondary" size="sm" className="rounded-full"><Bookmark className="h-4 w-4 mr-1.5" /> Kaydet</Button>
              <Button variant="secondary" size="sm" className="rounded-full"><Share2 className="h-4 w-4 mr-1.5" /> Paylaş</Button>
              {user && isPremiumUser && <Button variant="secondary" size="sm" onClick={handleDownload} disabled={downloading} className={cn("rounded-full transition-all", isDownloaded ? "bg-green-900/30 border border-green-500/40 text-green-400 hover:bg-green-900/40" : "hover:bg-primary/15 hover:border-primary/40 hover:text-primary")}>{downloading ? <><Download className="h-4 w-4 mr-1.5 animate-bounce" /> İndiriliyor…</> : isDownloaded ? <><Check className="h-4 w-4 mr-1.5" /> İndirildi</> : <><Download className="h-4 w-4 mr-1.5" /> İndir</>}</Button>}
              {user && !isPremiumUser && <Button variant="ghost" size="sm" onClick={() => setLocation("/pricing")} className="rounded-full text-[#555] hover:text-amber-400 hover:bg-amber-900/15 border border-transparent hover:border-amber-500/30 transition-all" title="Premium üyelik ile indirin"><Download className="h-4 w-4 mr-1.5" /><Crown className="h-3 w-3" /></Button>}
              {user && video.creator && (user as any).id !== video.creator.id && <><Button onClick={() => setShowTip(true)} size="sm" className="rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25 hover:border-yellow-500/50"><Coins className="h-4 w-4 mr-1.5" /> Bahşiş</Button><Button onClick={() => setShowRequest(true)} size="sm" className="rounded-full bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 hover:border-primary/50"><FileText className="h-4 w-4 mr-1.5" /> Özel İstek</Button></>}
              {user && <Button variant="ghost" size="sm" className="rounded-full text-[#666] hover:text-red-400" onClick={() => { setReportTarget({ type: "video" }); setShowReport(true); }} title="Şikayet et"><Flag className="h-4 w-4" /></Button>}
            </div>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-4 rounded-xl text-sm">
            <p className="text-[#888] font-medium mb-1.5">{video.viewCount?.toLocaleString()} görüntülenme • {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}{video.category && <span className="ml-2 text-primary">• {video.category.name}</span>}</p>
            <p className={cn("whitespace-pre-wrap text-[#ccc] text-sm leading-relaxed", !descExpanded && "line-clamp-3")}>{video.description}</p>
            {video.description && video.description.length > 150 && <button onClick={() => setDescExpanded(p => !p)} className="flex items-center gap-1 text-xs text-primary mt-2 hover:text-primary/80">{descExpanded ? <><ChevronUp className="h-3 w-3" />Daha az</> : <><ChevronDown className="h-3 w-3" />Daha fazla</>}</button>}
          </div>
          {isLocked && <div className="flex items-center justify-between gap-4 bg-primary/10 border border-primary/20 rounded-xl px-5 py-4"><div className="flex items-center gap-3"><Crown className="h-5 w-5 text-primary shrink-0" /><p className="text-sm text-white">{user ? "Bu içeriği izlemek için Premium üyelik gerekiyor." : "Giriş yap veya abone ol."}</p></div><Button size="sm" onClick={() => setLocation("/pricing")} className="shrink-0 bg-primary hover:bg-primary/90">{user ? "Premium'a Geç" : "Abone Ol"}</Button></div>}
          <div className="flex items-center gap-2 flex-wrap">
            {isCreatorOrAdmin && <button onClick={() => setShowSubManager(p => !p)} className="flex items-center gap-2 text-sm font-medium text-[#888] hover:text-white transition-colors"><Languages className="h-4 w-4" />Altyazı Yönetimi<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSubManager && "rotate-180")} /></button>}
            {isCreatorOrAdmin && <button onClick={() => setShowCrosspost(true)} className="flex items-center gap-2 text-sm font-medium text-[#888] hover:text-primary transition-colors"><Share2 className="h-4 w-4" />Crosspost Gönder</button>}
            {user && <button onClick={() => setShowTranscript(p => !p)} className="flex items-center gap-2 text-sm font-medium text-[#888] hover:text-white transition-colors"><FileText className="h-4 w-4" />Transcript<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showTranscript && "rotate-180")} /></button>}
          </div>
          {showTranscript && user && <SubtitleManager videoId={videoId} token={token} />}
          {isCreatorOrAdmin && showSubManager && <SubtitleManager videoId={videoId} token={token} />}
          <div className="pt-2"><h3 className="text-base font-bold mb-4">{video.commentCount ?? 0} Yorum</h3>{user ? (<form onSubmit={handleComment} className="flex gap-3 mb-6"><Avatar className="h-8 w-8 shrink-0"><AvatarFallback>{(user as any).username?.substring(0,2).toUpperCase()}</AvatarFallback></Avatar><div className="flex-1 flex gap-2"><Input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Yorum yaz..." className="bg-[#1e1e1e] border-[#2a2a2a] rounded-lg focus-visible:ring-primary" /><Button type="submit" size="sm" disabled={!commentText.trim() || commentMutation.isPending} className="shrink-0">Gönder</Button></div></form>) : (<p className="text-sm text-[#666] mb-4">Yorum yapmak için <a href="/login" className="text-primary hover:underline">giriş yap</a></p>)}<div className="space-y-5">{comments?.comments?.map(comment => (<div key={comment.id} className="flex gap-3"><Avatar className="h-8 w-8 shrink-0"><AvatarImage src={comment.author?.avatarUrl || ""} /><AvatarFallback>{comment.author?.username?.substring(0,2).toUpperCase()}</AvatarFallback></Avatar><div className="flex-1"><p className="text-xs font-bold mb-1">@{comment.author?.username}<span className="text-muted-foreground font-normal ml-2">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span></p><p className="text-sm text-[#ccc]">{comment.content}</p><div className="flex items-center gap-3 mt-1.5"><button className="text-xs text-[#666] hover:text-red-400 flex items-center gap-1 transition-colors"><Heart className="h-3 w-3" />{comment.likeCount}</button><button className="text-xs text-[#666] hover:text-white transition-colors">Yanıtla</button>{user && (user as any).id !== comment.author?.id && (<button onClick={() => { setReportTarget({ type: "comment", commentId: comment.id }); setShowReport(true); }} className="text-xs text-[#444] hover:text-red-400 flex items-center gap-1 transition-colors" title="Yorumu şikayet et"><Flag className="h-2.5 w-2.5" /> Şikayet</button>)}</div></div></div>))}</div></div>
        </div>
        <div className="lg:w-[360px] flex flex-col gap-3 shrink-0">
          <h3 className="font-bold text-base">İlgili Videolar</h3>
          {relatedVideos?.videos?.map(relVideo => <VideoCard key={relVideo.id} video={relVideo} />)}
        </div>
      </div>
      {showTip && video.creator && <TokenTipModal creator={{ id: video.creator.id, username: video.creator.username, displayName: video.creator.displayName ?? undefined, avatarUrl: video.creator.avatarUrl ?? undefined }} videoId={videoId} onClose={() => setShowTip(false)} />}
      {showRequest && video.creator && <CustomRequestModal creator={{ id: video.creator.id, username: video.creator.username, displayName: video.creator.displayName ?? undefined, avatarUrl: video.creator.avatarUrl ?? undefined }} currentBalance={tokenBalance} onClose={() => setShowRequest(false)} onSent={() => setShowRequest(false)} />}
      <ReportModal open={showReport} onClose={() => { setShowReport(false); setReportTarget(null); }} contentType={reportTarget?.type ?? "video"} videoId={reportTarget?.type === "video" ? videoId : undefined} commentId={reportTarget?.commentId} contentLabel={reportTarget?.type === "video" ? video.title : undefined} />
      {showCrosspost && <CrosspostDispatchModal videoId={videoId} videoTitle={video.title} onClose={() => setShowCrosspost(false)} />}
    </AppLayout>
  );
}
