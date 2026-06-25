import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Share2, Copy, CheckCheck, MousePointerClick, TrendingUp, DollarSign,
  Loader2, RefreshCw, AlertTriangle, Link2, ExternalLink, Send, Clock,
  CheckCircle, XCircle,
} from "lucide-react";
import { useLocation } from "wouter";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return json;
}

const PAYOUT_STATUS: Record<string, { label: string; cls: string; Icon: any }> = {
  pending:  { label: "Bekliyor",   cls: "bg-yellow-900/20 text-yellow-400 border-yellow-800", Icon: Clock },
  approved: { label: "Onaylandı",  cls: "bg-blue-900/20 text-blue-400 border-blue-800",       Icon: CheckCircle },
  paid:     { label: "Ödendi",     cls: "bg-green-900/20 text-green-400 border-green-800",    Icon: CheckCircle },
  rejected: { label: "Reddedildi", cls: "bg-red-900/20 text-red-400 border-red-800",          Icon: XCircle },
};

export default function AffiliatePage() {
  const { user }        = useAuth();
  const [, setLocation] = useLocation();

  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [stats, setStats]                   = useState<any>(null);
  const [loading, setLoading]               = useState(true);

  const [copied, setCopied]         = useState(false);
  const [payoutMethod, setPayoutMethod] = useState("bank");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [payoutMsg, setPayoutMsg]   = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const s = await apiFetch("/affiliate/settings");
      setSystemSettings(s);
      if (s.isActive && user) {
        const st = await apiFetch("/affiliate/stats");
        setStats(st);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const copyLink = () => {
    const base = window.location.origin;
    navigator.clipboard.writeText(`${base}/register?ref=${stats?.link?.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requestPayout = async () => {
    setRequesting(true); setPayoutMsg("");
    try {
      await apiFetch("/affiliate/payout-request", {
        method: "POST",
        body: JSON.stringify({ method: payoutMethod, details: payoutDetails }),
      });
      setPayoutMsg("✓ Ödeme talebi gönderildi!");
      setPayoutDetails("");
      load();
    } catch (e: any) { setPayoutMsg(e.message); }
    setRequesting(false);
  };

  if (!user) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Share2 className="h-12 w-12 text-[#333]" />
        <p className="text-[#555]">Affiliate programına katılmak için giriş yapın</p>
        <Button onClick={() => setLocation("/login")}>Giriş Yap</Button>
      </div>
    </AppLayout>
  );

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96 gap-2 text-[#555]">
        <Loader2 className="h-5 w-5 animate-spin" /><span>Yükleniyor...</span>
      </div>
    </AppLayout>
  );

  // Sistem kapalı
  if (!systemSettings?.isActive) return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="bg-[#161616] border border-[#222] rounded-2xl p-10 text-center space-y-4">
          <div className="p-4 bg-[#222] rounded-full w-fit mx-auto">
            <Share2 className="h-8 w-8 text-[#555]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Affiliate Programı</h1>
          <p className="text-[#666]">Affiliate programı şu anda aktif değil.</p>
          <p className="text-sm text-[#444]">Yakında başlayacak — takipte kalın!</p>
          <div className="flex items-center justify-center gap-2 text-[#555] text-sm mt-4">
            <AlertTriangle className="h-4 w-4" />
            Sistem yönetici tarafından kapalı tutulmaktadır
          </div>
        </div>
      </div>
    </AppLayout>
  );

  const refLink = stats?.link
    ? `${window.location.origin}/register?ref=${stats.link.code}`
    : null;

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Share2 className="h-6 w-6 text-primary" /> Affiliate Programı
            </h1>
            <p className="text-[#555] text-sm mt-0.5">Arkadaşlarını davet et, kazanmaya başla</p>
          </div>
          <button onClick={load} className="text-[#555] hover:text-white transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Komisyon bilgi banner */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-primary">%{Math.round((systemSettings.commissionRate || 0) * 100)}</p>
            <p className="text-sm text-[#aaa] mt-1">Kayıt komisyonu</p>
          </div>
          <div className="bg-[#161616] border border-[#222] rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-white">{systemSettings.cookieDays}</p>
            <p className="text-sm text-[#aaa] mt-1">Gün cookie süresi</p>
          </div>
          <div className="bg-[#161616] border border-[#222] rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-green-400">${systemSettings.minPayoutUsd}</p>
            <p className="text-sm text-[#aaa] mt-1">Minimum ödeme</p>
          </div>
        </div>

        {/* Referans linki */}
        <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Referans Linkiniz</h3>
          </div>
          {refLink ? (
            <div className="flex gap-2">
              <div className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 font-mono text-sm text-[#aaa] overflow-hidden text-ellipsis whitespace-nowrap">
                {refLink}
              </div>
              <Button onClick={copyLink} variant="secondary" className="gap-2 shrink-0">
                {copied ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                {copied ? "Kopyalandı!" : "Kopyala"}
              </Button>
            </div>
          ) : (
            <Button onClick={load} className="gap-2">
              <Link2 className="h-4 w-4" /> Link Oluştur
            </Button>
          )}
          {stats?.link && (
            <p className="text-xs text-[#555]">
              Kodunuz: <code className="bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{stats.link.code}</code>
            </p>
          )}
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
            <MousePointerClick className="h-4 w-4 text-blue-400 mb-3" />
            <p className="text-xs text-[#666] mb-1">Toplam Tıklama</p>
            <p className="text-2xl font-bold text-blue-400">{(stats?.totalClicks || 0).toLocaleString("tr")}</p>
          </div>
          <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
            <TrendingUp className="h-4 w-4 text-green-400 mb-3" />
            <p className="text-xs text-[#666] mb-1">Dönüşüm</p>
            <p className="text-2xl font-bold text-green-400">{stats?.totalConversions || 0}</p>
            <p className="text-xs text-[#555]">
              {stats?.totalClicks ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1) : 0}% oran
            </p>
          </div>
          <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
            <DollarSign className="h-4 w-4 text-yellow-400 mb-3" />
            <p className="text-xs text-[#666] mb-1">Toplam Kazanç</p>
            <p className="text-2xl font-bold text-yellow-400">${(stats?.totalEarned || 0).toFixed(2)}</p>
          </div>
          <div className="bg-[#161616] border border-[#222] rounded-2xl p-5">
            <DollarSign className="h-4 w-4 text-primary mb-3" />
            <p className="text-xs text-[#666] mb-1">Bekleyen</p>
            <p className="text-2xl font-bold text-primary">${(stats?.pendingAmount || 0).toFixed(2)}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Son komisyonlar */}
          <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <h3 className="font-semibold text-sm">Son Komisyonlar</h3>
            </div>
            {!stats?.commissions?.length ? (
              <div className="py-10 text-center text-[#444] text-sm">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-20" />
                Henüz komisyon yok
              </div>
            ) : (
              <div className="divide-y divide-[#1a1a1a]">
                {stats.commissions.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium capitalize">{c.event}</p>
                      <p className="text-[10px] text-[#555]">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">+${Number(c.amountUsd).toFixed(2)}</p>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border",
                        c.status === "paid" ? "bg-green-900/20 text-green-400 border-green-800" : "bg-yellow-900/20 text-yellow-400 border-yellow-800"
                      )}>{c.status === "paid" ? "Ödendi" : "Bekliyor"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ödeme talebi */}
          <div className="bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Ödeme Talep Et</h3>
              <span className="ml-auto text-xs text-[#555]">Min: ${systemSettings.minPayoutUsd}</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#222] rounded-xl px-4 py-3">
                <span className="text-sm text-[#666]">Çekilebilir bakiye</span>
                <span className="text-lg font-bold text-green-400">${(stats?.pendingAmount || 0).toFixed(2)}</span>
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1.5 block">Ödeme Yöntemi</label>
                <select value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="bank">Banka Transferi (IBAN)</option>
                  <option value="paypal">PayPal</option>
                  <option value="crypto">Kripto (USDT/BTC)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1.5 block">Hesap Bilgileri</label>
                <Input value={payoutDetails} onChange={e => setPayoutDetails(e.target.value)}
                  placeholder={payoutMethod === "bank" ? "TR00 0000..." : payoutMethod === "paypal" ? "email@..." : "0x... / TRC20 adres"}
                  className="bg-[#1e1e1e] border-[#2a2a2a]" />
              </div>
              {payoutMsg && (
                <p className={cn("text-xs px-3 py-2 rounded-lg border", payoutMsg.startsWith("✓") ? "bg-green-900/20 text-green-400 border-green-800" : "bg-red-900/20 text-red-400 border-red-800")}>
                  {payoutMsg}
                </p>
              )}
              <Button onClick={requestPayout} disabled={requesting || !payoutDetails || (stats?.pendingAmount || 0) < (systemSettings.minPayoutUsd || 10)}
                className="w-full gap-2">
                {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Ödeme Talebi Gönder
              </Button>

              {/* Geçmiş ödemeler */}
              {stats?.payouts?.length > 0 && (
                <div className="pt-4 border-t border-[#1e1e1e] space-y-2">
                  <p className="text-xs text-[#555] font-bold uppercase">Geçmiş Talepler</p>
                  {stats.payouts.map((p: any) => {
                    const st = PAYOUT_STATUS[p.status] || { label: p.status, cls: "bg-[#222] text-[#666] border-[#333]", Icon: Clock };
                    const StIcon = st.Icon;
                    return (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-medium">${p.amountUsd}</span>
                          <span className="text-[#555]">({p.method})</span>
                        </div>
                        <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold", st.cls)}>
                          <StIcon className="h-3 w-3" />{st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
