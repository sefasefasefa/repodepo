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

  return (
    <div className="flex flex-col gap-2 group">
      <Link href={`/videos/${video.id}`}>
        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer touch-manipulation">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary/50 group-hover:bg-secondary transition-colors">
              <Play className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground opacity-50" />
            </div>
          )}
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
          <Link href={`/videos/${video.id}`}>
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
