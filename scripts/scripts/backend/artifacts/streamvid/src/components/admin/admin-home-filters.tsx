import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Plus, Trash2, GripVertical, Edit2, Check, X } from "lucide-react";

const SORT_OPTIONS = [
  { value: "most_viewed", label: "En Çok İzlenen" },
  { value: "most_liked",  label: "En Çok Beğenilen" },
  { value: "newest",      label: "En Yeni" },
  { value: "trending",    label: "Trend" },
];

const TYPE_OPTIONS = [
  { value: "category", label: "Kategori" },
  { value: "sort",     label: "Sıralama" },
  { value: "custom",   label: "Özel Kural" },
];

const ICON_SUGGESTIONS = ["🔥","⭐","🎬","🎵","🎮","💃","😂","🍕","✈️","💪","💻","📈","👑","🌟","🆕","👁️","❤️"];

interface HomeFilter {
  id: number;
  label: string;
  icon: string;
  type: string;
  categoryId: number | null;
  sortBy: string | null;
  rules: Record<string, any>;
  order: number;
  isActive: boolean;
}

interface Category {
  id: number;
  name: string;
}

const emptyFilter = (): Omit<HomeFilter, "id"> => ({
  label: "",
  icon: "🎬",
  type: "sort",
  categoryId: null,
  sortBy: "most_viewed",
  rules: {},
  order: 0,
  isActive: true,
});

