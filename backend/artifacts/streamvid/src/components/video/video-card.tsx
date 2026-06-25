import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Video } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";

interface VideoCardProps {
  video: Video;
}

export function VideoCard({ video }: VideoCardProps) {
  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  return (
    <div className="flex flex-col gap-3 group">
      <Link href={`/videos/${video.id}`}>
        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer">
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary/50 group-hover:bg-secondary transition-colors">
              <Play className="h-10 w-10 text-muted-foreground opacity-50" />
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-xs font-medium text-white backdrop-blur-sm">{formatDuration(video.duration)}</div>
          {video.isPremium && <div className="absolute top-2 right-2"><Badge variant="default" className="bg-primary text-primary-foreground border-none">Premium</Badge></div>}
        </div>
      </Link>
      <div className="flex gap-3 items-start">
        <Link href={`/creators/${video.creator.id}`}>
          <Avatar className="h-9 w-9 mt-0.5 cursor-pointer border border-border/50">
            <AvatarImage src={video.creator.avatarUrl || ""} alt={video.creator.username} />
            <AvatarFallback>{video.creator.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-col overflow-hidden">
          <Link href={`/videos/${video.id}`}>
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 hover:text-primary transition-colors cursor-pointer" title={video.title}>{video.title}</h3>
          </Link>
          <Link href={`/creators/${video.creator.id}`}>
            <p className="text-xs text-muted-foreground mt-1 hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">{video.creator.displayName || video.creator.username}{video.creator.isVerified && <span className="w-3 h-3 bg-primary rounded-full inline-flex items-center justify-center"><span className="text-[8px] text-primary-foreground font-bold">✓</span></span>}</p>
          </Link>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><span>{formatViews(video.viewCount)} views</span><span>•</span><span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span></p>
        </div>
      </div>
    </div>
  );
}