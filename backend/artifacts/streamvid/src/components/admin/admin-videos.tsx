import { useState } from "react";
import { useListVideos, useDeleteVideo, useUpdateVideo, useListCategories } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Video, Trash2, Edit2, Eye, EyeOff, Search, ChevronLeft, ChevronRight, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayerManager } from "./video-player-manager";

export function AdminVideos() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [playersVideoId, setPlayersVideoId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});

  const { data, isLoading } = useListVideos({ page, limit: 20 } as any);
  const { data: catsData } = useListCategories();
  const deleteMutation = useDeleteVideo();
  const updateMutation = useUpdateVideo();

  const videos = data?.videos ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleDelete = (id: number) => {
    if (!confirm("Bu videoyu silmek istediğine emin misin?")) return;
    deleteMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["videos"] }) });
  };

  const handleTogglePublish = (video: any) => {
    updateMutation.mutate({ id: video.id, data: { isPublished: !video.isPublished } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["videos"] }),
    });
  };

  const handleEdit = (video: any) => {
    setEditId(video.id);
    setEditData({ title: video.title, description: video.description, categoryId: video.categoryId, isPremium: video.isPremium, isPPV: video.isPPV, ppvPrice: video.ppvPrice });
  };

  const handleSave = () => {
    if (!editId) return;
    updateMutation.mutate({ id: editId, data: editData }, {
      onSuccess: () => { setEditId(null); queryClient.invalidateQueries({ queryKey: ["videos"] }); },
    });
  };

  if (playersVideoId) {
    return <VideoPlayerManager videoId={playersVideoId} onBack={() => setPlayersVideoId(null)} />;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Video className="h-5 w-5 text-primary" /> Video Yönetimi</h1>
        <span className="text-sm text-[#666]">{total} video</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Video ara..."
          className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({length: 5}).map((_, i) => <div key={i} className="h-14 bg-[#1e1e1e] rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#222] text-[#888] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Video</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Kategori</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">İzlenme</th>
                <th className="text-left px-4 py-3">Durum</th>
                <th className="text-right px-4 py-3">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {videos.filter(v => !search || v.title.toLowerCase().includes(search.toLowerCase())).map(video => (
                <tr key={video.id} className="hover:bg-[#1e1e1e] transition-colors">
                  {editId === video.id ? (
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input value={editData.title} onChange={e => setEditData((p: any) => ({...p, title: e.target.value}))} className="col-span-2 bg-[#252525] border border-[#333] rounded px-3 py-1.5 text-sm text-white" placeholder="Başlık" />
                        <textarea value={editData.description || ""} onChange={e => setEditData((p: any) => ({...p, description: e.target.value}))} className="col-span-2 bg-[#252525] border border-[#333] rounded px-3 py-1.5 text-sm text-white h-16 resize-none" placeholder="Açıklama" />
                        <select value={editData.categoryId || ""} onChange={e => setEditData((p: any) => ({...p, categoryId: e.target.value ? Number(e.target.value) : null}))} className="bg-[#252525] border border-[#333] rounded px-3 py-1.5 text-sm text-white">
                          <option value="">Kategori Seç</option>
                          {catsData?.categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm text-[#aaa]">
                            <input type="checkbox" checked={editData.isPremium || false} onChange={e => setEditData((p: any) => ({...p, isPremium: e.target.checked}))} />
                            Premium
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[#aaa]">
                            <input type="checkbox" checked={editData.isPPV || false} onChange={e => setEditData((p: any) => ({...p, isPPV: e.target.checked}))} />
                            PPV
                          </label>
                        </div>
                        <div className="col-span-2 flex gap-2 justify-end">
                          <button onClick={() => setEditId(null)} className="px-4 py-1.5 rounded text-sm bg-[#333] text-[#aaa] hover:bg-[#444]">İptal</button>
                          <button onClick={handleSave} className="px-4 py-1.5 rounded text-sm bg-primary text-white hover:bg-primary/90">Kaydet</button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {video.thumbnailUrl ? (
                            <img src={video.thumbnailUrl} className="w-12 h-8 object-cover rounded shrink-0" />
                          ) : (
                            <div className="w-12 h-8 bg-[#333] rounded shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-[#ddd] truncate max-w-[160px]">{video.title}</p>
                            <p className="text-xs text-[#555]">#{video.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-[#888]">{video.category?.name || "—"}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-[#888]">{video.viewCount?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full w-fit", video.isPublished ? "bg-green-900/40 text-green-400" : "bg-[#333] text-[#666]")}>
                            {video.isPublished ? "Yayında" : "Gizli"}
                          </span>
                          {video.isPremium && (
                            <span className="text-xs px-2 py-0.5 rounded-full w-fit bg-yellow-900/30 text-yellow-400">Premium</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setPlayersVideoId(video.id)} title="Oynatıcılar" className="p-1.5 rounded hover:bg-[#333] text-[#666] hover:text-primary transition-colors">
                            <Video className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => updateMutation.mutate({ id: video.id, data: { isPremium: !video.isPremium } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["videos"] }) })}
                            title={video.isPremium ? "Premium Kaldır" : "Premium Yap"}
                            className={cn("p-1.5 rounded hover:bg-[#333] transition-colors", video.isPremium ? "text-yellow-400" : "text-[#666] hover:text-yellow-400")}
                          >
                            <Crown className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleTogglePublish(video)} title={video.isPublished ? "Gizle" : "Yayınla"} className="p-1.5 rounded hover:bg-[#333] text-[#666] hover:text-yellow-400 transition-colors">
                            {video.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => handleEdit(video)} title="Düzenle" className="p-1.5 rounded hover:bg-[#333] text-[#666] hover:text-white transition-colors">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(video.id)} title="Sil" className="p-1.5 rounded hover:bg-red-900/30 text-[#666] hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-[#222] disabled:opacity-30 text-[#888]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-[#888]">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-[#222] disabled:opacity-30 text-[#888]">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
