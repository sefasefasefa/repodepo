/**
 * Webhook Dashboard — Modern & Tam Özellikli
 * ─────────────────────────────────────────────
 * Sekmeler: Endpointler | Delivery Log | İstatistikler | Manuel Tetikle
 * Özellikler:
 *   • Platform renk/ikon branding (Discord, Slack, Zapier, Teams, Telegram, vb.)
 *   • Gerçek zamanlı endpoint sağlık göstergesi
 *   • Tam CRUD (oluştur, düzenle, sil, toggle)
 *   • Canlı test gönderimi ve sonuç görüntüleme
 *   • Delivery log — filtre, sayfalama, inline detay, retry
 *   • İstatistikler — başarı oranı, avg süre, olay dağılımı, endpoint karşılaştırması
 *   • Manuel olay tetikleme — event seçici + payload editörü
 *   • HMAC imza bilgisi + timeout/retry config
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import {
  Webhook, Plus, Trash2, Edit2, Check, X, ChevronRight, ChevronDown,
  RefreshCw, Send, AlertCircle, CheckCircle2, Clock, XCircle,
  BarChart2, Zap, Activity, Eye, RotateCcw, Filter,
  Play, Pause, Shield, Copy, Terminal, ExternalLink,
  Radio, TrendingUp, AlertTriangle, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = "/api";

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface Endpoint {
  id: number; name: string; platform: string; url: string;
  hasSecret: boolean; secret?: string; events: string[];
  isEnabled: boolean; status: string;
  totalDeliveries: number; successDeliveries: number; successRate: number | null;
  lastTriggeredAt: string | null; lastStatusCode: number | null;
  maxRetries: number; timeoutSecs: number;
  createdAt: string; updatedAt: string;
}
interface Delivery {
  id: number; endpointId: number; endpointName: string; platform: string;
  event: string; status: string; attempt: number; maxAttempts: number;
  responseStatus: number | null; responseTimeMs: number | null;
  error: string; triggeredAt: string; deliveredAt: string | null;
  payload?: any; requestBody?: string; requestHeaders?: any; responseBody?: string;
}
interface Stats {
  globalEnabled: boolean;
  endpoints: { total: number; active: number; failing: number };
  deliveries: { total: number; success: number; failed: number; pending: number; successRate: number | null; avgResponseMs: number | null };
  topEvents: { event: string; count: number }[];
  endpointStats: any[];
  recentFailures: any[];
}

// ─── Platform Metadata ────────────────────────────────────────────────────────
const PM: Record<string, { name: string; icon: string; color: string; bg: string; border: string; placeholder: string; hint: string }> = {
  discord:   { name: "Discord",       icon: "💬", color: "#5865F2", bg: "rgba(88,101,242,.12)", border: "rgba(88,101,242,.25)", placeholder: "https://discord.com/api/webhooks/ID/TOKEN",              hint: "Discord'da Sunucu Ayarları → Entegrasyonlar → Webhook'lar yolunu izleyin." },
  slack:     { name: "Slack",         icon: "💼", color: "#E01E5A", bg: "rgba(224,30,90,.12)",  border: "rgba(224,30,90,.25)",  placeholder: "https://hooks.slack.com/services/T.../B.../...",        hint: "Slack Uygulama Dizini'nden Incoming Webhooks ekleyin." },
  zapier:    { name: "Zapier",        icon: "⚡", color: "#FF4A00", bg: "rgba(255,74,0,.12)",   border: "rgba(255,74,0,.25)",   placeholder: "https://hooks.zapier.com/hooks/catch/ORG_ID/HOOK_ID/", hint: "Zapier'da 'Webhooks by Zapier' trigger ile Zap oluşturun." },
  make:      { name: "Make",          icon: "🔄", color: "#7E3AF2", bg: "rgba(126,58,242,.12)", border: "rgba(126,58,242,.25)", placeholder: "https://hook.eu2.make.com/xxxxx",                       hint: "Make'de 'Custom Webhook' modülü ile senaryo başlatın." },
  n8n:       { name: "n8n",           icon: "🔧", color: "#EA4B71", bg: "rgba(234,75,113,.12)", border: "rgba(234,75,113,.25)", placeholder: "https://your-n8n.app/webhook/UUID",                     hint: "n8n workflow'unda Webhook node ekleyin, Test URL'yi kopyalayın." },
  ifttt:     { name: "IFTTT",         icon: "🔀", color: "#009AE5", bg: "rgba(0,154,229,.12)",  border: "rgba(0,154,229,.25)",  placeholder: "https://maker.ifttt.com/trigger/EVENT/with/key/KEY",   hint: "IFTTT'de Maker Webhooks servisini If olarak seçin." },
  pipedream: { name: "Pipedream",     icon: "🌊", color: "#3CC877", bg: "rgba(60,200,119,.12)", border: "rgba(60,200,119,.25)", placeholder: "https://eo.pipedream.net/UUID",                         hint: "Pipedream'de yeni workflow oluşturun, HTTP/Webhook trigger seçin." },
  teams:     { name: "MS Teams",      icon: "🟦", color: "#6264A7", bg: "rgba(98,100,167,.12)", border: "rgba(98,100,167,.25)", placeholder: "https://xxx.webhook.office.com/webhookb2/...",          hint: "Teams kanalında Bağlayıcılar → Incoming Webhook ekleyin." },
  telegram:  { name: "Telegram",      icon: "✈️", color: "#2AABEE", bg: "rgba(42,171,238,.12)", border: "rgba(42,171,238,.25)", placeholder: "https://api.telegram.org/botTOKEN/sendMessage",         hint: "BotFather ile bot oluşturun ve chat_id'yi URL'e ekleyin." },
  custom:    { name: "Özel HTTP",     icon: "🌐", color: "#8B5CF6", bg: "rgba(139,92,246,.12)", border: "rgba(139,92,246,.25)", placeholder: "https://sizin-endpoint.com/webhook",                   hint: "JSON POST alabilecek herhangi bir HTTP endpoint. HMAC imzalı gönderim desteklenir." },
};

// ─── Olay Grupları ────────────────────────────────────────────────────────────
const EVENT_GROUPS = [
  { label: "🎬 Video",      color: "#7c3aed", events: ["video.created","video.updated","video.deleted","video.published","video.approved","video.rejected"] },
  { label: "👤 Kullanıcı", color: "#2563eb", events: ["user.registered","user.banned","user.role_changed"] },
  { label: "💳 Ödeme",     color: "#059669", events: ["payment.completed","payment.failed","subscription.created","subscription.cancelled","subscription.expired"] },
  { label: "🎤 Creator",   color: "#d97706", events: ["creator.approved","creator.rejected"] },
  { label: "💬 İçerik",    color: "#db2777", events: ["comment.created","report.created","live.started","live.ended","tip.received"] },
];
const ALL_EVENTS = EVENT_GROUPS.flatMap(g => g.events);

const EVENT_EMOJI: Record<string, string> = {
  "video.created":"🎬","video.updated":"✏️","video.deleted":"🗑️","video.published":"✅","video.approved":"✅","video.rejected":"❌",
  "user.registered":"👤","user.banned":"🚫","user.role_changed":"🔑",
  "payment.completed":"💳","payment.failed":"❗","subscription.created":"🌟","subscription.cancelled":"↩️","subscription.expired":"⏰",
  "creator.approved":"🎉","creator.rejected":"❌","comment.created":"💬","report.created":"⚠️",
  "live.started":"🔴","live.ended":"⬛","tip.received":"💎",
};

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 5000) return "az önce";
  if (d < 60000) return `${Math.round(d/1000)}s önce`;
  if (d < 3600000) return `${Math.round(d/60000)}dk önce`;
  if (d < 86400000) return `${Math.round(d/3600000)}sa önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"short" });
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function StatusChip({ status, small }: { status: string; small?: boolean }) {
  const map: Record<string, [string, React.ReactNode]> = {
    success:  ["text-green-400 bg-green-500/10 border-green-500/20",  <CheckCircle2 className={small?"h-2.5 w-2.5":"h-3 w-3"} />],
    failed:   ["text-red-400 bg-red-500/10 border-red-500/20",        <XCircle className={small?"h-2.5 w-2.5":"h-3 w-3"} />],
    retrying: ["text-amber-400 bg-amber-500/10 border-amber-500/20",  <RefreshCw className={cn(small?"h-2.5 w-2.5":"h-3 w-3","animate-spin")} />],
    pending:  ["text-blue-400 bg-blue-500/10 border-blue-500/20",     <Clock className={small?"h-2.5 w-2.5":"h-3 w-3"} />],
    active:   ["text-green-400 bg-green-500/10 border-green-500/20",  <Activity className={small?"h-2.5 w-2.5":"h-3 w-3"} />],
    failing:  ["text-red-400 bg-red-500/10 border-red-500/20",        <AlertCircle className={small?"h-2.5 w-2.5":"h-3 w-3"} />],
    paused:   ["text-[#666] bg-[#111] border-[#1e1e1e]",             <Pause className={small?"h-2.5 w-2.5":"h-3 w-3"} />],
    unknown:  ["text-[#555] bg-[#111] border-[#1e1e1e]",             <Clock className={small?"h-2.5 w-2.5":"h-3 w-3"} />],
  };
  const [cls, icon] = map[status] || map.unknown;
  const labels: Record<string,string> = { success:"Başarılı", failed:"Başarısız", retrying:"Tekrar", pending:"Bekliyor", active:"Aktif", failing:"Hata", paused:"Duraklatıldı", unknown:"Bilinmiyor" };
  return (
    <span className={cn("inline-flex items-center gap-1 border rounded-full font-medium", small ? "text-[9px] px-1.5 py-px" : "text-[10px] px-2 py-0.5", cls)}>
      {icon}{labels[status] || status}
    </span>
  );
}

function SuccessRing({ rate, size = 40 }: { rate: number | null; size?: number }) {
  const r = 14; const circ = 2 * Math.PI * r;
  const v = rate ?? 0;
  const dashOffset = circ - (v / 100) * circ;
  const color = v >= 80 ? "#22c55e" : v >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      <svg width={size} height={size} viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={r} fill="none" stroke="#1a1a1a" strokeWidth="3.5" />
        <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          strokeLinecap="round" transform="rotate(-90 16 16)" style={{ transition: "stroke-dashoffset .5s ease" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
        {rate != null ? `${rate}%` : "—"}
      </span>
    </div>
  );
}

// ─── Endpoint Formu ───────────────────────────────────────────────────────────
function EndpointForm({ initial, onSave, onCancel }: {
  initial?: Partial<Endpoint>;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    platform: initial?.platform || "custom",
    url: initial?.url || "",
    secret: "",
    events: initial?.events || [] as string[],
    isEnabled: initial?.isEnabled ?? true,
    maxRetries: initial?.maxRetries ?? 3,
    timeoutSecs: initial?.timeoutSecs ?? 10,
  });
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState("");
  const pm = PM[form.platform] || PM.custom;

  const validateUrl = (url: string) => {
    try { new URL(url); setUrlError(""); } catch { setUrlError("Geçerli bir URL girin"); }
  };

  const toggleEvent = (e: string) =>
    setForm(f => ({ ...f, events: f.events.includes(e) ? f.events.filter(x => x !== e) : [...f.events, e] }));

  const toggleGroup = (events: string[]) =>
    setForm(f => {
      const allIn = events.every(e => f.events.includes(e));
      return { ...f, events: allIn ? f.events.filter(e => !events.includes(e)) : [...new Set([...f.events, ...events])] };
    });

  const handleSave = async () => {
    if (!form.url || urlError) return;
    setSaving(true);
    try { await onSave({ ...form, name: form.name || pm.name }); } finally { setSaving(false); }
  };

  const isEditing = !!initial?.id;
  const noEventsSelected = form.events.length === 0;

  return (
    <div className="bg-[#0e0e0e] border border-primary/20 rounded-2xl overflow-hidden">
      {/* Platform Header */}
      <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-center gap-3"
        style={{ background: `linear-gradient(to right, ${pm.bg}, transparent)` }}>
        <span className="text-2xl">{pm.icon}</span>
        <div>
          <p className="text-xs font-bold text-white uppercase tracking-wider">
            {isEditing ? `${pm.name} Düzenle` : `Yeni ${pm.name} Endpoint`}
          </p>
          <p className="text-[10px] text-[#555] mt-0.5">{pm.hint}</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Platform + İsim */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-1.5">Platform</label>
            <select value={form.platform}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value, name: f.name || PM[e.target.value]?.name || "" }))}
              className="w-full bg-[#1a1a1a] border border-[#252525] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/40 transition-colors">
              {Object.entries(PM).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-1.5">Endpoint Adı</label>
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={pm.name}
              className="w-full bg-[#1a1a1a] border border-[#252525] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/40 transition-colors" />
          </div>
        </div>

        {/* URL */}
        <div>
          <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-1.5">
            Webhook URL <span className="text-red-400 ml-0.5">*</span>
          </label>
          <div className="relative">
            <input value={form.url}
              onChange={e => { setForm(f => ({ ...f, url: e.target.value })); validateUrl(e.target.value); }}
              placeholder={pm.placeholder}
              className={cn("w-full bg-[#1a1a1a] border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-colors font-mono pr-9",
                urlError ? "border-red-500/40 focus:border-red-500/60" : "border-[#252525] focus:border-primary/40")} />
            {form.url && !urlError && (
              <button onClick={() => copyText(form.url)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#aaa] transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {urlError && <p className="text-[10px] text-red-400 mt-1">{urlError}</p>}
        </div>

        {/* Secret */}
        <div>
          <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            {isEditing ? "Secret / Token (Değiştirmek için girin)" : "Secret / Token (Opsiyonel)"}
          </label>
          <input value={form.secret}
            onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
            type="password"
            placeholder={isEditing && initial?.hasSecret ? "••••••••" : "whsec_... veya API token"}
            className="w-full bg-[#1a1a1a] border border-[#252525] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary/40 transition-colors font-mono" />
          {["custom","n8n","pipedream","zapier","make","ifttt"].includes(form.platform) && (
            <p className="text-[10px] text-[#555] mt-1.5 flex items-center gap-1">
              <Shield className="h-2.5 w-2.5 text-primary/60" />
              HMAC-SHA256 imzası <code className="font-mono text-primary/60 ml-0.5">X-Webhook-Signature</code> başlığına eklenir.
            </p>
          )}
        </div>

        {/* Retry + Timeout */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-1.5">Maks. Deneme</label>
            <select value={form.maxRetries} onChange={e => setForm(f => ({ ...f, maxRetries: +e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#252525] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/40 transition-colors">
              {[1,2,3,5].map(n => <option key={n} value={n}>{n} deneme {n > 1 ? `(${[5,25,125].slice(0,n-1).join("/")}s bekleme)` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-1.5">Bağlantı Timeout</label>
            <select value={form.timeoutSecs} onChange={e => setForm(f => ({ ...f, timeoutSecs: +e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#252525] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/40 transition-colors">
              {[5,10,15,30].map(n => <option key={n} value={n}>{n} saniye</option>)}
            </select>
          </div>
        </div>

        {/* Event Seçici */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] text-[#555] uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="h-3 w-3" /> Dinlenecek Olaylar
              <span className={cn("ml-1 px-2 py-0.5 rounded-full text-[9px] font-bold border",
                noEventsSelected
                  ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                  : "text-primary bg-primary/10 border-primary/20")}>
                {noEventsSelected ? "Tümü (varsayılan)" : `${form.events.length} seçili`}
              </span>
            </label>
            <div className="flex gap-2 text-[10px]">
              <button onClick={() => setForm(f => ({ ...f, events: [] }))}
                className={cn("transition-colors", noEventsSelected ? "text-blue-400" : "text-[#555] hover:text-[#aaa]")}>
                Tüm Olaylar
              </button>
              <span className="text-[#333]">·</span>
              <button onClick={() => setForm(f => ({ ...f, events: [...ALL_EVENTS] }))}
                className="text-[#555] hover:text-[#aaa] transition-colors">
                Hepsini Seç
              </button>
            </div>
          </div>

          {noEventsSelected && (
            <div className="mb-3 bg-blue-500/5 border border-blue-500/15 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-400/80">
                Hiçbir olay seçilmediğinde endpoint <strong>tüm olayları</strong> alır. Belirli olayları filtrelemek için aşağıdan seçin.
              </p>
            </div>
          )}

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scroll">
            {EVENT_GROUPS.map(group => {
              const selectedCount = group.events.filter(e => form.events.includes(e)).length;
              const allSelected = selectedCount === group.events.length;
              return (
                <div key={group.label} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
                  <button onClick={() => toggleGroup(group.events)}
                    className="flex items-center justify-between w-full mb-2.5">
                    <span className={cn("text-[11px] font-bold", allSelected ? "text-white" : "text-[#666]")}>
                      {group.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedCount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-bold">
                          {selectedCount}/{group.events.length}
                        </span>
                      )}
                      <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                        allSelected ? "bg-primary border-primary" : "border-[#333] hover:border-[#555]")}>
                        {allSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {group.events.map(event => {
                      const sel = form.events.includes(event);
                      return (
                        <button key={event} onClick={() => toggleEvent(event)}
                          className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] border transition-all",
                            sel
                              ? "bg-primary/15 text-primary border-primary/30 font-medium"
                              : "bg-[#1a1a1a] text-[#555] border-[#252525] hover:text-[#aaa] hover:border-[#333]")}>
                          <span>{EVENT_EMOJI[event] || "📡"}</span>
                          {event}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kaydet / İptal */}
        <div className="flex gap-2 pt-2 border-t border-[#1a1a1a]">
          <button onClick={handleSave} disabled={saving || !form.url || !!urlError}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-all">
            {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Kaydediliyor...</> : <><Check className="h-3.5 w-3.5" />Kaydet</>}
          </button>
          <button onClick={onCancel}
            className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-[#777] text-xs rounded-xl transition-all">
            İptal
          </button>
          <div className="flex-1" />
          <label className="flex items-center gap-2 text-xs text-[#666] cursor-pointer">
            <button onClick={() => setForm(f => ({ ...f, isEnabled: !f.isEnabled }))}
              className={cn("w-9 h-5 rounded-full relative transition-all", form.isEnabled ? "bg-primary" : "bg-[#333]")}>
              <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", form.isEnabled ? "left-4" : "left-0.5")} />
            </button>
            {form.isEnabled ? "Aktif" : "Pasif"}
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Test Sonuç Baloncuğu ─────────────────────────────────────────────────────
function TestResultBubble({ result, onClose }: { result: any; onClose: () => void }) {
  const ok = result.status === "success";
  return (
    <div className={cn("rounded-xl border p-3.5 text-xs space-y-1.5 relative",
      ok ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20")}>
      <button onClick={onClose} className="absolute right-3 top-3 text-[#444] hover:text-[#aaa]"><X className="h-3.5 w-3.5" /></button>
      <p className={cn("font-bold", ok ? "text-green-400" : "text-red-400")}>
        {ok ? "✅ Test başarılı" : "❌ Test başarısız"}
      </p>
      <div className="flex gap-4 text-[10px] text-[#666]">
        {result.responseStatus && <span>HTTP {result.responseStatus}</span>}
        {result.responseTimeMs && <span>{result.responseTimeMs}ms</span>}
        <span>Deneme {result.attempt}/{result.maxAttempts}</span>
      </div>
      {result.error && <p className="text-red-400/80 font-mono text-[10px] break-all">{result.error}</p>}
      {result.responseBody && (
        <pre className="text-[9px] font-mono text-[#666] bg-[#0a0a0a] rounded-lg p-2 overflow-auto max-h-20 whitespace-pre-wrap">
          {result.responseBody.slice(0, 300)}
        </pre>
      )}
    </div>
  );
}

// ─── Endpoint Kartı ───────────────────────────────────────────────────────────
function EndpointCard({ ep, token, onUpdate, onDelete }: {
  ep: Endpoint; token: string;
  onUpdate: (ep: Endpoint) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [toggling, setToggling] = useState(false);
  const pm = PM[ep.platform] || PM.custom;

  const toggle = async () => {
    setToggling(true);
    try {
      const r = await fetch(`${API}/webhooks/admin/endpoints/${ep.id}/toggle`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      onUpdate({ ...ep, isEnabled: d.isEnabled });
    } finally { setToggling(false); }
  };

  const test = async () => {
    setTesting(true); setTestResult(null);
    const r = await fetch(`${API}/webhooks/admin/endpoints/${ep.id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event: "video.created" }),
    });
    const d = await r.json();
    setTestResult(d.delivery);
    if (d.endpoint) onUpdate(d.endpoint);
    setTesting(false);
  };

  const handleSave = async (data: any) => {
    const r = await fetch(`${API}/webhooks/admin/endpoints/${ep.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    const d = await r.json();
    onUpdate(d.endpoint);
    setEditing(false);
  };

  const handleDelete = async () => {
    await fetch(`${API}/webhooks/admin/endpoints/${ep.id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    onDelete(ep.id);
  };

  if (editing) {
    return <EndpointForm initial={ep} onSave={handleSave} onCancel={() => setEditing(false)} />;
  }

  const isHealthy = ep.status === "active" || (ep.totalDeliveries === 0 && ep.isEnabled);
  const isFailing = ep.status === "failing";

  return (
    <div className={cn("rounded-2xl overflow-hidden border transition-all duration-200",
      !ep.isEnabled
        ? "border-[#1a1a1a] bg-[#0a0a0a] opacity-60"
        : isFailing
          ? "border-red-500/20 bg-[#0d0a0a]"
          : "border-[#1e1e1e] bg-[#0e0e0e]")}>

      {/* Platform accent stripe */}
      <div className="h-0.5" style={{ background: ep.isEnabled ? pm.color : "#222" }} />

      {/* Kart başlığı */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          {/* Platform ikon + aktif göstergesi */}
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: pm.bg, border: `1px solid ${pm.border}` }}>
              {pm.icon}
            </div>
            {ep.isEnabled && (
              <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0e0e0e]",
                isFailing ? "bg-red-500" : "bg-green-500")} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">{ep.name}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                style={{ color: pm.color, background: pm.bg, border: `1px solid ${pm.border}` }}>
                {pm.name}
              </span>
              {!ep.isEnabled && <StatusChip status="paused" small />}
              {ep.isEnabled && isFailing && <StatusChip status="failing" small />}
            </div>
            <p className="text-[10px] text-[#444] truncate font-mono mt-0.5">{ep.url}</p>
          </div>

          <ChevronRight className={cn("h-4 w-4 text-[#333] transition-transform shrink-0", expanded && "rotate-90")} />
        </button>

        {/* Sağ taraf — oran + toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <SuccessRing rate={ep.totalDeliveries > 0 ? ep.successRate : null} size={38} />
          <button onClick={toggle} disabled={toggling}
            className={cn("w-10 h-[22px] rounded-full relative transition-all shrink-0", ep.isEnabled ? "bg-primary" : "bg-[#2a2a2a]", toggling && "opacity-60")}>
            <span className={cn("absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all shadow",
              ep.isEnabled ? "left-[22px]" : "left-[3px]")} />
          </button>
        </div>
      </div>

      {/* Genişletilmiş panel */}
      {expanded && (
        <div className="border-t border-[#1a1a1a] px-4 py-4 space-y-4">

          {/* İstatistik satırı */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Toplam", value: ep.totalDeliveries, color: "text-white" },
              { label: "Başarılı", value: ep.successDeliveries, color: "text-green-400" },
              { label: "Başarısız", value: ep.totalDeliveries - ep.successDeliveries, color: "text-red-400" },
              { label: "Son HTTP", value: ep.lastStatusCode ?? "—", color: ep.lastStatusCode && ep.lastStatusCode < 300 ? "text-green-400" : ep.lastStatusCode ? "text-red-400" : "text-[#444]" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-center">
                <p className={cn("text-lg font-bold", color)}>{value}</p>
                <p className="text-[10px] text-[#555] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Başarı bar */}
          {ep.totalDeliveries > 0 && (
            <div>
              <div className="flex justify-between text-[10px] text-[#555] mb-1">
                <span>Başarı oranı</span>
                <span className={cn((ep.successRate ?? 0) >= 80 ? "text-green-400" : (ep.successRate ?? 0) >= 50 ? "text-amber-400" : "text-red-400")}>
                  %{ep.successRate ?? 0}
                </span>
              </div>
              <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-500",
                  (ep.successRate ?? 0) >= 80 ? "bg-green-500" : (ep.successRate ?? 0) >= 50 ? "bg-amber-500" : "bg-red-500")}
                  style={{ width: `${ep.successRate ?? 0}%` }} />
              </div>
            </div>
          )}

          {/* Abone olaylar */}
          <div>
            <p className="text-[10px] text-[#444] uppercase tracking-wider mb-2">
              Abone Olaylar —{" "}
              {ep.events.length === 0
                ? <span className="text-blue-400 normal-case font-normal">tüm olaylar dinleniyor</span>
                : <span className="normal-case font-normal">{ep.events.length} olay seçili</span>}
            </p>
            {ep.events.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {ep.events.map(e => (
                  <span key={e} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary/80 border border-primary/20 rounded-full flex items-center gap-1">
                    <span>{EVENT_EMOJI[e] || "📡"}</span>{e}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {ALL_EVENTS.slice(0, 5).map(e => (
                  <span key={e} className="text-[10px] px-2 py-0.5 bg-blue-500/5 text-blue-400/50 border border-blue-500/10 rounded-full flex items-center gap-1">
                    <span>{EVENT_EMOJI[e] || "📡"}</span>{e}
                  </span>
                ))}
                <span className="text-[10px] px-2 py-0.5 bg-[#111] text-[#444] border border-[#1a1a1a] rounded-full">
                  +{ALL_EVENTS.length - 5} daha
                </span>
              </div>
            )}
          </div>

          {/* Konfig bilgileri */}
          <div className="flex flex-wrap gap-3 text-[10px] text-[#555]">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Timeout: {ep.timeoutSecs}s</span>
            <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />Maks. {ep.maxRetries} deneme</span>
            {ep.hasSecret && <span className="flex items-center gap-1 text-primary/60"><Shield className="h-3 w-3" />HMAC imzalı</span>}
            {ep.lastTriggeredAt && <span className="flex items-center gap-1"><Activity className="h-3 w-3" />Son: {timeAgo(ep.lastTriggeredAt)}</span>}
          </div>

          {/* Test sonucu */}
          {testResult && <TestResultBubble result={testResult} onClose={() => setTestResult(null)} />}

          {/* Aksiyonlar */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button onClick={test} disabled={testing}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-[#111] hover:bg-[#1a1a1a] text-[#aaa] border border-[#222] hover:border-[#333] transition-all disabled:opacity-50">
              {testing ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Test...</> : <><Play className="h-3.5 w-3.5 text-blue-400" />Test Gönder</>}
            </button>
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-[#111] hover:bg-[#1a1a1a] text-[#aaa] border border-[#222] hover:border-[#333] transition-all">
              <Edit2 className="h-3.5 w-3.5" />Düzenle
            </button>
            <button onClick={() => copyText(ep.url)}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-[#111] hover:bg-[#1a1a1a] text-[#aaa] border border-[#222] hover:border-[#333] transition-all">
              <Copy className="h-3.5 w-3.5" />URL Kopyala
            </button>
            <div className="flex-1" />
            {confirmDel ? (
              <div className="flex items-center gap-2">
                <button onClick={handleDelete}
                  className="text-xs px-3.5 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/40 rounded-xl transition-all">
                  Onayla Sil
                </button>
                <button onClick={() => setConfirmDel(false)} className="text-xs text-[#555] hover:text-[#aaa] px-2 py-2 transition-colors">
                  İptal
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl text-[#555] hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/15 border border-transparent transition-all">
                <Trash2 className="h-3.5 w-3.5" />Sil
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Delivery Log ──────────────────────────────────────────────────────────────
function DeliveryLog({ token }: { token: string }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: "", event: "", endpoint: "" });
  const [expanded, setExpanded] = useState<Record<number, any>>({});
  const [retrying, setRetrying] = useState<Record<number, boolean>>({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const load = useCallback(async (p = 1, silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "30" });
    if (filters.status) params.set("status", filters.status);
    if (filters.event) params.set("event", filters.event);
    if (filters.endpoint) params.set("endpoint", filters.endpoint);
    const r = await fetch(`${API}/webhooks/admin/deliveries?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    setDeliveries(d.deliveries || []);
    setTotal(d.total || 0);
    setPages(d.pages || 1);
    setPage(p);
    if (!silent) setLoading(false);
  }, [token, filters]);

  useEffect(() => { load(1); }, [load]);

  useEffect(() => {
    if (autoRefresh) { intervalRef.current = setInterval(() => load(1, true), 5000); }
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, load]);

  const loadDetail = async (id: number) => {
    if (expanded[id]) { setExpanded(e => { const n = { ...e }; delete n[id]; return n; }); return; }
    const r = await fetch(`${API}/webhooks/admin/deliveries/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    setExpanded(e => ({ ...e, [id]: d.delivery }));
  };

  const retry = async (id: number) => {
    setRetrying(r => ({ ...r, [id]: true }));
    try {
      const r = await fetch(`${API}/webhooks/admin/deliveries/${id}/retry`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setDeliveries(prev => prev.map(x => x.id === id ? { ...x, ...d.delivery } : x));
    } finally { setRetrying(r => ({ ...r, [id]: false })); }
  };

  const statusColors: Record<string, string> = {
    success: "text-green-400", failed: "text-red-400",
    retrying: "text-amber-400", pending: "text-blue-400",
  };

  return (
    <div className="space-y-3">
      {/* Filtre Çubuğu */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 p-1 bg-[#111] border border-[#1e1e1e] rounded-xl">
          {[["", "Tümü"],["success","✅"],["failed","❌"],["retrying","🔄"],["pending","⏳"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilters(f => ({ ...f, status: v }))}
              className={cn("text-[11px] px-2.5 py-1 rounded-lg transition-all",
                filters.status === v ? "bg-[#1e1e1e] text-white border border-[#2a2a2a]" : "text-[#555] hover:text-[#aaa]")}>
              {l}
            </button>
          ))}
        </div>
        <select value={filters.event} onChange={e => setFilters(f => ({ ...f, event: e.target.value }))}
          className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-1.5 text-xs text-[#aaa] focus:outline-none focus:border-primary/40 flex-1 min-w-[130px]">
          <option value="">Tüm Olaylar</option>
          {EVENT_GROUPS.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.events.map(e => <option key={e} value={e}>{EVENT_EMOJI[e] || "📡"} {e}</option>)}
            </optgroup>
          ))}
        </select>
        <button onClick={() => setAutoRefresh(a => !a)}
          className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all",
            autoRefresh ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-[#555] bg-[#111] border-[#1e1e1e] hover:text-[#aaa]")}>
          <Radio className={cn("h-3 w-3", autoRefresh && "animate-pulse")} />
          {autoRefresh ? "Canlı" : "Canlı"}
        </button>
        <button onClick={() => load(1)} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#111] border border-[#1e1e1e] rounded-xl text-[#555] hover:text-[#aaa] transition-all ml-auto">
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          {total.toLocaleString()} kayıt
        </button>
      </div>

      {/* Tablo */}
      <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        {/* Başlık */}
        <div className="grid text-[9px] text-[#444] uppercase tracking-widest px-4 py-2 border-b border-[#111]"
          style={{ gridTemplateColumns: "1fr 90px 90px 70px 70px 60px" }}>
          <span>Olay / Endpoint</span><span className="text-center">Durum</span>
          <span className="text-center">HTTP</span><span className="text-center">Süre</span>
          <span className="text-right">Zaman</span><span />
        </div>

        {loading && deliveries.length === 0 ? (
          <div className="py-12 text-center">
            <RefreshCw className="h-6 w-6 text-[#333] animate-spin mx-auto mb-2" />
            <p className="text-xs text-[#555]">Yükleniyor...</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="py-12 text-center">
            <Terminal className="h-8 w-8 text-[#222] mx-auto mb-3" />
            <p className="text-sm text-[#555]">Gönderim kaydı bulunamadı</p>
            <p className="text-xs text-[#333] mt-1">Filtre değiştirin veya bir endpoint test edin</p>
          </div>
        ) : (
          <div className="divide-y divide-[#111]">
            {deliveries.map(d => {
              const det = expanded[d.id];
              const pmeta = PM[d.platform] || PM.custom;
              return (
                <div key={d.id}>
                  <div className={cn("grid items-center px-4 py-2.5 hover:bg-[#111]/50 transition-colors cursor-pointer group",
                    d.status === "failed" && "border-l-2 border-red-500/30")}
                    style={{ gridTemplateColumns: "1fr 90px 90px 70px 70px 60px" }}
                    onClick={() => loadDetail(d.id)}>
                    {/* Olay + Endpoint */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{EVENT_EMOJI[d.event] || "📡"}</span>
                        <span className="text-xs text-white font-medium truncate">{d.event}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-base leading-none">{pmeta.icon}</span>
                        <span className="text-[10px] text-[#555] truncate">{d.endpointName}</span>
                      </div>
                    </div>
                    {/* Durum */}
                    <div className="flex justify-center">
                      <StatusChip status={d.status} small />
                    </div>
                    {/* HTTP */}
                    <div className="text-center">
                      <span className={cn("text-xs font-mono font-bold",
                        d.responseStatus && d.responseStatus < 300 ? "text-green-400"
                        : d.responseStatus && d.responseStatus < 500 ? "text-amber-400"
                        : d.responseStatus ? "text-red-400" : "text-[#444]")}>
                        {d.responseStatus ?? "—"}
                      </span>
                    </div>
                    {/* Süre */}
                    <div className="text-center">
                      <span className="text-xs text-[#666] font-mono">
                        {d.responseTimeMs ? `${d.responseTimeMs}ms` : "—"}
                      </span>
                    </div>
                    {/* Zaman */}
                    <div className="text-right">
                      <span className="text-[10px] text-[#444]">{timeAgo(d.triggeredAt)}</span>
                    </div>
                    {/* Aksiyonlar */}
                    <div className="flex justify-end gap-1">
                      <button onClick={e => { e.stopPropagation(); loadDetail(d.id); }}
                        className="p-1 text-[#333] hover:text-[#888] transition-colors opacity-0 group-hover:opacity-100">
                        {det ? <ChevronDown className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      {d.status === "failed" && (
                        <button onClick={e => { e.stopPropagation(); retry(d.id); }}
                          disabled={retrying[d.id]}
                          className="p-1 text-[#333] hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100">
                          {retrying[d.id] ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* İnline Detay */}
                  {det && (
                    <div className="border-t border-[#111] px-4 py-4 bg-[#0a0a0a] space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          ["Endpoint", det.endpointName],
                          ["Platform", pmeta.name],
                          ["Deneme", `${det.attempt} / ${det.maxAttempts}`],
                          ["HTTP Kodu", det.responseStatus ?? "—"],
                          ["Yanıt Süresi", det.responseTimeMs ? `${det.responseTimeMs}ms` : "—"],
                          ["Tetiklenme", new Date(det.triggeredAt).toLocaleString("tr-TR")],
                        ].map(([k, v]) => (
                          <div key={k} className="bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2">
                            <p className="text-[9px] text-[#444] uppercase tracking-wider">{k}</p>
                            <p className="text-xs text-white font-medium mt-0.5 truncate">{v}</p>
                          </div>
                        ))}
                      </div>

                      {det.error && (
                        <div className="bg-red-900/10 border border-red-900/30 rounded-xl px-3.5 py-2.5">
                          <p className="text-[9px] text-red-400/60 uppercase tracking-wider mb-1">Hata</p>
                          <p className="text-xs text-red-400 font-mono break-all">{det.error}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {det.requestBody && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[9px] text-[#444] uppercase tracking-wider">Gönderilen Payload</p>
                              <button onClick={() => copyText(det.requestBody)} className="text-[#444] hover:text-[#888]">
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                            <pre className="bg-[#111] border border-[#1a1a1a] rounded-xl p-2.5 text-[9px] text-[#777] font-mono overflow-auto max-h-32 whitespace-pre-wrap">
                              {(() => { try { return JSON.stringify(JSON.parse(det.requestBody), null, 2); } catch { return det.requestBody; } })()}
                            </pre>
                          </div>
                        )}
                        {det.responseBody && (
                          <div>
                            <p className="text-[9px] text-[#444] uppercase tracking-wider mb-1">Endpoint Yanıtı</p>
                            <pre className="bg-[#111] border border-[#1a1a1a] rounded-xl p-2.5 text-[9px] text-[#777] font-mono overflow-auto max-h-32 whitespace-pre-wrap">
                              {det.responseBody.slice(0, 500)}
                            </pre>
                          </div>
                        )}
                      </div>

                      {d.status === "failed" && (
                        <button onClick={() => retry(d.id)} disabled={retrying[d.id]}
                          className="flex items-center gap-2 text-xs px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition-all disabled:opacity-50">
                          {retrying[d.id] ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          Bu Teslimatı Tekrar Dene
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sayfalama */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[#444]">{total.toLocaleString()} toplam kayıt • Sayfa {page} / {pages}</p>
          <div className="flex gap-1">
            {[...Array(Math.min(pages, 7))].map((_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => load(p)}
                  className={cn("w-7 h-7 text-[11px] rounded-lg transition-all",
                    page === p ? "bg-primary text-white font-bold" : "bg-[#111] border border-[#1e1e1e] text-[#555] hover:text-white")}>
                  {p}
                </button>
              );
            })}
            {pages > 7 && (
              <button onClick={() => load(pages)}
                className="px-2.5 h-7 text-[11px] rounded-lg bg-[#111] border border-[#1e1e1e] text-[#555] hover:text-white">
                {pages} →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── İstatistik Sekmesi ────────────────────────────────────────────────────────
function StatsTab({ stats, onReload }: { stats: Stats; onReload: () => void }) {
  return (
    <div className="space-y-4">
      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Toplam Gönderim", value: stats.deliveries.total.toLocaleString(), icon: <Send className="h-4 w-4 text-blue-400" />, sub: `${stats.deliveries.success} başarılı`, color: "text-white" },
          { label: "Başarı Oranı",    value: stats.deliveries.successRate != null ? `%${stats.deliveries.successRate}` : "—",
            icon: <TrendingUp className="h-4 w-4 text-green-400" />,
            sub: stats.deliveries.successRate != null ? (stats.deliveries.successRate >= 80 ? "Sağlıklı" : stats.deliveries.successRate >= 50 ? "Orta" : "Kritik") : "Veri yok",
            color: stats.deliveries.successRate != null ? (stats.deliveries.successRate >= 80 ? "text-green-400" : stats.deliveries.successRate >= 50 ? "text-amber-400" : "text-red-400") : "text-white" },
          { label: "Başarısız",       value: stats.deliveries.failed.toLocaleString(), icon: <XCircle className="h-4 w-4 text-red-400" />, sub: stats.deliveries.pending > 0 ? `${stats.deliveries.pending} beklemede` : "Temiz", color: stats.deliveries.failed > 0 ? "text-red-400" : "text-white" },
          { label: "Ort. Yanıt",      value: stats.deliveries.avgResponseMs != null ? `${stats.deliveries.avgResponseMs}ms` : "—", icon: <Activity className="h-4 w-4 text-purple-400" />, sub: stats.deliveries.avgResponseMs != null ? (stats.deliveries.avgResponseMs < 500 ? "Hızlı" : stats.deliveries.avgResponseMs < 2000 ? "Normal" : "Yavaş") : "Veri yok", color: "text-white" },
        ].map(({ label, value, icon, sub, color }) => (
          <div key={label} className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">{icon}<span className="text-[10px] text-[#444] uppercase tracking-wider">{label}</span></div>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            <p className="text-[10px] text-[#444] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* En Sık Olaylar */}
      <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5 text-blue-400" />En Sık Tetiklenen Olaylar
          </p>
          <button onClick={onReload} className="text-[10px] text-[#555] hover:text-[#aaa] transition-colors"><RefreshCw className="h-3 w-3" /></button>
        </div>
        {stats.topEvents.length === 0 ? (
          <p className="text-xs text-[#444] py-4 text-center">Henüz olay kaydı yok</p>
        ) : (
          <div className="space-y-2.5">
            {stats.topEvents.map((ev, i) => {
              const maxCount = stats.topEvents[0]?.count || 1;
              const pct = (ev.count / maxCount) * 100;
              return (
                <div key={ev.event} className="flex items-center gap-3">
                  <span className="text-[10px] text-[#333] w-4 text-right font-mono">{i + 1}</span>
                  <span className="text-lg w-6">{EVENT_EMOJI[ev.event] || "📡"}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#bbb]">{ev.event}</span>
                      <span className="text-[10px] font-mono text-[#555]">{ev.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: `linear-gradient(to right, #7c3aed, #5b21b6)` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Endpoint Sağlık Tablosu */}
      <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-2xl p-4">
        <p className="text-xs font-bold text-[#666] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-green-400" />Endpoint Sağlık Durumu
        </p>
        {stats.endpointStats.length === 0 ? (
          <p className="text-xs text-[#444] py-4 text-center">Endpoint yok</p>
        ) : (
          <div className="space-y-2">
            {stats.endpointStats.map((ep: any) => {
              const pm = PM[ep.platform] || PM.custom;
              return (
                <div key={ep.id} className="flex items-center gap-3 bg-[#111] border border-[#1a1a1a] rounded-xl px-3.5 py-3">
                  <span className="text-lg shrink-0">{pm.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-white font-medium truncate">{ep.name}</span>
                      <StatusChip status={ep.status} small />
                    </div>
                    {ep.totalDeliveries > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all",
                            (ep.successRate ?? 0) >= 80 ? "bg-green-500" : (ep.successRate ?? 0) >= 50 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${ep.successRate ?? 0}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-[#555] w-8 text-right">%{ep.successRate ?? 0}</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-[#333]">Henüz gönderim yok</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white">{ep.totalDeliveries.toLocaleString()}</p>
                    <p className="text-[9px] text-[#444]">gönderim</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Son Başarısızlıklar */}
      {stats.recentFailures.length > 0 && (
        <div className="bg-[#0e0e0e] border border-red-500/10 rounded-2xl p-4">
          <p className="text-xs font-bold text-red-400/70 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />Son Başarısız Teslimatlar
          </p>
          <div className="space-y-2">
            {stats.recentFailures.map((f: any) => {
              const pm = PM[f.platform] || PM.custom;
              return (
                <div key={f.id} className="flex items-center gap-3 bg-red-900/5 border border-red-900/15 rounded-xl px-3.5 py-2.5">
                  <span>{pm.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white">{EVENT_EMOJI[f.event] || "📡"} {f.event}</p>
                    <p className="text-[10px] text-red-400/60 truncate">{f.endpointName} {f.responseStatus ? `• HTTP ${f.responseStatus}` : f.error ? `• ${f.error.slice(0, 60)}` : ""}</p>
                  </div>
                  <span className="text-[10px] text-[#444] shrink-0">{timeAgo(f.triggeredAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manuel Tetikle ────────────────────────────────────────────────────────────
function ManualFireTab({ token, endpoints }: { token: string; endpoints: Endpoint[] }) {
  const [event, setEvent]  = useState("video.created");
  const [epId, setEpId]    = useState("");
  const [payloadStr, setPayloadStr] = useState(
    JSON.stringify({ id: 1, title: "Test Video", creator: "creator1" }, null, 2)
  );
  const [payloadError, setPayloadError] = useState("");
  const [firing, setFiring] = useState(false);
  const [result, setResult] = useState<any>(null);

  const validatePayload = (v: string) => {
    try { JSON.parse(v); setPayloadError(""); }
    catch { setPayloadError("Geçersiz JSON"); }
  };

  const fire = async () => {
    if (payloadError) return;
    setFiring(true); setResult(null);
    try {
      let payload: any = {};
      try { payload = JSON.parse(payloadStr); } catch {}
      const body: any = { event, payload };
      if (epId) body.endpointId = parseInt(epId);
      const r = await fetch(`${API}/webhooks/admin/fire`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setResult(d);
    } finally { setFiring(false); }
  };

  const ok = result && (result.ok || result.deliveries?.[0]?.status === "success");

  return (
    <div className="space-y-4">
      <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Manuel Olay Tetikle</p>
          <span className="text-[10px] text-[#555]">— test, hata ayıklama veya veri aktarımı için</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-1.5">Olay Türü</label>
            <select value={event} onChange={e => { setEvent(e.target.value); setPayloadStr(JSON.stringify({ id: 1, title: "Test", creator: "creator1", event: e.target.value }, null, 2)); }}
              className="w-full bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/40 transition-colors">
              {EVENT_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.events.map(e => <option key={e} value={e}>{EVENT_EMOJI[e] || "📡"} {e}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-1.5">Hedef Endpoint</label>
            <select value={epId} onChange={e => setEpId(e.target.value)}
              className="w-full bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/40 transition-colors">
              <option value="">→ Tüm Aktif Endpointler</option>
              {endpoints.filter(e => e.isEnabled).map(ep => {
                const pm = PM[ep.platform] || PM.custom;
                return <option key={ep.id} value={ep.id}>{pm.icon} {ep.name}</option>;
              })}
            </select>
          </div>
        </div>

        {/* Payload Editörü */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-[#555] uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-3 w-3" /> Payload (JSON)
            </label>
            {payloadError && <span className="text-[10px] text-red-400">{payloadError}</span>}
          </div>
          <textarea value={payloadStr}
            onChange={e => { setPayloadStr(e.target.value); validatePayload(e.target.value); }}
            rows={6}
            className={cn("w-full bg-[#111] border rounded-xl px-3.5 py-2.5 text-xs text-[#ccc] font-mono focus:outline-none transition-colors resize-none",
              payloadError ? "border-red-500/30 focus:border-red-500/50" : "border-[#1e1e1e] focus:border-primary/40")} />
          <p className="text-[10px] text-[#444] mt-1">
            timestamp otomatik eklenir. event alanı üstteki seçiciden alınır.
          </p>
        </div>

        <button onClick={fire} disabled={firing || !!payloadError}
          className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-40">
          {firing
            ? <><RefreshCw className="h-4 w-4 animate-spin" />Gönderiliyor...</>
            : <><Send className="h-4 w-4" />{epId ? "Seçili Endpointe Gönder" : "Tüm Aktif Endpointlere Gönder"}</>}
        </button>

        {result && (
          <div className={cn("rounded-xl border p-4 space-y-2",
            ok ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20")}>
            <p className={cn("font-bold text-sm", ok ? "text-green-400" : "text-red-400")}>
              {ok ? "✅ Başarıyla gönderildi" : "❌ Gönderim başarısız"}
            </p>
            {result.message && <p className="text-xs text-[#777]">{result.message}</p>}
            {result.deliveries?.[0] && (
              <div className="text-xs space-y-1">
                <p className="text-[#666]">HTTP: <span className="text-white font-mono">{result.deliveries[0].responseStatus ?? "—"}</span></p>
                <p className="text-[#666]">Süre: <span className="text-white font-mono">{result.deliveries[0].responseTimeMs ?? "—"}ms</span></p>
                {result.deliveries[0].error && <p className="text-red-400/80 font-mono text-[10px]">{result.deliveries[0].error}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Platform Referansı */}
      <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-2xl p-4">
        <p className="text-xs font-bold text-[#555] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />Platform Entegrasyon Notları
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(PM).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2.5 bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2.5">
              <span className="text-lg shrink-0">{v.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{v.name}</p>
                <p className="text-[10px] text-[#555] mt-0.5">{v.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function WebhookDashboard() {
  const { token } = useAuth() as any;
  const [tab, setTab] = useState<"endpoints" | "logs" | "stats" | "fire">("endpoints");
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/webhooks/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setStats(d);
        setGlobalEnabled(d.globalEnabled);
      }
    } catch {}
  }, [token]);

  const loadEndpoints = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/webhooks/admin/endpoints`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setEndpoints(d.endpoints || []);
      }
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => {
    Promise.all([loadEndpoints(), loadStats()]);
    statsIntervalRef.current = setInterval(loadStats, 20000);
    return () => clearInterval(statsIntervalRef.current);
  }, [loadEndpoints, loadStats]);

  const toggleGlobal = async () => {
    setToggling(true);
    try {
      const r = await fetch(`${API}/webhooks/admin/global`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isEnabled: !globalEnabled }),
      });
      const d = await r.json();
      setGlobalEnabled(d.isEnabled);
    } finally { setToggling(false); }
  };

  const handleCreate = async (data: any) => {
    const r = await fetch(`${API}/webhooks/admin/endpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (d.endpoint) {
      setEndpoints(prev => [d.endpoint, ...prev]);
      setShowForm(false);
      loadStats();
    }
  };

  const activeEndpoints = endpoints.filter(e => e.isEnabled);
  const failingEndpoints = endpoints.filter(e => e.status === "failing");

  return (
    <div className="space-y-4">
      {/* ── Global Durum Başlığı ── */}
      <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 transition-all",
            globalEnabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,.5)]" : "bg-[#333]")} />
          <div>
            <p className="text-xs font-bold text-white">
              {globalEnabled ? "Webhook Sistemi Aktif" : "Webhook Sistemi Pasif"}
            </p>
            <p className="text-[10px] text-[#555] mt-0.5">
              {activeEndpoints.length} / {endpoints.length} endpoint aktif
              {failingEndpoints.length > 0 && <span className="text-red-400 ml-1.5">• {failingEndpoints.length} hatalı</span>}
              {stats && stats.deliveries.total > 0 && <span className="ml-1.5">• {stats.deliveries.total.toLocaleString()} toplam gönderim</span>}
            </p>
          </div>
        </div>
        <button onClick={toggleGlobal} disabled={toggling}
          className={cn("flex items-center gap-2 text-xs px-4 py-2 rounded-xl border font-medium transition-all disabled:opacity-50",
            globalEnabled
              ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
              : "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20")}>
          {toggling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            : globalEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {globalEnabled ? "Sistemi Durdur" : "Sistemi Başlat"}
        </button>
      </div>

      {/* ── Mini İstatistik Çubuğu ── */}
      {stats && stats.deliveries.total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Toplam", value: stats.deliveries.total.toLocaleString(), color: "text-white" },
            { label: "Başarılı", value: stats.deliveries.success.toLocaleString(), color: "text-green-400" },
            { label: "Başarısız", value: stats.deliveries.failed.toLocaleString(), color: stats.deliveries.failed > 0 ? "text-red-400" : "text-[#444]" },
            { label: "Başarı %", value: stats.deliveries.successRate != null ? `%${stats.deliveries.successRate}` : "—", color: stats.deliveries.successRate != null && stats.deliveries.successRate >= 80 ? "text-green-400" : "text-amber-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-center">
              <p className={cn("text-lg font-bold", color)}>{value}</p>
              <p className="text-[9px] text-[#444] uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Başarısızlık Uyarısı ── */}
      {stats && stats.recentFailures.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/15 rounded-2xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-400">{stats.recentFailures.length} yakın başarısız teslimat</p>
            <div className="mt-1 space-y-0.5">
              {stats.recentFailures.slice(0, 2).map((f: any) => (
                <p key={f.id} className="text-[10px] text-red-400/60 truncate">
                  {EVENT_EMOJI[f.event] || "📡"} {f.event} → {f.endpointName}
                  {f.responseStatus ? ` (HTTP ${f.responseStatus})` : f.error ? ` — ${f.error.slice(0, 50)}` : ""}
                </p>
              ))}
            </div>
          </div>
          <button onClick={() => setTab("logs")}
            className="text-[10px] text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg shrink-0 hover:bg-red-500/10 transition-all">
            Loglara Git →
          </button>
        </div>
      )}

      {/* ── Sekmeler ── */}
      <div className="flex gap-1 bg-[#0a0a0a] p-1 rounded-2xl border border-[#111]">
        {[
          { id: "endpoints", label: "Endpointler",       badge: endpoints.length },
          { id: "logs",      label: "Delivery Log",       badge: stats?.deliveries.total },
          { id: "stats",     label: "İstatistikler",      badge: null },
          { id: "fire",      label: "Manuel Tetikle",     badge: null },
        ].map(({ id, label, badge }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all",
              tab === id ? "bg-[#1a1a1a] text-white border border-[#252525] shadow-sm" : "text-[#555] hover:text-[#888]")}>
            {label}
            {badge != null && badge > 0 && (
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                tab === id ? "bg-primary/20 text-primary" : "bg-[#1a1a1a] text-[#444]")}>
                {badge.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Sekme İçeriği ── */}

      {/* Endpointler */}
      {tab === "endpoints" && (
        <div className="space-y-3">
          {/* Yeni ekle butonu */}
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-dashed border-[#222] hover:border-primary/30 text-xs text-[#444] hover:text-primary transition-all group">
              <div className="w-6 h-6 rounded-lg bg-[#111] group-hover:bg-primary/10 border border-[#1a1a1a] group-hover:border-primary/20 flex items-center justify-center transition-all">
                <Plus className="h-3.5 w-3.5" />
              </div>
              Yeni Webhook Endpoint Ekle
            </button>
          )}

          {showForm && (
            <EndpointForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
          )}

          {/* Endpoint listesi */}
          {loading ? (
            <div className="py-12 text-center">
              <RefreshCw className="h-6 w-6 text-[#333] animate-spin mx-auto mb-3" />
              <p className="text-xs text-[#555]">Yükleniyor...</p>
            </div>
          ) : endpoints.length === 0 && !showForm ? (
            <div className="py-14 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto">
                <Webhook className="h-6 w-6 text-[#333]" />
              </div>
              <div>
                <p className="text-sm text-[#666] font-medium">Henüz webhook endpoint yok</p>
                <p className="text-xs text-[#444] mt-1">Discord, Slack, Zapier, Telegram ve daha fazlasına<br />otomatik bildirim gönder</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {Object.entries(PM).slice(0, 5).map(([k, v]) => (
                  <span key={k} className="text-lg" title={v.name}>{v.icon}</span>
                ))}
                <span className="text-sm text-[#444]">···</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {endpoints.map(ep => (
                <EndpointCard key={ep.id} ep={ep} token={token}
                  onUpdate={updated => setEndpoints(prev => prev.map(e => e.id === updated.id ? updated : e))}
                  onDelete={id => { setEndpoints(prev => prev.filter(e => e.id !== id)); loadStats(); }} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "logs" && <DeliveryLog token={token} />}

      {tab === "stats" && stats && (
        <StatsTab stats={stats} onReload={loadStats} />
      )}
      {tab === "stats" && !stats && (
        <div className="py-12 text-center text-xs text-[#555]">İstatistikler yükleniyor...</div>
      )}

      {tab === "fire" && <ManualFireTab token={token} endpoints={endpoints} />}
    </div>
  );
}
