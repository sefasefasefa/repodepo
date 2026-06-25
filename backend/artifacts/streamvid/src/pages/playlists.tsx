import { AppLayout } from "@/components/layout/app-layout";
import { useListPlaylists } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ListVideo } from "lucide-react";
import { Link } from "wouter";

export default function Playlists() {
  const { data: playlists, isLoading } = useListPlaylists();

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListVideo className="h-6 w-6 text-primary" /> My Playlists
          </h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {playlists?.map(playlist => (
              <Link key={playlist.id} href={`/playlists/${playlist.id}`}>
                <div className="group cursor-pointer">
                  <div className="aspect-video bg-secondary rounded-xl overflow-hidden relative mb-2 border border-border group-hover:border-primary/50 transition-colors">
                    {playlist.thumbnailUrl ? (
                      <img src={playlist.thumbnailUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <ListVideo className="h-10 w-10 text-muted-foreground opacity-50" />
                      </div>
                    )}
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white border-l border-white/10">
                      <span className="font-bold text-xl">{playlist.videoCount}</span>
                      <ListVideo className="h-5 w-5 mt-1 opacity-80" />
                    </div>
                  </div>
                  <h3 className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-1">{playlist.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {playlist.isPublic ? "Public" : "Private"} • {playlist.videoCount} videos
                  </p>
                </div>
              </Link>
            ))}
            {playlists?.length === 0 && (
              <p className="col-span-full text-center py-10 text-muted-foreground">You haven't created any playlists yet.</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}