export default function AdminHomeFilters() {
  const { token } = useAuth() as any;
  const [filters, setFilters] = useState<HomeFilter[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HomeFilter | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyFilter());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/home-filters", { headers }).then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
    ]).then(([fd, cd]) => {
      setFilters(fd.filters ?? []);
      setCategories(cd.categories ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const saveFilter = async () => {
    if (!form.label.trim()) return flash("Etiket zorunludur");
    setSaving(true);
    try {
      const payload = { ...form };
      if (form.type === "category") { payload.sortBy = null; }
      if (form.type !== "category") { payload.categoryId = null; }

      if (editing) {
        const r = await fetch(`/api/admin/home-filters/${editing.id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
        const d = await r.json();
        setFilters(prev => prev.map(f => f.id === editing.id ? d : f));
        setEditing(null);
      } else {
        const r = await fetch("/api/admin/home-filters", { method: "POST", headers, body: JSON.stringify(payload) });
        const d = await r.json();
        setFilters(prev => [...prev, d]);
        setCreating(false);
      }
      setForm(emptyFilter());
      flash("Kaydedildi ✓");
    } catch { flash("Hata oluştu"); }
    setSaving(false);
  };

  const deleteFilter = async (id: number) => {
    if (!confirm("Bu filtreyi silmek istediğine emin misin?")) return;
    await fetch(`/api/admin/home-filters/${id}`, { method: "DELETE", headers });
    setFilters(prev => prev.filter(f => f.id !== id));
    flash("Silindi");
  };

  const toggleActive = async (f: HomeFilter) => {
    const updated = { ...f, isActive: !f.isActive };
    await fetch(`/api/admin/home-filters/${f.id}`, { method: "PUT", headers, body: JSON.stringify(updated) });
    setFilters(prev => prev.map(x => x.id === f.id ? { ...x, isActive: !x.isActive } : x));
  };

  const startEdit = (f: HomeFilter) => {
    setEditing(f);
    setCreating(false);
    setForm({ label: f.label, icon: f.icon, type: f.type, categoryId: f.categoryId, sortBy: f.sortBy, rules: f.rules || {}, order: f.order, isActive: f.isActive });
  };

  const cancelForm = () => { setEditing(null); setCreating(false); setForm(emptyFilter()); };

  const FilterForm = () => (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <p className="text-sm font-semibold text-white">{editing ? "Filtreyi Düzenle" : "Yeni Filtre Ekle"}</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Etiket */}
        <div>
          <label className="text-xs text-[#888] mb-1 block">Etiket</label>
          <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            placeholder="ör. En Çok İzlenen"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary" />
        </div>
        {/* İkon */}
        <div>
          <label className="text-xs text-[#888] mb-1 block">İkon (emoji)</label>
          <div className="flex gap-2">
            <input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
              className="w-16 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm text-center text-white outline-none focus:border-primary" />
            <div className="flex flex-wrap gap-1 flex-1">
              {ICON_SUGGESTIONS.map(ic => (
                <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
                  className={cn("w-7 h-7 rounded text-base hover:bg-[#2a2a2a] transition-colors", form.icon === ic && "bg-primary/20 ring-1 ring-primary")}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tür */}
      <div>
        <label className="text-xs text-[#888] mb-1 block">Filtre Türü</label>
        <div className="flex gap-2">
          {TYPE_OPTIONS.map(t => (
            <button key={t.value} onClick={() => setForm(p => ({ ...p, type: t.value }))}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                form.type === t.value ? "bg-primary text-white border-primary" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:text-white")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kategori seçici */}
      {form.type === "category" && (
        <div>
          <label className="text-xs text-[#888] mb-1 block">Kategori</label>
          <select value={form.categoryId ?? ""} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value ? +e.target.value : null }))}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary">
            <option value="">— Seç —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* Sıralama */}
      {(form.type === "sort" || form.type === "custom") && (
        <div>
          <label className="text-xs text-[#888] mb-1 block">Sıralama</label>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map(s => (
              <button key={s.value} onClick={() => setForm(p => ({ ...p, sortBy: s.value }))}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  form.sortBy === s.value ? "bg-primary text-white border-primary" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:text-white")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kurallar */}
      {(form.type === "sort" || form.type === "custom") && (
        <div className="space-y-3">
          <label className="text-xs text-[#888] block">Kurallar <span className="text-[#555]">(opsiyonel — boş bırakılabilir)</span></label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">Min. İzlenme</label>
              <input type="number" min={0} value={form.rules.min_views ?? ""}
                onChange={e => setForm(p => ({ ...p, rules: { ...p.rules, min_views: e.target.value ? +e.target.value : undefined } }))}
                placeholder="ör. 1000"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">Min. Beğeni</label>
              <input type="number" min={0} value={form.rules.min_likes ?? ""}
                onChange={e => setForm(p => ({ ...p, rules: { ...p.rules, min_likes: e.target.value ? +e.target.value : undefined } }))}
                placeholder="ör. 50"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[11px] text-[#666]">Sadece Premium</label>
            <button onClick={() => setForm(p => ({ ...p, rules: { ...p.rules, is_premium: p.rules.is_premium ? undefined : true } }))}
              className={cn("w-8 h-4 rounded-full transition-all", form.rules.is_premium ? "bg-primary" : "bg-[#2a2a2a]")}>
              <div className={cn("w-3 h-3 rounded-full bg-white mx-auto transition-all", form.rules.is_premium ? "translate-x-2" : "-translate-x-1")} />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#888] mb-1 block">Sıra (küçük = önce)</label>
          <input type="number" value={form.order} onChange={e => setForm(p => ({ ...p, order: +e.target.value }))}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary" />
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-[#888] mb-1 block">Aktif</label>
          <button onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
            className={cn("w-10 h-5 rounded-full transition-all mb-2", form.isActive ? "bg-primary" : "bg-[#2a2a2a]")}>
            <div className={cn("w-4 h-4 rounded-full bg-white mx-auto transition-all", form.isActive ? "translate-x-2.5" : "-translate-x-2.5")} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={saveFilter} disabled={saving}
          className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          <Check className="h-3.5 w-3.5" /> {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button onClick={cancelForm} className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] px-4 py-2 rounded-lg text-sm hover:text-white">
          <X className="h-3.5 w-3.5" /> İptal
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Anasayfa Filtreleri</h2>
          <p className="text-xs text-[#666] mt-0.5">Anasayfadaki filtre çubuğunu özelleştir — kategoriler, sıralama ve özel kurallar ekle</p>
        </div>
        {!creating && !editing && (
          <button onClick={() => { setCreating(true); setEditing(null); setForm(emptyFilter()); }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Filtre Ekle
          </button>
        )}
      </div>

      {msg && <div className="bg-primary/10 border border-primary/20 text-primary rounded-lg px-4 py-2 text-sm">{msg}</div>}

      {(creating || editing) && <FilterForm />}

      {loading ? (
        <div className="text-[#555] text-sm py-8 text-center">Yükleniyor…</div>
      ) : filters.length === 0 ? (
        <div className="text-[#555] text-sm py-12 text-center border border-dashed border-[#222] rounded-xl">
          Henüz filtre yok. "Filtre Ekle" ile başla.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Önizleme */}
          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-3 flex items-center gap-2 flex-wrap mb-4">
            <span className="text-[10px] text-[#444] font-bold uppercase tracking-widest">Önizleme</span>
            <button className="px-3 py-1 rounded-full text-[11px] font-medium bg-white text-black border border-white">Tümü</button>
            {filters.filter(f => f.isActive).map(f => (
              <button key={f.id} className="px-3 py-1 rounded-full text-[11px] font-medium bg-transparent border border-[#2a2a2a] text-[#666]">
                {f.icon} {f.label}
              </button>
            ))}
          </div>

          {filters.map(f => (
            <div key={f.id} className={cn("flex items-center gap-3 bg-[#111] border rounded-xl px-4 py-3 transition-all",
              f.isActive ? "border-[#2a2a2a]" : "border-[#1a1a1a] opacity-50")}>
              <GripVertical className="h-4 w-4 text-[#444] shrink-0" />
              <span className="text-lg shrink-0">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{f.label}</span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold",
                    f.type === "category" ? "bg-blue-500/20 text-blue-400" :
                    f.type === "sort"     ? "bg-purple-500/20 text-purple-400" :
                                           "bg-orange-500/20 text-orange-400")}>
                    {f.type === "category" ? "KATEGORİ" : f.type === "sort" ? "SIRALAMA" : "ÖZEL"}
                  </span>
                  {!f.isActive && <span className="text-[10px] text-[#555]">Pasif</span>}
                </div>
                <div className="text-[11px] text-[#555] mt-0.5">
                  {f.type === "category" && `Kategori #${f.categoryId}`}
                  {f.type !== "category" && f.sortBy && SORT_OPTIONS.find(s => s.value === f.sortBy)?.label}
                  {f.rules && Object.keys(f.rules).length > 0 && (
                    <span className="ml-2 text-[#444]">
                      {f.rules.min_views ? `· min. ${f.rules.min_views} izlenme` : ""}
                      {f.rules.min_likes ? `· min. ${f.rules.min_likes} beğeni` : ""}
                      {f.rules.is_premium ? "· sadece premium" : ""}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleActive(f)}
                  className={cn("w-8 h-4 rounded-full transition-all", f.isActive ? "bg-primary" : "bg-[#2a2a2a]")}>
                  <div className={cn("w-3 h-3 rounded-full bg-white mx-auto transition-all", f.isActive ? "translate-x-2" : "-translate-x-1")} />
                </button>
                <button onClick={() => startEdit(f)} className="p-1.5 rounded-lg hover:bg-[#2a2a2a] text-[#666] hover:text-white transition-colors ml-1">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => deleteFilter(f.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#666] hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
