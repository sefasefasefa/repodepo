import { AppLayout } from "@/components/layout/app-layout";
import { useGetBookmarks } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { Bookmark } from "lucide-react";

export default function Bookmarks() {
  const { data, isLoading } = useGetBookmarks({ query: { limit: 20 } });

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-primary" /> Bookmarks
          </h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {data?.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
            {data?.videos.length === 0 && (
              <div className="col-span-full text-center py-20 text-muted-foreground flex flex-col items-center">
                <Bookmark className="h-16 w-16 opacity-20 mb-4" />
                <p>You haven't bookmarked any videos.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}