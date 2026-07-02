import { AppLayout } from "@/components/layout/app-layout";
import { useParams, Link } from "wouter";
import { useGetPlaylist } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { ListVideo, Lock, Globe, Share2, Pencil, ChevronLeft, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PlaylistDetail() {
  const params = useParams();
  const playlistId = parseInt(params.id || "0");
  const { data: playlist, isLoading } = useGetPlaylist(playlistId, { query: { enabled: !!playlistId } });
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Bağlantı kopyalandı");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        {/* Breadcrumb */}
        <Link href="/playlists">
          <span className="flex items-center gap-1 text-sm text-muted-foreground hover:text-white transition-colors cursor-pointer w-fit">
            <ChevronLeft className="h-4 w-4" /> Oynatma Listeleri
          </span>
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-5 w-1/3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : !playlist ? (
          <div className="text-center py-24 text-muted-foreground">
            <ListVideo className="h-16 w-16 mx-auto opacity-20 mb-4" />
            <p className="font-medium text-lg">Oynatma listesi bulunamadı</p>
          </div>
        ) : (
          <>
            {/* Başlık + Eylemler */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-bold">{playlist.title}</h1>
                  <span className={cn(
                    "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium",
                    playlist.isPublic
                      ? "border-blue-700/40 bg-blue-900/20 text-blue-400"
                      : "border-border bg-muted text-muted-foreground"
                  )}>
                    {playlist.isPublic
                      ? <><Globe className="h-3 w-3" /> Herkese Açık</>
                      : <><Lock className="h-3 w-3" /> Gizli</>}
                  </span>
                </div>
                {playlist.description && (
                  <p className="text-muted-foreground mt-2 max-w-2xl">{playlist.description}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                  <span className="font-medium text-white">@{playlist.owner.username}</span>
                  <span>·</span>
                  <span>{playlist.videoCount} video</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleShare}>
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
                  {copied ? "Kopyalandı" : "Paylaş"}
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Pencil className="h-4 w-4" /> Düzenle
                </Button>
              </div>
            </div>

            {/* Thumbnail Banner (varsa) */}
            {playlist.thumbnailUrl && (
              <div className="w-full aspect-[4/1] rounded-2xl overflow-hidden border border-border">
                <img src={playlist.thumbnailUrl} alt={playlist.title} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Video Grid */}
            {playlist.videos.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground flex flex-col items-center">
                <ListVideo className="h-16 w-16 opacity-20 mb-4" />
                <p className="font-medium text-lg">Bu listede henüz video yok</p>
                <p className="text-sm mt-1">Video izlerken "Listeye Ekle" seçeneğini kullan</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Videolar
                  </h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{playlist.videos.length} video</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                  {playlist.videos.map((video, idx) => (
                    <div key={video.id} className="relative">
                      <div className="absolute -top-1 -left-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                        {idx + 1}
                      </div>
                      <VideoCard video={video} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
