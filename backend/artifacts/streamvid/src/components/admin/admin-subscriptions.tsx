import { useState } from "react";
import { CreditCard, Users, CheckCircle, Star, Filter, Search, MoreVertical,
         DollarSign, XCircle, AlertCircle, RefreshCw, Plus, Trash2, Edit3,
         X, Save, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const STATUS_OPTIONS = ["Tümü", "Aktif", "İptal Edildi", "Süresi Doldu", "Deneme"];
const PLAN_FILTERS   = ["Tümü", "Ücretsiz", "Premium", "Creator", "VIP"];

const MOCK_SUBS = [
  { id: 1, user: "ahmet_k", plan: "Premium", price: 9.99, status: "Aktif", start: "2025-01-15", end: "2026-01-15", method: "Kart" },
];

const STATUS_STYLE: Record<string, string> = {
  "Aktif":         "bg-green-900/30 text-green-400 border-green-800/40",
  "İptal Edildi":  "bg-red-900/30 text-red-400 border-red-800/40",
  "Süresi Doldu":  "bg-gray-800/60 text-gray-400 border-gray-700/40",
  "Deneme":        "bg-blue-900/30 text-blue-400 border-blue-800/40",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  billingCycle: "monthly" as "monthly" | "yearly" | "lifetime",
  features: "",
  isPopular: false,
  isActive: true,
};

type PlanForm = typeof EMPTY_FORM;

function PlanModal({
  open, onClose, initial, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: PlanForm & { id?: number };
  onSave: (data: PlanForm & { id?: number }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<PlanForm & { id?: number }>(initial);

  if (!open) return null;

  const set = (k: keyof PlanForm, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222]">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {form.id ? "Planı Düzenle" : "Yeni Plan Oluştur"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a] text-[#555] hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Ad */}
          <div>
            <label className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5 block">Plan Adı *</label>
            <input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Premium, VIP, Creator..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary/60"
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5 block">Açıklama</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={2}
              placeholder="Bu planın kısa açıklaması..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary/60 resize-none"
            />
          </div>

          {/* Fiyat + Dönem */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5 block">Fiyat ($) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => set("price", e.target.value)}
                placeholder="9.99"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary/60"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5 block">Dönem</label>
              <select
                value={form.billingCycle}
                onChange={e => set("billingCycle", e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/60"
              >
                <option value="monthly">Aylık</option>
                <option value="yearly">Yıllık</option>
                <option value="lifetime">Ömür Boyu</option>
              </select>
            </div>
          </div>

          {/* Özellikler */}
          <div>
            <label className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5 block">
              Özellikler <span className="text-[#555] font-normal">(her satır ayrı)</span>
            </label>
            <textarea
              value={form.features}
              onChange={e => set("features", e.target.value)}
              rows={4}
              placeholder={"Reklamsız izleme\nHD kalite\nÖzel içerikler\nÜcretsiz indirme"}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary/60 resize-none font-mono"
            />
          </div>

          {/* Toggles */}
          <div className="flex gap-4">
            {([
              { key: "isPopular", label: "Popüler (öne çıkar)", color: "text-yellow-400" },
              { key: "isActive",  label: "Aktif (kullanıcılara göster)", color: "text-green-400" },
            ] as const).map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => set(key, !(form as any)[key])}
                  className={cn(
                    "w-10 h-5 rounded-full border transition-all relative",
                    (form as any)[key]
                      ? "bg-primary border-primary"
                      : "bg-[#222] border-[#333]"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                    (form as any)[key] ? "left-5" : "left-0.5"
                  )} />
                </div>
                <span className={cn("text-xs", (form as any)[key] ? color : "text-[#555]")}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#222]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#888] hover:text-white transition-colors"
          >
            İptal
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name || !form.price}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminSubscriptions() {
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [planFilter, setPlanFilter]     = useState("Tümü");
  const [search, setSearch]             = useState("");
  const [menuOpen, setMenuOpen]         = useState<number | null>(null);
  const [modal, setModal]               = useState<{ open: boolean; form: PlanForm & { id?: number } }>({
    open: false,
    form: EMPTY_FORM,
  });

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const r = await fetch("/api/admin/subscription-plans", { headers: getHeaders() });
      if (!r.ok) throw new Error("Planlar alınamadı");
      return r.json();
    },
  });
  const plans: any[] = data?.plans ?? [];

  const saveMutation = useMutation({
    mutationFn: async (form: PlanForm & { id?: number }) => {
      const features = form.features
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);
      const payload = { ...form, price: parseFloat(form.price as string) || 0, features };

      if (form.id) {
        const r = await fetch(`/api/admin/subscription-plans/${form.id}`, {
          method: "PATCH", headers: getHeaders(), body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("Güncelleme başarısız");
      } else {
        const r = await fetch("/api/admin/subscription-plans/create", {
          method: "POST", headers: getHeaders(), body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("Oluşturma başarısız");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      setModal({ open: false, form: EMPTY_FORM });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/subscription-plans/${id}`, { method: "DELETE", headers: getHeaders() });
      if (!r.ok) throw new Error("Silme başarısız");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }),
  });

  const openCreate = () =>
    setModal({ open: true, form: { ...EMPTY_FORM } });

  const openEdit = (plan: any) =>
    setModal({
      open: true,
      form: {
        id: plan.id,
        name: plan.name ?? "",
        description: plan.description ?? "",
        price: String(plan.price ?? ""),
        billingCycle: plan.billingCycle ?? "monthly",
        features: (plan.features ?? []).join("\n"),
        isPopular: !!plan.isPopular,
        isActive: !!plan.isActive,
      },
    });

  const filtered = MOCK_SUBS.filter(s => {
    if (statusFilter !== "Tümü" && s.status !== statusFilter) return false;
    if (planFilter !== "Tümü" && s.plan !== planFilter) return false;
    if (search && !s.user.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    active:    MOCK_SUBS.filter(s => s.status === "Aktif").length,
    revenue:   MOCK_SUBS.filter(s => s.status === "Aktif").reduce((a, s) => a + s.price, 0).toFixed(2),
    cancelled: MOCK_SUBS.filter(s => s.status === "İptal Edildi").length,
    trial:     MOCK_SUBS.filter(s => s.status === "Deneme").length,
  };

  const cycleLabel: Record<string, string> = { monthly: "ay", yearly: "yıl", lifetime: "ömür boyu" };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Modal */}
      <PlanModal
        open={modal.open}
        onClose={() => setModal(m => ({ ...m, open: false }))}
        initial={modal.form}
        onSave={form => saveMutation.mutate(form)}
        saving={saveMutation.isPending}
      />

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" /> Abonelik Yönetimi
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Yeni Plan
        </button>
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Aktif Aboneler", value: stats.active,       icon: Users,       color: "text-green-400",  bg: "bg-green-900/20" },
          { label: "Aylık Gelir",    value: `$${stats.revenue}`, icon: DollarSign, color: "text-blue-400",   bg: "bg-blue-900/20" },
          { label: "İptal Edilen",   value: stats.cancelled,    icon: XCircle,     color: "text-red-400",    bg: "bg-red-900/20" },
          { label: "Deneme Süresi",  value: stats.trial,        icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-900/20" },
        ].map(card => (
          <div key={card.label} className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1.5 rounded-lg", card.bg)}>
                <card.icon className={cn("h-4 w-4", card.color)} />
              </div>
              <span className="text-xs text-[#555]">{card.label}</span>
            </div>
            <p className={cn("text-2xl font-black", card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Planlar */}
      <div>
        <h2 className="text-sm font-bold text-[#666] uppercase tracking-widest mb-3">Abonelik Planları</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-[#555]">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Planlar yükleniyor...
          </div>
        ) : plans.length === 0 ? (
          <div className="border border-dashed border-[#2a2a2a] rounded-xl p-10 text-center text-[#555]">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm mb-3">Henüz plan yok</p>
            <button onClick={openCreate} className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto">
              <Plus className="h-3 w-3" /> İlk planı oluştur
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan: any) => (
              <div
                key={plan.id}
                className={cn(
                  "bg-[#111] border rounded-xl p-5 relative",
                  plan.isPopular ? "border-primary" : "border-[#222]",
                  !plan.isActive && "opacity-50"
                )}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-3 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" /> Popüler
                  </div>
                )}
                {!plan.isActive && (
                  <div className="absolute top-3 right-3 text-[10px] bg-[#333] text-[#777] px-2 py-0.5 rounded-full border border-[#444]">
                    Pasif
                  </div>
                )}
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <div className="text-3xl font-black text-primary my-3">
                  ${plan.price}
                  <span className="text-sm text-[#666] font-normal">/{cycleLabel[plan.billingCycle] ?? plan.billingCycle}</span>
                </div>
                <p className="text-sm text-[#888] mb-4">{plan.description}</p>
                {plan.features?.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {plan.features.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-[#ccc]">
                        <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="pt-4 border-t border-[#2a2a2a] flex items-center justify-between gap-2">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full border",
                    plan.isActive
                      ? "bg-green-900/30 text-green-400 border-green-800/40"
                      : "bg-[#222] text-[#555] border-[#2a2a2a]"
                  )}>
                    {plan.isActive ? "Aktif" : "Pasif"}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEdit(plan)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] hover:border-primary/50 hover:text-white transition-colors"
                    >
                      <Edit3 className="h-3 w-3" /> Düzenle
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`"${plan.name}" planını silmek istediğine emin misin?`))
                          deleteMutation.mutate(plan.id);
                      }}
                      className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-red-500 hover:border-red-800/50 hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abone Listesi */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-[#666] uppercase tracking-widest">Aboneler</h2>
          <div className="flex items-center gap-1.5 text-xs text-yellow-500/80 bg-yellow-900/20 border border-yellow-800/30 rounded-full px-2.5 py-0.5">
            <Info className="h-3 w-3 shrink-0" />
            Aşağıdaki satır örnek veridir — gerçek abone listesi ödeme sistemi entegrasyonu sonrası buraya yansır
          </div>
        </div>
        <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-4 space-y-3 mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Kullanıcı ara..."
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all",
                    statusFilter === s ? "border-primary bg-primary/15 text-white font-semibold" : "border-[#2a2a2a] bg-[#1a1a1a] text-[#666] hover:border-[#444]"
                  )}>{s}</button>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {PLAN_FILTERS.map(p => (
                <button key={p} onClick={() => setPlanFilter(p)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all",
                    planFilter === p ? "border-primary bg-primary/15 text-white font-semibold" : "border-[#2a2a2a] bg-[#1a1a1a] text-[#666] hover:border-[#444]"
                  )}>{p}</button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[#555]">{filtered.length} abone gösteriliyor</p>
        </div>

        <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_80px_1fr_1fr_100px_40px] gap-0 text-[10px] font-bold text-[#555] uppercase tracking-wider px-4 py-2.5 border-b border-[#1e1e1e]">
            <span>Kullanıcı</span><span>Plan</span><span>Fiyat</span><span>Başlangıç</span><span>Bitiş</span><span>Durum</span><span />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[#555]">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Filtreye uyan abone yok</p>
            </div>
          ) : (
            filtered.map((sub, i) => (
              <div key={sub.id}
                className={cn("grid grid-cols-[1fr_1fr_80px_1fr_1fr_100px_40px] gap-0 px-4 py-3 items-center text-sm border-b border-[#1a1a1a] last:border-0",
                  i % 2 === 0 ? "bg-transparent" : "bg-[#111]")}
              >
                <span className="font-medium text-[#ddd]">@{sub.user}</span>
                <span className="text-[#888]">{sub.plan}</span>
                <span className="text-green-400 font-mono font-semibold">${sub.price}</span>
                <span className="text-[#666] text-xs">{sub.start}</span>
                <span className="text-[#666] text-xs">{sub.end}</span>
                <span>
                  <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-semibold", STATUS_STYLE[sub.status] ?? "bg-[#222] text-[#666] border-[#333]")}>
                    {sub.status}
                  </span>
                </span>
                <div className="relative">
                  <button onClick={() => setMenuOpen(menuOpen === sub.id ? null : sub.id)}
                    className="p-1 rounded hover:bg-[#2a2a2a] text-[#555] hover:text-white transition-colors">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen === sub.id && (
                    <div className="absolute right-0 top-7 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-20 overflow-hidden w-36">
                      <button className="flex items-center gap-2 px-3 py-2 w-full text-xs text-[#ccc] hover:bg-[#252525]">
                        <RefreshCw className="h-3 w-3" /> Yenile
                      </button>
                      <button className="flex items-center gap-2 px-3 py-2 w-full text-xs text-red-400 hover:bg-red-900/20">
                        <XCircle className="h-3 w-3" /> İptal Et
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Ödeme Entegrasyonları */}
      <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-5">
        <h2 className="font-bold mb-3 text-[#ddd]">Ödeme Entegrasyonları</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: "Stripe",  status: "Hazır",  note: "Kart ödemeleri",   icon: "💳" },
            { name: "PayPal",  status: "Yakında", note: "PayPal ödemeleri", icon: "🅿️" },
            { name: "Kripto",  status: "Aktif",  note: "15 coin destekli", icon: "₿" },
            { name: "Papara",  status: "Yakında", note: "Türk lirası",      icon: "🇹🇷" },
          ].map(p => (
            <div key={p.name} className="bg-[#151515] rounded-xl p-4 border border-[#222]">
              <div className="text-2xl mb-2">{p.icon}</div>
              <p className="font-medium text-sm text-[#ddd]">{p.name}</p>
              <p className="text-xs text-[#555] mt-0.5">{p.note}</p>
              <span className={cn("text-xs mt-2 inline-block px-2 py-0.5 rounded-full border",
                p.status === "Hazır" || p.status === "Aktif"
                  ? "bg-green-900/30 text-green-400 border-green-800/40"
                  : "bg-[#222] text-[#555] border-[#2a2a2a]"
              )}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
