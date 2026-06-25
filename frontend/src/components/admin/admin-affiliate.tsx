import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Share2, ToggleLeft, ToggleRight, Settings, Users, MousePointerClick,
  TrendingUp, DollarSign, RefreshCw, Loader2, CheckCircle, XCircle,
  Clock, AlertTriangle, Percent, Link2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

const PAYOUT_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Bekliyor",   cls: "bg-yellow-900/20 text-yellow-400 border-yellow-800" },
  approved: { label: "Onaylandı",  cls: "bg-blue-900/20 text-blue-400 border-blue-800" },
  paid:     { label: "Ödendi",     cls: "bg-green-900/20 text-green-400 border-green-800" },
  rejected: { label: "Reddedildi", cls: "bg-red-900/20 text-red-400 border-red-800" },
};

export function AdminAffiliate() {
  const [settings, setSettings]   = useState<any>(null);
  const [links, setLinks]         = useState<any[]>([]);
  const [payouts, setPayouts]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "links" | "payouts">("overview");
  const [toggling, setToggling]   = useState(false);
  const [msg, setMsg]             = useState("");

  // Düzenleme alanları
  const [commissionRate, setCommissionRate]       = useState("");
  const [subCommissionRate, setSubCommissionRate] = useState("");
  const [cookieDays, setCookieDays]               = useState("");
  const [minPayout, setMinPayout]                 = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [s, l, p] = await Promise.all([
        apiFetch("/affiliate/settings"),
        apiFetch("/affiliate/admin/links"),
        apiFetch("/affiliate/admin/payouts"),
      ]);
      setSettings(s);
      setLinks(l.links || []);
      setPayouts(p.payouts || []);
      setCommissionRate(String(Math.round((s.commissionRate || 0.1) * 100)));
      setSubCommissionRate(String(Math.round((s.subCommissionRate || 0.05) * 100)));
      setCookieDays(String(s.cookieDays || 30));
      setMinPayout(String(s.minPayoutUsd || 10));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleSystem = async () => {
    setToggling(true);
    try {
      const updated = await apiFetch("/affiliate/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ isActive: !settings.isActive }),
      });
      setSettings((p: any) => ({ ...p, isActive: updated.settings.isActive }));
      setMsg(updated.settings.isActive ? "✓ Affiliate sistemi aktif edildi!" : "Affiliate sistemi devre dışı bırakıldı.");
      setTimeout(() => setMsg(""), 3000);
    } catch (e: any) { setMsg(e.message); }
    setToggling(false);
  };

  const saveSettings = async () => {
    setSaving(true); setMsg("");
    try {
      const updated = await apiFetch("/affiliate/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          commissionRate: parseFloat(commissionRate) / 100,
          subCommissionRate: parseFloat(subCommissionRate) / 100,
          cookieDays: parseInt(cookieDays),
          minPayoutUsd: parseFloat(minPayout),
        }),
      });
      setSettings((p: any) => ({ ...p, ...updated.settings }));
      setMsg("✓ Ayarlar kaydedildi");
      setTimeout(() => setMsg(""), 3000);
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
  };

  const toggleLink = async (id: number, current: boolean) => {
    await apiFetch(`/affiliate/admin/links/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: !current }) });
    setLinks(prev => prev.map(l => l.id === id ? { ...l, isActive: !current } : l));
  };

  const updatePayout = async (id: number, status: string) => {
    await apiFetch(`/affiliate/admin/payouts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    setPayouts(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-[#555]">
      <Loader2 className="h-5 w-5 animate-spin" /><span>Yükleniyor...</span>
    </div>
  );

  const totalClicks      = links.reduce((s, l) => s + (l.totalClicks || 0), 0);
  const totalConversions = links.reduce((s, l) => s + (l.totalConversions || 0), 0);
  const pendingPayouts   = payouts.filter(p => p.status === "pending").length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" /> Affiliate Sistemi
          </h1>
          <p className="text-[#555] text-sm mt-0.5">Referans programı yönetimi</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Sistem Açma/Kapatma — büyük banner */}
      <div className={cn(
        "border-2 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 transition-all",
        settings?.isActive
          ? "border-green-600/40 bg-green-900/10"
          : "border-[#2a2a2a] bg-[#161616]"
      )}>
        <div className={cn("p-3 rounded-xl", settings?.isActive ? "bg-green-500/10" : "bg-[#222]")}>
          <Share2 className={cn("h-6 w-6", settings?.isActive ? "text-green-400" : "text-[#555]")} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-lg">
            Affiliate Programı — {settings?.isActive ? (
              <span className="text-green-400">AKTİF</span>
            ) : (
              <span className="text-[#555]">KAPALI</span>
            )}
          </p>
          <p className="text-[#666] text-sm mt-0.5">
            {settings?.isActive
              ? "Kullanıcılar referans linkleri oluşturup komisyon kazanabilir."
              : "Sistem şu an kapalı. Aşağıdaki butona tıklayarak aktif edebilirsiniz."}
          </p>
          {settings?.isActive && (
            <div className="flex gap-4 mt-2 text-xs text-[#888]">
              <span>Komisyon: <strong className="text-white">%{Math.round((settings.commissionRate || 0) * 100)}</strong></span>
              <span>Alt komisyon: <strong className="text-white">%{Math.round((settings.subCommissionRate || 0) * 100)}</strong></span>
              <span>Cookie: <strong className="text-white">{settings.cookieDays} gün</strong></span>
              <span>Min ödeme: <strong className="text-white">${settings.minPayoutUsd}</strong></span>
            </div>
          )}
        </div>
        <Button
          onClick={toggleSystem}
          disabled={toggling}
          className={cn(
            "gap-2 shrink-0",
            settings?.isActive
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
          )}
        >
          {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            settings?.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />
          )}
          {settings?.isActive ? "Sistemi Kapat" : "Sistemi Aç"}
        </Button>
      </div>

      {msg && (
        <div className={cn("px-4 py-3 rounded-xl text-sm border", msg.startsWith("✓") ? "bg-green-900/20 text-green-400 border-green-800" : "bg-red-900/20 text-red-400 border-red-800")}>
          {msg}
        </div>
      )}

      {/* Alt sekmeler */}
      <div className="flex border-b border-[#222] gap-1">
        {[
          { id: "overview", label: "Genel Bakış", icon: TrendingUp },
          { id: "links",    label: `Affiliate Linkler (${links.length})`, icon: Link2 },
          { id: "payouts",  label: `Ödeme Talepleri${pendingPayouts > 0 ? ` (${pendingPayouts})` : ""}`, icon: DollarSign },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id as any)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all",
              activeSection === s.id ? "border-primary text-primary" : "border-transparent text-[#666] hover:text-white"
            )}>
            <s.icon className="h-3.5 w-3.5" />{s.label}
          </button>
        ))}
      </div>

      {/* ── GENEL BAKIŞ ── */}
      {activeSection === "overview" && (
        <div className="space-y-6">
          {/* Özet kartlar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-primary" /></div>
              <p className="text-xs text-[#666] mb-1">Toplam Affiliate</p>
              <p className="text-2xl font-bold">{links.length}</p>
            </div>
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2"><MousePointerClick className="h-4 w-4 text-blue-400" /></div>
              <p className="text-xs text-[#666] mb-1">Toplam Tıklama</p>
              <p className="text-2xl font-bold text-blue-400">{totalClicks.toLocaleString("tr")}</p>
            </div>
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-green-400" /></div>
              <p className="text-xs text-[#666] mb-1">Dönüşüm</p>
              <p className="text-2xl font-bold text-green-400">{totalConversions}</p>
              <p className="text-xs text-[#555]">{totalClicks ? ((totalConversions / totalClicks) * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2"><DollarSign className="h-4 w-4 text-yellow-400" /></div>
              <p className="text-xs text-[#666] mb-1">Bekleyen Ödeme</p>
              <p className="text-2xl font-bold text-yellow-400">{pendingPayouts}</p>
            </div>
          </div>

          {/* Komisyon ayarları */}
          <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Komisyon Ayarları</h3>
              <span className="ml-auto text-xs text-[#555]">Sistemi kapatmadan da ayarlayabilirsiniz</span>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#666] mb-1.5 block">Kayıt Komisyonu (%)</label>
                <div className="flex gap-2 items-center">
                  <Input value={commissionRate} onChange={e => setCommissionRate(e.target.value)} type="number" min={0} max={50} className="bg-[#1e1e1e] border-[#2a2a2a]" />
                  <Percent className="h-4 w-4 text-[#555] shrink-0" />
                </div>
                <p className="text-[10px] text-[#444] mt-1">Yeni üyelik satışından alınacak oran</p>
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1.5 block">Alt Referans Komisyonu (%)</label>
                <div className="flex gap-2 items-center">
                  <Input value={subCommissionRate} onChange={e => setSubCommissionRate(e.target.value)} type="number" min={0} max={20} className="bg-[#1e1e1e] border-[#2a2a2a]" />
                  <Percent className="h-4 w-4 text-[#555] shrink-0" />
                </div>
                <p className="text-[10px] text-[#444] mt-1">Referansın getirdiği kişinin komisyonu</p>
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1.5 block">Cookie Süresi (Gün)</label>
                <Input value={cookieDays} onChange={e => setCookieDays(e.target.value)} type="number" min={1} max={365} className="bg-[#1e1e1e] border-[#2a2a2a]" />
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1.5 block">Minimum Ödeme (USD)</label>
                <Input value={minPayout} onChange={e => setMinPayout(e.target.value)} type="number" min={1} className="bg-[#1e1e1e] border-[#2a2a2a]" />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={saveSettings} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Ayarları Kaydet
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LİNKLER ── */}
      {activeSection === "links" && (
        <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
          {links.length === 0 ? (
            <div className="py-16 text-center text-[#444]">
              <Link2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Henüz affiliate linki yok</p>
              <p className="text-xs text-[#333] mt-1">Sistem aktif olduğunda kullanıcılar link oluşturabilir</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {links.map(l => (
                <div key={l.id} className="flex items-center gap-4 px-5 py-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={l.user?.avatarUrl || ""} />
                    <AvatarFallback className="text-xs">{l.user?.username?.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">@{l.user?.username}</p>
                    <code className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{l.code}</code>
                  </div>
                  <div className="text-right text-xs space-y-0.5 shrink-0">
                    <p><span className="text-[#555]">Tıklama:</span> <span className="text-white font-bold">{l.totalClicks}</span></p>
                    <p><span className="text-[#555]">Dönüşüm:</span> <span className="text-green-400 font-bold">{l.totalConversions}</span></p>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <p className="text-yellow-400 font-bold">${Number(l.totalEarnedUsd).toFixed(2)}</p>
                    <p className="text-[#555]">kazanılan</p>
                  </div>
                  <button onClick={() => toggleLink(l.id, l.isActive)}
                    className={cn("px-3 py-1 rounded-full text-xs border font-medium transition-all",
                      l.isActive ? "bg-green-900/20 text-green-400 border-green-800 hover:bg-red-900/20 hover:text-red-400 hover:border-red-800" : "bg-[#222] text-[#555] border-[#333] hover:border-green-800 hover:text-green-400"
                    )}>
                    {l.isActive ? "Aktif" : "Kapalı"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ÖDEME TALEPLERİ ── */}
      {activeSection === "payouts" && (
        <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
          {payouts.length === 0 ? (
            <div className="py-16 text-center text-[#444]">
              <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Henüz ödeme talebi yok</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {payouts.map(p => {
                const st = PAYOUT_STATUS[p.status] || { label: p.status, cls: "bg-[#222] text-[#666] border-[#333]" };
                return (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">@{p.user?.username}</p>
                      <p className="text-xs text-[#555]">{p.method} • {p.details?.substring(0, 30)}</p>
                      <p className="text-[10px] text-[#444]">{formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</p>
                    </div>
                    <p className="text-lg font-bold text-green-400 shrink-0">${p.amountUsd}</p>
                    <span className={cn("px-2.5 py-1 rounded-full border text-xs font-bold shrink-0", st.cls)}>{st.label}</span>
                    {p.status === "pending" && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => updatePayout(p.id, "paid")}
                          className="p-1.5 rounded-lg bg-green-900/20 text-green-400 hover:bg-green-900/40 transition-colors" title="Ödendi">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button onClick={() => updatePayout(p.id, "rejected")}
                          className="p-1.5 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors" title="Reddet">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
