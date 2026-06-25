import { useState, useRef, useEffect, useCallback } from "react";
import { useSiteConfig, NAV_DEFAULTS, SECTION_DEFAULTS, MAINTENANCE_DEFAULTS } from "@/lib/use-site-config";
import { useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import {
  Settings2, Eye, EyeOff, Edit2, Check, X, RotateCcw,
  AlertTriangle, Wrench, ChevronRight, Tag, LayoutList, Stamp, Sparkles, Plus, Trash2, Search,
  Globe, Link2, ShieldAlert, Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "/api";

// ── Otomatik Kategorileme Sekmesi ──────────────────────────────────────────
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
    if (!token) return;
    fetch(`${API_BASE}/auto-category/rules`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (!d.rules) return;
        const map: Record<number, { keywords: string[]; isEnabled: boolean }> = {};
        for (const r of d.rules) {
          map[r.categoryId] = { keywords: r.keywords ?? [], isEnabled: r.isEnabled ?? true };
        }
        setRules(map);
        setLoaded(true);
      });
  }, [token]);

  const setEnabled = (catId: number, v: boolean) =>
    setRules(p => ({ ...p, [catId]: { ...(p[catId] ?? { keywords: [] }), isEnabled: v } }));

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

  const removeKeyword = (catId: number, kw: string) =>
    setRules(p => {
      const existing = p[catId] ?? { keywords: [], isEnabled: true };
      return { ...p, [catId]: { ...existing, keywords: existing.keywords.filter(k => k !== kw) } };
    });

  const save = async () => {
    setSaving(true);
    try {
      const payload = allCategories.map(cat => ({
        categoryId: cat.id,
        keywords: rules[cat.id]?.keywords ?? [],
        isEnabled: rules[cat.id]?.isEnabled ?? true,
      }));
      await fetch(`${API_BASE}/auto-category/rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rules: payload }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="py-10 text-center text-[#555] text-sm">Yükleniyor...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#555]">
          Her kategori için anahtar kelimeler tanımlayın. Video başlığı/açıklaması eşleşince kategori otomatik önerilir.
        </p>
        <button
          onClick={save}
          disabled={saving}
          className={cn(
            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all",
            saved ? "bg-green-900/40 text-green-400" : "bg-primary/20 hover:bg-primary/30 text-primary"
          )}
        >
          {saved ? <><Check className="h-3 w-3" /> Kaydedildi</> : saving ? "Kaydediliyor..." : <><Check className="h-3 w-3" /> Kaydet</>}
        </button>
      </div>

      {allCategories.map(cat => {
        const rule = rules[cat.id] ?? { keywords: [], isEnabled: true };
        return (
          <div key={cat.id} className={cn(
            "bg-[#111] border rounded-xl overflow-hidden transition-all",
            rule.isEnabled ? "border-[#222]" : "border-[#1a1a1a] opacity-60"
          )}>
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => setEnabled(cat.id, !rule.isEnabled)}
                className={cn("w-9 h-5 rounded-full relative shrink-0 transition-all", rule.isEnabled ? "bg-primary" : "bg-[#333]")}
              >
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
                        <button onClick={() => removeKeyword(cat.id, kw)} className="text-[#555] hover:text-red-400 transition-colors ml-0.5">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={draft[cat.id] ?? ""}
                    onChange={e => setDraft(p => ({ ...p, [cat.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword(cat.id))}
                    placeholder="Anahtar kelime ekle (Enter)..."
                    className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#444] placeholder:text-[#444]"
                  />
                  <button
                    onClick={() => addKeyword(cat.id)}
                    className="flex items-center gap-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-[#aaa] transition-colors"
                  >
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn("w-11 h-6 rounded-full transition-all relative shrink-0", checked ? "bg-primary" : "bg-[#333]")}
    >
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
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") cancel(); }}
          className="flex-1 bg-[#111] border border-primary rounded px-2 py-1 text-sm text-white focus:outline-none min-w-0"
        />
        <button onClick={confirm} className="text-green-400 hover:text-green-300"><Check className="h-4 w-4" /></button>
        <button onClick={cancel} className="text-[#555] hover:text-white"><X className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0 group cursor-pointer" onClick={start}>
      <span className="text-sm text-white truncate flex-1">{value}</span>
      <Edit2 className="h-3.5 w-3.5 text-[#444] group-hover:text-[#888] shrink-0 transition-colors" />
    </div>
  );
}

function WatermarkTab() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/watermark/admin/settings");
    const d = await r.json();
    setSettings(d.settings);
    setForm(d.settings || {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const r = await fetch("/api/watermark/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setSettings(d.settings);
    setForm(d.settings);
    setSaving(false);
  };

  if (!settings) return <div className="flex items-center justify-center h-32 text-[#555] text-sm">Yükleniyor...</div>;

  const positions = [
    { value: "top-left",     label: "Sol Üst" },
    { value: "top-right",    label: "Sağ Üst" },
    { value: "bottom-left",  label: "Sol Alt" },
    { value: "bottom-right", label: "Sağ Alt" },
    { value: "center",       label: "Ortada" },
  ];

  return (
    <div className="space-y-5">
      {/* Sistem toggle */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Filigran Sistemi</p>
          <p className="text-xs text-[#555] mt-0.5">Etkinleştirildiğinde, watermarkEnabled olan videolarda filigran görünür</p>
        </div>
        <button
          onClick={() => setForm((f: any) => ({ ...f, isEnabled: !f.isEnabled }))}
          className={cn(
            "w-12 h-6 rounded-full transition-all relative shrink-0",
            form.isEnabled ? "bg-blue-500" : "bg-[#333]"
          )}
        >
          <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", form.isEnabled ? "left-7" : "left-1")} />
        </button>
      </div>

      {!form.isEnabled && (
        <div className="flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
          <Stamp className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-500/80">Filigran sistemi pasif. Hiçbir videoda gösterilmez.</p>
        </div>
      )}

      {/* İçerik türü */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Filigran İçeriği</p>
        <div className="flex gap-3">
          <button
            onClick={() => setForm((f: any) => ({ ...f, useImage: false }))}
            className={cn("flex-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all",
              !form.useImage ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-[#aaa]"
            )}
          >
            Metin Filigranı
          </button>
          <button
            onClick={() => setForm((f: any) => ({ ...f, useImage: true }))}
            className={cn("flex-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all",
              form.useImage ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-[#aaa]"
            )}
          >
            Logo / Resim
          </button>
        </div>

        {form.useImage ? (
          <div>
            <label className="text-xs text-[#666] block mb-1.5">Logo URL (PNG/SVG önerilir)</label>
            <input
              value={form.imageUrl || ""}
              onChange={e => setForm((f: any) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="https://example.com/logo.png"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40"
            />
            {form.imageUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={form.imageUrl} alt="preview" className="h-8 object-contain bg-[#1a1a1a] rounded p-1 border border-[#2a2a2a]" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span className="text-xs text-[#555]">Önizleme</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="text-xs text-[#666] block mb-1.5">Filigran Metni</label>
            <input
              value={form.text || ""}
              onChange={e => setForm((f: any) => ({ ...f, text: e.target.value }))}
              placeholder="Prnhbbbb"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40"
            />
          </div>
        )}
      </div>

      {/* Konum, boyut, opaklık */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Görünüm</p>

        <div>
          <label className="text-xs text-[#666] block mb-2">Konum</label>
          <div className="grid grid-cols-3 gap-1.5">
            {positions.map(p => (
              <button key={p.value} onClick={() => setForm((f: any) => ({ ...f, position: p.value }))}
                className={cn("px-2 py-2 rounded-lg text-xs font-medium border transition-all",
                  form.position === p.value
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-[#aaa]"
                )}>
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
                  form.size === s.v
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-[#aaa]"
                )}>
                {s.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-[#666] block mb-2">
            Opaklık — <span className="text-white font-medium">{Math.round((form.opacity ?? 0.4) * 100)}%</span>
          </label>
          <input
            type="range" min="0.05" max="1" step="0.05"
            value={form.opacity ?? 0.4}
            onChange={e => setForm((f: any) => ({ ...f, opacity: parseFloat(e.target.value) }))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-[#444] mt-1">
            <span>%5 (çok hafif)</span>
            <span>%100 (tam)</span>
          </div>
        </div>

        {/* Canlı önizleme */}
        <div>
          <label className="text-xs text-[#666] block mb-2">Önizleme</label>
          <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden h-32">
            <div className="absolute inset-0 flex items-center justify-center text-[#333] text-xs">Video alanı</div>
            <div className={cn("absolute flex",
              form.position === "top-left"     ? "top-2 left-2" :
              form.position === "top-right"    ? "top-2 right-2" :
              form.position === "bottom-left"  ? "bottom-2 left-2" :
              form.position === "bottom-right" ? "bottom-2 right-2" :
              "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            )} style={{ opacity: form.opacity ?? 0.4 }}>
              {form.useImage && form.imageUrl ? (
                <img src={form.imageUrl} alt="wm"
                  className={cn("object-contain", form.size === "small" ? "h-4" : form.size === "large" ? "h-8" : "h-6")} />
              ) : (
                <span className={cn("text-white font-bold bg-black/30 rounded px-1.5 py-0.5",
                  form.size === "small" ? "text-[9px]" : form.size === "large" ? "text-sm" : "text-xs"
                )}>
                  {form.text || "Prnhbbbb"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
      >
        {saving ? "Kaydediliyor..." : <><Check className="h-4 w-4" /> Ayarları Kaydet</>}
      </button>
    </div>
  );
}

function SeoTab() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/seo/admin/settings")
      .then(r => r.json())
      .then(d => setSettings(d.settings || {
        siteTitle: "Prnhbbbb",
        siteDescription: "Video streaming ve sosyal platform",
        keywords: "video, streaming, creator, sosyal",
        robots: "index,follow",
        ogImage: "",
      }));
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/seo/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) return <div className="py-10 text-center text-[#555] text-sm">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2"><Search className="h-3.5 w-3.5" /> SEO Aracı</p>
        {[
          { key: "siteTitle", label: "Site Başlığı" },
          { key: "siteDescription", label: "Site Açıklaması" },
          { key: "keywords", label: "Anahtar Kelimeler" },
          { key: "robots", label: "Robots" },
          { key: "ogImage", label: "OG Görseli URL" },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs text-[#666] block mb-1.5">{f.label}</label>
            <input
              value={settings[f.key] || ""}
              onChange={e => setSettings((p: any) => ({ ...p, [f.key]: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40"
            />
          </div>
        ))}
        <div className="grid md:grid-cols-3 gap-2 text-xs text-[#666]">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3"><Globe className="h-4 w-4 text-blue-400 mb-2" /> Daha iyi indeksleme için sayfa başlıkları ve açıklamalar.</div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3"><Link2 className="h-4 w-4 text-green-400 mb-2" /> Open Graph ve sosyal paylaşım önizlemeleri.</div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3"><ShieldAlert className="h-4 w-4 text-yellow-400 mb-2" /> Robots yönergeleri ve temel SEO kontrolü.</div>
        </div>
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-all">
          {saving ? "Kaydediliyor..." : saved ? "Kaydedildi" : "SEO Ayarlarını Kaydet"}
        </button>
      </div>
    </div>
  );
}

function WebhookTab() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/webhooks/admin/settings")
      .then(r => r.json())
      .then(d => setSettings(d.settings || {
        isEnabled: false,
        endpointUrl: "",
        secret: "",
        events: ["video.created", "user.registered", "payment.completed"],
      }));
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/webhooks/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) return <div className="py-10 text-center text-[#555] text-sm">Yükleniyor...</div>;

  const toggleEvent = (event: string) => {
    setSettings((p: any) => ({
      ...p,
      events: p.events.includes(event) ? p.events.filter((e: string) => e !== event) : [...p.events, event],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2"><Webhook className="h-3.5 w-3.5" /> Webhook Sistemi</p>
            <p className="text-xs text-[#555] mt-1">Pasif modda; kayıtlı ama tetiklenmez.</p>
          </div>
          <button
            onClick={() => setSettings((p: any) => ({ ...p, isEnabled: !p.isEnabled }))}
            className={cn("w-12 h-6 rounded-full transition-all relative shrink-0", settings.isEnabled ? "bg-primary" : "bg-[#333]")}
          >
            <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", settings.isEnabled ? "left-7" : "left-1")} />
          </button>
        </div>
        {!settings.isEnabled && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 text-xs text-yellow-500/80">
            Webhook sistemi pasif. Eventler gösterilir ama gönderim yapılmaz.
          </div>
        )}
        <div>
          <label className="text-xs text-[#666] block mb-1.5">Endpoint URL</label>
          <input
            value={settings.endpointUrl || ""}
            onChange={e => setSettings((p: any) => ({ ...p, endpointUrl: e.target.value }))}
            placeholder="https://example.com/webhook"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40"
          />
        </div>
        <div>
          <label className="text-xs text-[#666] block mb-1.5">Secret</label>
          <input
            value={settings.secret || ""}
            onChange={e => setSettings((p: any) => ({ ...p, secret: e.target.value }))}
            placeholder="whsec_..."
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40"
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-[#666]">Eventler</p>
          <div className="flex flex-wrap gap-2">
            {["video.created", "video.updated", "user.registered", "payment.completed", "creator.approved"].map(event => (
              <button
                key={event}
                onClick={() => toggleEvent(event)}
                className={cn("px-3 py-1.5 rounded-full text-xs border transition-all",
                  settings.events.includes(event) ? "bg-primary/15 text-primary border-primary/30" : "bg-[#1a1a1a] text-[#666] border-[#2a2a2a]"
                )}
              >
                {event}
              </button>
            ))}
          </div>
        </div>
        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-all">
          {saving ? "Kaydediliyor..." : saved ? "Kaydedildi" : "Webhook Ayarlarını Kaydet"}
        </button>
      </div>
    </div>
  );
}

export default function AdminSiteSettings() {
  const { config, setNavItem, setSection, setMaintenance, resetAll } = useSiteConfig();
  const { data: categoriesData, refetch } = useListCategories();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"nav" | "categories" | "maintenance" | "watermark" | "seo" | "webhook">("nav");
  const [catEditing, setCatEditing] = useState<Record<number, string>>({});
  const [catSaving, setCatSaving] = useState<Record<number, boolean>>({});

  const categories: any[] = (categoriesData as any)?.categories ?? (Array.isArray(categoriesData) ? categoriesData : []);

  const groups = Array.from(new Set(Object.values(NAV_DEFAULTS).map(v => v.group)));

  const saveCategoryName = async (id: number, name: string) => {
    setCatSaving(s => ({ ...s, [id]: true }));
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE}/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      await refetch();
      setCatEditing(e => { const n = { ...e }; delete n[id]; return n; });
    } catch {}
    setCatSaving(s => ({ ...s, [id]: false }));
  };

  const globalMaint = config.maintenance["global"]?.enabled;

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-900/20 p-2.5 rounded-xl"><Settings2 className="h-5 w-5 text-blue-400" /></div>
          <div>
            <h2 className="text-lg font-bold text-white">Site Ayarları</h2>
            <p className="text-[#666] text-xs mt-0.5">Navbar içerikleri, kategoriler ve bakım modları</p>
          </div>
        </div>
        <button onClick={resetAll} className="flex items-center gap-1.5 text-xs text-[#555] hover:text-red-400 transition-colors border border-[#222] hover:border-red-900/50 px-3 py-1.5 rounded-lg">
          <RotateCcw className="h-3.5 w-3.5" /> Sıfırla
        </button>
      </div>

      {/* Global Bakım Uyarısı */}
      {globalMaint && (
        <div className="bg-red-900/20 border border-red-900/40 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-red-300 text-xs">Site geneli bakım modu aktif. Ziyaretçiler bakım sayfası görüyor.</p>
        </div>
      )}

      {/* Sekmeler */}
      <div className="flex gap-1 bg-[#111] p-1 rounded-xl border border-[#222] flex-wrap">
        {[
          { id: "nav", icon: LayoutList, label: "Navbar & Menü" },
          { id: "categories", icon: Tag, label: "Kategoriler" },
          { id: "auto-category", icon: Sparkles, label: "Otomatik Kat." },
          { id: "seo", icon: Search, label: "SEO Aracı" },
          { id: "webhook", icon: Webhook, label: "Webhook" },
          { id: "maintenance", icon: Wrench, label: "Bakım Modu" },
          { id: "watermark", icon: Stamp, label: "Filigran" },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
              activeTab === id ? "bg-[#1e1e1e] text-white border border-[#2a2a2a] shadow" : "text-[#555] hover:text-[#aaa]"
            )}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── NAV ITEMS ── */}
      {activeTab === "nav" && (
        <div className="space-y-4">
          {/* Section labels */}
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

          {/* Nav items grouped */}
          {groups.map(group => (
            <div key={group} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
                <span className="text-[11px] font-bold text-[#666] uppercase tracking-widest">{group}</span>
              </div>
              <div className="divide-y divide-[#1a1a1a]">
                {Object.entries(NAV_DEFAULTS)
                  .filter(([, v]) => v.group === group)
                  .map(([id]) => {
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

      {/* ── KATEGORİLER ── */}
      {activeTab === "categories" && (
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#666] uppercase tracking-widest">DB Kategorileri</span>
            <span className="text-[11px] text-[#555]">{categories.length} kategori</span>
          </div>
          {categories.length === 0 ? (
            <div className="py-10 text-center text-[#555] text-sm">Kategori bulunamadı</div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {categories.map(cat => {
                const isDirty = catEditing[cat.id] !== undefined;
                const editVal = catEditing[cat.id] ?? cat.name;
                return (
                  <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center text-xs text-[#666] font-mono shrink-0">
                      {cat.id}
                    </div>
                    <input
                      value={editVal}
                      onChange={e => setCatEditing(p => ({ ...p, [cat.id]: e.target.value }))}
                      className={cn(
                        "flex-1 bg-transparent text-sm text-white focus:outline-none focus:bg-[#1a1a1a] px-2 py-1 rounded transition-colors border",
                        isDirty ? "border-primary/50" : "border-transparent"
                      )}
                    />
                    <span className="text-[11px] text-[#444]">{cat.videoCount ?? 0} video</span>
                    {isDirty && (
                      <button
                        onClick={() => saveCategoryName(cat.id, editVal)}
                        disabled={catSaving[cat.id]}
                        className="flex items-center gap-1 text-xs bg-primary/20 hover:bg-primary/30 text-primary px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {catSaving[cat.id] ? "..." : <><Check className="h-3 w-3" /> Kaydet</>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SEO ── */}
      {activeTab === "seo" && <SeoTab />}

      {/* ── WEBHOOK ── */}
      {activeTab === "webhook" && <WebhookTab />}

      {/* ── FİLİGRAN ── */}
      {activeTab === "watermark" && <WatermarkTab />}

      {/* ── BAKIM MODU ── */}
      {activeTab === "maintenance" && (
        <div className="space-y-3">
          {Object.entries(MAINTENANCE_DEFAULTS).map(([id]) => {
            const cfg = config.maintenance[id] ?? { enabled: false, message: MAINTENANCE_DEFAULTS[id] };
            const isGlobal = id === "global";
            return (
              <div key={id} className={cn(
                "bg-[#111] border rounded-xl overflow-hidden transition-all",
                cfg.enabled ? (isGlobal ? "border-red-900/50" : "border-yellow-900/40") : "border-[#222]"
              )}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Toggle checked={cfg.enabled} onChange={v => setMaintenance(id, { enabled: v })} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", cfg.enabled ? (isGlobal ? "text-red-400" : "text-yellow-400") : "text-[#aaa]")}>
                      {isGlobal ? "🔴 Tüm Site" :
                       id === "videos" ? "📹 Videolar Sayfası" :
                       id === "shorts" ? "⚡ Kısa Videolar" :
                       id === "upload" ? "⬆️ Video Yükleme" :
                       id === "payment" ? "💳 Ödeme Sistemi" :
                       id === "register" ? "👤 Yeni Kayıt" : id}
                    </p>
                  </div>
                  {cfg.enabled && (
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold",
                      isGlobal ? "bg-red-900/30 text-red-400" : "bg-yellow-900/30 text-yellow-400"
                    )}>AKTİF</span>
                  )}
                </div>
                {cfg.enabled && (
                  <div className="px-4 pb-3">
                    <label className="text-[11px] text-[#555] uppercase tracking-wider block mb-1">Ziyaretçi Mesajı</label>
                    <input
                      value={cfg.message}
                      onChange={e => setMaintenance(id, { message: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444]"
                    />
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
