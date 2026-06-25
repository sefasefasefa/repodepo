import { AppLayout } from "@/components/layout/app-layout";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { X, ChevronLeft, ChevronRight, Plus, Heart, Eye, Lock, MessageCircle, Send, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { processMessage } from "@/lib/link-filter";

interface Story {
  id: number;
  mediaUrl: string;
  mediaType: string;
  thumbnailUrl?: string;
  caption?: string;
  isPremium: boolean;
  viewCount: number;
  duration: number;
  expiresAt: string;
  createdAt: string;
}

interface StoryGroup {
  creator: { id: number; username: string; displayName?: string; avatarUrl?: string; isVerified?: boolean };
  stories: Story[];
}

interface StoryComment {
  id: number;
  user: string;
  avatar?: string;
  text: string;
  ts: number;
}

const STORY_REACTIONS = ["❤️", "🔥", "😂", "😮", "😍", "👏"];

export default function Stories() {
  const { user, token } = useAuth() as any;
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newStory, setNewStory] = useState({ mediaUrl: "", mediaType: "image", caption: "", isPremium: false });

  // Per-story state
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Record<number, StoryComment[]>>({});
  const [commentText, setCommentText] = useState("");
  const [reactionPicker, setReactionPicker] = useState(false);
  const [floatingReaction, setFloatingReaction] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/stories");
    const d = await r.json();
    setGroups(d.storyGroups || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const storyKey = activeGroup !== null && activeStoryIdx !== null
    ? groups[activeGroup]?.stories[activeStoryIdx]?.id
    : null;

  const openGroup = (idx: number) => {
    setActiveGroup(idx);
    setActiveStoryIdx(0);
    setProgress(0);
    setShowComments(false);
  };

  const closeViewer = () => {
    setActiveGroup(null);
    setShowComments(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const nextStory = () => {
    if (activeGroup === null) return;
    const group = groups[activeGroup];
    if (activeStoryIdx < group.stories.length - 1) {
      setActiveStoryIdx(i => i + 1);
      setProgress(0);
    } else if (activeGroup < groups.length - 1) {
      setActiveGroup(g => (g ?? 0) + 1);
      setActiveStoryIdx(0);
      setProgress(0);
    } else {
      closeViewer();
    }
  };

  const prevStory = () => {
    if (activeStoryIdx > 0) {
      setActiveStoryIdx(i => i - 1);
      setProgress(0);
    } else if (activeGroup !== null && activeGroup > 0) {
      setActiveGroup(g => (g ?? 1) - 1);
      setActiveStoryIdx(0);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (activeGroup === null || paused || showComments) return;
    const story = groups[activeGroup]?.stories[activeStoryIdx];
    if (!story) return;
    const duration = (story.duration || 5) * 1000;
    const step = 100 / (duration / 100);
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { nextStory(); return 0; }
        return p + step;
      });
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeGroup, activeStoryIdx, paused, showComments]);

  const handleAddStory = async () => {
    if (!newStory.mediaUrl) return;
    await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(newStory),
    });
    setShowAdd(false);
    setNewStory({ mediaUrl: "", mediaType: "image", caption: "", isPremium: false });
    load();
  };

  const toggleLike = (storyId: number) => {
    setLiked(p => ({ ...p, [storyId]: !p[storyId] }));
    setLikeCounts(p => ({ ...p, [storyId]: (p[storyId] ?? 0) + (liked[storyId] ? -1 : 1) }));
  };

  const sendReaction = (emoji: string) => {
    if (storyKey === null || storyKey === undefined) return;
    setFloatingReaction(emoji);
    setReactionPicker(false);
    setTimeout(() => setFloatingReaction(null), 1200);
    if (!liked[storyKey]) {
      setLiked(p => ({ ...p, [storyKey]: true }));
      setLikeCounts(p => ({ ...p, [storyKey]: (p[storyKey] ?? 0) + 1 }));
    }
  };

  const sendComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed || storyKey === null || storyKey === undefined) return;
    const { filtered } = processMessage(trimmed, user?.username ?? "anonim", "comment", `story_${storyKey}`);
    const newComment: StoryComment = {
      id: Date.now(),
      user: user?.username ?? "anonim",
      avatar: user?.avatarUrl,
      text: filtered,
      ts: Date.now(),
    };
    setComments(p => ({ ...p, [storyKey]: [...(p[storyKey] ?? []), newComment] }));
    setCommentText("");
  };

  const activeStoryData = activeGroup !== null ? groups[activeGroup]?.stories[activeStoryIdx] : null;
  const activeCreator = activeGroup !== null ? groups[activeGroup]?.creator : null;
  const currentStoryLiked = storyKey !== null && storyKey !== undefined ? (liked[storyKey] ?? false) : false;
  const currentLikeCount = storyKey !== null && storyKey !== undefined ? (likeCounts[storyKey] ?? activeStoryData?.viewCount ?? 0) : 0;
  const currentComments = storyKey !== null && storyKey !== undefined ? (comments[storyKey] ?? []) : [];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Hikayeler</h1>
          {user && (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Hikaye Ekle
            </button>
          )}
        </div>

        {showAdd && (
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5 mb-6 space-y-3">
            <h2 className="font-bold text-sm">Yeni Hikaye</h2>
            <div>
              <label className="text-xs text-[#777] block mb-1">Medya URL (resim veya video)</label>
              <input value={newStory.mediaUrl} onChange={e => setNewStory(p => ({...p, mediaUrl: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs text-[#777] block mb-1">Tür</label>
              <select value={newStory.mediaType} onChange={e => setNewStory(p => ({...p, mediaType: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white">
                <option value="image">Resim</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#777] block mb-1">Altyazı</label>
              <input value={newStory.caption} onChange={e => setNewStory(p => ({...p, caption: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" placeholder="Hikaye açıklaması..." />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#aaa]">
              <input type="checkbox" checked={newStory.isPremium} onChange={e => setNewStory(p => ({...p, isPremium: e.target.checked}))} className="w-4 h-4" />
              Premium hikaye (sadece aboneler görebilir)
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 rounded text-sm bg-[#333] text-[#aaa]">İptal</button>
              <button onClick={handleAddStory} className="px-4 py-1.5 rounded text-sm bg-primary text-white">Paylaş</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Array.from({length:6}).map((_,i) => (
              <div key={i} className="shrink-0 flex flex-col items-center gap-1.5">
                <div className="w-16 h-16 rounded-full bg-[#222] animate-pulse" />
                <div className="w-12 h-2 bg-[#222] rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 text-[#555]">
            <div className="text-5xl mb-4">📸</div>
            <p className="font-medium text-[#aaa]">Henüz hikaye yok</p>
            <p className="text-sm mt-1">Takip ettiğin kişilerin hikayeleri burada görünür</p>
            <Link href="/creators">
              <button className="mt-4 px-6 py-2 rounded-full bg-primary text-white text-sm hover:bg-primary/90 transition-colors">Modelleri Keşfet</button>
            </Link>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {groups.map((group, idx) => (
              <button key={group.creator.id} onClick={() => openGroup(idx)} className="shrink-0 flex flex-col items-center gap-1.5 group">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-primary via-orange-400 to-yellow-300">
                    <div className="w-full h-full rounded-full bg-[#111] p-0.5">
                      {group.creator.avatarUrl ? (
                        <img src={group.creator.avatarUrl} className="w-full h-full rounded-full object-cover" alt={group.creator.username} />
                      ) : (
                        <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                          {group.creator.username.substring(0,1).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 bg-[#111] rounded-full p-0.5">
                    <div className="w-5 h-5 rounded-full bg-[#222] flex items-center justify-center text-[10px] text-[#888]">{group.stories.length}</div>
                  </div>
                </div>
                <span className="text-xs text-[#aaa] max-w-[64px] truncate group-hover:text-white transition-colors">
                  {group.creator.displayName || group.creator.username}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Story Viewer Modal */}
      {activeGroup !== null && activeStoryData && activeCreator && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center">
          <div className="relative w-full max-w-sm h-full max-h-[780px] bg-[#111] rounded-2xl overflow-hidden shadow-2xl flex flex-col">

            {/* Progress bars */}
            <div className="absolute top-3 left-3 right-3 z-10 flex gap-1">
              {groups[activeGroup].stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-none" style={{ width: i < activeStoryIdx ? "100%" : i === activeStoryIdx ? `${progress}%` : "0%" }} />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-7 left-3 right-3 z-10 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0">
                {activeCreator.avatarUrl ? (
                  <img src={activeCreator.avatarUrl} className="w-full h-full object-cover" alt="" onError={e => { (e.target as any).style.display='none' }} />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {activeCreator.username.substring(0,1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold leading-tight truncate">
                  {activeCreator.displayName || activeCreator.username}
                  {activeCreator.isVerified && <span className="ml-1 text-[10px] text-primary">✓</span>}
                </p>
                <p className="text-white/50 text-[11px]">{formatAgo(activeStoryData.createdAt)}</p>
              </div>
              <button onClick={closeViewer} className="text-white/70 hover:text-white p-1.5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Media */}
            <div
              className="flex-1 relative"
              onMouseDown={e => { if (!(e.target as HTMLElement).closest('.no-pause')) setPaused(true); }}
              onMouseUp={() => setPaused(false)}
              onTouchStart={e => { if (!(e.target as HTMLElement).closest('.no-pause')) setPaused(true); }}
              onTouchEnd={() => setPaused(false)}
            >
              {activeStoryData.isPremium && !user ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#1a1a1a] to-[#111]">
                  <Lock className="h-12 w-12 text-primary" />
                  <p className="text-white font-bold">Premium Hikaye</p>
                  <p className="text-[#888] text-sm text-center px-8">Bu hikayeyi görmek için abone olman gerekiyor</p>
                  <Link href="/pricing" onClick={closeViewer}>
                    <button className="px-6 py-2 rounded-full bg-primary text-white text-sm font-semibold">Abone Ol</button>
                  </Link>
                </div>
              ) : activeStoryData.mediaType === "video" ? (
                <video src={activeStoryData.mediaUrl} className="w-full h-full object-cover" autoPlay muted playsInline />
              ) : (
                <img src={activeStoryData.mediaUrl} className="w-full h-full object-cover" alt="" />
              )}

              {/* Floating reaction */}
              {floatingReaction && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <div className="text-6xl animate-bounce">{floatingReaction}</div>
                </div>
              )}

              {/* Caption */}
              {activeStoryData.caption && !showComments && (
                <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-16">
                  <p className="text-white text-sm leading-relaxed drop-shadow">{activeStoryData.caption}</p>
                </div>
              )}

              {/* Tap nav zones */}
              <button className="absolute left-0 top-0 w-1/3 h-full z-10 opacity-0" onClick={e => { e.stopPropagation(); prevStory(); }} />
              <button className="absolute right-0 top-0 w-1/3 h-full z-10 opacity-0" onClick={e => { e.stopPropagation(); nextStory(); }} />
            </div>

            {/* Bottom actions */}
            {!showComments ? (
              <div className="absolute bottom-0 left-0 right-0 z-20 px-3 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white/60 text-xs">
                  <Eye className="h-3.5 w-3.5" />{activeStoryData.viewCount}
                </div>

                <div className="flex items-center gap-2 no-pause">
                  {/* Reaction picker */}
                  <div className="relative">
                    <button
                      onClick={() => setReactionPicker(p => !p)}
                      className="no-pause p-2 rounded-full bg-black/40 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    {reactionPicker && (
                      <div className="absolute bottom-10 right-0 flex gap-1 bg-[#1e1e1e] border border-[#333] rounded-2xl p-2 shadow-xl no-pause">
                        {STORY_REACTIONS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => sendReaction(emoji)}
                            className="text-xl hover:scale-125 transition-transform no-pause"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comment button */}
                  <button
                    onClick={() => { setShowComments(true); setPaused(true); }}
                    className="no-pause flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white/70 hover:text-white text-xs transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {currentComments.length > 0 && <span>{currentComments.length}</span>}
                  </button>

                  {/* Like button */}
                  <button
                    onClick={() => storyKey !== null && storyKey !== undefined && toggleLike(storyKey)}
                    className="no-pause flex items-center gap-1.5 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
                  >
                    <Heart className={cn("h-5 w-5 transition-all", currentStoryLiked ? "fill-red-500 text-red-500 scale-110" : "")} />
                  </button>
                </div>
              </div>
            ) : (
              /* Comment panel */
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#111]/95 backdrop-blur-sm rounded-t-2xl border-t border-[#222] flex flex-col max-h-[55%]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e] shrink-0">
                  <p className="text-white font-semibold text-sm">Yorumlar ({currentComments.length})</p>
                  <button
                    onClick={() => { setShowComments(false); setPaused(false); }}
                    className="text-[#555] hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
                  {currentComments.length === 0 ? (
                    <p className="text-center text-[#555] text-sm py-4">İlk yorumu sen yap!</p>
                  ) : (
                    currentComments.map(c => (
                      <div key={c.id} className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {c.user[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-primary mr-1.5">{c.user}</span>
                          <span className="text-sm text-[#ccc] break-words">{c.text}</span>
                          <p className="text-[10px] text-[#555] mt-0.5">{formatAgo(new Date(c.ts).toISOString())}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {user ? (
                  <div className="flex items-center gap-2 px-3 pb-3 pt-2 border-t border-[#1e1e1e] shrink-0">
                    <input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendComment()}
                      placeholder="Yorum yaz..."
                      className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-3.5 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary/40"
                    />
                    <button
                      onClick={sendComment}
                      disabled={!commentText.trim()}
                      className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-white disabled:opacity-30 flex items-center justify-center shrink-0 transition-all"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="px-4 pb-4 pt-2 text-center text-sm text-[#555]">
                    Yorum için <Link href="/login" onClick={closeViewer} className="text-primary">giriş yap</Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Outside click to close */}
          <div className="absolute inset-0 -z-10" onClick={closeViewer} />
        </div>
      )}
    </AppLayout>
  );
}

function formatAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}dk`;
  if (h < 24) return `${h}s`;
  return `${Math.floor(h / 24)}g`;
}
