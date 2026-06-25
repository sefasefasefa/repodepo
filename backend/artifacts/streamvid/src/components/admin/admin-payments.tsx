import { useState } from "react";
import { Plus, Trash2, RefreshCw, Star, ToggleLeft, ToggleRight, CreditCard, Bitcoin, DollarSign, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const GATEWAY_TYPES = [
  { id: "stripe",  name: "Stripe",         icon: CreditCard, color: "text-violet-400", bg: "bg-violet-900/20",
    fields: ["publicKey","secretKey"], currencies: ["USD","EUR","GBP","TRY"], note: "Kredi/banka kartı ile ödeme" },
  { id: "paypal",  name: "PayPal",          icon: DollarSign, color: "text-blue-400",   bg: "bg-blue-900/20",
    fields: ["apiKey","merchantId"], currencies: ["USD","EUR","GBP"], note: "PayPal hesabı ile ödeme" },
  { id: "papara",  name: "Papara",          icon: Landmark,   color: "text-green-400",  bg: "bg-green-900/20",
    fields: ["apiKey","merchantId"], currencies: ["TRY"], note: "Türkiye için Papara ödeme" },
  { id: "crypto",  name: "Kripto Para",     icon: Bitcoin,    color: "text-yellow-400", bg: "bg-yellow-900/20",
    fields: ["walletAddress","network"], currencies: ["USDT","BTC","ETH","BNB"], note: "Bitcoin, Ethereum, USDT" },
  { id: "eft",     name: "EFT / Havale",    icon: Landmark,   color: "text-emerald-400",bg: "bg-emerald-900/20",
    fields: ["merchantId"], currencies: ["TRY"], note: "Türk bankası havale" },
];

const NETWORKS = ["ERC-20 (Ethereum)", "TRC-20 (Tron)", "BEP-20 (BSC)", "Bitcoin (BTC)", "Solana (SOL)"];

const BASE = "/api";
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
  return res.json();
}

