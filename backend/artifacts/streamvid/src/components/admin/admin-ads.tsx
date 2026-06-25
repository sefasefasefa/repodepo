import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Megaphone, Eye, MousePointer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const AD_TYPES = ["banner", "video", "popup", "overlay", "preroll", "sidebar"];
const AD_CATEGORIES = ["genel", "18+", "casino", "google_ads", "affiliate", "crypto", "fashion", "diger"];
const AD_POSITIONS = [
  { value: "home_top", label: "Ana Sayfa Üst" },
  { value: "home_mid", label: "Ana Sayfa Orta" },
  { value: "home_bottom", label: "Ana Sayfa Alt" },
  { value: "sidebar", label: "Sidebar" },
  { value: "video_preroll", label: "Video Öncesi" },
  { value: "video_overlay", label: "Video Üstü" },
  { value: "video_postroll", label: "Video Sonrası" },
  { value: "search_top", label: "Arama Üstü" },
  { value: "profile_banner", label: "Profil Banner" },
];

const EMPTY_AD = { name: "", type: "banner", category: "genel", position: "home_top", imageUrl: "", videoUrl: "", targetUrl: "", scriptCode: "", dailyBudget: "", totalBudget: "", startsAt: "", endsAt: "" };

export function AdminAds() {
  const { token } = useAuth() as any;
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_AD });

  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/ads?active=all");
    const d = await r.json();
    setAds(d.ads || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.targetUrl) { alert("Ad adı ve hedef URL zorunlu"); return; }
    if (editId) {
      await fetch(`/api/ads/${editId}`, { method: "PATCH", headers, body: JSON.stringify(form) });
    } else {
      await fetch("/api/ads", { method: "POST", headers, body: JSON.stringify(form) });
    }
    setShowForm(false); setEditId(null); setForm({ ...EMPTY_AD }); load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu reklamı silmek istediğine emin misin?")) return;
    await fetch(`/api/ads/${id}`, { method: "DELETE", headers });
    load();
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    await fetch(`/api/ads/${id}`, { method: "PATCH", headers, body: JSON.stringify({ isActive: !isActive }) });
    load();
  };

  const handleEdit = (ad: any) => {
    setForm({ name: ad.name, type: ad.type, category: ad.category, position: ad.position, imageUrl: ad.imageUrl || "", videoUrl: ad.videoUrl || "", targetUrl: ad.targetUrl, scriptCode: ad.scriptCode || "", dailyBudget: ad.dailyBudget || "", totalBudget: ad.totalBudget || "", startsAt: ad.startsAt || "", endsAt: ad.endsAt || "" });
    setEditId(ad.id);
    setShowForm(true);
  };

  const ctr = (ad: any) => ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Reklam Yönetimi</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...EMPTY_AD }); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Reklam Ekle
        </button>
      </div>

      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 text-sm text-[#888] space-y-1">
        <p className="text-[#ccc] font-medium">Reklam Konumları ve Türleri</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {AD_POSITIONS.map(p => (
            <div key={p.value} className="flex items-center gap-2 text-xs text-[#666]">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />{p.label}
              <span className="text-[#444]">({p.value})</span>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="bg-[#1e1e1e] border border-primary/30 rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-sm">{editId ? "Reklamı Düzenle" : "Yeni Reklam"}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs text-[#777] block mb-1">Reklam Adı *</label>
              <input value={form.name} onChange={e => setForm((p: any) => ({...p, name: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" placeholder="Reklam adı" />
            </div>
            <div>
              <label className="text-xs text-[#777] block mb-1">Tür</label>
              <select value={form.type} onChange={e => setForm((p: any) => ({...p, type: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white">
                {AD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#777] block mb-1">Kategori</label>
              <select value={form.category} onChange={e => setForm((p: any) => ({...p, category: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white">
                {AD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#777] block mb-1">Konum</label>
              <select value={form.position} onChange={e => setForm((p: any) => ({...p, position: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white">
                {AD_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-[#777] block mb-1">Hedef URL *</label>
              <input value={form.targetUrl} onChange={e => setForm((p: any) => ({...p, targetUrl: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-[#777] block mb-1">Görsel URL (banner için)</label>
              <input value={form.imageUrl} onChange={e => setForm((p: any) => ({...p, imageUrl: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-[#777] block mb-1">JavaScript / Embed Kodu (Google Ads, 3rd party vb.)</label>
              <textarea value={form.scriptCode} onChange={e => setForm((p: any) => ({...p, scriptCode: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white h-20 resize-none font-mono text-xs" placeholder='<script async src="https://..."></script>' />
            </div>
            <div>
              <label className="text-xs text-[#777] block mb-1">Günlük Bütçe ($)</label>
              <input type="number" value={form.dailyBudget} onChange={e => setForm((p: any) => ({...p, dailyBudget: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-[#777] block mb-1">Toplam Bütçe ($)</label>
              <input type="number" value={form.totalBudget} onChange={e => setForm((p: any) => ({...p, totalBudget: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-[#777] block mb-1">Başlangıç Tarihi</label>
              <input type="datetime-local" value={form.startsAt} onChange={e => setForm((p: any) => ({...p, startsAt: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-[#777] block mb-1">Bitiş Tarihi</label>
              <input type="datetime-local" value={form.endsAt} onChange={e => setForm((p: any) => ({...p, endsAt: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-1.5 rounded text-sm bg-[#333] text-[#aaa] hover:bg-[#444]">İptal</button>
            <button onClick={handleSubmit} className="px-4 py-1.5 rounded text-sm bg-primary text-white hover:bg-primary/90">{editId ? "Güncelle" : "Ekle"}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({length:3}).map((_,i) => <div key={i} className="h-16 bg-[#1e1e1e] rounded-lg animate-pulse" />)}</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12 text-[#555]">
          <Megaphone className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>Henüz reklam eklenmedi</p>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#222] text-[#888] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Reklam</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Konum</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">İstatistik</th>
                <th className="text-left px-4 py-3">Durum</th>
                <th className="text-right px-4 py-3">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {ads.map(ad => (
                <tr key={ad.id} className="hover:bg-[#1e1e1e] transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-[#ddd]">{ad.name}</p>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-xs text-[#555] bg-[#252525] px-1.5 py-0.5 rounded">{ad.type}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded", ad.category === "18+" ? "bg-red-900/30 text-red-400" : ad.category === "casino" ? "bg-yellow-900/30 text-yellow-400" : "bg-[#252525] text-[#666]")}>{ad.category}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[#888] text-xs">{AD_POSITIONS.find(p => p.value === ad.position)?.label || ad.position}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex gap-3 text-xs text-[#666]">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{ad.impressions}</span>
                      <span className="flex items-center gap-1"><MousePointer className="h-3 w-3" />{ad.clicks}</span>
                      <span className="text-primary">CTR: {ctr(ad)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", ad.isActive ? "bg-green-900/40 text-green-400" : "bg-[#333] text-[#666]")}>
                      {ad.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => handleToggle(ad.id, ad.isActive)} className="p-1.5 rounded hover:bg-[#333] text-[#666] hover:text-yellow-400 transition-colors">
                        {ad.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => handleEdit(ad)} className="p-1.5 rounded hover:bg-[#333] text-[#666] hover:text-white transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(ad.id)} className="p-1.5 rounded hover:bg-red-900/30 text-[#666] hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
