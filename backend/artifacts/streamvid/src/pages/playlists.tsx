import { AppLayout } from "@/components/layout/app-layout";
import { useListPlaylists } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ListVideo, Plus, Lock, Globe, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function Playlists() {
  const { data: playlists, isLoading } = useListPlaylists();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [isPublic, setIsPublic]     = useState(false);
  const [menuOpen, setMenuOpen]     = useState<number | null>(null);

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-5">
        {/* Başlık */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListVideo className="h-6 w-6 text-primary" /> Oynatma Listelerim
          </h1>
          <Button onClick={() => setShowCreate(v => !v)} className="gap-2">
            <Plus className="h-4 w-4" /> Yeni Liste
          </Button>
        </div>

        {/* Yeni liste oluşturma formu */}
        {showCreate && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold">Yeni Oynatma Listesi</h2>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Liste Adı</label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Liste adını gir..."
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPublic(v => !v)}
                className={cn("w-10 h-5 rounded-full transition-all relative", isPublic ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", isPublic ? "left-5" : "left-0.5")} />
              </button>
              <span className="text-sm flex items-center gap-1.5">
                {isPublic ? <><Globe className="h-4 w-4 text-primary" /> Herkese açık</> : <><Lock className="h-4 w-4 text-muted-foreground" /> Gizli</>}
              </span>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={!newName.trim()}>Oluştur</Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setNewName(""); }}>İptal</Button>
            </div>
          </div>
        )}

        {/* Liste */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        ) : playlists?.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground flex flex-col items-center">
            <ListVideo className="h-16 w-16 opacity-20 mb-4" />
            <p className="font-medium text-lg">Henüz oynatma listen yok</p>
            <p className="text-sm mt-1">Yukarıdaki "Yeni Liste" butonuna tıkla</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {playlists?.map(playlist => (
              <div key={playlist.id} className="group relative cursor-pointer">
                {/* Menü butonu */}
                <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-black/60 hover:bg-black/80"
                    onClick={e => { e.preventDefault(); setMenuOpen(menuOpen === playlist.id ? null : playlist.id); }}
                  >
                    <MoreVertical className="h-3.5 w-3.5 text-white" />
                  </Button>
                  {menuOpen === playlist.id && (
                    <div className="absolute right-0 top-8 bg-popover border border-border rounded-lg shadow-xl z-20 overflow-hidden w-36">
                      <button className="flex items-center gap-2 px-3 py-2.5 w-full text-sm hover:bg-accent transition-colors">
                        <Pencil className="h-3.5 w-3.5" /> Düzenle
                      </button>
                      <button className="flex items-center gap-2 px-3 py-2.5 w-full text-sm text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" /> Sil
                      </button>
                    </div>
                  )}
                </div>

                <Link href={`/playlists/${playlist.id}`}>
                  <div>
                    <div className="aspect-video bg-secondary rounded-xl overflow-hidden relative mb-2 border border-border group-hover:border-primary/50 transition-colors">
                      {playlist.thumbnailUrl ? (
                        <img src={playlist.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <ListVideo className="h-10 w-10 text-muted-foreground opacity-50" />
                        </div>
                      )}
                      <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white border-l border-white/10">
                        <span className="font-bold text-xl">{playlist.videoCount}</span>
                        <ListVideo className="h-5 w-5 mt-1 opacity-80" />
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-1">{playlist.title}</h3>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                          {playlist.isPublic
                            ? <><Globe className="h-3 w-3" /> Herkese açık</>
                            : <><Lock className="h-3 w-3" /> Gizli</>}
                          <span>·</span>
                          <span>{playlist.videoCount} video</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