export function AdminPayments() {
  const { toast } = useToast();
  const [gateways, setGateways] = useState<any[]>([]);
  const [txData, setTxData] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gateways"|"transactions">("gateways");
  const [form, setForm] = useState({
    type: "stripe", name: "", currency: "USD",
    publicKey: "", secretKey: "", apiKey: "", merchantId: "",
    walletAddress: "", network: "ERC-20 (Ethereum)", isTestMode: true,
  });

  const load = async () => {
    try {
      const [gd, td] = await Promise.all([
        apiFetch("/admin/payments/gateways"),
        apiFetch("/admin/payments/transactions"),
      ]);
      setGateways(gd.gateways);
      setTxData(td);
      setLoaded(true);
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  if (!loaded) load();

  const save = async () => {
    try {
      const d = await apiFetch("/admin/payments/gateways", { method: "POST", body: JSON.stringify(form) });
      setGateways(p => [...p, d.gateway]);
      setShowAdd(false);
      toast({ title: "Ödeme sistemi eklendi", description: form.name });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch(`/admin/payments/gateways/${id}`, { method: "DELETE" });
      setGateways(p => p.filter(g => g.id !== id));
      toast({ title: "Silindi" });
    } catch {}
  };

  const setDefault = async (id: string) => {
    try {
      await apiFetch(`/admin/payments/gateways/${id}/default`, { method: "POST" });
      setGateways(p => p.map(g => ({ ...g, isDefault: g.id === id })));
    } catch {}
  };

  const toggle = async (id: string) => {
    try {
      const d = await apiFetch(`/admin/payments/gateways/${id}/toggle`, { method: "POST" });
      setGateways(p => p.map(g => g.id === id ? { ...g, isActive: d.isActive } : g));
    } catch {}
  };

  const testGateway = async (id: string) => {
    setTesting(id);
    try {
      const d = await apiFetch(`/admin/payments/gateways/${id}/test`, { method: "POST" });
      toast({
        title: d.ok ? "Bağlantı başarılı ✓" : "Bağlantı başarısız",
        description: d.ok ? JSON.stringify(d.info) : d.error,
        variant: d.ok ? "default" : "destructive",
      });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
    setTesting(null);
  };

  const selectedType = GATEWAY_TYPES.find(g => g.id === form.type);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Ödeme Sistemleri</h2>
          <p className="text-[#666] text-sm mt-1">Üyelik ve içerik ödemeleri için ödeme yöntemleri</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="h-4 w-4" /> Ödeme Sistemi Ekle
        </button>
      </div>

      {/* Özet kartlar */}
      {txData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Toplam Hacim", value: `$${Number(txData.totalVolume || 0).toFixed(2)}`, color: "text-primary" },
            { label: "İşlem Sayısı", value: txData.total || 0, color: "text-white" },
            { label: "Tamamlanan", value: txData.completed || 0, color: "text-green-400" },
            { label: "Bekleyen", value: txData.pending || 0, color: "text-yellow-400" },
          ].map(c => (
            <div key={c.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <p className="text-[11px] text-[#666] mb-1">{c.label}</p>
              <p className={cn("text-xl font-bold", c.color)}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#222]">
        {(["gateways","transactions"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn("px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === t ? "border-primary text-primary" : "border-transparent text-[#888] hover:text-white")}>
            {t === "gateways" ? "Ödeme Yöntemleri" : "İşlemler"}
          </button>
        ))}
      </div>

      {activeTab === "gateways" && (
        <div className="space-y-3">
          {gateways.length === 0 ? (
            <div className="text-center py-12 text-[#555]">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Henüz ödeme sistemi eklenmedi</p>
            </div>
          ) : (
            gateways.map(gw => {
              const gt = GATEWAY_TYPES.find(x => x.id === gw.type);
              const GtIcon = gt?.icon || CreditCard;
              return (
                <div key={gw.id} className={cn("bg-[#1a1a1a] border rounded-xl p-4 transition-all",
                  gw.isActive ? "border-[#2a2a2a]" : "border-[#1e1e1e] opacity-60")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", gt?.bg)}>
                      <GtIcon className={cn("h-5 w-5", gt?.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-white">{gw.name}</p>
                        {gw.isDefault && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Varsayılan</span>}
                        {gw.isTestMode && <span className="text-[10px] bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full">Test Modu</span>}
                      </div>
                      <p className="text-[11px] text-[#555]">{gt?.name} • {gw.currency} • {gt?.note}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggle(gw.id)}>
                        {gw.isActive ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-[#444]" />}
                      </button>
                      {!gw.isDefault && (
                        <button onClick={() => setDefault(gw.id)} className="p-1.5 rounded hover:bg-yellow-900/30 text-[#555] hover:text-yellow-400 transition-colors" title="Varsayılan yap">
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => testGateway(gw.id)} disabled={testing === gw.id}
                        className="text-[11px] px-2 py-1 rounded bg-[#222] hover:bg-[#2a2a2a] text-[#888] transition-colors flex items-center gap-1">
                        {testing === gw.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Test"}
                      </button>
                      <button onClick={() => remove(gw.id)} className="p-1.5 rounded hover:bg-red-900/30 text-[#555] hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#222]">
            <p className="text-sm text-[#666]">İşlem geçmişi burada görünür</p>
          </div>
          <div className="p-8 text-center text-[#555]">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Henüz işlem yok</p>
          </div>
        </div>
      )}

      {/* Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 w-full max-w-md my-4">
            <h3 className="font-bold text-lg mb-4">Ödeme Sistemi Ekle</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#888] mb-1 block">Ödeme Sistemi</label>
                <div className="grid grid-cols-3 gap-2">
                  {GATEWAY_TYPES.map(gt => {
                    const Icon = gt.icon;
                    return (
                      <button key={gt.id} onClick={() => setForm(f => ({ ...f, type: gt.id, currency: gt.currencies[0] }))}
                        className={cn("flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs transition-all",
                          form.type === gt.id ? `${gt.bg} ${gt.color} border-current/30` : "bg-[#222] border-[#333] text-[#888] hover:border-[#444]")}>
                        <Icon className="h-4 w-4" />
                        {gt.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#888] mb-1 block">Görünen Ad</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={`Örn: ${selectedType?.name} Ana`}
                  className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555]" />
              </div>
              <div>
                <label className="text-xs text-[#888] mb-1 block">Para Birimi</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white">
                  {selectedType?.currencies.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              {selectedType?.fields.includes("publicKey") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">Public Key (pk_...)</label>
                  <input value={form.publicKey} onChange={e => setForm(f => ({ ...f, publicKey: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white font-mono text-xs" />
                </div>
              )}
              {selectedType?.fields.includes("secretKey") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">Secret Key (sk_...)</label>
                  <input type="password" value={form.secretKey} onChange={e => setForm(f => ({ ...f, secretKey: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              )}
              {selectedType?.fields.includes("apiKey") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">API Key</label>
                  <input type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              )}
              {selectedType?.fields.includes("merchantId") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">Merchant ID</label>
                  <input value={form.merchantId} onChange={e => setForm(f => ({ ...f, merchantId: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              )}
              {selectedType?.fields.includes("walletAddress") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">Cüzdan Adresi</label>
                  <input value={form.walletAddress} onChange={e => setForm(f => ({ ...f, walletAddress: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white font-mono text-xs" />
                </div>
              )}
              {selectedType?.fields.includes("network") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">Ağ (Network)</label>
                  <select value={form.network} onChange={e => setForm(f => ({ ...f, network: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white">
                    {NETWORKS.map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="testMode" checked={form.isTestMode} onChange={e => setForm(f => ({ ...f, isTestMode: e.target.checked }))} />
                <label htmlFor="testMode" className="text-sm text-[#aaa]">Test modu (canlıya geçmeden önce)</label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={save} disabled={!form.name} className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">Kaydet</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-[#222] hover:bg-[#2a2a2a] text-[#aaa] font-medium py-2.5 rounded-lg text-sm transition-colors">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
