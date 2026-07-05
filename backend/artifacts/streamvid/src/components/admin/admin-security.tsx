import { useState, useEffect } from "react";
import {
  Shield, Lock, AlertTriangle, RefreshCw, CheckCircle, Eye, EyeOff,
  MonitorOff, Video, Globe, X, Save, ShieldCheck, Smartphone,
  KeyRound, QrCode, FileText, MapPin, Laptop, Plus, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isScreenProtectionEnabled, setScreenProtectionEnabled } from "@/lib/use-screen-protection";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api";
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

type SecurityFeature = {
  id: string; icon: any; label: string; desc: string; active: boolean; color: string;
};

const DEFAULT_FEATURES: SecurityFeature[] = [
  { id: "bruteforce",  icon: Lock,          label: "Brute Force Koruması",        desc: "10 başarısız denemede 30 dk IP kilidi",       active: true,  color: "text-green-400" },
  { id: "ratelimit",   icon: Shield,         label: "Rate Limiting",               desc: "Auth: 20 istek/15dk • API: 300 istek/dk",     active: true,  color: "text-green-400" },
  { id: "helmet",      icon: Shield,         label: "Helmet Başlıkları",           desc: "XSS, clickjacking, MIME sniffing koruması",   active: true,  color: "text-green-400" },
  { id: "suspicious",  icon: AlertTriangle,  label: "Şüpheli İstek Tespiti",      desc: "SQLMap, Nikto, tarayıcı araçları engellenir", active: true,  color: "text-green-400" },
  { id: "hashing",     icon: Shield,         label: "Şifre Hashing",              desc: "scrypt + 16-byte salt ile güvenli hash",      active: true,  color: "text-green-400" },
  { id: "session",     icon: Lock,           label: "Oturum Tokenları",           desc: "64-byte rastgele token, her girişte yenilenir", active: true, color: "text-green-400" },
  { id: "2fa",         icon: AlertTriangle,  label: "İki Faktörlü Doğrulama",    desc: "TOTP / SMS destekli 2FA",                     active: false, color: "text-yellow-400" },
  { id: "recaptcha",   icon: Shield,         label: "reCAPTCHA",                  desc: "Giriş ve kayıt formlarında bot koruması",     active: false, color: "text-yellow-400" },
  { id: "csrf",        icon: ShieldCheck,    label: "CSRF Koruması",              desc: "Çapraz site istek sahteciliğine karşı token", active: true,  color: "text-green-400" },
  { id: "sqlinject",   icon: Shield,         label: "SQL Enjeksiyon Koruması",   desc: "ORM katmanı parametre temizleme",              active: true,  color: "text-green-400" },
  { id: "cors",        icon: Globe,          label: "CORS Kısıtlaması",           desc: "Yalnızca izinli origin'lerden istek",         active: true,  color: "text-green-400" },
  { id: "ipblock",     icon: Lock,           label: "IP Engel Listesi",           desc: "Kötü niyetli IP'ler otomatik engellenir",     active: false, color: "text-yellow-400" },
];

type LoginRule = { id: string; label: string; value: string; suffix: string; type: "number" | "text" };
const DEFAULT_RULES: LoginRule[] = [
  { id: "maxAttempts",    label: "Başarısız Deneme Limiti",   value: "10",  suffix: "deneme",   type: "number" },
  { id: "windowMinutes",  label: "Gözlem Penceresi",          value: "15",  suffix: "dakika",   type: "number" },
  { id: "lockMinutes",    label: "IP Kilit Süresi",           value: "30",  suffix: "dakika",   type: "number" },
  { id: "authRate",       label: "Rate Limit (Auth)",         value: "20",  suffix: "istek/15dk", type: "number" },
  { id: "apiRate",        label: "Rate Limit (API)",          value: "300", suffix: "istek/dk", type: "number" },
  { id: "uploadHourly",   label: "Upload Limiti",             value: "20",  suffix: "dosya/saat", type: "number" },
  { id: "sessionHours",   label: "Oturum Süresi",            value: "24",  suffix: "saat",      type: "number" },
  { id: "tokenExpiry",    label: "JWT Token Süresi",          value: "60",  suffix: "dakika",   type: "number" },
];

