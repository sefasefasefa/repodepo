import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSiteConfig, NAV_DEFAULTS, SECTION_DEFAULTS, MAINTENANCE_DEFAULTS } from "@/lib/use-site-config";
import { usePublicSiteSettings } from "@/lib/use-public-site-settings";
import { useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import {
  Settings2, Eye, EyeOff, Edit2, Check, X, RotateCcw,
  AlertTriangle, Wrench, ChevronRight, Tag, LayoutList, Stamp, Sparkles, Plus, Trash2, Search,
  Globe, Link2, Webhook, Palette, Upload, BarChart2,
  Twitter, Code2, Map, Zap, RefreshCw, Copy, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import WebhookDashboard from "./webhook-dashboard";

const API_BASE = "/api";

// ── GeneralTab ──────────────────────────────────────────────────────────────
function GeneralTab() {
  const { reload } = usePublicSiteSettings();
  const { token } = useAuth() as any;
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch("/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setForm({
        siteName: d.siteName ?? "",
        siteDescription: d.siteDescription ?? "",
        logoUrl: d.logoUrl ?? "",
        faviconUrl: d.faviconUrl ?? "",
        primaryColor: d.primaryColor ?? "#7c3aed",
        registrationEnabled: d.registrationEnabled ?? true,
        maintenanceMode: d.maintenanceMode ?? false,
        serviceWorkerEnabled: d.serviceWorkerEnabled ?? false,
      }))
      .catch(() => setForm({
        siteName: "", siteDescription: "", logoUrl: "", faviconUrl: "",
        primaryColor: "#7c3aed", registrationEnabled: true, maintenanceMode: false,
        serviceWorkerEnabled: false,
      }))
      .finally(() => setLoading(false));
  }, [token]);

  const save = async () => {
    if (!token) { setError("Oturum bulunamadı, lütfen yeniden giriş yapın."); return; }
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/settings/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          siteName: form.siteName,
          siteDescription: form.siteDescription,
          logoUrl: form.logoUrl || null,
          faviconUrl: form.faviconUrl || null,
          primaryColor: form.primaryColor,
          registrationEnabled: form.registrationEnabled,
          maintenanceMode: form.maintenanceMode,
          serviceWorkerEnabled: form.serviceWorkerEnabled,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? `Kayıt başarısız (${r.status})`);
        return;
      }
      await reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Sunucuya bağlanılamadı, lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };


  if (loading) return <div className="py-10 text-center text-[#555] text-sm">Yükleniyor...</div>;
  if (!form) return <div className="py-10 text-center text-[#555] text-sm">Ayarlar yüklenemedi.</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Site Kimliği</p>
        <div>
          <label className="text-xs text-[#666] block mb-1.5">Site Adı</label>
          <input value={form.siteName ?? ""} onChange={e => setForm((f: any) => ({ ...f, siteName: e.target.value }))}
            placeholder="Prnhbbbb" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-xs text-[#666] block mb-1.5">Site Açıklaması</label>
          <input value={form.siteDescription ?? ""} onChange={e => setForm((f: any) => ({ ...f, siteDescription: e.target.value }))}
            placeholder="Video streaming ve sosyal platform" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
        </div>
      </div>
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Logo & Favicon</p>
        <div>
          <label className="text-xs text-[#666] block mb-1.5">Logo URL</label>
          <input value={form.logoUrl ?? ""} onChange={e => setForm((f: any) => ({ ...f, logoUrl: e.target.value }))}
            placeholder="https://example.com/logo.png" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
          {form.logoUrl && <img src={form.logoUrl} alt="logo" className="h-8 mt-2 object-contain bg-[#1a1a1a] rounded p-1 border border-[#2a2a2a]" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
        </div>
        <div>
          <label className="text-xs text-[#666] block mb-1.5">Favicon URL</label>
          <input value={form.faviconUrl ?? ""} onChange={e => setForm((f: any) => ({ ...f, faviconUrl: e.target.value }))}
            placeholder="https://example.com/favicon.ico" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
        </div>
      </div>
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2"><Palette className="h-3.5 w-3.5" /> Ana Renk</p>
        <div className="flex items-center gap-3">
          <input type="color" value={form.primaryColor ?? "#7c3aed"} onChange={e => setForm((f: any) => ({ ...f, primaryColor: e.target.value }))}
            className="w-12 h-10 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] cursor-pointer p-1" />
          <input value={form.primaryColor ?? ""} onChange={e => setForm((f: any) => ({ ...f, primaryColor: e.target.value }))}
            placeholder="#7c3aed" className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40 font-mono" />
          <div className="w-10 h-10 rounded-xl border border-[#2a2a2a] shrink-0" style={{ backgroundColor: form.primaryColor ?? "#7c3aed" }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {["#7c3aed","#e11d48","#2563eb","#059669","#d97706","#db2777","#0891b2","#dc2626"].map(c => (
            <button key={c} onClick={() => setForm((f: any) => ({ ...f, primaryColor: c }))}
              className={cn("w-7 h-7 rounded-lg border-2 transition-all", form.primaryColor === c ? "border-white scale-110" : "border-transparent")}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Platform Ayarları</p>
        {[
          { key: "registrationEnabled", label: "Kullanıcı Kaydı", desc: "Yeni kayıtlara izin ver", color: "bg-primary" },
          { key: "maintenanceMode", label: "Bakım Modu", desc: "Siteyi ziyaretçilere kapat", color: "bg-red-500" },
          { key: "serviceWorkerEnabled", label: "Service Worker (Cache)", desc: "Kapatılırsa site her ziyarette sunucudan en güncel sürümü çeker, offline/hızlı açılış cache'i devre dışı kalır", color: "bg-blue-500" },
        ].map(({ key, label, desc, color }) => (
          <div key={key} className="flex items-center justify-between">
            <div><p className="text-sm text-white">{label}</p><p className="text-xs text-[#555]">{desc}</p></div>
            <button onClick={() => setForm((f: any) => ({ ...f, [key]: !f[key] }))}
              className={cn("w-11 h-6 rounded-full transition-all relative shrink-0", form[key] ? color : "bg-[#333]")}>
              <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", form[key] ? "left-6" : "left-1")} />
            </button>
          </div>
        ))}
        {form.serviceWorkerEnabled === false && (
          <p className="text-[11px] text-[#555] leading-relaxed pt-1 border-t border-[#1a1a1a]">
            Kayıt sonrası bu ayar ziyaretçilerin sonraki sayfa yüklemesinde uygulanır; mevcut Service Worker ve cache'leri otomatik olarak temizlenir.
          </p>
        )}
      </div>
      <button onClick={save} disabled={saving}
        className={cn("w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all",
          saved ? "bg-green-600 text-white" : "bg-primary hover:bg-primary/90 text-white disabled:opacity-50")}>
        {saving ? "Kaydediliyor..." : saved ? <><Check className="h-4 w-4" /> Kaydedildi!</> : <><Check className="h-4 w-4" /> Değişiklikleri Kaydet</>}
      </button>
    </div>
  );
}

// ── AutoCategoryTab ─────────────────────────────────────────────────────────
function AutoCategoryTab() {
  const { data: catData } = useListCategories();
  const { token } = useAuth() as any;
  const allCategories: any[] = (catData as any)?.categories ?? [];
  const [rules, setRules] = useState<Record<number, { keywords: string[]; isEnabled: boolean }>>({});
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) { setLoaded(true); return; }
    fetch(`${API_BASE}/auto-category/rules`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        if (d.rules) {
          const map: Record<number, { keywords: string[]; isEnabled: boolean }> = {};
          for (const r of d.rules) map[r.categoryId] = { keywords: r.keywords ?? [], isEnabled: r.isEnabled ?? true };
          setRules(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [token]);

  const addKeyword = (catId: number) => {
    const kw = (draft[catId] ?? "").trim().toLowerCase();
    if (!kw) return;
    setRules(p => {
      const existing = p[catId] ?? { keywords: [], isEnabled: true };
      if (existing.keywords.includes(kw)) return p;
      return { ...p, [catId]: { ...existing, keywords: [...existing.keywords, kw] } };
    });
    setDraft(p => ({ ...p, [catId]: "" }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = allCategories.map(cat => ({
        categoryId: cat.id, keywords: rules[cat.id]?.keywords ?? [], isEnabled: rules[cat.id]?.isEnabled ?? true,
      }));
      await fetch(`${API_BASE}/auto-category/rules`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rules: payload }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  if (!loaded) return <div className="py-10 text-center text-[#555] text-sm">Yükleniyor...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#555]">Her kategori için anahtar kelimeler tanımlayın. Video başlığı/açıklaması eşleşince kategori otomatik önerilir.</p>
        <button onClick={save} disabled={saving}
          className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all",
            saved ? "bg-green-900/40 text-green-400" : "bg-primary/20 hover:bg-primary/30 text-primary")}>
          {saved ? <><Check className="h-3 w-3" /> Kaydedildi</> : saving ? "..." : <><Check className="h-3 w-3" /> Kaydet</>}
        </button>
      </div>
      {allCategories.map(cat => {
        const rule = rules[cat.id] ?? { keywords: [], isEnabled: true };
        return (
          <div key={cat.id} className={cn("bg-[#111] border rounded-xl overflow-hidden", rule.isEnabled ? "border-[#222]" : "border-[#1a1a1a] opacity-60")}>
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => setRules(p => ({ ...p, [cat.id]: { ...(p[cat.id] ?? { keywords: [] }), isEnabled: !rule.isEnabled } }))}
                className={cn("w-9 h-5 rounded-full relative shrink-0 transition-all", rule.isEnabled ? "bg-primary" : "bg-[#333]")}>
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", rule.isEnabled ? "left-4" : "left-0.5")} />
              </button>
              <span className="text-sm font-medium text-white flex-1">{cat.name}</span>
              <span className="text-[11px] text-[#555] font-mono">{rule.keywords.length} kelime</span>
            </div>
            {rule.isEnabled && (
              <div className="px-4 pb-3 space-y-2">
                {rule.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {rule.keywords.map(kw => (
                      <span key={kw} className="inline-flex items-center gap-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-full px-2.5 py-0.5 text-xs text-[#ccc]">
                        {kw}
                        <button onClick={() => setRules(p => ({ ...p, [cat.id]: { ...rule, keywords: rule.keywords.filter(k => k !== kw) } }))} className="text-[#555] hover:text-red-400 ml-0.5"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={draft[cat.id] ?? ""} onChange={e => setDraft(p => ({ ...p, [cat.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword(cat.id))}
                    placeholder="Anahtar kelime ekle (Enter)..."
                    className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#444] placeholder:text-[#444]" />
                  <button onClick={() => addKeyword(cat.id)} className="flex items-center gap-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-[#aaa]">
                    <Plus className="h-3 w-3" /> Ekle
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Toggle & InlineEdit helpers ─────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={cn("w-11 h-6 rounded-full transition-all relative shrink-0", checked ? "bg-primary" : "bg-[#333]")}>
      <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", checked ? "left-6" : "left-1")} />
    </button>
  );
}

function InlineEdit({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const start = () => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.select(), 30); };
  const confirm = () => { if (draft.trim()) onChange(draft.trim()); setEditing(false); };
  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-1">
        <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") setEditing(false); }}
          className="flex-1 bg-[#111] border border-primary rounded px-2 py-1 text-sm text-white focus:outline-none min-w-0" />
        <button onClick={confirm} className="text-green-400"><Check className="h-4 w-4" /></button>
        <button onClick={() => setEditing(false)} className="text-[#555]"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0 group cursor-pointer" onClick={start}>
      <span className="text-sm text-white truncate flex-1">{value}</span>
      <Edit2 className="h-3.5 w-3.5 text-[#444] group-hover:text-[#888] shrink-0" />
    </div>
  );
}

// ── WatermarkTab ─────────────────────────────────────────────────────────────
function WatermarkTab() {
  const { token } = useAuth() as any;
  const [settings, setSettings] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/watermark/admin/settings", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) { setSettings({}); return; }
      const d = await r.json();
      setSettings(d.settings ?? {}); setForm(d.settings || {});
    } catch { setSettings({}); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!token) { setSaveError("Oturum bulunamadı, lütfen yeniden giriş yapın."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/watermark/admin/settings", {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setSaveError(d.error ?? `Kayıt başarısız (${r.status})`);
        return;
      }
      const d = await r.json();
      setSettings(d.settings ?? form); setForm(d.settings ?? form);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Sunucuya bağlanılamadı, lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true); setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/watermark/admin/upload", {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const d = await r.json();
      if (!r.ok) { setUploadError(d.error || "Yükleme başarısız"); return; }
      setForm((f: any) => ({ ...f, imageUrl: d.url, useImage: true }));
    } catch { setUploadError("Yükleme sırasında hata oluştu"); }
    finally { setUploading(false); }
  };


  const positions = [
    { value: "top-left", label: "Sol Üst" }, { value: "top-right", label: "Sağ Üst" },
    { value: "bottom-left", label: "Sol Alt" }, { value: "bottom-right", label: "Sağ Alt" },
    { value: "center", label: "Ortada" },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Filigran Sistemi</p>
          <p className="text-xs text-[#555] mt-0.5">Etkinleştirildiğinde watermarkEnabled olan videolarda görünür</p>
        </div>
        <button onClick={() => setForm((f: any) => ({ ...f, isEnabled: !f.isEnabled }))}
          className={cn("w-12 h-6 rounded-full transition-all relative shrink-0", form.isEnabled ? "bg-blue-500" : "bg-[#333]")}>
          <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", form.isEnabled ? "left-7" : "left-1")} />
        </button>
      </div>

      {!form.isEnabled && (
        <div className="flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
          <Stamp className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-500/80">Filigran sistemi pasif.</p>
        </div>
      )}

      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Filigran İçeriği</p>
        <div className="flex gap-3">
          {[{ v: false, l: "Metin Filigranı" }, { v: true, l: "Logo / Resim" }].map(({ v, l }) => (
            <button key={String(v)} onClick={() => setForm((f: any) => ({ ...f, useImage: v }))}
              className={cn("flex-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all",
                form.useImage === v ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-[#aaa]")}>
              {l}
            </button>
          ))}
        </div>

        {form.useImage ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#666] block mb-1.5">Logo URL (PNG/SVG önerilir)</label>
              <input value={form.imageUrl || ""} onChange={e => setForm((f: any) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://example.com/logo.png"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40" />
            </div>
            <div className="relative">
              <div className="flex items-center gap-2 text-xs text-[#555] mb-2"><span>veya</span><div className="flex-1 h-px bg-[#222]" /></div>
              <input ref={fileRef} type="file" accept=".png,.svg,.jpg,.jpeg,.gif,.webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#333] text-xs text-[#666] hover:border-[#444] hover:text-[#aaa] transition-all disabled:opacity-50">
                {uploading ? <><RefreshCw className="h-4 w-4 animate-spin" /> Yükleniyor...</> : <><Upload className="h-4 w-4" /> Dosyadan yükle (PNG, SVG, JPG, WebP)</>}
              </button>
              {uploadError && <p className="text-xs text-red-400 mt-1.5">{uploadError}</p>}
            </div>
            {form.imageUrl && (
              <div className="flex items-center gap-2">
                <img src={form.imageUrl} alt="preview" className="h-8 object-contain bg-[#1a1a1a] rounded p-1 border border-[#2a2a2a]" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span className="text-xs text-[#555]">Önizleme</span>
                <button onClick={() => setForm((f: any) => ({ ...f, imageUrl: "" }))} className="text-[#555] hover:text-red-400 ml-auto"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="text-xs text-[#666] block mb-1.5">Filigran Metni</label>
            <input value={form.text || ""} onChange={e => setForm((f: any) => ({ ...f, text: e.target.value }))}
              placeholder="Prnhbbbb" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40" />
          </div>
        )}
      </div>

      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Görünüm</p>
        <div>
          <label className="text-xs text-[#666] block mb-2">Konum</label>
          <div className="grid grid-cols-3 gap-1.5">
            {positions.map(p => (
              <button key={p.value} onClick={() => setForm((f: any) => ({ ...f, position: p.value }))}
                className={cn("px-2 py-2 rounded-lg text-xs font-medium border transition-all",
                  form.position === p.value ? "bg-primary/10 border-primary/30 text-primary" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-[#aaa]")}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-[#666] block mb-2">Boyut</label>
          <div className="flex gap-2">
            {[{ v: "small", l: "Küçük" }, { v: "medium", l: "Orta" }, { v: "large", l: "Büyük" }].map(s => (
              <button key={s.v} onClick={() => setForm((f: any) => ({ ...f, size: s.v }))}
                className={cn("flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                  form.size === s.v ? "bg-primary/10 border-primary/30 text-primary" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-[#aaa]")}>
                {s.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-[#666] block mb-2">Opaklık — <span className="text-white font-medium">{Math.round((form.opacity ?? 0.4) * 100)}%</span></label>
          <input type="range" min="0.05" max="1" step="0.05" value={form.opacity ?? 0.4}
            onChange={e => setForm((f: any) => ({ ...f, opacity: parseFloat(e.target.value) }))}
            className="w-full accent-primary" />
          <div className="flex justify-between text-[10px] text-[#444] mt-1"><span>%5</span><span>%100</span></div>
        </div>
        <div>
          <label className="text-xs text-[#666] block mb-2">Canlı Önizleme</label>
          <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden h-32">
            <div className="absolute inset-0 flex items-center justify-center text-[#333] text-xs">Video alanı</div>
            <div className={cn("absolute flex",
              form.position === "top-left" ? "top-2 left-2" : form.position === "top-right" ? "top-2 right-2" :
              form.position === "bottom-left" ? "bottom-2 left-2" : form.position === "bottom-right" ? "bottom-2 right-2" :
              "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2")} style={{ opacity: form.opacity ?? 0.4 }}>
              {form.useImage && form.imageUrl
                ? <img src={form.imageUrl} alt="wm" className={cn("object-contain", form.size === "small" ? "h-4" : form.size === "large" ? "h-8" : "h-6")} />
                : <span className={cn("text-white font-bold bg-black/30 rounded px-1.5 py-0.5", form.size === "small" ? "text-[9px]" : form.size === "large" ? "text-sm" : "text-xs")}>{form.text || "Prnhbbbb"}</span>
              }
            </div>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="ml-auto text-red-400/60 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      <button onClick={save} disabled={saving}
        className={cn("w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all",
          saved ? "bg-green-600 text-white" : "bg-primary hover:bg-primary/90 text-white disabled:opacity-50")}>
        {saving ? "Kaydediliyor..." : saved ? <><Check className="h-4 w-4" /> Kaydedildi!</> : <><Check className="h-4 w-4" /> Ayarları Kaydet</>}
      </button>
    </div>
  );
}

// ── SeoTab yardımcı bileşenleri (SeoTab DIŞINDA — re-mount sorununu önler) ────
function SeoField({ label, k, placeholder, type = "text", hint, settings, setSettings }: {
  label: string; k: string; placeholder?: string; type?: string; hint?: string;
  settings: any; setSettings: (fn: (p: any) => any) => void;
}) {
  return (
    <div>
      <label className="text-xs text-[#666] block mb-1.5">{label}</label>
      {type === "textarea"
        ? <textarea value={settings[k] || ""} onChange={e => setSettings((p: any) => ({ ...p, [k]: e.target.value }))}
            placeholder={placeholder} rows={3}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40 resize-none" />
        : <input value={settings[k] || ""} onChange={e => setSettings((p: any) => ({ ...p, [k]: e.target.value }))}
            placeholder={placeholder}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40" />}
      {hint && <p className="text-[10px] text-[#444] mt-1">{hint}</p>}
    </div>
  );
}

function SeoSelectField({ label, k, options, hint, settings, setSettings }: {
  label: string; k: string; options: { v: string; l: string }[]; hint?: string;
  settings: any; setSettings: (fn: (p: any) => any) => void;
}) {
  return (
    <div>
      <label className="text-xs text-[#666] block mb-1.5">{label}</label>
      <select value={settings[k] || options[0].v} onChange={e => setSettings((p: any) => ({ ...p, [k]: e.target.value }))}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      {hint && <p className="text-[10px] text-[#444] mt-1">{hint}</p>}
    </div>
  );
}

function SeoBoolField({ label, desc, k, settings, setSettings }: {
  label: string; desc: string; k: string;
  settings: any; setSettings: (fn: (p: any) => any) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div><p className="text-sm text-white">{label}</p><p className="text-xs text-[#555]">{desc}</p></div>
      <button onClick={() => setSettings((p: any) => ({ ...p, [k]: !p[k] }))}
        className={cn("w-11 h-6 rounded-full transition-all relative shrink-0", settings[k] ? "bg-primary" : "bg-[#333]")}>
        <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", settings[k] ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}

function PingSitemapButton({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [results, setResults] = useState<any>(null);

  const ping = async () => {
    setStatus("loading");
    try {
      const r = await fetch("/api/seo/ping-sitemap", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setResults(d.results);
      setStatus(d.allSuccess ? "ok" : "err");
    } catch {
      setStatus("err");
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white">Sitemap Ping</p>
          <p className="text-xs text-[#555]">Yandex'e sitemap bildir (Bing manuel)</p>
        </div>
        <button onClick={ping} disabled={status === "loading"}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-all">
          {status === "loading" ? "Gönderiliyor..." : "Ping Gönder"}
        </button>
      </div>
      {results && (
        <div className="space-y-1.5">
          {Object.entries(results).map(([engine, r]: any) => (
            <div key={engine}>
              {r.manual ? (
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400" style={{ fontSize: 10 }}>⚠ Bing:</span>
                  <span className="text-[#888]" style={{ fontSize: 10 }}>
                    {r.message}{" "}
                    {r.action_url && (
                      <a href={r.action_url} target="_blank" rel="noreferrer"
                        className="text-blue-400 underline">
                        Webmaster Tools'u aç →
                      </a>
                    )}
                  </span>
                </div>
              ) : (
                <span className={r.success ? "text-green-400" : "text-red-400"} style={{ fontSize: 10 }}>
                  {r.success ? "✓" : "✗"} {engine.charAt(0).toUpperCase() + engine.slice(1)}: {r.message}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SeoTab ───────────────────────────────────────────────────────────────────
function SeoTab() {
  const { token } = useAuth() as any;
  const [settings, setSettings] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<"basic" | "og" | "twitter" | "advanced" | "analytics">("basic");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch("/api/seo/admin/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setSettings(d.settings || {}))
      .catch(() => {});
  }, [token]);

  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    if (!token) { setSaveError("Oturum bulunamadı, lütfen yeniden giriş yapın."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/seo/admin/settings", {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setSaveError(d.error ?? `Kayıt başarısız (${r.status})`);
        return;
      }
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Sunucuya bağlanılamadı, lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  const copyMeta = () => {
    if (!settings) return;
    const meta = `<title>${settings.siteTitle || ''}</title>
<meta name="description" content="${settings.siteDescription || ''}">
<meta name="keywords" content="${settings.keywords || ''}">
<meta name="robots" content="${settings.robots || 'index,follow'}">
<link rel="canonical" href="${settings.canonicalUrl || ''}">
<meta property="og:title" content="${settings.ogTitle || settings.siteTitle || ''}">
<meta property="og:description" content="${settings.ogDescription || settings.siteDescription || ''}">
<meta property="og:image" content="${settings.ogImage || ''}">
<meta property="og:type" content="${settings.ogType || 'website'}">
<meta name="twitter:card" content="${settings.twitterCard || 'summary_large_image'}">
<meta name="twitter:site" content="${settings.twitterSite || ''}">`;
    navigator.clipboard.writeText(meta);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const sectionTabs = [
    { id: "basic", label: "Temel", icon: Globe },
    { id: "og", label: "Open Graph", icon: Link2 },
    { id: "twitter", label: "Twitter", icon: Twitter },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
    { id: "advanced", label: "Gelişmiş", icon: Code2 },
  ];

  const sp = { settings, setSettings };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#555]">Arama motorları ve sosyal medya için gelişmiş SEO yönetimi</p>
        <button onClick={copyMeta}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#222] text-[#666] hover:text-[#aaa] hover:border-[#333] transition-all">
          {copied ? <><CheckCheck className="h-3 w-3 text-green-400" /> Kopyalandı</> : <><Copy className="h-3 w-3" /> Meta Etiketleri Kopyala</>}
        </button>
      </div>

      <div className="flex gap-1 bg-[#0e0e0e] p-1 rounded-xl border border-[#1a1a1a] flex-wrap">
        {sectionTabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveSection(id as any)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeSection === id ? "bg-[#1e1e1e] text-white border border-[#2a2a2a]" : "text-[#555] hover:text-[#aaa]")}>
            <Icon className="h-3 w-3" />{label}
          </button>
        ))}
      </div>

      {activeSection === "basic" && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
          <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-blue-400" /> Temel SEO</p>
          <SeoField label="Site Başlığı" k="siteTitle" placeholder="Prnhbbbb - Video Platform" hint="50-60 karakter ideal. Tarayıcı sekmesi ve Google'da görünür." {...sp} />
          <SeoField label="Site Açıklaması" k="siteDescription" type="textarea" placeholder="Video streaming ve sosyal platform" hint="150-160 karakter ideal. Google snippet olarak kullanılır." {...sp} />
          <SeoField label="Anahtar Kelimeler" k="keywords" placeholder="video, streaming, creator, sosyal" hint="Virgülle ayırın. Modern SEO'da az etkisi var ama yararlı." {...sp} />
          <SeoSelectField label="Robots Direktifi" k="robots" hint="index,follow önerilir. Yeni site veya gizli içerik için noindex." options={[
            { v: "index,follow", l: "index,follow (Önerilir — tam indeksleme)" },
            { v: "noindex,follow", l: "noindex,follow — sayfayı indeksleme" },
            { v: "index,nofollow", l: "index,nofollow — linkleri takip etme" },
            { v: "noindex,nofollow", l: "noindex,nofollow — tamamen gizle" },
          ]} {...sp} />
          <SeoField label="Canonical URL" k="canonicalUrl" placeholder="https://example.com" hint="Duplicate içerik sorununu önler. Sitenizin ana domain'i." {...sp} />
          <SeoSelectField label="Sayfa Dili (hreflang)" k="hreflang" options={[
            { v: "tr", l: "Türkçe (tr)" }, { v: "en", l: "English (en)" }, { v: "de", l: "Deutsch (de)" },
            { v: "fr", l: "Français (fr)" }, { v: "es", l: "Español (es)" }, { v: "ar", l: "العربية (ar)" },
            { v: "ru", l: "Русский (ru)" }, { v: "ja", l: "日本語 (ja)" },
          ]} {...sp} />
        </div>
      )}

      {activeSection === "og" && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
          <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2"><Link2 className="h-3.5 w-3.5 text-blue-400" /> Open Graph (Facebook, LinkedIn, WhatsApp)</p>
          <SeoField label="OG Başlık" k="ogTitle" placeholder="Prnhbbbb — Video Platform" hint="Boş bırakılırsa Site Başlığı kullanılır." {...sp} />
          <SeoField label="OG Açıklama" k="ogDescription" type="textarea" placeholder="Video streaming platformu" hint="Sosyal medyada paylaşım önizlemesinde görünür." {...sp} />
          <SeoField label="OG Görsel URL" k="ogImage" placeholder="https://example.com/og-image.jpg" hint="1200x630 piksel PNG/JPG önerilir. Sosyal paylaşım kartında görünür." {...sp} />
          {settings.ogImage && <img src={settings.ogImage} alt="og preview" className="w-full max-h-32 object-cover rounded-xl border border-[#2a2a2a]" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
          <SeoSelectField label="OG Type" k="ogType" hint="Genellikle 'website'. Video sayfaları için 'video.other'." options={[
            { v: "website", l: "website" }, { v: "article", l: "article" },
            { v: "video.other", l: "video.other" }, { v: "profile", l: "profile" },
          ]} {...sp} />
        </div>
      )}

      {activeSection === "twitter" && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
          <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2"><Twitter className="h-3.5 w-3.5 text-blue-400" /> Twitter (X) Kartları</p>
          <SeoSelectField label="Kart Türü" k="twitterCard" hint="summary_large_image geniş görsel gösterir, daha fazla tıklama getirir." options={[
            { v: "summary_large_image", l: "summary_large_image (Büyük Görsel)" },
            { v: "summary", l: "summary (Küçük Görsel)" },
            { v: "player", l: "player (Video Oynatıcı)" },
          ]} {...sp} />
          <SeoField label="Twitter Hesabı (@)" k="twitterSite" placeholder="@hesap_adi" hint="Sitenin resmi Twitter hesabı." {...sp} />
          <SeoField label="İçerik Üreticisi (@)" k="twitterCreator" placeholder="@icerik_uretici" hint="İçerik üreticisinin Twitter hesabı (opsiyonel)." {...sp} />
          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-3">
            <p className="text-[10px] text-[#555] mb-2 uppercase tracking-wider">Kart Önizlemesi</p>
            <div className="border border-[#222] rounded-xl overflow-hidden">
              <div className="bg-[#1a1a1a] h-20 flex items-center justify-center text-[#333] text-xs">
                {settings.ogImage ? <img src={settings.ogImage} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : "Görsel Alanı"}
              </div>
              <div className="p-2.5 bg-[#111]">
                <p className="text-xs text-white font-medium">{settings.ogTitle || settings.siteTitle || "Site Başlığı"}</p>
                <p className="text-[10px] text-[#555] mt-0.5 line-clamp-2">{settings.ogDescription || settings.siteDescription || "Açıklama"}</p>
                <p className="text-[10px] text-[#444] mt-1">{settings.canonicalUrl?.replace(/^https?:\/\//, '') || "example.com"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === "analytics" && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
          <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2"><BarChart2 className="h-3.5 w-3.5 text-green-400" /> Analytics & Search Console</p>
          <SeoField label="Google Analytics ID" k="googleAnalyticsId" placeholder="G-XXXXXXXXXX" hint="Google Analytics 4 Measurement ID. Boş bırakılırsa tracking yapılmaz." {...sp} />
          <SeoField label="Google Search Console Doğrulama" k="googleSearchConsole" placeholder="abc123xyz..." hint="Search Console → HTML Meta Tag yöntemindeki content değeri." {...sp} />

          <div className="border-t border-[#2a2a2a] pt-4">
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2 mb-3">
              <Globe className="h-3.5 w-3.5 text-blue-400" /> Bing & Yandex Doğrulama
            </p>
            <div className="space-y-3">
              <SeoField label="Bing Doğrulama Kodu" k="bingVerification" placeholder="1A2B3C4D5E6F7890..." hint="bing.com/webmasters → Site ekle → HTML Meta Tag → content değeri." {...sp} />
              <SeoField label="Yandex Doğrulama Kodu" k="yandexVerification" placeholder="a1b2c3d4e5f6g7h8..." hint="webmaster.yandex.com → Site ekle → Meta Tag → content değeri." {...sp} />
              <PingSitemapButton token={token} />
            </div>
          </div>

          <div className="border-t border-[#2a2a2a] pt-4">
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2 mb-3">
              <BarChart2 className="h-3.5 w-3.5 text-purple-400" /> Yapısal Veri
            </p>
            <SeoBoolField label="Sitemap.xml" desc="Arama motorları için XML sitemap oluştur" k="sitemapEnabled" {...sp} />
            <SeoBoolField label="Yapısal Veri (Schema.org)" desc="JSON-LD ile zengin snippet desteği" k="structuredDataEnabled" {...sp} />
            <SeoSelectField label="Schema.org Türü" k="schemaOrgType" hint="Sitenizi Google'a tanımlayan yapısal veri türü." options={[
              { v: "Organization", l: "Organization" }, { v: "WebSite", l: "WebSite" },
              { v: "VideoObject", l: "VideoObject" }, { v: "Person", l: "Person" },
            ]} {...sp} />
          </div>

          {settings.googleAnalyticsId && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <BarChart2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
              <p className="text-xs text-green-400">Analytics aktif: <span className="font-mono">{settings.googleAnalyticsId}</span></p>
            </div>
          )}
        </div>
      )}

      {activeSection === "advanced" && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
          <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2"><Code2 className="h-3.5 w-3.5 text-purple-400" /> Gelişmiş Ayarlar</p>
          <div className="grid grid-cols-3 gap-2 text-xs text-[#666]">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
              <Globe className="h-4 w-4 text-blue-400 mb-2" />
              <p className="text-white text-[11px] font-medium mb-0.5">Teknik SEO</p>
              Canonical URL, robots.txt, hreflang
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
              <Map className="h-4 w-4 text-green-400 mb-2" />
              <p className="text-white text-[11px] font-medium mb-0.5">Sitemap</p>
              Otomatik XML sitemap oluşturma
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
              <Zap className="h-4 w-4 text-yellow-400 mb-2" />
              <p className="text-white text-[11px] font-medium mb-0.5">Core Web Vitals</p>
              LCP, FID, CLS optimizasyonu
            </div>
          </div>
          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-3">
            <p className="text-[10px] text-[#555] mb-2 uppercase tracking-wider font-bold">Üretilen Meta Etiketleri Önizlemesi</p>
            <pre className="text-[10px] text-[#666] font-mono whitespace-pre-wrap leading-relaxed overflow-auto max-h-40">
{`<title>${settings.siteTitle || ''}</title>
<meta name="description" content="${settings.siteDescription || ''}">
<meta name="robots" content="${settings.robots || 'index,follow'}">
<link rel="canonical" href="${settings.canonicalUrl || ''}">
<meta property="og:type" content="${settings.ogType || 'website'}">
<meta property="og:image" content="${settings.ogImage || ''}">
<meta name="twitter:card" content="${settings.twitterCard || 'summary_large_image'}">`}
            </pre>
          </div>
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="ml-auto text-red-400/60 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      <button onClick={save} disabled={saving}
        className={cn("w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all",
          saved ? "bg-green-600 text-white" : "bg-primary hover:bg-primary/90 text-white disabled:opacity-50")}>
        {saving ? "Kaydediliyor..." : saved ? <><Check className="h-4 w-4" /> Kaydedildi!</> : "SEO Ayarlarını Kaydet"}
      </button>
    </div>
  );
}

// ── WebhookTab — delegates to standalone WebhookDashboard ─────────────────────
function WebhookTab() {
  return <WebhookDashboard />;
}

// ── CategoryManagerTab ────────────────────────────────────────────────────────
function CategoryManagerTab() {
  const { token } = useAuth() as any;
  const queryClient = useQueryClient();
  const { data: categoriesData, refetch } = useListCategories();
  const categories: any[] = (categoriesData as any)?.categories ?? (Array.isArray(categoriesData) ? categoriesData : []);

  const [editing, setEditing] = useState<Record<number, any>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ name: "", slug: "", iconUrl: "" });
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const invalidateAndRefetch = async () => {
    await queryClient.invalidateQueries();
    await refetch();
  };

  const saveCategory = async (id: number) => {
    setSaving(s => ({ ...s, [id]: true }));
    setCatError(null);
    try {
      const res = await fetch(`${API_BASE}/categories/${id}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editing[id]),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setCatError(d.error || `Güncelleme başarısız (${res.status})`);
        return;
      }
      await invalidateAndRefetch();
      setEditing(e => { const n = { ...e }; delete n[id]; return n; });
    } catch {
      setCatError("Sunucuya bağlanılamadı.");
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  };

  const deleteCategory = async (id: number) => {
    setDeleting(d => ({ ...d, [id]: true }));
    setCatError(null);
    try {
      const res = await fetch(`${API_BASE}/categories/${id}/delete`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setCatError(d.error || `Silme başarısız (${res.status})`);
        return;
      }
      await invalidateAndRefetch();
      setConfirmDelete(null);
    } catch {
      setCatError("Sunucuya bağlanılamadı.");
    } finally {
      setDeleting(d => ({ ...d, [id]: false }));
    }
  };

  const addCategory = async () => {
    if (!addForm.name.trim()) return;
    setAdding(true);
    setCatError(null);
    try {
      const res = await fetch(`${API_BASE}/categories/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: addForm.name, slug: addForm.slug || addForm.name.toLowerCase().replace(/\s+/g, '-'), iconUrl: addForm.iconUrl }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setCatError(d.error || `Ekleme başarısız (${res.status})`);
        return;
      }
      await invalidateAndRefetch();
      setAddForm({ name: "", slug: "", iconUrl: "" });
      setShowAdd(false);
    } catch {
      setCatError("Sunucuya bağlanılamadı.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      {catError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400 flex-1">{catError}</p>
          <button onClick={() => setCatError(null)} className="text-red-400/60 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#555]">{categories.length} kategori</p>
        <button onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary transition-all">
          <Plus className="h-3.5 w-3.5" /> Kategori Ekle
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#111] border border-primary/20 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Yeni Kategori</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[#666] block mb-1">İsim *</label>
              <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value, slug: f.slug || e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                placeholder="Kategori adı" onKeyDown={e => e.key === "Enter" && addCategory()}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-xs text-[#666] block mb-1">Slug</label>
              <input value={addForm.slug} onChange={e => setAddForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                placeholder="kategori-slug" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary/40 font-mono" />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#666] block mb-1">İkon URL (opsiyonel)</label>
            <input value={addForm.iconUrl} onChange={e => setAddForm(f => ({ ...f, iconUrl: e.target.value }))}
              placeholder="https://example.com/icon.png ya da emoji URL"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary/40" />
          </div>
          <div className="flex gap-2">
            <button onClick={addCategory} disabled={adding || !addForm.name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50 transition-all">
              {adding ? "Ekleniyor..." : <><Check className="h-3.5 w-3.5" /> Ekle</>}
            </button>
            <button onClick={() => { setShowAdd(false); setAddForm({ name: "", slug: "", iconUrl: "" }); }}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] text-[#666] text-xs hover:text-[#aaa] transition-all">
              İptal
            </button>
          </div>
        </div>
      )}

      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-10 text-center text-[#555] text-sm">Kategori bulunamadı</div>
        ) : (
          <div className="divide-y divide-[#1a1a1a]">
            {categories.map(cat => {
              const isEditing = editing[cat.id] !== undefined;
              const vals = editing[cat.id] ?? {
                name: cat.name, slug: cat.slug, iconUrl: cat.icon_url || "",
                showOnHome: cat.showOnHome !== false, homeOrder: cat.homeOrder ?? 0,
              };
              const toggleShowOnHome = async () => {
                setSaving(s => ({ ...s, [cat.id]: true }));
                try {
                  await fetch(`${API_BASE}/categories/${cat.id}/update`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ name: cat.name, showOnHome: !(cat.showOnHome !== false) }),
                  });
                  await invalidateAndRefetch();
                } finally {
                  setSaving(s => ({ ...s, [cat.id]: false }));
                }
              };
              return (
                <div key={cat.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-[#1a1a1a] rounded-lg flex items-center justify-center text-xs text-[#555] font-mono shrink-0">{cat.id}</div>
                    {isEditing ? (
                      <input value={vals.name} onChange={e => setEditing(p => ({ ...p, [cat.id]: { ...vals, name: e.target.value } }))}
                        className="flex-1 bg-[#1a1a1a] border border-primary/40 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none" autoFocus />
                    ) : (
                      <span className="flex-1 text-sm text-white">{cat.name}</span>
                    )}
                    <span className="text-[11px] text-[#444] shrink-0">{cat.videoCount ?? 0} video</span>
                    <button
                      onClick={toggleShowOnHome}
                      disabled={saving[cat.id]}
                      title="Anasayfa filtrelerinde göster/gizle"
                      className={cn(
                        "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors shrink-0 disabled:opacity-50",
                        cat.showOnHome !== false
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555]"
                      )}
                    >
                      {cat.showOnHome !== false ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {cat.showOnHome !== false ? "Anasayfada" : "Gizli"}
                    </button>
                    {!isEditing ? (
                      <>
                        <button onClick={() => setEditing(p => ({ ...p, [cat.id]: {
                          name: cat.name, slug: cat.slug, iconUrl: cat.icon_url || "",
                          showOnHome: cat.showOnHome !== false, homeOrder: cat.homeOrder ?? 0,
                        } }))}
                          className="text-[#444] hover:text-primary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                        {confirmDelete === cat.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deleteCategory(cat.id)} disabled={deleting[cat.id]}
                              className="text-[10px] text-red-400 bg-red-900/20 border border-red-900/30 px-2 py-1 rounded-lg">{deleting[cat.id] ? "..." : "Sil"}</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-[#555] px-1.5 py-1">İptal</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(cat.id)} className="text-[#444] hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </>
                    ) : (
                      <>
                        <button onClick={() => saveCategory(cat.id)} disabled={saving[cat.id]}
                          className="flex items-center gap-1 text-xs bg-primary/20 hover:bg-primary/30 text-primary px-2.5 py-1 rounded-lg disabled:opacity-50">
                          {saving[cat.id] ? "..." : <><Check className="h-3 w-3" /> Kaydet</>}
                        </button>
                        <button onClick={() => setEditing(p => { const n = { ...p }; delete n[cat.id]; return n; })} className="text-[#555] hover:text-white"><X className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                  {isEditing && (
                    <div className="grid grid-cols-2 gap-2 ml-10">
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1">Slug</label>
                        <input value={vals.slug} onChange={e => setEditing(p => ({ ...p, [cat.id]: { ...vals, slug: e.target.value } }))}
                          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1">İkon URL</label>
                        <input value={vals.iconUrl} onChange={e => setEditing(p => ({ ...p, [cat.id]: { ...vals, iconUrl: e.target.value } }))}
                          placeholder="https://..." className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1">Anasayfa Sırası (küçük = önce)</label>
                        <input type="number" value={vals.homeOrder} onChange={e => setEditing(p => ({ ...p, [cat.id]: { ...vals, homeOrder: +e.target.value } }))}
                          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                      </div>
                      <div className="flex items-end">
                        <button onClick={() => setEditing(p => ({ ...p, [cat.id]: { ...vals, showOnHome: !vals.showOnHome } }))}
                          className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
                            vals.showOnHome ? "bg-primary/15 border-primary/30 text-primary" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555]")}>
                          {vals.showOnHome ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          Anasayfa filtresinde göster
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
    </div>
  );
}

// ── Main AdminSiteSettings ───────────────────────────────────────────────────
export default function AdminSiteSettings() {
  const { config, setNavItem, setSection, setMaintenance, resetAll } = useSiteConfig();
  const [activeTab, setActiveTab] = useState<string>("general");

  const groups = Array.from(new Set(Object.values(NAV_DEFAULTS).map(v => v.group)));
  const globalMaint = config.maintenance["global"]?.enabled;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-900/20 p-2.5 rounded-xl"><Settings2 className="h-5 w-5 text-blue-400" /></div>
          <div>
            <h2 className="text-lg font-bold text-white">Site Ayarları</h2>
            <p className="text-[#666] text-xs mt-0.5">SEO, Webhook, Filigran ve Kategori yönetimi</p>
          </div>
        </div>
        <button onClick={resetAll} className="flex items-center gap-1.5 text-xs text-[#555] hover:text-red-400 border border-[#222] hover:border-red-900/50 px-3 py-1.5 rounded-lg transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Sıfırla
        </button>
      </div>

      {globalMaint && (
        <div className="bg-red-900/20 border border-red-900/40 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-red-300 text-xs">Site geneli bakım modu aktif.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1 bg-[#111] p-1 rounded-xl border border-[#222]">
        {[
          { id: "general",       icon: Palette,    label: "Genel Ayarlar" },
          { id: "nav",           icon: LayoutList, label: "Navbar" },
          { id: "categories",    icon: Tag,        label: "Kategoriler" },
          { id: "auto-category", icon: Sparkles,   label: "Otomatik Kategori" },
          { id: "seo",           icon: Search,     label: "SEO" },
          { id: "webhook",       icon: Webhook,    label: "Webhook" },
          { id: "maintenance",   icon: Wrench,     label: "Bakım" },
          { id: "watermark",     icon: Stamp,      label: "Filigran" },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn("flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all",
              activeTab === id ? "bg-[#1e1e1e] text-white border border-[#2a2a2a] shadow" : "text-[#555] hover:text-[#aaa]")}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {activeTab === "general" && <GeneralTab />}

      {activeTab === "nav" && (
        <div className="space-y-4">
          <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
              <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
              <span className="text-[11px] font-bold text-[#666] uppercase tracking-widest">Bölüm Başlıkları</span>
            </div>
            <div className="divide-y divide-[#1a1a1a]">
              {Object.entries(SECTION_DEFAULTS).map(([id]) => {
                const cfg = config.sections[id] ?? { label: SECTION_DEFAULTS[id], enabled: true };
                return (
                  <div key={id} className="flex items-center gap-3 px-4 py-3">
                    <Toggle checked={cfg.enabled} onChange={v => setSection(id, { enabled: v })} />
                    <InlineEdit value={cfg.label} onChange={v => setSection(id, { label: v })} />
                    <span className="text-[10px] text-[#444] font-mono">{id}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {groups.map(group => (
            <div key={group} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
                <span className="text-[11px] font-bold text-[#666] uppercase tracking-widest">{group}</span>
              </div>
              <div className="divide-y divide-[#1a1a1a]">
                {Object.entries(NAV_DEFAULTS).filter(([, v]) => v.group === group).map(([id]) => {
                  const cfg = config.nav[id] ?? { label: NAV_DEFAULTS[id].label, enabled: true };
                  return (
                    <div key={id} className={cn("flex items-center gap-3 px-4 py-3 transition-colors", !cfg.enabled && "opacity-50")}>
                      <Toggle checked={cfg.enabled} onChange={v => setNavItem(id, { enabled: v })} />
                      <InlineEdit value={cfg.label} onChange={v => setNavItem(id, { label: v })} />
                      <span className="text-[10px] text-[#444] font-mono hidden sm:block">{id}</span>
                      {!cfg.enabled && <EyeOff className="h-3.5 w-3.5 text-[#444] shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "categories" && <CategoryManagerTab />}
      {activeTab === "auto-category" && <AutoCategoryTab />}
      {activeTab === "seo" && <SeoTab />}
      {activeTab === "webhook" && <WebhookTab />}
      {activeTab === "watermark" && <WatermarkTab />}

      {activeTab === "maintenance" && (
        <div className="space-y-3">
          {Object.entries(MAINTENANCE_DEFAULTS).map(([id]) => {
            const cfg = config.maintenance[id] ?? { enabled: false, message: MAINTENANCE_DEFAULTS[id] };
            const isGlobal = id === "global";
            return (
              <div key={id} className={cn("bg-[#111] border rounded-xl overflow-hidden transition-all",
                cfg.enabled ? (isGlobal ? "border-red-900/50" : "border-yellow-900/40") : "border-[#222]")}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Toggle checked={cfg.enabled} onChange={v => setMaintenance(id, { enabled: v })} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", cfg.enabled ? (isGlobal ? "text-red-400" : "text-yellow-400") : "text-[#aaa]")}>
                      {isGlobal ? "🔴 Tüm Site" : id === "videos" ? "📹 Videolar" : id === "shorts" ? "⚡ Kısa Videolar" : id === "upload" ? "⬆️ Video Yükleme" : id === "payment" ? "💳 Ödeme" : id === "register" ? "👤 Yeni Kayıt" : id}
                    </p>
                  </div>
                  {cfg.enabled && <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", isGlobal ? "bg-red-900/30 text-red-400" : "bg-yellow-900/30 text-yellow-400")}>AKTİF</span>}
                </div>
                {cfg.enabled && (
                  <div className="px-4 pb-3">
                    <label className="text-[11px] text-[#555] uppercase tracking-wider block mb-1">Ziyaretçi Mesajı</label>
                    <input value={cfg.message} onChange={e => setMaintenance(id, { message: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
