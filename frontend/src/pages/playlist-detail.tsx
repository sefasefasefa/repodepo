import { AppLayout } from "@/components/layout/app-layout";
import { useParams } from "wouter";
import { useGetPlaylist } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { ListVideo } from "lucide-react";

export default function PlaylistDetail() {
  const params = useParams();
  const playlistId = parseInt(params.id || "0");
  const { data: playlist, isLoading } = useGetPlaylist(playlistId, { query: { enabled: !!playlistId } });

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : !playlist ? (
          <p>Playlist not found</p>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
                <ListVideo className="h-8 w-8 text-primary" /> {playlist.title}
              </h1>
              {playlist.description && <p className="text-muted-foreground">{playlist.description}</p>}
              <p className="text-sm mt-2 text-muted-foreground">
                Created by {playlist.owner.username} • {playlist.videoCount} videos
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 mt-8">
              {playlist.videos.map(video => (
                <VideoCard key={video.id} video={video} />
              ))}
              {playlist.videos.length === 0 && (
                <p className="col-span-full text-center py-10 text-muted-foreground">No videos in this playlist.</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}