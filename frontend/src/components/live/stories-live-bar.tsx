import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Plus, Radio } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface StoryGroup {
  creatorId: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  hasLive?: boolean;
  streamId?: number;
  viewerCount?: number;
  hasStories?: boolean;
  seen?: boolean;
}

interface StoriesLiveBarProps {
  onAddStory?: () => void;
}

export function StoriesLiveBar({ onAddStory }: StoriesLiveBarProps) {
  const { user, token } = useAuth() as any;
  const [items, setItems] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const headers: any = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const [storiesRes, liveRes] = await Promise.all([
          fetch("/api/stories", { headers }).then(r => r.json()),
          fetch("/api/live", { headers }).then(r => r.json()),
        ]);

        const storyGroups: StoryGroup[] = (storiesRes.storyGroups || []).map((g: any) => ({
          creatorId: g.creator.id,
          username: g.creator.username,
          displayName: g.creator.displayName,
          avatarUrl: g.creator.avatarUrl,
          hasStories: true,
          seen: false,
        }));

        const liveStreams: StoryGroup[] = (liveRes.streams || []).map((s: any) => ({
          creatorId: s.creator?.id ?? s.creatorId,
          username: s.creator?.username ?? "",
          displayName: s.creator?.displayName,
          avatarUrl: s.creator?.avatarUrl,
          hasLive: true,
          streamId: s.id,
          viewerCount: s.viewerCount,
          hasStories: false,
        }));

        const merged: StoryGroup[] = [...liveStreams];
        storyGroups.forEach(sg => {
          const existing = merged.find(m => m.creatorId === sg.creatorId);
          if (existing) {
            existing.hasStories = true;
          } else {
            merged.push(sg);
          }
        });

        setItems(merged);
      } catch {}
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [token]);

  if (loading) {
    return (
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-[62px] h-[62px] rounded-full bg-[#222] animate-pulse" />
            <div className="w-10 h-2 bg-[#222] rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0 && !user) return null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-[#1e1e1e]"
    >
      {user && (
        <button
          onClick={onAddStory}
          className="shrink-0 flex flex-col items-center gap-1.5 group"
        >
          <div className="relative w-[62px] h-[62px]">
            <div className="w-full h-full rounded-full bg-[#1e1e1e] border-2 border-[#2a2a2a] group-hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-lg font-bold text-[#666]">
                  {user.username?.substring(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-[#111]">
              <Plus className="h-3 w-3 text-white" />
            </div>
          </div>
          <span className="text-[11px] text-[#666] group-hover:text-white transition-colors max-w-[62px] truncate">
            Hikaye ekle
          </span>
        </button>
      )}

      {items.map(item => (
        <StoryBubble key={item.creatorId} item={item} />
      ))}
    </div>
  );
}

function StoryBubble({ item }: { item: StoryGroup }) {
  const href = item.hasLive && item.streamId ? `/live/${item.streamId}` : `/stories`;

  return (
    <Link href={href}>
      <div className="shrink-0 flex flex-col items-center gap-1.5 group cursor-pointer">
        <div className="relative w-[62px] h-[62px]">
          {item.hasLive ? (
            <div className="w-full h-full rounded-full p-0.5 bg-gradient-to-tr from-red-600 via-red-500 to-orange-400 ring-2 ring-red-500/30">
              <div className="w-full h-full rounded-full bg-[#111] p-0.5">
                <Avatar item={item} />
              </div>
            </div>
          ) : item.hasStories ? (
            <div className="w-full h-full rounded-full p-0.5 bg-gradient-to-tr from-primary via-orange-400 to-yellow-300">
              <div className="w-full h-full rounded-full bg-[#111] p-0.5">
                <Avatar item={item} />
              </div>
            </div>
          ) : (
            <div className="w-full h-full rounded-full border-2 border-[#333] overflow-hidden">
              <Avatar item={item} />
            </div>
          )}

          {item.hasLive && (
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 z-10">
              <span className="flex items-center gap-0.5 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider border border-[#111]">
                <Radio className="h-2 w-2" /> CANLI
              </span>
            </div>
          )}
        </div>

        <span className="text-[11px] text-[#aaa] group-hover:text-white transition-colors max-w-[62px] truncate">
          {item.displayName || item.username}
        </span>
      </div>
    </Link>
  );
}

function Avatar({ item }: { item: StoryGroup }) {
  return item.avatarUrl ? (
    <img
      src={item.avatarUrl}
      className="w-full h-full rounded-full object-cover"
      alt={item.username}
    />
  ) : (
    <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-base">
      {item.username?.substring(0, 1).toUpperCase()}
    </div>
  );
}
