import { useState } from "react";
import { useListSubscriptionPlans } from "@workspace/api-client-react";
import { CreditCard, Users, CheckCircle, Star, Filter, Search, MoreVertical, TrendingUp, DollarSign, XCircle, AlertCircle, RefreshCw, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["Tümü", "Aktif", "İptal Edildi", "Süresi Doldu", "Deneme"];
const PLAN_FILTERS   = ["Tümü", "Ücretsiz", "Premium", "Creator", "VIP"];

const MOCK_SUBS = [
  { id: 1, user: "ahmet_k",  plan: "Premium",  price: 9.99,  status: "Aktif",         start: "2025-01-15", end: "2026-01-15", method: "Kart" },
  { id: 2, user: "zeynep_s", plan: "Creator",  price: 24.99, status: "Aktif",         start: "2025-03-10", end: "2026-03-10", method: "Kripto" },
  { id: 3, user: "mert_d",   plan: "VIP",      price: 49.99, status: "İptal Edildi",  start: "2024-10-01", end: "2025-10-01", method: "Kart" },
  { id: 4, user: "selin_y",  plan: "Premium",  price: 9.99,  status: "Deneme",        start: "2025-06-20", end: "2025-07-20", method: "—" },
  { id: 5, user: "emre_t",   plan: "Creator",  price: 24.99, status: "Süresi Doldu",  start: "2024-05-01", end: "2025-05-01", method: "Kart" },
  { id: 6, user: "ayse_b",   plan: "Premium",  price: 9.99,  status: "Aktif",         start: "2025-05-01", end: "2026-05-01", method: "PayPal" },
];

const STATUS_STYLE: Record<string, string> = {
  "Aktif":         "bg-green-900/30 text-green-400 border-green-800/40",
  "İptal Edildi":  "bg-red-900/30 text-red-400 border-red-800/40",
  "Süresi Doldu":  "bg-gray-800/60 text-gray-400 border-gray-700/40",
  "Deneme":        "bg-blue-900/30 text-blue-400 border-blue-800/40",
};

export function AdminSubscriptions() {
  const { data } = useListSubscriptionPlans();
  const plans = data?.plans ?? (data as any)?.subscriptionPlans ?? [];

  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [planFilter, setPlanFilter]     = useState("Tümü");
  const [search, setSearch]             = useState("");
  const [menuOpen, setMenuOpen]         = useState<number | null>(null);

  const filtered = MOCK_SUBS.filter(s => {
    if (statusFilter !== "Tümü" && s.status !== statusFilter) return false;
    if (planFilter !== "Tümü" && s.plan !== planFilter) return false;
    if (search && !s.user.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    active:  MOCK_SUBS.filter(s => s.status === "Aktif").length,
    revenue: MOCK_SUBS.filter(s => s.status === "Aktif").reduce((a, s) => a + s.price, 0).toFixed(2),
    cancelled: MOCK_SUBS.filter(s => s.status === "İptal Edildi").length,
    trial: MOCK_SUBS.filter(s => s.status === "Deneme").length,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" /> Abonelik Yönetimi
        </h1>
        <button className="flex items-center gap-2 text-xs bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-1.5 rounded-lg hover:border-[#444] transition-colors">
          <Download className="h-3.5 w-3.5" /> CSV İndir
        </button>
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Aktif Aboneler",   value: stats.active,            icon: Users,      color: "text-green-400", bg: "bg-green-900/20" },
          { label: "Aylık Gelir",      value: `$${stats.revenue}`,     icon: DollarSign, color: "text-blue-400",  bg: "bg-blue-900/20" },
          { label: "İptal Edilen",     value: stats.cancelled,         icon: XCircle,    color: "text-red-400",   bg: "bg-red-900/20" },
          { label: "Deneme Süresi",    value: stats.trial,             icon: AlertCircle,color: "text-yellow-400",bg: "bg-yellow-900/20" },
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
        <div className="grid md:grid-cols-3 gap-4">
          {plans.length > 0 ? plans.map((plan: any) => (
            <div key={plan.id} className={cn("bg-[#111] border rounded-xl p-5 relative", plan.isPopular ? "border-primary" : "border-[#222]")}>
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-3 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="h-3 w-3" /> Popüler
                </div>
              )}
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <div className="text-3xl font-black text-primary my-3">
                ${plan.price}<span className="text-sm text-[#666] font-normal">/{plan.billingCycle === "monthly" ? "ay" : plan.billingCycle}</span>
              </div>
              <p className="text-sm text-[#888] mb-4">{plan.description}</p>
              <ul className="space-y-2 mb-4">
                {plan.features?.map((f: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#ccc]">
                    <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-[#2a2a2a] flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-[#666]">
                  <Users className="h-4 w-4" />
                  <span>{plan.isActive ? "Aktif" : "Pasif"}</span>
                </div>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] hover:border-primary/50 transition-colors">
                  Düzenle
                </button>
              </div>
            </div>
          )) : (
            [
              { name: "Premium", price: "9.99", desc: "Reklamsız izleme, HD kalite", popular: true },
              { name: "Creator", price: "24.99", desc: "Creator araçları + Premium", popular: false },
              { name: "VIP",     price: "49.99", desc: "Tüm özellikler + öncelikli", popular: false },
            ].map(plan => (
              <div key={plan.name} className={cn("bg-[#111] border rounded-xl p-5 relative", plan.popular ? "border-primary" : "border-[#222]")}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-3 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" /> Popüler
                  </div>
                )}
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <div className="text-3xl font-black text-primary my-3">${plan.price}<span className="text-sm text-[#666] font-normal">/ay</span></div>
                <p className="text-sm text-[#888] mb-4">{plan.desc}</p>
                <div className="pt-4 border-t border-[#2a2a2a] flex items-center justify-between">
                  <span className="text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded-full">Aktif</span>
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] hover:border-primary/50 transition-colors">Düzenle</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Abone Listesi */}
      <div>
        <h2 className="text-sm font-bold text-[#666] uppercase tracking-widest mb-3">Aboneler</h2>

        {/* Filtreler */}
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
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs border transition-all",
                    statusFilter === s
                      ? "border-primary bg-primary/15 text-white font-semibold"
                      : "border-[#2a2a2a] bg-[#1a1a1a] text-[#666] hover:border-[#444]"
                  )}
                >{s}</button>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {PLAN_FILTERS.map(p => (
                <button
                  key={p}
                  onClick={() => setPlanFilter(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs border transition-all",
                    planFilter === p
                      ? "border-primary bg-primary/15 text-white font-semibold"
                      : "border-[#2a2a2a] bg-[#1a1a1a] text-[#666] hover:border-[#444]"
                  )}
                >{p}</button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[#555]">{filtered.length} abone gösteriliyor</p>
        </div>

        {/* Tablo */}
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
              <div
                key={sub.id}
                className={cn("grid grid-cols-[1fr_1fr_80px_1fr_1fr_100px_40px] gap-0 px-4 py-3 items-center text-sm", i % 2 === 0 ? "bg-transparent" : "bg-[#111]", "border-b border-[#1a1a1a] last:border-0")}
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
                  <button
                    onClick={() => setMenuOpen(menuOpen === sub.id ? null : sub.id)}
                    className="p-1 rounded hover:bg-[#2a2a2a] text-[#555] hover:text-white transition-colors"
                  >
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
              <span className={cn(
                "text-xs mt-2 inline-block px-2 py-0.5 rounded-full border",
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