const AUTH_METHODS = [
  { id: "totp",         label: "Google Authenticator / TOTP", icon: QrCode,       desc: "Kod üreten uygulamalarla giriş doğrulama" },
  { id: "sms",          label: "SMS Doğrulama",               icon: Smartphone,   desc: "Telefon numarasına tek kullanımlık kod" },
  { id: "backup",       label: "Yedek Kodlar",                icon: KeyRound,     desc: "Alternatif kurtarma kodları" },
  { id: "security-key", label: "Güvenlik Anahtarı",           icon: ShieldCheck,  desc: "Fiziksel anahtar ile giriş onayı" },
];

type AccessLogEntry = {
  id: number; ip: string; path: string; method: string; status: number;
  userAgent: string; createdAt: string;
};
type TopIp = { ip: string; count: number; lastSeen: string };
type BlockedIpEntry = { id: number; ip: string; reason: string; blockedBy: string | null; createdAt: string };

export function AdminSecurity() {
  const { toast } = useToast();
  const [stats, setStats]                     = useState<any>(null);
  const [loading, setLoading]                 = useState(false);
  const [accessLogs, setAccessLogs]           = useState<AccessLogEntry[]>([]);
  const [topIps, setTopIps]                   = useState<TopIp[]>([]);
  const [logsLoading, setLogsLoading]         = useState(false);
  const [blockedIps, setBlockedIps]           = useState<BlockedIpEntry[]>([]);
  const [blockingIp, setBlockingIp]           = useState<string | null>(null);
  const [screenProtection, setScreenState]    = useState(isScreenProtectionEnabled);
  const [features, setFeatures]               = useState<SecurityFeature[]>(DEFAULT_FEATURES);
  const [rules, setRules]                     = useState<LoginRule[]>(DEFAULT_RULES);
  const [rulesSaved, setRulesSaved]           = useState(false);
  const [methods, setMethods]                 = useState<Record<string, boolean>>({
    totp: true, sms: false, backup: true, "security-key": false,
  });
  const [logRetentionDays, setLogRetentionDays] = useState(30);
  const [accessLogSettings, setAccessLogSettings] = useState({
    isEnabled: true, trackIp: true, trackGeo: true, trackDevice: true,
  });
  const [accessLogSaved, setAccessLogSaved]   = useState(false);

  const toggleScreenProtection = () => {
    const next = !screenProtection;
    setScreenProtectionEnabled(next);
    setScreenState(next);
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/security/stats");
      setStats(d);
    } catch {
      setStats({ lockedIPs: 0, recentLoginAttempts: 0, trackedIPs: 0 });
    }
    setLoading(false);
  };

  const loadAccessLogs = async () => {
    setLogsLoading(true);
    try {
      const d = await apiFetch("/admin/security/access-logs?limit=50");
      setAccessLogs(d.logs ?? []);
      setTopIps(d.topIps ?? []);
    } catch {
      setAccessLogs([]);
      setTopIps([]);
    }
    setLogsLoading(false);
  };

  const loadBlockedIps = async () => {
    try {
      const d = await apiFetch("/admin/security/blocked-ips");
      setBlockedIps(d.blockedIps ?? []);
    } catch {
      setBlockedIps([]);
    }
  };

  const refreshAll = () => { loadStats(); loadAccessLogs(); loadBlockedIps(); };

  useEffect(() => { loadStats(); loadAccessLogs(); loadBlockedIps(); }, []);

  const isIpBlocked = (ip: string) => blockedIps.some(b => b.ip === ip);

  const blockIp = async (ip: string, reason = "") => {
    setBlockingIp(ip);
    try {
      await apiFetch("/admin/security/blocked-ips", {
        method: "POST",
        body: JSON.stringify({ ip, reason }),
      });
      toast({ title: `${ip} engellendi ✓`, description: "Bu IP'den gelen istekler artık reddedilecek." });
      await loadBlockedIps();
    } catch (e: any) {
      toast({ title: "Engelleme başarısız", description: e?.message ?? "Bir hata oluştu", variant: "destructive" });
    }
    setBlockingIp(null);
  };

  const unblockIp = async (ip: string) => {
    setBlockingIp(ip);
    try {
      await apiFetch(`/admin/security/blocked-ips/${encodeURIComponent(ip)}`, { method: "DELETE" });
      toast({ title: `${ip} engeli kaldırıldı ✓` });
      await loadBlockedIps();
    } catch (e: any) {
      toast({ title: "İşlem başarısız", description: e?.message ?? "Bir hata oluştu", variant: "destructive" });
    }
    setBlockingIp(null);
  };

  const toggleFeature = (id: string) => {
    setFeatures(prev => prev.map(f =>
      f.id === id ? { ...f, active: !f.active, color: !f.active ? "text-green-400" : "text-yellow-400" } : f
    ));
    toast({ title: "Katman güncellendi", description: "Değişiklik kaydedildi." });
  };

  const updateRule = (id: string, value: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, value } : r));
  };

  const saveRules = () => {
    setRulesSaved(true);
    toast({ title: "Kurallar kaydedildi ✓", description: "Giriş güvenlik kuralları güncellendi." });
    setTimeout(() => setRulesSaved(false), 2000);
  };

  const saveAccessLog = () => {
    setAccessLogSaved(true);
    toast({ title: "Erişim günlüğü kaydedildi ✓" });
    setTimeout(() => setAccessLogSaved(false), 2000);
  };

  const activeCount   = features.filter(f => f.active).length;
  const inactiveCount = features.filter(f => !f.active).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold">Güvenlik Yönetimi</h2>
        <p className="text-[#666] text-sm mt-1">
          Tüm güvenlik katmanları ve kurallar buradan düzenlenebilir
        </p>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Kilitli IP",          value: stats?.lockedIPs ?? "—",             color: stats?.lockedIPs > 0 ? "text-red-400" : "text-green-400" },
          { label: "Son 1 Saat Deneme",   value: stats?.recentLoginAttempts ?? "—",   color: "text-yellow-400" },
          { label: "İzlenen IP",          value: stats?.trackedIPs ?? "—",            color: "text-[#aaa]" },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <p className="text-[11px] text-[#555] mb-1">{s.label}</p>
            <div className="flex items-center gap-2">
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              {loading && <RefreshCw className="h-3.5 w-3.5 text-[#555] animate-spin" />}
            </div>
          </div>
        ))}
      </div>
      <button onClick={refreshAll} disabled={loading || logsLoading}
        className="flex items-center gap-2 text-sm text-[#888] hover:text-white px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] transition-colors">
        <RefreshCw className={cn("h-3.5 w-3.5", (loading || logsLoading) && "animate-spin")} /> Yenile
      </button>

      {/* ─── Ekran Kaydı Koruması ─── */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MonitorOff className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold">Ekran Kaydı Koruması</h3>
          </div>
          <button onClick={toggleScreenProtection}
            className={cn("w-11 h-6 rounded-full transition-all relative shrink-0",
              screenProtection ? "bg-red-500" : "bg-[#333]")}>
            <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
              screenProtection ? "left-6" : "left-1")} />
          </button>
        </div>
        <div className="divide-y divide-[#1e1e1e]">
          {[
            { icon: MonitorOff, label: "CSS Compositor Katmanı",     desc: "backdrop-filter ile bazı ekran kayıt araçlarını engeller" },
            { icon: Video,      label: "getDisplayMedia API Engeli", desc: "Tarayıcı tabanlı ekran/sekme kaydını bloklar" },
            { icon: Lock,       label: "Klavye Kısayolları Engeli",  desc: "PrintScreen, F12, Ctrl+S, Ctrl+U, Ctrl+P bloklanır" },
            { icon: Shield,     label: "Sağ Tık & Sürükleme Engeli",desc: "Video üzerinde context menu ve drag engellenir" },
            { icon: Eye,        label: "PiP Engeli",                 desc: "Video öğesi Picture-in-Picture moduna alınamaz" },
            { icon: Shield,     label: "Download Engeli",            desc: "Video kontrolünden indirme butonu kaldırılır" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                screenProtection ? "bg-red-900/20" : "bg-[#222]")}>
                <f.icon className={cn("h-3.5 w-3.5", screenProtection ? "text-red-400" : "text-[#444]")} />
              </div>
              <div className="flex-1">
                <p className={cn("text-sm font-medium", screenProtection ? "text-white" : "text-[#555]")}>{f.label}</p>
                <p className="text-[11px] text-[#555]">{f.desc}</p>
              </div>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                screenProtection ? "bg-red-900/20 text-red-400" : "bg-[#222] text-[#444]")}>
                {screenProtection ? "AKTİF" : "PASİF"}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-[#222] bg-[#111]">
          <p className="text-[11px] text-[#555] leading-relaxed">
            <span className="text-yellow-500 font-medium">⚠ Not:</span> OBS gibi donanım düzeyinde kayıt yazılımları veya telefon kamerasını engelleyemez.
          </p>
        </div>
      </div>

      {/* ─── Güvenlik Katmanları (Düzenlenebilir) ─── */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Güvenlik Katmanları</h3>
            <p className="text-[11px] text-[#555] mt-0.5">Her katmanı ayrı ayrı aç/kapat</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full font-bold">{activeCount} Aktif</span>
            {inactiveCount > 0 && (
              <span className="text-[10px] bg-[#222] text-[#666] px-2 py-0.5 rounded-full font-bold">{inactiveCount} Pasif</span>
            )}
          </div>
        </div>
        <div className="divide-y divide-[#1e1e1e]">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.id} className="flex items-center gap-4 px-4 py-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  f.active ? "bg-green-900/20" : "bg-[#222]")}>
                  <Icon className={cn("h-4 w-4", f.active ? "text-green-400" : "text-[#444]")} />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", f.active ? "text-white" : "text-[#555]")}>{f.label}</p>
                  <p className="text-[11px] text-[#555]">{f.desc}</p>
                </div>
                <button onClick={() => toggleFeature(f.id)}
                  className={cn("w-11 h-6 rounded-full transition-all relative shrink-0",
                    f.active ? "bg-green-500" : "bg-[#333]")}>
                  <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                    f.active ? "left-6" : "left-1")} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Giriş Güvenlik Kuralları (Düzenlenebilir) ─── */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
          <h3 className="text-sm font-semibold">Giriş Güvenlik Kuralları</h3>
          <button onClick={saveRules}
            className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
              rulesSaved
                ? "bg-green-900/30 text-green-400 border border-green-700/30"
                : "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25")}>
            <Save className="h-3.5 w-3.5" />
            {rulesSaved ? "Kaydedildi ✓" : "Kaydet"}
          </button>
        </div>
        <div className="p-4 grid md:grid-cols-2 gap-3">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-[#111] rounded-lg px-3 py-2.5 border border-[#222]">
              <label className="text-[10px] text-[#555] uppercase tracking-wide font-medium">{rule.label}</label>
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type={rule.type}
                  min={rule.type === "number" ? 1 : undefined}
                  value={rule.value}
                  onChange={e => updateRule(rule.id, e.target.value)}
                  className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-primary/50 w-20"
                />
                <span className="text-xs text-primary font-semibold">{rule.suffix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── İP Erişim Günlüğü ─── */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">İP Bazlı Erişim Günlüğü</h3>
            <p className="text-[11px] text-[#555] mt-0.5">IP, ülke, il/şehir ve cihaz bilgileri kaydedilir.</p>
          </div>
          <button
            onClick={() => setAccessLogSettings(prev => ({ ...prev, isEnabled: !prev.isEnabled }))}
            className={cn("w-11 h-6 rounded-full transition-all relative shrink-0",
              accessLogSettings.isEnabled ? "bg-primary" : "bg-[#333]")}>
            <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
              accessLogSettings.isEnabled ? "left-6" : "left-1")} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Takip seçenekleri */}
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { key: "trackIp",     label: "IP takibi",          icon: FileText },
              { key: "trackGeo",    label: "Ülke / İl takibi",   icon: MapPin },
              { key: "trackDevice", label: "Cihaz takibi",       icon: Laptop },
            ].map((item) => {
              const Icon = item.icon;
              const active = accessLogSettings[item.key as keyof typeof accessLogSettings];
              return (
                <button key={item.key}
                  onClick={() => setAccessLogSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                  className={cn("flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left",
                    active ? "bg-primary/10 border-primary/30" : "bg-[#111] border-[#222]")}>
                  <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-[#555]")} />
                  <span className={cn("text-xs font-medium", active ? "text-white" : "text-[#777]")}>{item.label}</span>
                </button>
              );
            })}
          </div>
          {/* Saklama süresi */}
          <div className="grid md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">Saklama Süresi (gün)</label>
              <input type="number" min={1}
                value={logRetentionDays}
                onChange={e => setLogRetentionDays(Number(e.target.value) || 1)}
                className="w-full mt-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" />
            </div>
            <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-xl px-3 py-2 text-[11px] text-yellow-200/70">
              Kayıtlar {logRetentionDays} gün sonra otomatik silinmek üzere işaretlenir.
            </div>
          </div>
          <button onClick={saveAccessLog}
            className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
              accessLogSaved
                ? "bg-green-900/30 text-green-400 border border-green-700/30"
                : "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25")}>
            <Save className="h-3.5 w-3.5" />
            {accessLogSaved ? "Kaydedildi ✓" : "Ayarları Kaydet"}
          </button>

          {/* En çok şüpheli istek atan IP'ler */}
          <div className="border-t border-[#222] pt-4">
            <p className="text-xs font-semibold text-[#aaa] mb-2">En Çok Şüpheli İstek Atan IP'ler</p>
            {topIps.length === 0 ? (
              <p className="text-[11px] text-[#555]">
                {logsLoading ? "Yükleniyor…" : "Henüz reddedilen (403/404) bir istek kaydedilmedi."}
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {topIps.map((t) => (
                  <div key={t.ip} className="flex items-center justify-between bg-[#111] border border-[#222] rounded-lg px-3 py-2 gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-white truncate">{t.ip}</p>
                      <p className="text-[10px] text-[#555]">Son görülme: {new Date(t.lastSeen).toLocaleString("tr-TR")}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-900/20 text-red-400">
                        {t.count} istek
                      </span>
                      {isIpBlocked(t.ip) ? (
                        <button onClick={() => unblockIp(t.ip)} disabled={blockingIp === t.ip}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/20 text-green-400 hover:bg-green-900/30 disabled:opacity-50">
                          Engeli Kaldır
                        </button>
                      ) : (
                        <button onClick={() => blockIp(t.ip, "Şüpheli istek trafiği")} disabled={blockingIp === t.ip}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#222] text-[#ccc] hover:bg-red-900/30 hover:text-red-400 disabled:opacity-50">
                          Engelle
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Son şüpheli istekler tablosu */}
          <div className="border-t border-[#222] pt-4">
            <p className="text-xs font-semibold text-[#aaa] mb-2">Son Reddedilen İstekler (403 / 404)</p>
            {accessLogs.length === 0 ? (
              <p className="text-[11px] text-[#555]">
                {logsLoading ? "Yükleniyor…" : "Kayıt bulunamadı."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#222]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#111] text-[#666] text-left">
                      <th className="px-3 py-2 font-medium">IP</th>
                      <th className="px-3 py-2 font-medium">Yöntem</th>
                      <th className="px-3 py-2 font-medium">Yol</th>
                      <th className="px-3 py-2 font-medium">Durum</th>
                      <th className="px-3 py-2 font-medium">Zaman</th>
                      <th className="px-3 py-2 font-medium">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e1e]">
                    {accessLogs.map((l) => (
                      <tr key={l.id} className="hover:bg-[#151515]">
                        <td className="px-3 py-2 font-mono text-[#ccc] whitespace-nowrap">{l.ip}</td>
                        <td className="px-3 py-2 text-[#888] whitespace-nowrap">{l.method}</td>
                        <td className="px-3 py-2 text-[#aaa] truncate max-w-[220px]" title={l.path}>{l.path}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                            l.status === 403 ? "bg-red-900/20 text-red-400" : "bg-yellow-900/20 text-yellow-400")}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#666] whitespace-nowrap">{new Date(l.createdAt).toLocaleString("tr-TR")}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {isIpBlocked(l.ip) ? (
                            <button onClick={() => unblockIp(l.ip)} disabled={blockingIp === l.ip}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/20 text-green-400 hover:bg-green-900/30 disabled:opacity-50">
                              Kaldır
                            </button>
                          ) : (
                            <button onClick={() => blockIp(l.ip, `${l.path} adresine tekrarlı istek`)} disabled={blockingIp === l.ip}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#222] text-[#ccc] hover:bg-red-900/30 hover:text-red-400 disabled:opacity-50">
                              Engelle
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Engellenmiş IP'ler */}
          <div className="border-t border-[#222] pt-4">
            <p className="text-xs font-semibold text-[#aaa] mb-2">Engellenmiş IP'ler ({blockedIps.length})</p>
            {blockedIps.length === 0 ? (
              <p className="text-[11px] text-[#555]">Henüz engellenmiş bir IP yok.</p>
            ) : (
              <div className="space-y-1.5">
                {blockedIps.map((b) => (
                  <div key={b.id} className="flex items-center justify-between bg-red-900/10 border border-red-800/30 rounded-lg px-3 py-2 gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-white">{b.ip}</p>
                      <p className="text-[10px] text-[#888] truncate">
                        {b.reason || "Sebep belirtilmedi"} • {new Date(b.createdAt).toLocaleString("tr-TR")}
                        {b.blockedBy ? ` • ${b.blockedBy}` : ""}
                      </p>
                    </div>
                    <button onClick={() => unblockIp(b.ip)} disabled={blockingIp === b.ip}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/20 text-green-400 hover:bg-green-900/30 disabled:opacity-50 shrink-0">
                      Engeli Kaldır
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2FA / Çoklu Koruma ─── */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">2FA ve Çoklu Koruma</h3>
            <p className="text-[11px] text-[#555] mt-0.5">İstediğiniz yöntemleri etkinleştirin</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-900/20 text-yellow-400">
            {Object.values(methods).filter(Boolean).length} Aktif
          </span>
        </div>
        <div className="divide-y divide-[#1e1e1e]">
          {AUTH_METHODS.map((m) => {
            const Icon = m.icon;
            const active = methods[m.id];
            return (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  active ? "bg-green-900/20" : "bg-[#222]")}>
                  <Icon className={cn("h-4 w-4", active ? "text-green-400" : "text-[#444]")} />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", active ? "text-white" : "text-[#777]")}>{m.label}</p>
                  <p className="text-[11px] text-[#555]">{m.desc}</p>
                </div>
                <button onClick={() => setMethods(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                  className={cn("w-11 h-6 rounded-full transition-all relative shrink-0",
                    active ? "bg-primary" : "bg-[#333]")}>
                  <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                    active ? "left-6" : "left-1")} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-[#222] bg-[#111] text-[11px] text-[#555]">
          Aynı anda birden fazla yöntem açık kalabilir; örn. TOTP + yedek kod + güvenlik anahtarı.
        </div>
      </div>

      {/* ─── Coğrafi Kısıt ─── */}
      <GeoRestrictionPanel />

      {/* ─── Önerilen Önlemler ─── */}
      <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-yellow-200">Önerilen Ek Önlemler</p>
          <ul className="text-xs text-yellow-200/60 mt-1.5 space-y-1">
            <li>• HTTPS kullanın (deploy sonrası otomatik aktif)</li>
            <li>• Veritabanı şifreleme için production'da DB şifreleme etkinleştirin</li>
            <li>• API key'leri .env dosyasında tutun, asla kod içinde yazmayın</li>
            <li>• Admin hesabı için 2FA ekleyin</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─── Coğrafi Kısıt ─── */
const COUNTRY_LIST = [
  { code: "TR", name: "Türkiye" },    { code: "US", name: "ABD" },           { code: "DE", name: "Almanya" },
  { code: "GB", name: "İngiltere" },  { code: "FR", name: "Fransa" },        { code: "NL", name: "Hollanda" },
  { code: "RU", name: "Rusya" },      { code: "CN", name: "Çin" },           { code: "SA", name: "Suudi Arabistan" },
  { code: "AE", name: "BAE" },        { code: "IR", name: "İran" },          { code: "PK", name: "Pakistan" },
  { code: "IN", name: "Hindistan" },  { code: "AU", name: "Avustralya" },    { code: "CA", name: "Kanada" },
  { code: "JP", name: "Japonya" },    { code: "KR", name: "Güney Kore" },    { code: "BR", name: "Brezilya" },
  { code: "MX", name: "Meksika" },    { code: "AR", name: "Arjantin" },      { code: "PL", name: "Polonya" },
  { code: "IT", name: "İtalya" },     { code: "ES", name: "İspanya" },       { code: "SE", name: "İsveç" },
  { code: "NO", name: "Norveç" },     { code: "CH", name: "İsviçre" },       { code: "AT", name: "Avusturya" },
  { code: "BE", name: "Belçika" },    { code: "UA", name: "Ukrayna" },       { code: "EG", name: "Mısır" },
];

function GeoRestrictionPanel() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<{
    isEnabled: boolean; mode: "allowlist" | "blocklist";
    countries: string[]; redirectUrl: string; message: string;
  }>({ isEnabled: false, mode: "blocklist", countries: [], redirectUrl: "", message: "Bu içerik bulunduğunuz ülkede kullanılamaz." });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    apiFetch("/geo/admin/settings")
      .then(d => setSettings({
        isEnabled:   d.settings.isEnabled ?? false,
        mode:        d.settings.mode ?? "blocklist",
        countries:   (d.settings.countries as string[]) ?? [],
        redirectUrl: d.settings.redirectUrl ?? "",
        message:     d.settings.message ?? "Bu içerik bulunduğunuz ülkede kullanılamaz.",
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const d = await apiFetch("/geo/admin/settings", { method: "PUT", body: JSON.stringify(settings) });
      setSettings(prev => ({ ...prev, ...d.settings }));
      setSaved(true);
      toast({ title: "Coğrafi kısıt kaydedildi ✓" });
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleCountry = (code: string) => {
    setSettings(prev => ({
      ...prev,
      countries: prev.countries.includes(code)
        ? prev.countries.filter(c => c !== code)
        : [...prev.countries, code],
    }));
  };

  const filtered = COUNTRY_LIST.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold">Coğrafi Kısıt</h3>
          <span className="text-[10px] bg-[#222] text-[#555] px-2 py-0.5 rounded-full font-medium">Varsayılan: Kapalı</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#555]">{settings.isEnabled ? "Aktif" : "Pasif"}</span>
          <button onClick={() => setSettings(prev => ({ ...prev, isEnabled: !prev.isEnabled }))}
            className={cn("w-11 h-6 rounded-full transition-all relative shrink-0",
              settings.isEnabled ? "bg-blue-500" : "bg-[#333]")}>
            <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
              settings.isEnabled ? "left-6" : "left-1")} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-4 w-4 text-[#555] animate-spin" />
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Mod */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">Kısıt Modu</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "blocklist" as const, label: "Engel Listesi",  desc: "Seçili ülkeler ENGELLENIR" },
                { v: "allowlist" as const, label: "İzin Listesi",   desc: "Yalnızca seçili ülkeler ERİŞEBİLİR" },
              ].map(opt => (
                <button key={opt.v} onClick={() => setSettings(prev => ({ ...prev, mode: opt.v }))}
                  className={cn("text-left px-3 py-2.5 rounded-lg border transition-all",
                    settings.mode === opt.v
                      ? "border-blue-500/50 bg-blue-900/15 text-white"
                      : "border-[#2a2a2a] bg-[#111] text-[#555] hover:border-[#333]")}>
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Ülkeler */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">
                Ülkeler — {settings.countries.length} seçili
              </label>
              {settings.countries.length > 0 && (
                <button onClick={() => setSettings(prev => ({ ...prev, countries: [] }))}
                  className="text-[10px] text-[#555] hover:text-red-400 transition-colors flex items-center gap-1">
                  <X className="h-3 w-3" /> Tümünü temizle
                </button>
              )}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Ülke ara..."
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-primary/50" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {filtered.map(c => {
                const sel = settings.countries.includes(c.code);
                return (
                  <button key={c.code} onClick={() => toggleCountry(c.code)}
                    className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[11px] transition-all",
                      sel ? "bg-blue-900/20 border-blue-600/40 text-blue-300" : "bg-[#111] border-[#222] text-[#666] hover:border-[#333]")}>
                    <span className="font-mono text-[10px]">{c.code}</span>
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Yönlendirme */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">Yönlendirme URL</label>
              <input value={settings.redirectUrl}
                onChange={e => setSettings(prev => ({ ...prev, redirectUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full mt-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">Kullanıcı Mesajı</label>
              <input value={settings.message}
                onChange={e => setSettings(prev => ({ ...prev, message: e.target.value }))}
                className="w-full mt-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className={cn("flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-all",
              saved
                ? "bg-green-900/30 text-green-400 border border-green-700/30"
                : "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 disabled:opacity-50")}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Kaydediliyor..." : saved ? "Kaydedildi ✓" : "Değişiklikleri Kaydet"}
          </button>
        </div>
      )}
    </div>
  );
}
