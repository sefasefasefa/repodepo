import { useState, useEffect } from "react";
import { Shield, Lock, AlertTriangle, RefreshCw, CheckCircle, Eye, EyeOff, MonitorOff, Video, Globe, X, Plus, Save, ShieldCheck, Smartphone, KeyRound, QrCode, FileText, MapPin, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";
import { isScreenProtectionEnabled, setScreenProtectionEnabled } from "@/lib/use-screen-protection";

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

const SECURITY_FEATURES = [
  { icon: Lock, label: "Brute Force Koruması", desc: "10 başarısız denemede 30 dk IP kilidi", active: true, color: "text-green-400" },
  { icon: Shield, label: "Rate Limiting", desc: "Auth: 20 istek/15dk • API: 300 istek/dk", active: true, color: "text-green-400" },
  { icon: Shield, label: "Helmet Başlıkları", desc: "XSS, clickjacking, MIME sniffing koruması", active: true, color: "text-green-400" },
  { icon: AlertTriangle, label: "Şüpheli İstek Tespiti", desc: "SQLMap, Nikto, tarayıcı araçları engellenir", active: true, color: "text-green-400" },
  { icon: Shield, label: "Şifre Hashing", desc: "scrypt + 16-byte salt ile güvenli hash", active: true, color: "text-green-400" },
  { icon: Lock, label: "Oturum Tokenları", desc: "64-byte rastgele token, her girişte yenilenir", active: true, color: "text-green-400" },
  { icon: AlertTriangle, label: "İki Faktörlü Doğrulama (2FA)", desc: "TOTP / SMS destekli 2FA", active: false, color: "text-[#555]" },
  { icon: Shield, label: "reCAPTCHA", desc: "Giriş ve kayıt formlarında bot koruması", active: false, color: "text-[#555]" },
];

const AUTH_METHODS = [
  { id: "totp", label: "Google Authenticator / TOTP", icon: QrCode, desc: "Kod üreten uygulamalarla giriş doğrulama" },
  { id: "sms", label: "SMS Doğrulama", icon: Smartphone, desc: "Telefon numarasına tek kullanımlık kod" },
  { id: "backup", label: "Yedek Kodlar", icon: KeyRound, desc: "Alternatif kurtarma kodları" },
  { id: "security-key", label: "Güvenlik Anahtarı", icon: ShieldCheck, desc: "Fiziksel anahtar ile giriş onayı" },
];

const ACCESS_LOG_FIELDS = [
  { label: "IP Adresi", value: "Kaydedilir" },
  { label: "Ülke", value: "Kaydedilir" },
  { label: "İl / Şehir", value: "Kaydedilir" },
  { label: "Cihaz / Tarayıcı", value: "Kaydedilir" },
];

export function AdminSecurity() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [screenProtection, setScreenProtectionState] = useState(isScreenProtectionEnabled);
  const [methods, setMethods] = useState<Record<string, boolean>>({
    totp: true,
    sms: false,
    backup: true,
    "security-key": false,
  });
  const [logRetentionDays, setLogRetentionDays] = useState(30);
  const [accessLogSettings, setAccessLogSettings] = useState({
    isEnabled: true,
    trackIp: true,
    trackGeo: true,
    trackDevice: true,
  });

  const toggleScreenProtection = () => {
    const next = !screenProtection;
    setScreenProtectionEnabled(next);
    setScreenProtectionState(next);
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/security/stats");
      setStats(d);
    } catch {
      // Stats endpoint olmayabilir, mock göster
      setStats({ lockedIPs: 0, recentLoginAttempts: 0, trackedIPs: 0 });
    }
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold">Güvenlik Durumu</h2>
        <p className="text-[#666] text-sm mt-1">Aktif güvenlik katmanları ve giriş istatistikleri</p>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Kilitli IP", value: stats?.lockedIPs ?? "—", color: stats?.lockedIPs > 0 ? "text-red-400" : "text-green-400" },
          { label: "Son 1 Saat Deneme", value: stats?.recentLoginAttempts ?? "—", color: "text-yellow-400" },
          { label: "İzlenen IP", value: stats?.trackedIPs ?? "—", color: "text-[#aaa]" },
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

      <button onClick={loadStats} disabled={loading} className="flex items-center gap-2 text-sm text-[#888] hover:text-white px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] transition-colors">
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Yenile
      </button>

      {/* Ekran Kaydı Koruması */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MonitorOff className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold">Ekran Kaydı Koruması</h3>
          </div>
          <button
            onClick={toggleScreenProtection}
            className={cn(
              "w-11 h-6 rounded-full transition-all relative shrink-0",
              screenProtection ? "bg-red-500" : "bg-[#333]"
            )}
          >
            <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", screenProtection ? "left-6" : "left-1")} />
          </button>
        </div>
        <div className="divide-y divide-[#1e1e1e]">
          {[
            { icon: MonitorOff, label: "CSS Compositor Katmanı", desc: "backdrop-filter ile bazı ekran kayıt araçlarını engeller", active: screenProtection },
            { icon: Video, label: "getDisplayMedia API Engeli", desc: "Tarayıcı tabanlı ekran/sekme kaydını bloklar", active: screenProtection },
            { icon: Lock, label: "Klavye Kısayolları Engeli", desc: "PrintScreen, F12, Ctrl+S, Ctrl+U, Ctrl+P bloklanır", active: screenProtection },
            { icon: Shield, label: "Sağ Tık & Sürükleme Engeli", desc: "Video üzerinde context menu ve drag engellenir", active: screenProtection },
            { icon: Eye, label: "PiP (Picture-in-Picture) Engeli", desc: "Video öğesi PiP moduna alınamaz", active: screenProtection },
            { icon: Shield, label: "Download Engeli", desc: "Video kontrolünden indirme butonu kaldırılır", active: screenProtection },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                f.active ? "bg-red-900/20" : "bg-[#222]")}>
                <f.icon className={cn("h-3.5 w-3.5", f.active ? "text-red-400" : "text-[#444]")} />
              </div>
              <div className="flex-1">
                <p className={cn("text-sm font-medium", f.active ? "text-white" : "text-[#555]")}>{f.label}</p>
                <p className="text-[11px] text-[#555]">{f.desc}</p>
              </div>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                f.active ? "bg-red-900/20 text-red-400" : "bg-[#222] text-[#444]")}>
                {f.active ? "AKTİF" : "PASİF"}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-[#222] bg-[#111]">
          <p className="text-[11px] text-[#555] leading-relaxed">
            <span className="text-yellow-500 font-medium">⚠ Not:</span> Tarayıcı tabanlı koruma, OBS gibi donanım düzeyinde kayıt yazılımlarını veya telefon kamerasını engelleyemez. Bu sistem caydırıcı bir katmandır.
          </p>
        </div>
      </div>

      {/* Güvenlik katmanları */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222]">
          <h3 className="text-sm font-semibold">Güvenlik Katmanları</h3>
        </div>
        <div className="divide-y divide-[#1e1e1e]">
          {SECURITY_FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  f.active ? "bg-green-900/20" : "bg-[#222]")}>
                  <Icon className={cn("h-4 w-4", f.active ? "text-green-400" : "text-[#444]")} />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", f.active ? "text-white" : "text-[#555]")}>{f.label}</p>
                  <p className="text-[11px] text-[#555]">{f.desc}</p>
                </div>
                <div className={cn("flex items-center gap-1.5 text-[11px] font-medium", f.active ? "text-green-400" : "text-[#444]")}>
                  {f.active ? <><CheckCircle className="h-3.5 w-3.5" /> Aktif</> : <><EyeOff className="h-3.5 w-3.5" /> Pasif</>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Giriş kuralları */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">Giriş Güvenlik Kuralları</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            { label: "Başarısız Deneme Limiti", value: "10 deneme" },
            { label: "Gözlem Penceresi", value: "15 dakika" },
            { label: "IP Kilit Süresi", value: "30 dakika" },
            { label: "Rate Limit (Auth)", value: "20 istek / 15 dk" },
            { label: "Rate Limit (Genel API)", value: "300 istek / dakika" },
            { label: "Upload Limiti", value: "20 dosya / saat" },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between bg-[#111] rounded-lg px-3 py-2.5">
              <span className="text-xs text-[#888]">{r.label}</span>
              <span className="text-xs font-semibold text-primary">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">İP Bazlı Erişim Günlüğü</h3>
            <p className="text-[11px] text-[#555] mt-1">IP, ülke, il/şehir ve cihaz bilgileri belirli süre tutulur.</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#222] text-[#888]">PASİF</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            {ACCESS_LOG_FIELDS.map((field) => (
              <div key={field.label} className="flex items-center justify-between bg-[#111] rounded-lg px-3 py-2.5 border border-[#222]">
                <span className="text-xs text-[#888]">{field.label}</span>
                <span className="text-xs font-semibold text-primary">{field.value}</span>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { key: "trackIp", label: "IP takibi", icon: FileText },
              { key: "trackGeo", label: "Ülke / İl takibi", icon: MapPin },
              { key: "trackDevice", label: "Cihaz takibi", icon: Laptop },
            ].map((item) => {
              const Icon = item.icon;
              const active = accessLogSettings[item.key as keyof typeof accessLogSettings];
              return (
                <button
                  key={item.key}
                  onClick={() => setAccessLogSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                  className={cn("flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left", active ? "bg-primary/10 border-primary/30" : "bg-[#111] border-[#222]")}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-[#555]")} />
                  <span className={cn("text-xs font-medium", active ? "text-white" : "text-[#777]")}>{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="grid md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">Saklama Süresi (gün)</label>
              <input
                type="number"
                min={1}
                value={logRetentionDays}
                onChange={e => setLogRetentionDays(Number(e.target.value) || 1)}
                className="w-full mt-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#444]"
              />
            </div>
            <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-xl px-3 py-2 text-[11px] text-yellow-200/70">
              Kayıtlar {logRetentionDays} gün sonra otomatik silinmek üzere işaretlenir.
            </div>
          </div>
          <div className="flex items-center justify-between bg-[#111] rounded-lg px-3 py-2.5 border border-[#222]">
            <div>
              <p className="text-xs font-medium text-white">Günlükleme Aktif</p>
              <p className="text-[11px] text-[#555]">Pasif görünür mod; altyapıya bağlanmadı.</p>
            </div>
            <button
              onClick={() => setAccessLogSettings(prev => ({ ...prev, isEnabled: !prev.isEnabled }))}
              className={cn("w-11 h-6 rounded-full transition-all relative shrink-0", accessLogSettings.isEnabled ? "bg-primary" : "bg-[#333]")}
            >
              <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", accessLogSettings.isEnabled ? "left-6" : "left-1")} />
            </button>
          </div>
        </div>
      </div>

      {/* 2FA / Çoklu Koruma Yöntemleri */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">2FA ve Çoklu Koruma</h3>
            <p className="text-[11px] text-[#555] mt-1">Pasif modda; görünür ve yapılandırılabilir.</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#222] text-[#888]">PASİF</span>
        </div>
        <div className="divide-y divide-[#1e1e1e]">
          {AUTH_METHODS.map((m) => {
            const Icon = m.icon;
            const active = methods[m.id];
            return (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", active ? "bg-green-900/20" : "bg-[#222]")}>
                  <Icon className={cn("h-4 w-4", active ? "text-green-400" : "text-[#444]")} />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", active ? "text-white" : "text-[#777]")}>{m.label}</p>
                  <p className="text-[11px] text-[#555]">{m.desc}</p>
                </div>
                <button
                  onClick={() => setMethods(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                  className={cn("w-11 h-6 rounded-full transition-all relative shrink-0", active ? "bg-primary" : "bg-[#333]")}
                >
                  <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", active ? "left-6" : "left-1")} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-[#222] bg-[#111] text-[11px] text-[#555]">
          Aynı anda birden fazla yöntem açık kalabilir; örn. TOTP + yedek kod + güvenlik anahtarı.
        </div>
      </div>

      {/* Coğrafi Kısıt */}
      <GeoRestrictionPanel />

      {/* Uyarı */}
      <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-yellow-200">Önerilen Ek Önlemler</p>
          <ul className="text-xs text-yellow-200/60 mt-1.5 space-y-1">
            <li>• HTTPS kullanın (deploy sonrası otomatik aktif)</li>
            <li>• Veritabanı şifreleme için production'da DB şifreleme etkinleştirin</li>
            <li>• API key'leri .env dosyasında tutun, asla kod içinde yazmayın</li>
            <li>• Admin hesabı için 2FA ekleyin (gelecek güncelleme)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Coğrafi Kısıt Yönetim Paneli
───────────────────────────────────────────── */
const COUNTRY_LIST = [
  { code: "TR", name: "Türkiye" }, { code: "US", name: "ABD" }, { code: "DE", name: "Almanya" },
  { code: "GB", name: "İngiltere" }, { code: "FR", name: "Fransa" }, { code: "NL", name: "Hollanda" },
  { code: "RU", name: "Rusya" }, { code: "CN", name: "Çin" }, { code: "SA", name: "Suudi Arabistan" },
  { code: "AE", name: "BAE" }, { code: "IR", name: "İran" }, { code: "PK", name: "Pakistan" },
  { code: "IN", name: "Hindistan" }, { code: "AU", name: "Avustralya" }, { code: "CA", name: "Kanada" },
  { code: "JP", name: "Japonya" }, { code: "KR", name: "Güney Kore" }, { code: "BR", name: "Brezilya" },
  { code: "MX", name: "Meksika" }, { code: "AR", name: "Arjantin" }, { code: "PL", name: "Polonya" },
  { code: "IT", name: "İtalya" }, { code: "ES", name: "İspanya" }, { code: "SE", name: "İsveç" },
  { code: "NO", name: "Norveç" }, { code: "CH", name: "İsviçre" }, { code: "AT", name: "Avusturya" },
  { code: "BE", name: "Belçika" }, { code: "UA", name: "Ukrayna" }, { code: "EG", name: "Mısır" },
];

function GeoRestrictionPanel() {
  const [settings, setSettings] = useState<{
    isEnabled: boolean; mode: "allowlist" | "blocklist";
    countries: string[]; redirectUrl: string; message: string;
  }>({ isEnabled: false, mode: "blocklist", countries: [], redirectUrl: "", message: "Bu içerik bulunduğunuz ülkede kullanılamaz." });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [search, setSearch]     = useState("");

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
      const d = await apiFetch("/geo/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(prev => ({ ...prev, ...d.settings }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
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
      {/* Başlık */}
      <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold">Coğrafi Kısıt</h3>
          <span className="text-[10px] bg-[#222] text-[#555] px-2 py-0.5 rounded-full font-medium">Varsayılan: Kapalı</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#555]">{settings.isEnabled ? "Aktif" : "Pasif"}</span>
          <button
            onClick={() => setSettings(prev => ({ ...prev, isEnabled: !prev.isEnabled }))}
            className={cn("w-11 h-6 rounded-full transition-all relative shrink-0",
              settings.isEnabled ? "bg-blue-500" : "bg-[#333]")}
          >
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
          {/* Mod seçimi */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">Kısıt Modu</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "blocklist" as const, label: "Engel Listesi", desc: "Seçili ülkeler ENGELLENIR" },
                { v: "allowlist" as const, label: "İzin Listesi", desc: "Yalnızca seçili ülkeler ERİŞEBİLİR" },
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

          {/* Ülke arama + seçim */}
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

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ülke ara..."
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#444]"
            />

            {/* Seçili ülkeler */}
            {settings.countries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {settings.countries.map(code => {
                  const c = COUNTRY_LIST.find(x => x.code === code);
                  return (
                    <span key={code}
                      className="inline-flex items-center gap-1 bg-blue-900/20 border border-blue-500/30 text-blue-300 text-[10px] font-medium px-2 py-0.5 rounded-full">
                      {c?.name ?? code}
                      <button onClick={() => toggleCountry(code)}><X className="h-2.5 w-2.5" /></button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Ülke listesi */}
            <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent">
              {filtered.map(c => (
                <button key={c.code} onClick={() => toggleCountry(c.code)}
                  className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-all text-left",
                    settings.countries.includes(c.code)
                      ? "bg-blue-900/20 border border-blue-500/30 text-blue-300"
                      : "bg-[#111] border border-[#1e1e1e] text-[#888] hover:border-[#2a2a2a] hover:text-white")}>
                  <span className="font-mono text-[10px] opacity-60 w-6 shrink-0">{c.code}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mesaj */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">Engel Mesajı</label>
            <input
              value={settings.message}
              onChange={e => setSettings(prev => ({ ...prev, message: e.target.value }))}
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#444]"
              placeholder="Bu içerik bulunduğunuz ülkede kullanılamaz."
            />
          </div>

          {/* Yönlendirme URL */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">
              Yönlendirme URL <span className="text-[#444] normal-case font-normal">(isteğe bağlı)</span>
            </label>
            <input
              value={settings.redirectUrl}
              onChange={e => setSettings(prev => ({ ...prev, redirectUrl: e.target.value }))}
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#444]"
              placeholder="https://ornek.com/erisim-engeli (boş bırakılırsa engel ekranı gösterilir)"
            />
          </div>

          {/* Kaydet */}
          <button onClick={save} disabled={saving}
            className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
              saved
                ? "bg-green-600 text-white"
                : "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50")}>
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> :
             saved   ? <CheckCircle className="h-4 w-4" /> :
                       <Save className="h-4 w-4" />}
            {saving ? "Kaydediliyor..." : saved ? "Kaydedildi!" : "Kaydet"}
          </button>
        </div>
      )}
    </div>
  );
}
