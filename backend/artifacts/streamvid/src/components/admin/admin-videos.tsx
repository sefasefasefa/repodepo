import { useState, useEffect } from "react";
import { useListVideos, useDeleteVideo, useUpdateVideo, useListCategories } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Video, Trash2, Edit2, Eye, EyeOff, Search, ChevronLeft, ChevronRight,
  Crown, Plus, X, Loader2, Link, Image, Upload, Share2, Check,
  AlertCircle, PlayCircle, RefreshCw, ExternalLink,
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
  categoryId: "", isPublished: true, isPremium: false, isPPV: false, ppvPrice: "", type: "video",
};

function AddVideoModal({ categories, onClose, onSuccess }: {
  categories: any[]; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"url" | "file">("url");
  const [uploading, setUploading] = useState(false);
  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

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
    setUploading(true); setError("");
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("thumbnail", file);
      const res = await fetch("/api/upload/thumbnail-image", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      set("thumbnailUrl", data.url || data.thumbnailUrl || "");
    } catch (e: any) { setError(e.message); } finally { setUploading(false); }
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
          categoryId: form.categoryId ? Number(form.categoryId) : undefined,
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
              <input value={form.thumbnailUrl} onChange={e => set("thumbnailUrl", e.target.value)} placeholder="https://example.com/thumb.jpg" className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
              <label className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors shrink-0", uploading ? "border-primary/40 text-primary" : "border-[#2a2a2a] text-[#666] hover:text-white hover:border-[#444]")}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />} Yükle
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} disabled={uploading} />
              </label>
            </div>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] mb-1.5 block font-medium">Kategori</label>
              <select value={form.categoryId} onChange={e => set("categoryId", e.target.value)} className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
                <option value="">Seç</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1.5 block font-medium">Tür</label>
              <select value={form.type} onChange={e => set("type", e.target.value)} className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
                <option value="video">Video</option>
                <option value="short">Short</option>
                <option value="live">Live VOD</option>
              </select>
            </div>
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [result, setResult] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/cross-post/sites", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => {
        const list = d.sites ?? [];
        setSites(list);
        setSelected(new Set(list.filter((s: any) => s.enabled).map((s: any) => s.id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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
      setResult(d.jobs ?? []);
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

  if (result) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-white">{result.length} siteye gönderildi</p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {result.map((job: any) => (
            <div key={job.id} className="flex items-center justify-between bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-sm">
              <span className="text-[#bbb] truncate">{job.siteName ?? job.site_name}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                job.status === "success" ? "bg-green-400/10 text-green-400" :
                job.status === "failed"  ? "bg-red-400/10 text-red-400" :
                "bg-primary/10 text-primary"
              }`}>
                {job.status === "success" ? "✓ Başarılı" : job.status === "failed" ? "✕ Başarısız" : "⟳ Kuyrukta"}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setResult(null)}
          className="w-full py-2 rounded-lg bg-[#222] border border-[#333] text-sm text-[#888] hover:text-white transition-colors"
        >
          Tekrar Dağıt
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Select all / clear */}
      <div className="flex items-center justify-between text-xs text-[#555]">
        <span>{selected.size} / {sites.length} sağlayıcı seçili</span>
        <div className="flex gap-3">
          <button onClick={() => setSelected(new Set(sites.map((s: any) => s.id)))} className="hover:text-white transition-colors">Tümünü Seç</button>
          <span>·</span>
          <button onClick={() => setSelected(new Set())} className="hover:text-red-400 transition-colors">Temizle</button>
        </div>
      </div>

      {/* Site list */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {sites.map((site: any) => {
          const isSelected = selected.has(site.id);
          return (
            <button
              key={site.id}
              onClick={() => toggle(site.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                isSelected
                  ? "bg-primary/8 border-primary/30"
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
              {!site.enabled && (
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

      {selected.size === 0 && (
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

      <button
        onClick={dispatch}
        disabled={dispatching || selected.size === 0}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {dispatching
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor…</>
          : <><Share2 className="h-4 w-4" /> {selected.size} Sağlayıcıya Dağıt</>}
      </button>
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
    categoryId: video.categoryId || "",
    isPremium: !!video.isPremium, isPPV: !!video.isPPV,
    ppvPrice: video.ppvPrice ? String(video.ppvPrice) : "",
    isPublished: !!video.isPublished, type: video.type || "video",
  });
  const [uploading, setUploading] = useState(false);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData(); fd.append("thumbnail", file);
      const res = await fetch("/api/upload/thumbnail-image", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      set("thumbnailUrl", data.url || data.thumbnailUrl || "");
    } catch {} finally { setUploading(false); }
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
              </div>

              <div>
                <label className="text-[11px] text-[#666] mb-1 block">HLS URL</label>
                <input value={form.hlsUrl} onChange={e => set("hlsUrl", e.target.value)} placeholder="https://...m3u8" className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] text-[#666] mb-1 block">Thumbnail URL</label>
                <div className="flex gap-2">
                  <input value={form.thumbnailUrl} onChange={e => set("thumbnailUrl", e.target.value)} placeholder="https://...jpg" className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                  <label className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[#333] text-[#666] hover:text-white text-xs cursor-pointer shrink-0">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} disabled={uploading} />
                  </label>
                </div>
                {form.thumbnailUrl && <img src={form.thumbnailUrl} className="mt-1.5 h-12 w-20 object-cover rounded border border-[#333]" onError={e => (e.currentTarget.style.display = "none")} />}
              </div>

              <div>
                <label className="text-[11px] text-[#666] mb-1 block">Kategori</label>
                <select value={form.categoryId} onChange={e => set("categoryId", e.target.value)} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
                  <option value="">—</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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
                categoryId: form.categoryId ? Number(form.categoryId) : null,
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

export function AdminVideos() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [playersVideoId, setPlayersVideoId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [distributing, setDistributing] = useState<number | null>(null);
  const [distributeResult, setDistributeResult] = useState<Record<number, string>>({});
  const [jobSummary, setJobSummary] = useState<Record<string, any[]>>({});

  const { data, isLoading } = useListVideos({ page, limit: 20 } as any);
  const { data: catsData } = useListCategories();
  const deleteMutation = useDeleteVideo();
  const updateMutation = useUpdateVideo();

  // Crosspost durum özeti
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/cross-post/jobs/summary", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => { if (d.summary) setJobSummary(d.summary); })
      .catch(() => {});
  }, [page]);

  const videos = data?.videos ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const categories = catsData?.categories ?? [];

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
        <AddVideoModal categories={categories} onClose={() => setShowAddModal(false)} onSuccess={refetchAll} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Video className="h-5 w-5 text-primary" /> Video Yönetimi</h1>
          <p className="text-xs text-[#555] mt-0.5">{total} video · Sayfa {page}/{Math.max(1, totalPages)}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0">
          <Plus className="h-3.5 w-3.5" /> Video Ekle
        </button>
      </div>

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
              <div className="flex items-center gap-1 px-3 pb-3 flex-wrap">
                {/* Edit */}
                <button onClick={() => setEditId(editId === video.id ? null : video.id)} title="Düzenle" className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors", editId === video.id ? "bg-primary/20 text-primary" : "bg-[#222] text-[#777] hover:text-white hover:bg-[#2a2a2a]")}>
                  <Edit2 className="h-3 w-3" /> <span className="hidden sm:inline">Düzenle</span>
                </button>

                {/* Publish toggle */}
                <button onClick={() => handleToggle(video, "isPublished", !video.isPublished)} title={video.isPublished ? "Gizle" : "Yayınla"} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#777] hover:text-white hover:bg-[#2a2a2a] transition-colors">
                  {video.isPublished ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span className="hidden sm:inline">{video.isPublished ? "Gizle" : "Yayınla"}</span>
                </button>

                {/* Premium toggle */}
                <button onClick={() => handleToggle(video, "isPremium", !video.isPremium)} title={video.isPremium ? "Premium Kaldır" : "Premium Yap"} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors", video.isPremium ? "bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50" : "bg-[#222] text-[#777] hover:text-yellow-400 hover:bg-[#2a2a2a]")}>
                  <Crown className="h-3 w-3" /> <span className="hidden sm:inline">{video.isPremium ? "Premium ✓" : "Premium"}</span>
                </button>

                {/* Players / sources */}
                <button onClick={() => setPlayersVideoId(video.id)} title="Oynatıcılar" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#777] hover:text-primary hover:bg-[#2a2a2a] transition-colors">
                  <PlayCircle className="h-3 w-3" /> <span className="hidden sm:inline">Oynatıcılar</span>
                </button>

                {/* Distribute */}
                <button onClick={() => handleDistribute(video)} disabled={distributing === video.id} title="Sağlayıcılara Dağıt" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#777] hover:text-green-400 hover:bg-green-900/20 disabled:opacity-50 transition-colors">
                  {distributing === video.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                  <span className="hidden sm:inline">Dağıt</span>
                </button>

                {/* Video URL link */}
                {(video.videoUrl || video.hlsUrl) && (
                  <a href={video.videoUrl || video.hlsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#222] text-[#777] hover:text-white hover:bg-[#2a2a2a] transition-colors">
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
    </div>
  );
}
