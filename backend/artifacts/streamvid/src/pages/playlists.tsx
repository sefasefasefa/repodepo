import { AppLayout } from "@/components/layout/app-layout";
import { useListPlaylists, useCreatePlaylist, useDeletePlaylist } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ListVideo, Plus, Lock, Globe, MoreVertical, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function DeleteDialog({ name, onConfirm, onClose, loading }: { name: string; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-6 max-w-xs w-full shadow-2xl">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20 shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Listeyi Sil</h3>
            <p className="text-xs text-[#777]">
              <span className="text-white font-semibold">"{name}"</span> listesi silinecek. Bu işlem geri alınamaz.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onConfirm} disabled={loading} variant="destructive" className="flex-1 gap-1.5 h-9 text-sm">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Sil
          </Button>
          <Button onClick={onClose} disabled={loading} variant="outline" className="flex-1 border-[#333] text-[#aaa] hover:text-white h-9 text-sm">
            İptal
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Playlists() {
  const { data: rawData, isLoading } = useListPlaylists();
  const { mutate: createPlaylist, isPending: creating } = useCreatePlaylist();
  const { mutate: deletePlaylist, isPending: deleting } = useDeletePlaylist();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  const list: any[] = (rawData as any)?.playlists ?? (Array.isArray(rawData) ? rawData : []);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createPlaylist(
      { title: newName.trim(), isPublic } as any,
      {
        onSuccess: () => {
          toast({ title: "Liste oluşturuldu", description: `"${newName}" listeniz hazır.` });
          queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
          setShowCreate(false);
          setNewName("");
          setIsPublic(false);
        },
        onError: () => {
          toast({ title: "Hata", description: "Liste oluşturulamadı.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deletePlaylist(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: "Liste silindi", description: `"${deleteTarget.title}" başarıyla silindi.` });
        queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
        setDeleteTarget(null);
      },
      onError: () => {
        toast({ title: "Hata", description: "Silme işlemi başarısız.", variant: "destructive" });
        setDeleteTarget(null);
      },
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListVideo className="h-6 w-6 text-primary" /> Oynatma Listelerim
          </h1>
          <Button onClick={() => setShowCreate(v => !v)} className="gap-2 bg-primary hover:bg-primary/90 text-white">
            <Plus className="h-4 w-4" /> Yeni Liste
          </Button>
        </div>

        {showCreate && (
          <div className="bg-[#161616] border border-[#222] rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-white">Yeni Oynatma Listesi</h2>
            <div className="space-y-1.5">
              <label className="text-xs text-[#666] font-medium">Liste Adı</label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Liste adını gir..."
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                className="bg-[#111] border-[#333] text-white placeholder:text-[#444] focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPublic(v => !v)}
                className={cn("w-10 h-5 rounded-full transition-all relative shrink-0", isPublic ? "bg-primary" : "bg-[#333]")}
              >
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", isPublic ? "left-5" : "left-0.5")} />
              </button>
              <span className="text-sm flex items-center gap-1.5 text-[#aaa]">
                {isPublic
                  ? <><Globe className="h-4 w-4 text-primary" /> Herkese açık</>
                  : <><Lock className="h-4 w-4 text-[#555]" /> Gizli</>
                }
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 text-white gap-2"
                disabled={!newName.trim() || creating}
                onClick={handleCreate}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creating ? "Oluşturuluyor..." : "Oluştur"}
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setNewName(""); }} className="text-[#666] hover:text-white">
                İptal
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl bg-[#161616]" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center">
            <ListVideo className="h-16 w-16 text-[#222] mb-4" />
            <p className="font-medium text-lg text-[#666]">Henüz oynatma listen yok</p>
            <p className="text-sm mt-1 text-[#444]">Yukarıdaki "Yeni Liste" butonuna tıkla</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {list.map((playlist: any) => (
              <div key={playlist.id} className="group relative">
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
                    <div className="absolute right-0 top-8 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg shadow-xl z-20 overflow-hidden w-36">
                      <button
                        className="flex items-center gap-2 px-3 py-2.5 w-full text-sm text-red-400 hover:bg-red-900/10 transition-colors"
                        onClick={e => { e.preventDefault(); setMenuOpen(null); setDeleteTarget({ id: playlist.id, title: playlist.title }); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Sil
                      </button>
                    </div>
                  )}
                </div>

                <Link href={`/playlists/${playlist.id}`}>
                  <div>
                    <div className="aspect-video bg-[#161616] rounded-xl overflow-hidden relative mb-2 border border-[#222] group-hover:border-primary/50 transition-colors">
                      {playlist.thumbnailUrl ? (
                        <img src={playlist.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt={playlist.title} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#111]">
                          <ListVideo className="h-10 w-10 text-[#333]" />
                        </div>
                      )}
                      <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white border-l border-white/10">
                        <span className="font-bold text-xl">{playlist.videoCount ?? 0}</span>
                        <ListVideo className="h-5 w-5 mt-1 opacity-80" />
                      </div>
                    </div>
                    <h3 className="font-bold text-sm text-white group-hover:text-primary transition-colors line-clamp-1">{playlist.title}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#555]">
                      {playlist.isPublic ? <><Globe className="h-3 w-3" /> Herkese açık</> : <><Lock className="h-3 w-3" /> Gizli</>}
                      <span>·</span>
                      <span>{playlist.videoCount ?? 0} video</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.title}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </AppLayout>
  );
}
