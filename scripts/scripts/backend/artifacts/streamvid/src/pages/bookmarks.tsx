import { AppLayout } from "@/components/layout/app-layout";
import { useGetBookmarks } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { Bookmark, FolderPlus, Grid2x2, List, Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COLLECTIONS = [
  { id: "all", label: "Tümü", icon: "📚" },
  { id: "fav", label: "Favoriler", icon: "❤️" },
  { id: "later", label: "Sonra İzle", icon: "🕐" },
  { id: "top", label: "En İyiler", icon: "⭐" },
];

type ViewMode = "grid" | "list";

export default function Bookmarks() {
  const { data, isLoading } = useGetBookmarks({ query: { limit: 40 } });
  const [activeCol, setActiveCol] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSearch, setShowSearch] = useState(false);

  const videos = data?.videos ?? [];
  const filtered = videos.filter(v =>
    !search || (v as any).title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-5">
        {/* Başlık */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-primary" /> Kaydedilenler
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowSearch(v => !v)}>
              {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid2x2 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <FolderPlus className="h-4 w-4" /> Koleksiyon Oluştur
            </Button>
          </div>
        </div>

        {/* Arama */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Kaydedilenlerde ara..."
              className="pl-9"
              autoFocus
            />
          </div>
        )}

        {/* Koleksiyonlar */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {COLLECTIONS.map(col => (
            <button
              key={col.id}
              onClick={() => setActiveCol(col.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all shrink-0",
                activeCol === col.id
                  ? "bg-primary border-primary text-white"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              )}
            >
              <span>{col.icon}</span> {col.label}
              {col.id === "all" && (
                <span className="bg-white/10 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                  {videos.length}
                </span>
              )}
            </button>
          ))}
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border border-dashed border-border text-muted-foreground hover:border-primary/40 transition-all shrink-0">
            <FolderPlus className="h-3.5 w-3.5" /> Yeni Koleksiyon
          </button>
        </div>

        {/* İçerik */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground flex flex-col items-center">
            <Bookmark className="h-16 w-16 opacity-20 mb-4" />
            {search ? (
              <>
                <p className="font-medium text-lg">"{search}" bulunamadı</p>
                <Button variant="ghost" className="mt-3" onClick={() => setSearch("")}>Aramayı Temizle</Button>
              </>
            ) : (
              <>
                <p className="font-medium text-lg">Henüz kaydedilen video yok</p>
                <p className="text-sm mt-1">Video izlerken yer imi ikonuna tıkla</p>
              </>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {filtered.map(video => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(video => (
              <div key={video.id} className="flex gap-4 bg-card border border-border rounded-xl p-3 hover:border-primary/30 transition-colors cursor-pointer group">
                <div className="w-40 aspect-video rounded-lg overflow-hidden shrink-0 bg-muted">
                  {(video as any).thumbnailUrl && (
                    <img src={(video as any).thumbnailUrl} alt={(video as any).title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  )}
                </div>
                <div className="flex-1 min-w-0 py-1">
                  <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                    {(video as any).title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{(video as any).creator?.username}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{(video as any).viewCount?.toLocaleString()} görüntülenme</span>
                    <span>•</span>
                    {(() => { const d = (video as any).duration; if (!d || d <= 0) return null; const h = Math.floor(d/3600), m = Math.floor((d%3600)/60), s = Math.floor(d%60); return <span>{h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`}</span>; })()}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
