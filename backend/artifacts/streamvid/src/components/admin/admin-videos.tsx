import { useState, useEffect, useRef } from "react";
import { useListVideos, useDeleteVideo, useUpdateVideo, useListCategories } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Video, Trash2, Edit2, Eye, EyeOff, Search, ChevronLeft, ChevronRight, ChevronDown,
  Crown, Plus, X, Loader2, Link, Image, Upload, Share2, Check,
  AlertCircle, PlayCircle, RefreshCw, ExternalLink, Grid3x3, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayerManager } from "./video-player-manager";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const EMPTY_FORM = {
  title: "", videoUrl: "", hlsUrl: "", thumbnailUrl: "", description: "",
  isPublished: true, isPremium: false, isPPV: false, ppvPrice: "", type: "video",
};

function AddVideoModal({ categories, onClose, onSuccess }: {
  categories: any[]; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"url" | "file">("url");
  const [uploading, setUploading] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [thumbnailStatus, setThumbnailStatus] = useState<null | "success" | "error">(null);
  const [thumbnailError, setThumbnailError] = useState("");
  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));
  const toggleCat = (id: number) => setSelectedCategoryIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError("");
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/video", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      set("videoUrl", data.url || data.videoUrl || "");
      if (!form.title) set("title", file.name.replace(/\.[^.]+$/, ""));
    } catch (e: any) { setError(e.message); } finally { setUploading(false); }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailUploading(true);
    setThumbnailStatus(null);
    setThumbnailError("");
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("thumbnail", file);
      const res = await fetch("/api/upload/thumbnail-image", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const url = data.url || data.thumbnailUrl || "";
      if (!url) throw new Error("Sunucu URL döndürmedi");
      set("thumbnailUrl", url);
      setThumbnailStatus("success");
    } catch (err: any) {
      setThumbnailStatus("error");
      setThumbnailError(err.message || "Yükleme başarısız");
    } finally {
      setThumbnailUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Başlık zorunludur."); return; }
    if (!form.videoUrl.trim()) { setError("Video URL zorunludur."); return; }
    setSaving(true); setError("");
    try {
      await apiFetch("/videos/create", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(), videoUrl: form.videoUrl.trim(),
          hlsUrl: form.hlsUrl.trim() || undefined, thumbnailUrl: form.thumbnailUrl.trim() || undefined,
          description: form.description.trim() || undefined,
          categoryId: selectedCategoryIds[0] || undefined,
          categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          isPublished: form.isPublished, isPremium: form.isPremium, isPPV: form.isPPV,
          ppvPrice: form.isPPV && form.ppvPrice ? Number(form.ppvPrice) : undefined,
          type: form.type,
        }),
      });
      onSuccess(); onClose();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#141414] border-b border-[#2a2a2a] px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-white flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Video Ekle</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#222] text-[#666] hover:text-white transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#888] mb-2 block font-medium uppercase tracking-wide">Video Kaynağı</label>
            <div className="flex rounded-lg border border-[#2a2a2a] overflow-hidden mb-3">
              <button type="button" onClick={() => setTab("url")} className={cn("flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors", tab === "url" ? "bg-primary/20 text-primary" : "text-[#666] hover:text-[#aaa]")}><Link className="h-3 w-3" /> URL ile</button>
              <button type="button" onClick={() => setTab("file")} className={cn("flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors", tab === "file" ? "bg-primary/20 text-primary" : "text-[#666] hover:text-[#aaa]")}><Upload className="h-3 w-3" /> Dosya Yükle</button>
            </div>
            {tab === "url" ? (
              <input value={form.videoUrl} onChange={e => set("videoUrl", e.target.value)} placeholder="https://example.com/video.mp4" className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
            ) : (
              <label className={cn("flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors", uploading ? "border-primary/50 bg-primary/5" : "border-[#2a2a2a] hover:border-primary/50 hover:bg-[#1a1a1a]")}>
                {uploading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <><Upload className="h-5 w-5 text-[#555]" /><span className="text-xs text-[#555]">Video dosyası seç (MP4, WebM...)</span></>}
                <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            )}
            {form.videoUrl && <p className="text-[11px] text-green-400 mt-1 truncate">✓ {form.videoUrl}</p>}
          </div>

          <div>
            <label className="text-xs text-[#888] mb-1.5 block font-medium">HLS URL <span className="text-[#555]">(isteğe bağlı)</span></label>
            <input value={form.hlsUrl} onChange={e => set("hlsUrl", e.target.value)} placeholder="https://example.com/stream.m3u8" className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-xs text-[#888] mb-1.5 block font-medium">Thumbnail</label>
            <div className="flex gap-2">
              <input value={form.thumbnailUrl} onChange={e => { set("thumbnailUrl", e.target.value); setThumbnailStatus(null); }} placeholder="https://example.com/thumb.jpg" className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
              <label className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors shrink-0",
                thumbnailUploading ? "border-primary/40 text-primary" :
                thumbnailStatus === "success" ? "border-green-600/50 text-green-400 bg-green-900/10" :
                thumbnailStatus === "error" ? "border-red-600/50 text-red-400 bg-red-900/10" :
                "border-[#2a2a2a] text-[#666] hover:text-white hover:border-[#444]"
              )}>
                {thumbnailUploading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Yükleniyor…</>
                  : thumbnailStatus === "success"
                  ? <><Check className="h-3.5 w-3.5" /> Yüklendi</>
                  : thumbnailStatus === "error"
                  ? <><AlertCircle className="h-3.5 w-3.5" /> Hata</>
                  : <><Image className="h-3.5 w-3.5" /> Yükle</>
                }
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} disabled={thumbnailUploading} />
              </label>
            </div>
            {thumbnailStatus === "error" && thumbnailError && (
              <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{thumbnailError}</p>
            )}
            {form.thumbnailUrl && <img src={form.thumbnailUrl} className="mt-2 h-16 w-28 object-cover rounded-lg border border-[#2a2a2a]" onError={e => (e.currentTarget.style.display = "none")} />}
          </div>

          <div>
            <label className="text-xs text-[#888] mb-1.5 block font-medium">Başlık <span className="text-red-400">*</span></label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Video başlığı" className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-xs text-[#888] mb-1.5 block font-medium">Açıklama</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Video açıklaması..." rows={3} className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary resize-none" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#888] font-medium">Kategori</label>
              {selectedCategoryIds.length > 0 && (
                <span className="text-[11px] text-primary/70">{selectedCategoryIds.length} seçildi</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c: any) => {
                const sel = selectedCategoryIds.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${sel ? "bg-primary text-white border-primary" : "bg-[#1e1e1e] text-[#888] border-[#2a2a2a] hover:border-primary/50 hover:text-white"}`}>
                    {c.name}
                  </button>
                );
              })}
              {categories.length === 0 && <span className="text-xs text-[#555]">Yükleniyor...</span>}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#888] mb-1.5 block font-medium">Tür</label>
            <select value={form.type} onChange={e => set("type", e.target.value)} className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
              <option value="video">Video</option>
              <option value="short">Short</option>
              <option value="live">Live VOD</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[["isPublished","Yayında"],["isPremium","Premium"],["isPPV","PPV"]].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-[#aaa] cursor-pointer">
                <input type="checkbox" checked={(form as any)[key]} onChange={e => set(key, e.target.checked)} className="accent-primary" />{label}
              </label>
            ))}
          </div>

          {form.isPPV && (
            <div>
              <label className="text-xs text-[#888] mb-1.5 block font-medium">PPV Fiyatı ($)</label>
              <input type="number" min="0" step="0.01" value={form.ppvPrice} onChange={e => set("ppvPrice", e.target.value)} placeholder="9.99" className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
            </div>
          )}

          {error && <div className="bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-[#888] text-sm hover:bg-[#1e1e1e] transition-colors">İptal</button>
            <button type="submit" disabled={saving || uploading} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Ekleniyor...</> : <><Plus className="h-4 w-4" />Video Ekle</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const EMPTY_EDIT = {
  title: "", description: "", videoUrl: "", hlsUrl: "", thumbnailUrl: "",
  categoryId: "" as string | number, isPremium: false, isPPV: false, ppvPrice: "",
  isPublished: true, type: "video",
};

// ── Distribution tab sub-component ──────────────────────────────────────────
function DistributionTab({ videoId }: { videoId: number }) {
  const [sites, setSites] = useState<any[]>([]);
  // siteId → latest CrossPostJob for this video
  const [siteJobs, setSiteJobs] = useState<Record<number, any>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<number | null>(null);
  const [newJobs, setNewJobs] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  const loadData = async () => {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [sitesRes, jobsRes] = await Promise.all([
        fetch("/api/cross-post/sites", { headers }).then(r => r.json()),
        fetch(`/api/cross-post/jobs?videoId=${videoId}`, { headers }).then(r => r.json()),
      ]);

      const list: any[] = sitesRes.sites ?? [];
      setSites(list);

      // En güncel job'u siteId bazında grupla
      const jobMap: Record<number, any> = {};
      for (const job of (jobsRes.jobs ?? [])) {
        const sid: number = job.siteId;
        if (!jobMap[sid]) jobMap[sid] = job;
      }
      setSiteJobs(jobMap);

      // Başarılı gönderilmemiş, etkin siteleri varsayılan seçili yap
      const sentSiteIds = new Set(
        Object.entries(jobMap)
          .filter(([, j]) => j.status === "success")
          .map(([id]) => Number(id))
      );
      setSelected(new Set(list.filter((s: any) => s.enabled && !sentSiteIds.has(s.id)).map((s: any) => s.id)));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [videoId]);

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleDelete = async (jobId: number, siteId: number) => {
    setDeletingJobId(jobId);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/cross-post/jobs/${jobId}/delete`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Silinemedi"); return; }
      // Silinen job'u state'den çıkar ve siteyi seçilebilir yap
      setSiteJobs(prev => { const next = { ...prev }; delete next[siteId]; return next; });
      setSelected(prev => new Set([...prev, siteId]));
      setNewJobs(null);
    } catch {
      setError("Sunucu hatası");
    } finally {
      setDeletingJobId(null);
    }
  };

  const dispatch = async () => {
    if (selected.size === 0) return;
    setDispatching(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/cross-post/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ videoId, siteIds: [...selected] }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Gönderilemedi"); return; }
      setNewJobs(d.jobs ?? []);
      // Gönderilen job'ları state'e ekle
      const updatedMap: Record<number, any> = { ...siteJobs };
      for (const job of (d.jobs ?? [])) {
        updatedMap[job.siteId] = job;
      }
      setSiteJobs(updatedMap);
      setSelected(new Set());
    } catch {
      setError("Sunucu hatası");
    } finally {
      setDispatching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-[#555]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /><span className="text-sm">Sağlayıcılar yükleniyor...</span>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <Share2 className="h-8 w-8 mx-auto text-[#333]" />
        <div className="space-y-1">
          <p className="text-sm text-[#555]">Henüz crosspost sitesi eklenmemiş.</p>
          <p className="text-xs text-[#444]">Admin paneli → Entegrasyonlar sekmesinden sağlayıcı ekle.</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("admin:goto", { detail: "integrations" }))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
        >
          <Link className="h-3 w-3" /> Entegrasyonlar'a Git
        </button>
      </div>
    );
  }

  const sentCount = Object.values(siteJobs).filter(j => j.status === "success").length;
  const selectableSites = sites.filter(s => !siteJobs[s.id] || siteJobs[s.id].status !== "success");

  return (
    <div className="space-y-3">
      {/* Son gönderim sonuçları */}
      {newJobs && newJobs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#888]">Son gönderim sonuçları:</p>
          {newJobs.map((job: any) => {
            const errMsg: string = job.responseText ?? job.response_text ?? "";
            return (
              <div key={job.id} className="bg-[#111] border border-[#222] rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#bbb] text-sm truncate">{job.siteName ?? job.site_name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    job.status === "success" ? "bg-green-400/10 text-green-400" :
                    job.status === "failed"  ? "bg-red-400/10 text-red-400" :
                    "bg-primary/10 text-primary"
                  }`}>
                    {job.status === "success" ? "✓ Başarılı" : job.status === "failed" ? "✕ Başarısız" : "⟳ Kuyrukta"}
                  </span>
                </div>
                {job.status === "failed" && errMsg && (
                  <p className="text-[11px] text-red-400/80 bg-red-900/10 rounded px-2 py-1 break-words">
                    {errMsg.slice(0, 300)}
                  </p>
                )}
                {job.status === "success" && (job.remoteUrl ?? job.remote_url) && (
                  <a href={job.remoteUrl ?? job.remote_url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline truncate block">
                    {job.remoteUrl ?? job.remote_url}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Özet */}
      {sentCount > 0 && (
        <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-lg px-3 py-2">
          <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
          <p className="text-xs text-green-300/80">{sentCount} sağlayıcıya daha önce başarıyla gönderildi.</p>
        </div>
      )}

      {/* Select all / clear — only for selectable sites */}
      {selectableSites.length > 0 && (
        <div className="flex items-center justify-between text-xs text-[#555]">
          <span>{selected.size} / {selectableSites.length} gönderilebilir sağlayıcı seçili</span>
          <div className="flex gap-3">
            <button onClick={() => setSelected(new Set(selectableSites.map((s: any) => s.id)))} className="hover:text-white transition-colors">Tümünü Seç</button>
            <span>·</span>
            <button onClick={() => setSelected(new Set())} className="hover:text-red-400 transition-colors">Temizle</button>
          </div>
        </div>
      )}

      {/* Site list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {sites.map((site: any) => {
          const job = siteJobs[site.id];
          const isSent = job?.status === "success";
          const isFailed = job?.status === "failed";
          const isPending = job?.status === "pending" || job?.status === "running";
          const isSelected = selected.has(site.id);

          if (isSent) {
            // Başarıyla gönderilmiş — seçilemez, "Gönderildi" göster + Sil butonu
            return (
              <div
                key={site.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-green-900/10 border-green-700/30 text-left"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 opacity-70"
                  style={{ backgroundColor: site.providerColor ?? site.provider_color ?? "#555" }}
                >
                  {(site.providerLetter ?? site.provider_letter ?? site.name?.substring(0, 2).toUpperCase())}
                </div>
                <span className="flex-1 text-sm font-medium text-[#aaa]">{site.name}</span>
                {job.remoteUrl && (
                  <a href={job.remoteUrl} target="_blank" rel="noopener noreferrer"
                    className="text-primary opacity-60 hover:opacity-100 shrink-0"
                    title="Bağlantıyı aç">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <span className="text-[11px] font-semibold text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                  <Check className="h-2.5 w-2.5" /> Gönderildi
                </span>
                <button
                  onClick={() => handleDelete(job.id, site.id)}
                  disabled={deletingJobId === job.id}
                  title="Kaydı sil — tekrar gönderilebilir hale getirir (yalnızca yükleme başarısız olduysa kullan)"
                  className="shrink-0 p-1.5 rounded-lg bg-red-900/20 text-red-400/60 hover:text-red-400 hover:bg-red-900/40 disabled:opacity-40 transition-colors"
                >
                  {deletingJobId === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            );
          }

          // Başarısız / bekleyen / gönderilmemiş — seçilebilir
          return (
            <button
              key={site.id}
              onClick={() => toggle(site.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                isSelected
                  ? "bg-primary/8 border-primary/30"
                  : isFailed
                  ? "bg-red-900/10 border-red-700/30 hover:border-red-600/50"
                  : isPending
                  ? "bg-blue-900/10 border-blue-700/30"
                  : "bg-[#161616] border-[#222] hover:border-[#333]"
              }`}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
                style={{ backgroundColor: site.providerColor ?? site.provider_color ?? "#555" }}
              >
                {(site.providerLetter ?? site.provider_letter ?? site.name?.substring(0, 2).toUpperCase())}
              </div>
              <span className={`flex-1 text-sm font-medium ${isSelected ? "text-white" : "text-[#aaa]"}`}>
                {site.name}
              </span>
              {isFailed && (
                <span className="text-[10px] text-red-400 border border-red-700/40 px-1.5 py-0.5 rounded shrink-0">Başarısız</span>
              )}
              {isPending && (
                <span className="text-[10px] text-blue-400 border border-blue-700/40 px-1.5 py-0.5 rounded shrink-0">Kuyrukta</span>
              )}
              {!site.enabled && !job && (
                <span className="text-[10px] text-[#555] border border-[#2a2a2a] px-1.5 py-0.5 rounded">Devre dışı</span>
              )}
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                isSelected ? "bg-primary border-primary" : "border-[#444] bg-transparent"
              }`}>
                {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      {selectableSites.length > 0 && selected.size === 0 && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-300/80">Hiçbir sağlayıcı seçili değil — dağıtım yapılmaz.</p>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {selectableSites.length > 0 && (
        <button
          onClick={dispatch}
          disabled={dispatching || selected.size === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {dispatching
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor…</>
            : <><Share2 className="h-4 w-4" /> {selected.size} Sağlayıcıya Dağıt</>}
        </button>
      )}

      {selectableSites.length === 0 && sentCount === sites.length && (
        <p className="text-center text-xs text-[#555] py-2">Tüm sağlayıcılara gönderildi. Tekrar göndermek için ilgili kaydı silin.</p>
      )}
    </div>
  );
}

// ── Edit panel with tabs ──────────────────────────────────────────────────────
function EditVideoPanel({ video, categories, onClose, onSave }: {
  video: any; categories: any[]; onClose: () => void; onSave: (data: any) => void;
}) {
  const [activeTab, setActiveTab] = useState<"edit" | "distribution">("edit");
  const [form, setForm] = useState({
    title: video.title || "", description: video.description || "",
    videoUrl: video.videoUrl || "", hlsUrl: video.hlsUrl || "",
    thumbnailUrl: video.thumbnailUrl || "",
    isPremium: !!video.isPremium, isPPV: !!video.isPPV,
    ppvPrice: video.ppvPrice ? String(video.ppvPrice) : "",
    isPublished: !!video.isPublished, type: video.type || "video",
  });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(() => {
    if (Array.isArray(video.categoryIds) && video.categoryIds.length > 0) return video.categoryIds.map(Number);
    if (video.categoryId) return [Number(video.categoryId)];
    return [];
  });
  const toggleEditCat = (id: number) => setSelectedCategoryIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const [uploading, setUploading] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbStatus, setThumbStatus] = useState<null | "success" | "error">(null);
  const [thumbError, setThumbError] = useState("");
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  // ── cloud.mail.ru indirme durumu ─────────────────────────────────────────
  const [dlStatus, setDlStatus] = useState<string | null>(null);
  const [dlPct, setDlPct]       = useState(0);
  const dlPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCloudMail = form.videoUrl.includes('cloud.mail.ru/public/');
  const isLocalVideo = form.videoUrl.startsWith('/media/');

  const stopPoll = () => {
    if (dlPollRef.current) { clearInterval(dlPollRef.current); dlPollRef.current = null; }
  };

  const pollStatus = () => {
    stopPoll();
    dlPollRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/videos/${video.id}/fetch-status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await res.json();
        setDlStatus(d.status);
        setDlPct(d.percent ?? 0);
        if (d.isLocal || (d.status && d.status.startsWith('error')) || d.status === 'done') {
          stopPoll();
          if (d.isLocal && d.videoUrl) {
            set("videoUrl", d.videoUrl);
          }
        }
      } catch { stopPoll(); }
    }, 1500);
  };

  const startDownload = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/videos/${video.id}/fetch-from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const d = await res.json();
      setDlStatus(d.status ?? 'pending');
      setDlPct(0);
      pollStatus();
    } catch { setDlStatus('error'); }
  };

  useEffect(() => () => stopPoll(), []);

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setThumbUploading(true);
    setThumbStatus(null);
    setThumbError("");
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData(); fd.append("thumbnail", file);
      const res = await fetch("/api/upload/thumbnail-image", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const url = data.url || data.thumbnailUrl || "";
      if (!url) throw new Error("Sunucu URL döndürmedi");
      set("thumbnailUrl", url);
      setThumbStatus("success");
    } catch (err: any) {
      setThumbStatus("error");
      setThumbError(err.message || "Yükleme başarısız");
    } finally {
      setThumbUploading(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
      {/* Tab header */}
      <div className="flex items-center border-b border-[#2a2a2a]">
        <button
          onClick={() => setActiveTab("edit")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
            activeTab === "edit"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-[#666] hover:text-[#aaa]"
          }`}
        >
          <Edit2 className="h-3 w-3" /> Düzenle
        </button>
        <button
          onClick={() => setActiveTab("distribution")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
            activeTab === "distribution"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-[#666] hover:text-[#aaa]"
          }`}
        >
          <Share2 className="h-3 w-3" /> Dağıtım
        </button>
        <div className="flex-1" />
        <button onClick={onClose} className="p-2 mr-1 rounded hover:bg-[#2a2a2a] text-[#555] hover:text-white transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "edit" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] text-[#666] mb-1 block">Başlık</label>
                <input value={form.title} onChange={e => set("title", e.target.value)} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] text-[#666] mb-1 block">Açıklama</label>
                <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary resize-none" />
              </div>

              <div>
                <label className="text-[11px] text-[#666] mb-1 block">Video URL</label>
                <input value={form.videoUrl} onChange={e => set("videoUrl", e.target.value)} placeholder="https://..." className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                {/* cloud.mail.ru indirme butonu */}
                {isCloudMail && !isLocalVideo && (
                  <div className="mt-2 space-y-1.5">
                    {(!dlStatus || dlStatus === 'done') && (
                      <button
                        type="button"
                        onClick={startDownload}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                      >
                        <Upload className="h-3 w-3" /> Sunucuya İndir
                      </button>
                    )}
                    {(dlStatus === 'pending' || dlStatus === 'downloading') && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-blue-300">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>İndiriliyor… {dlPct > 0 ? `${dlPct}%` : ''}</span>
                        </div>
                        {dlPct > 0 && (
                          <div className="w-full h-1.5 bg-[#333] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${dlPct}%` }} />
                          </div>
                        )}
                      </div>
                    )}
                    {dlStatus && dlStatus.startsWith('error') && (
                      <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> İndirme başarısız. Tekrar deneyin.</p>
                    )}
                  </div>
                )}
                {isLocalVideo && (
                  <p className="mt-1 text-[11px] text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> Sunucuda saklanıyor — crosspost için hazır</p>
                )}
              </div>

              <div>
                <label className="text-[11px] text-[#666] mb-1 block">HLS URL</label>
                <input value={form.hlsUrl} onChange={e => set("hlsUrl", e.target.value)} placeholder="https://...m3u8" className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] text-[#666] mb-1 block">Thumbnail URL</label>
                <div className="flex gap-2">
                  <input value={form.thumbnailUrl} onChange={e => { set("thumbnailUrl", e.target.value); setThumbStatus(null); }} placeholder="https://...jpg" className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                  <label className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors shrink-0",
                    thumbUploading ? "border-primary/40 text-primary" :
                    thumbStatus === "success" ? "border-green-600/50 text-green-400 bg-green-900/10" :
                    thumbStatus === "error" ? "border-red-600/50 text-red-400 bg-red-900/10" :
                    "border-[#333] text-[#666] hover:text-white hover:border-[#444]"
                  )}>
                    {thumbUploading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Yükleniyor…</>
                      : thumbStatus === "success"
                      ? <><Check className="h-3.5 w-3.5" /> Yüklendi</>
                      : thumbStatus === "error"
                      ? <><AlertCircle className="h-3.5 w-3.5" /> Hata</>
                      : <><Image className="h-3.5 w-3.5" /> Yükle</>
                    }
                    <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} disabled={thumbUploading} />
                  </label>
                </div>
                {thumbStatus === "error" && thumbError && (
                  <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{thumbError}</p>
                )}
                {form.thumbnailUrl && <img src={form.thumbnailUrl} className="mt-1.5 h-12 w-20 object-cover rounded border border-[#333]" onError={e => (e.currentTarget.style.display = "none")} />}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-[#666]">Kategori</label>
                  {selectedCategoryIds.length > 0 && (
                    <span className="text-[10px] text-primary/70">{selectedCategoryIds.length} seçildi</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c: any) => {
                    const sel = selectedCategoryIds.includes(Number(c.id));
                    return (
                      <button key={c.id} type="button" onClick={() => toggleEditCat(Number(c.id))}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${sel ? "bg-primary text-white border-primary" : "bg-[#252525] text-[#777] border-[#333] hover:border-primary/50 hover:text-white"}`}>
                        {c.name}
                      </button>
                    );
                  })}
                  {categories.length === 0 && <span className="text-xs text-[#555]">Yükleniyor...</span>}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#666] mb-1 block">Tür</label>
                <select value={form.type} onChange={e => set("type", e.target.value)} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
                  <option value="video">Video</option>
                  <option value="short">Short</option>
                  <option value="live">Live VOD</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 py-1">
              {[["isPublished","Yayında"],["isPremium","Premium"],["isPPV","PPV"]].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-[#aaa] cursor-pointer select-none">
                  <input type="checkbox" checked={(form as any)[key]} onChange={e => set(key, e.target.checked)} className="accent-primary w-3.5 h-3.5" />{label}
                </label>
              ))}
              {form.isPPV && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#666]">Fiyat ($)</span>
                  <input type="number" min="0" step="0.01" value={form.ppvPrice} onChange={e => set("ppvPrice", e.target.value)} className="w-20 bg-[#252525] border border-[#333] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary" />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-[#252525] text-[#888] text-sm hover:bg-[#2a2a2a]">İptal</button>
              <button onClick={() => onSave({
                title: form.title, description: form.description,
                videoUrl: form.videoUrl || undefined, hlsUrl: form.hlsUrl || undefined,
                thumbnailUrl: form.thumbnailUrl || undefined,
                categoryId: selectedCategoryIds[0] ?? null,
                categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : [],
                isPremium: form.isPremium, isPPV: form.isPPV,
                ppvPrice: form.isPPV && form.ppvPrice ? Number(form.ppvPrice) : undefined,
                isPublished: form.isPublished, type: form.type,
              })} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
                Kaydet
              </button>
            </div>
          </div>
        ) : (
          <DistributionTab videoId={video.id} />
        )}
      </div>
    </div>
  );
}

// ── Categories management tab ────────────────────────────────────────────────
function CategoriesTab() {
  const queryClient = useQueryClient();
  const { data: rawData, isLoading, refetch } = useListCategories();
  const cats: any[] = Array.isArray(rawData) ? rawData : (rawData as any)?.categories ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSlug, setAddSlug] = useState("");
  const [addIcon, setAddIcon] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");

  const [editCat, setEditCat] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    refetch();
  };

  const handleAdd = async () => {
    if (!addName.trim()) { setAddErr("İsim zorunludur"); return; }
    setAdding(true); setAddErr("");
    try {
      await apiFetch("/categories/create", {
        method: "POST",
        body: JSON.stringify({ name: addName.trim(), slug: addSlug.trim() || undefined, iconUrl: addIcon.trim() || undefined }),
      });
      setShowAdd(false); setAddName(""); setAddSlug(""); setAddIcon("");
      invalidate();
    } catch (e: any) { setAddErr(e.message); } finally { setAdding(false); }
  };

  const openEdit = (cat: any) => {
    setEditCat(cat); setEditName(cat.name); setEditSlug(cat.slug || ""); setEditIcon(cat.iconUrl || ""); setEditErr("");
  };

  const handleSave = async () => {
    if (!editName.trim()) { setEditErr("İsim zorunludur"); return; }
    setSaving(true); setEditErr("");
    try {
      await apiFetch(`/categories/${editCat.id}/update`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim(), slug: editSlug.trim() || undefined, iconUrl: editIcon.trim() || undefined }),
      });
      setEditCat(null); invalidate();
    } catch (e: any) { setEditErr(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await apiFetch(`/categories/${id}/delete`, { method: "DELETE" });
      setDeleteConfirm(null); invalidate();
    } catch (e: any) {} finally { setDeleting(null); }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-primary" /> Kategoriler
          </h2>
          <p className="text-xs text-[#555] mt-0.5">{cats.length} kategori</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0">
          <Plus className="h-3.5 w-3.5" /> Kategori Ekle
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Yeni Kategori</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">İsim *</label>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Kategori adı" className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">Slug <span className="text-[#555]">(opsiyonel)</span></label>
              <input value={addSlug} onChange={e => setAddSlug(e.target.value)} placeholder="otomatik-olusturulur" className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">İkon URL <span className="text-[#555]">(opsiyonel)</span></label>
              <input value={addIcon} onChange={e => setAddIcon(e.target.value)} placeholder="https://..." className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
            </div>
          </div>
          {addErr && <p className="text-red-400 text-xs">{addErr}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAdd(false); setAddErr(""); }} className="px-4 py-2 rounded-lg border border-[#333] text-[#888] text-sm hover:bg-[#222]">İptal</button>
            <button onClick={handleAdd} disabled={adding} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5">
              {adding ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Ekleniyor…</> : <><Plus className="h-3.5 w-3.5" />Ekle</>}
            </button>
          </div>
        </div>
      )}

      {/* Category list */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-[#1e1e1e] rounded-xl animate-pulse" />)}</div>
      ) : cats.length === 0 ? (
        <div className="py-16 text-center text-[#555] bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
          <Grid3x3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Henüz kategori yok. "Kategori Ekle" ile başlayın.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cats.map(cat => (
            <div key={cat.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#333] transition-colors">
              {/* Edit form */}
              {editCat?.id === cat.id && (
                <div className="p-3 border-b border-[#2a2a2a] space-y-3 bg-[#141414]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-[#666] mb-1 block">İsim *</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#666] mb-1 block">Slug</label>
                      <input value={editSlug} onChange={e => setEditSlug(e.target.value)} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#666] mb-1 block">İkon URL</label>
                      <input value={editIcon} onChange={e => setEditIcon(e.target.value)} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                  {editErr && <p className="text-red-400 text-xs">{editErr}</p>}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditCat(null)} className="px-3 py-1.5 rounded-lg border border-[#333] text-[#888] text-xs hover:bg-[#222]">İptal</button>
                    <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Kaydet
                    </button>
                  </div>
                </div>
              )}

              {/* Row */}
              <div className="flex items-center gap-3 p-3">
                {cat.iconUrl ? (
                  <img src={cat.iconUrl} className="w-10 h-10 rounded-lg object-cover shrink-0" onError={e => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center shrink-0">
                    <Grid3x3 className="h-4 w-4 text-[#444]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#e0e0e0] text-sm">{cat.name}</p>
                  <p className="text-[11px] text-[#555]">/{cat.slug} · {cat.videoCount ?? 0} video</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => openEdit(cat)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-[#222] text-[#777] hover:text-white hover:bg-[#2a2a2a] transition-colors">
                    <Edit2 className="h-3 w-3" /> <span className="hidden sm:inline">Düzenle</span>
                  </button>
                  {deleteConfirm === cat.id ? (
                    <span className="flex items-center gap-1">
                      <span className="text-[11px] text-red-400">Sil?</span>
                      <button onClick={() => handleDelete(cat.id)} disabled={deleting === cat.id} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50">
                        {deleting === cat.id ? "…" : "Evet"}
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1.5 rounded-lg text-[11px] bg-[#222] text-[#666] hover:bg-[#2a2a2a]">Hayır</button>
                    </span>
                  ) : (
                    <button onClick={() => setDeleteConfirm(cat.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-[#222] text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminVideos() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"videos" | "categories">("videos");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [playersVideoId, setPlayersVideoId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [distributing, setDistributing] = useState<number | null>(null);
  const [distributeResult, setDistributeResult] = useState<Record<number, string>>({});
  const [bulkFetching, setBulkFetching] = useState(false);
  const [bulkFetchResult, setBulkFetchResult] = useState<string | null>(null);
  const [thumbGenerating, setThumbGenerating] = useState(false);
  const [thumbResult, setThumbResult] = useState<{ message: string; queued: number; skipped: number; reasons: string[] } | null>(null);
  const [jobSummary, setJobSummary] = useState<Record<string, any[]>>({});
  const [dlStatuses, setDlStatuses] = useState<Record<number, { status: string | null; percent: number; isLocal: boolean; title: string; errorMessage?: string | null }>>({});
  const [showDlPanel, setShowDlPanel] = useState(true);
  const [retrying, setRetrying] = useState<Record<number, boolean>>({});

  const { data, isLoading } = useListVideos({ page, limit: 20 } as any);
  const { data: catsData } = useListCategories();
  const deleteMutation = useDeleteVideo();
  const updateMutation = useUpdateVideo();

  // Crosspost durum özeti — sayfa değişince yükle + pending/running varsa her 3sn polling
  const fetchJobSummary = () => {
    const token = localStorage.getItem("token");
    fetch("/api/cross-post/jobs/summary", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => { if (d.summary) setJobSummary(d.summary); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchJobSummary();
  }, [page]);

  // Pending/running job varsa polling
  useEffect(() => {
    const hasPendingOrRunning = Object.values(jobSummary).some(jobs =>
      (jobs as any[]).some(j => j.status === "pending" || j.status === "running")
    );
    if (!hasPendingOrRunning) return;
    const interval = setInterval(fetchJobSummary, 3000);
    return () => clearInterval(interval);
  }, [jobSummary]);

  const videos = data?.videos ?? [];

  // ── İndirme durumu polling ────────────────────────────────────────
  useEffect(() => {
    if (!videos.length) return;
    const token = localStorage.getItem("token");

    // Harici URL'li videoları bul
    const externalVideos = videos.filter((v: any) => {
      const url = v.hlsUrl || v.videoUrl || "";
      return url.startsWith("http://") || url.startsWith("https://");
    });
    if (!externalVideos.length) return;

    const fetchAll = async () => {
      const updates: Record<number, { status: string | null; percent: number; isLocal: boolean; title: string; errorMessage?: string | null }> = {};
      await Promise.all(externalVideos.map(async (v: any) => {
        try {
          const res = await fetch(`/api/videos/${v.id}/fetch-status`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) return;
          const d = await res.json();
          updates[v.id] = { status: d.status ?? null, percent: d.percent ?? 0, isLocal: d.isLocal ?? false, title: v.title, errorMessage: d.errorMessage ?? null };
        } catch { /* sessizce geç */ }
      }));
      setDlStatuses(prev => ({ ...prev, ...updates }));
    };

    fetchAll();
    const interval = setInterval(() => {
      // Hâlâ devam eden indirme varsa polling sürdür
      const hasActive = Object.values(dlStatuses).some(s => s.status === "downloading" || s.status === "pending");
      if (hasActive || !Object.keys(dlStatuses).length) fetchAll();
    }, 3000);
    return () => clearInterval(interval);
  }, [videos.length, page]);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const categories = Array.isArray(catsData) ? catsData : (catsData as any)?.categories ?? [];

  const refetchAll = () => queryClient.invalidateQueries();

  const handleDelete = (id: number) => {
    if (deleteMutation.isPending) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => { setDeleteConfirm(null); refetchAll(); },
    });
  };

  const handleSave = (video: any, data: any) => {
    updateMutation.mutate({ id: video.id, data }, {
      onSuccess: () => { setEditId(null); refetchAll(); },
    });
  };

  const handleToggle = (video: any, field: string, value: any) => {
    updateMutation.mutate({ id: video.id, data: { [field]: value } }, {
      onSuccess: refetchAll,
    });
  };

  const handleDistribute = async (video: any) => {
    setDistributing(video.id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/videos/${video.id}/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const d = await res.json().catch(() => ({}));
      setDistributeResult(p => ({ ...p, [video.id]: d.message || "Dağıtıldı" }));
      setTimeout(() => setDistributeResult(p => { const n = { ...p }; delete n[video.id]; return n; }), 4000);
    } catch (e: any) {
      setDistributeResult(p => ({ ...p, [video.id]: "Hata: " + e.message }));
    } finally {
      setDistributing(null);
    }
  };

  if (playersVideoId) {
    return <VideoPlayerManager videoId={playersVideoId} onBack={() => setPlayersVideoId(null)} />;
  }

  const filtered = videos.filter(v => !search || v.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 max-w-5xl">
      {showAddModal && (
        <AddVideoModal categories={categories} onClose={() => setShowAddModal(false)} onSuccess={() => { refetchAll(); setTimeout(fetchJobSummary, 1500); setTimeout(fetchJobSummary, 4000); }} />
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("videos")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "videos" ? "bg-primary text-white" : "text-[#666] hover:text-[#aaa]")}
        >
          <Video className="h-4 w-4" /> Videolar
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "categories" ? "bg-primary text-white" : "text-[#666] hover:text-[#aaa]")}
        >
          <Grid3x3 className="h-4 w-4" /> Kategoriler
        </button>
      </div>

      {/* Categories tab */}
      {activeTab === "categories" && <CategoriesTab />}

      {/* Video tab content below */}
      {activeTab === "videos" && <>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold flex items-center gap-2"><Video className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" /><span className="truncate">Video Yönetimi</span></h1>
          <p className="text-xs text-[#555] mt-0.5">{total} video · Sayfa {page}/{Math.max(1, totalPages)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={async () => {
              if (bulkFetching) return;
              setBulkFetching(true);
              setBulkFetchResult(null);
              try {
                const token = localStorage.getItem("token");
                const res = await fetch("/api/videos/bulk-fetch", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                });
                const d = await res.json().catch(() => ({}));
                setBulkFetchResult(d.message || "İndirme başlatıldı");
                setTimeout(() => setBulkFetchResult(null), 8000);
              } catch {
                setBulkFetchResult("Hata oluştu");
              } finally {
                setBulkFetching(false);
              }
            }}
            disabled={bulkFetching}
            title="Tüm harici URL'li videoları sunucuya indir"
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-600/30 transition-colors shrink-0 disabled:opacity-50"
          >
            {bulkFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{bulkFetching ? "İndiriliyor..." : "Tümünü İndir"}</span>
          </button>
          <button
            onClick={async () => {
              if (thumbGenerating) return;
              setThumbGenerating(true);
              setThumbResult(null);
              try {
                const token = localStorage.getItem("token");
                const res = await fetch("/api/videos/bulk-generate-thumbnails", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                });
                const d = await res.json().catch(() => ({}));
                setThumbResult({
                  message: d.message || "Thumbnail üretimi başlatıldı",
                  queued: d.queued ?? 0,
                  skipped: d.skipped ?? 0,
                  reasons: d.skipped_reasons ?? [],
                });
                setTimeout(() => setThumbResult(null), 15000);
              } catch {
                setThumbResult({ message: "Sunucu hatası oluştu", queued: 0, skipped: 0, reasons: [] });
              } finally {
                setThumbGenerating(false);
              }
            }}
            disabled={thumbGenerating}
            title="Thumbnail'i olmayan tüm videolar için otomatik üret"
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/30 transition-colors shrink-0 disabled:opacity-50"
          >
            {thumbGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{thumbGenerating ? "Üretiliyor..." : "Thumbnail Üret"}</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0">
            <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Video </span>Ekle
          </button>
        </div>
      </div>
      {bulkFetchResult && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-2.5 text-blue-300 text-xs font-medium">
          ✓ {bulkFetchResult}
        </div>
      )}
      {thumbResult && (
        <div className={`rounded-lg px-4 py-3 text-xs font-medium space-y-1 ${
          thumbResult.queued > 0
            ? "bg-emerald-900/20 border border-emerald-500/30 text-emerald-300"
            : thumbResult.skipped > 0
            ? "bg-amber-900/20 border border-amber-500/30 text-amber-300"
            : "bg-emerald-900/20 border border-emerald-500/30 text-emerald-300"
        }`}>
          <div>{thumbResult.queued > 0 ? "✓" : "⚠"} {thumbResult.message}</div>
          {thumbResult.reasons.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[11px] opacity-80 list-disc list-inside">
              {thumbResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* İndirme Durumu Paneli */}
      {Object.keys(dlStatuses).length > 0 && (
        <div className="bg-[#0d1f35] border border-blue-500/20 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowDlPanel(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-300">Sunucu İndirme Durumu</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                {Object.values(dlStatuses).filter(s => s.status === "downloading" || s.status === "pending").length} aktif
                {" · "}
                {Object.values(dlStatuses).filter(s => s.isLocal).length}/{Object.keys(dlStatuses).length} tamamlandı
              </span>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-blue-400 transition-transform", !showDlPanel && "-rotate-90")} />
          </button>
          {showDlPanel && (
            <div className="border-t border-blue-500/10 divide-y divide-blue-500/10">
              {Object.entries(dlStatuses).map(([id, info]) => {
                const isActive = info.status === "downloading" || info.status === "pending";
                const isDone = info.isLocal || info.status === "done";
                const isError = info.status?.startsWith("error");
                return (
                  <div key={id} className="px-4 py-2.5 space-y-1.5">
                    {/* Üst satır: ikon + başlık + durum rozeti */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0">
                        {isDone
                          ? <Check className="h-4 w-4 text-green-400" />
                          : isError
                            ? <AlertCircle className="h-4 w-4 text-red-400" />
                            : isActive
                              ? <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                              : <Download className="h-4 w-4 text-[#555]" />}
                      </div>
                      <p className="text-xs font-medium text-white truncate flex-1 min-w-0">{info.title}</p>
                      {/* Durum rozeti */}
                      {isDone
                        ? <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-bold border border-green-500/20 shrink-0">Yerel ✓</span>
                        : isActive
                          ? <span className="text-[10px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full font-bold border border-blue-500/20 shrink-0">İndiriliyor</span>
                          : !isError
                            ? <span className="text-[10px] bg-[#1a1a1a] text-[#555] px-2 py-0.5 rounded-full font-bold border border-[#2a2a2a] shrink-0">Bekleniyor</span>
                            : null}
                    </div>
                    {/* İlerleme çubuğu */}
                    {isActive && (
                      <div className="flex items-center gap-2 pl-6">
                        <div className="flex-1 h-1 bg-blue-900/50 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${info.status === "pending" ? 3 : info.percent}%` }} />
                        </div>
                        <span className="text-[10px] text-blue-400 font-bold tabular-nums shrink-0">
                          {info.status === "pending" ? "Başlıyor..." : `${info.percent}%`}
                        </span>
                      </div>
                    )}
                    {/* Hata satırı: mesaj + Hata rozeti + Tekrar butonu */}
                    {isError && (
                      <div className="flex items-center gap-2 pl-6 flex-wrap">
                        {info.errorMessage && (
                          <p className="text-[10px] text-red-400/80 truncate flex-1 min-w-0" title={info.errorMessage}>
                            {info.errorMessage.length > 60 ? info.errorMessage.slice(0, 60) + "…" : info.errorMessage}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-bold border border-red-500/20">Hata</span>
                          <button
                            disabled={retrying[Number(id)]}
                            onClick={async () => {
                              setRetrying(p => ({ ...p, [Number(id)]: true }));
                              try {
                                const token = localStorage.getItem("token");
                                await fetch(`/api/videos/${id}/fetch-from-url`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                });
                                setDlStatuses(p => ({ ...p, [Number(id)]: { ...p[Number(id)], status: "pending", percent: 0, errorMessage: null } }));
                              } finally {
                                setRetrying(p => ({ ...p, [Number(id)]: false }));
                              }
                            }}
                            title="Yeniden dene"
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25 transition-colors disabled:opacity-50"
                          >
                            {retrying[Number(id)] ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                            Tekrar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Video ara..." className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
        {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"><X className="h-3.5 w-3.5" /></button>}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-[#1e1e1e] rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[#555] bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
          <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? `"${search}" için sonuç bulunamadı` : 'Henüz video yok. "Video Ekle" ile ekleyebilirsiniz.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(video => (
            <div key={video.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#333] transition-colors">

              {/* Edit form — inline above card */}
              {editId === video.id && (
                <div className="p-3 border-b border-[#2a2a2a]">
                  <EditVideoPanel
                    video={video}
                    categories={categories}
                    onClose={() => setEditId(null)}
                    onSave={(data) => handleSave(video, data)}
                  />
                </div>
              )}

              {/* Main card row */}
              <div className="flex gap-3 p-3 items-start">
                {/* Thumbnail */}
                <div className="shrink-0">
                  {video.thumbnailUrl
                    ? <img src={video.thumbnailUrl} className="w-20 h-[52px] sm:w-24 sm:h-[60px] object-cover rounded-lg" />
                    : <div className="w-20 h-[52px] sm:w-24 sm:h-[60px] bg-[#2a2a2a] rounded-lg flex items-center justify-center"><Video className="h-5 w-5 text-[#444]" /></div>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="font-semibold text-[#e0e0e0] text-sm leading-tight line-clamp-1 flex-1">{video.title}</p>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", video.isPublished ? "border-green-800/50 text-green-400 bg-green-900/20" : "border-[#333] text-[#666] bg-[#222]")}>{video.isPublished ? "Yayında" : "Gizli"}</span>
                      {video.isPremium && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-800/50 text-yellow-400 bg-yellow-900/20">Premium</span>}
                      {video.isPPV && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-blue-800/50 text-blue-400 bg-blue-900/20">PPV</span>}
                      {video.type !== "video" && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[#333] text-[#888] bg-[#222]">{video.type}</span>}
                      {/* İndirme durumu rozeti */}
                      {(() => {
                        const dl = dlStatuses[video.id];
                        if (!dl) return null;
                        if (dl.isLocal)
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-green-700/40 text-green-400 bg-green-900/20">
                              <Check className="h-2.5 w-2.5" /> Yerel
                            </span>
                          );
                        if (dl.status === "downloading")
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-blue-700/40 text-blue-400 bg-blue-900/20">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> {dl.percent}%
                            </span>
                          );
                        if (dl.status === "pending")
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-700/40 text-yellow-400 bg-yellow-900/20">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Başlıyor
                            </span>
                          );
                        if (dl.status?.startsWith("error"))
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-red-700/40 text-red-400 bg-red-900/20">
                              <AlertCircle className="h-2.5 w-2.5" /> Hata
                            </span>
                          );
                        return null;
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[#555] flex-wrap">
                    <span>#{video.id}</span>
                    {video.category && <span className="text-[#666]">{video.category.name}</span>}
                    <span>{video.viewCount?.toLocaleString() || 0} izlenme</span>
                    <span>{video.likeCount || 0} beğeni</span>
                    {video.players?.length > 0 && (
                      <span className="text-primary/70 flex items-center gap-0.5">
                        <Share2 className="h-2.5 w-2.5" />{video.players.length} kaynak
                      </span>
                    )}
                  </div>

                  {/* Crosspost durum badge'leri */}
                  {jobSummary[String(video.id)]?.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {jobSummary[String(video.id)].map((job: any, i: number) => {
                        const statusColor =
                          job.status === 'success'  ? 'bg-green-900/40 border-green-700/50 text-green-400' :
                          job.status === 'failed'   ? 'bg-red-900/40 border-red-700/50 text-red-400' :
                          job.status === 'running'  ? 'bg-blue-900/40 border-blue-700/50 text-blue-400' :
                                                     'bg-[#222] border-[#333] text-[#666]';
                        const dot =
                          job.status === 'success'  ? '●' :
                          job.status === 'failed'   ? '●' :
                          job.status === 'running'  ? '◌' : '○';
                        return (
                          <span
                            key={i}
                            title={`${job.provider}: ${job.status}${job.remoteUrl ? ' — ' + job.remoteUrl : ''}`}
                            className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium leading-none",
                              statusColor
                            )}
                          >
                            <span className="text-[8px]">{dot}</span>
                            {job.provider}
                            {job.remoteUrl && (
                              <a
                                href={job.remoteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="opacity-60 hover:opacity-100"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Distribution result toast */}
                  {distributeResult[video.id] && (
                    <p className={cn("text-[11px] mt-1 flex items-center gap-1", distributeResult[video.id].startsWith("Hata") ? "text-red-400" : "text-green-400")}>
                      {distributeResult[video.id].startsWith("Hata") ? <AlertCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      {distributeResult[video.id]}
                    </p>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-1 px-3 pb-3 overflow-x-auto scrollbar-none">
                {/* Edit */}
                <button onClick={() => setEditId(editId === video.id ? null : video.id)} title="Düzenle" className={cn("flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0", editId === video.id ? "bg-primary/20 text-primary" : "bg-[#222] text-[#777] hover:text-white hover:bg-[#2a2a2a]")}>
                  <Edit2 className="h-3 w-3" /> <span className="hidden sm:inline">Düzenle</span>
                </button>

                {/* Publish toggle */}
                <button onClick={() => handleToggle(video, "isPublished", !video.isPublished)} title={video.isPublished ? "Gizle" : "Yayınla"} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#777] hover:text-white hover:bg-[#2a2a2a] transition-colors shrink-0">
                  {video.isPublished ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span className="hidden sm:inline">{video.isPublished ? "Gizle" : "Yayınla"}</span>
                </button>

                {/* Premium toggle */}
                <button onClick={() => handleToggle(video, "isPremium", !video.isPremium)} title={video.isPremium ? "Premium Kaldır" : "Premium Yap"} className={cn("flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0", video.isPremium ? "bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50" : "bg-[#222] text-[#777] hover:text-yellow-400 hover:bg-[#2a2a2a]")}>
                  <Crown className="h-3 w-3" /> <span className="hidden sm:inline">{video.isPremium ? "Premium ✓" : "Premium"}</span>
                </button>

                {/* Players / sources */}
                <button onClick={() => setPlayersVideoId(video.id)} title="Oynatıcılar" className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#777] hover:text-primary hover:bg-[#2a2a2a] transition-colors shrink-0">
                  <PlayCircle className="h-3 w-3" /> <span className="hidden sm:inline">Oynatıcılar</span>
                </button>

                {/* Distribute */}
                <button onClick={() => handleDistribute(video)} disabled={distributing === video.id} title="Sağlayıcılara Dağıt" className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#777] hover:text-green-400 hover:bg-green-900/20 disabled:opacity-50 transition-colors shrink-0">
                  {distributing === video.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                  <span className="hidden sm:inline">Dağıt</span>
                </button>

                {/* Video URL link */}
                {(video.videoUrl || video.hlsUrl) && (
                  <a href={video.videoUrl || video.hlsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#777] hover:text-white hover:bg-[#2a2a2a] transition-colors shrink-0">
                    <ExternalLink className="h-3 w-3" /> <span className="hidden sm:inline">URL</span>
                  </a>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Delete */}
                {deleteConfirm === video.id ? (
                  <span className="flex items-center gap-1">
                    <span className="text-[11px] text-red-400">Sil?</span>
                    <button onClick={() => handleDelete(video.id)} disabled={deleteMutation.isPending} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50">
                      {deleteMutation.isPending ? "…" : "Evet"}
                    </button>
                    <button onClick={() => setDeleteConfirm(null)} disabled={deleteMutation.isPending} className="px-2.5 py-1.5 rounded-lg text-[11px] bg-[#222] text-[#666] hover:bg-[#2a2a2a]">Hayır</button>
                  </span>
                ) : (
                  <button onClick={() => setDeleteConfirm(video.id)} title="Sil" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3">
          <span className="text-xs text-[#555]">{total} video · {page}/{totalPages} sayfa</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-[#222] disabled:opacity-30 text-[#888] transition-colors"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm text-[#888] font-medium">{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-[#222] disabled:opacity-30 text-[#888] transition-colors"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
