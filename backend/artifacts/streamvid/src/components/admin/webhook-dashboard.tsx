import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import {
  Webhook, Plus, Trash2, Edit2, Check, X, ChevronRight, ChevronDown,
  RefreshCw, Send, AlertCircle, CheckCircle2, Clock, XCircle,
  BarChart2, Zap, Activity, Eye, Copy, RotateCcw, Filter,
  Globe, Settings2, Play, Pause, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = "/api";

// ── Types ────────────────────────────────────────────────────────────────────
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
}

interface Stats {
  globalEnabled: boolean;
  endpoints: { total: number; active: number; failing: number };
  deliveries: { total: number; success: number; failed: number; pending: number; successRate: number | null; avgResponseMs: number | null };
  topEvents: { event: string; count: number }[];
  endpointStats: any[];
  recentFailures: any[];
}

// ── Constants ────────────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { name: string; icon: string; color: string; placeholder: string }> = {
  discord:   { name: "Discord",          icon: "💬", color: "#5865F2", placeholder: "https://discord.com/api/webhooks/ID/TOKEN" },
  slack:     { name: "Slack",            icon: "💼", color: "#4A154B", placeholder: "https://hooks.slack.com/services/T.../B.../..." },
  zapier:    { name: "Zapier",           icon: "⚡", color: "#FF4A00", placeholder: "https://hooks.zapier.com/hooks/catch/..." },
  make:      { name: "Make",             icon: "🔄", color: "#7E3AF2", placeholder: "https://hook.make.com/..." },
  n8n:       { name: "n8n",              icon: "🔧", color: "#EA4B71", placeholder: "https://your-n8n.app/webhook/..." },
  ifttt:     { name: "IFTTT",            icon: "🔀", color: "#009AE5", placeholder: "https://maker.ifttt.com/trigger/.../with/key/..." },
  pipedream: { name: "Pipedream",        icon: "🌊", color: "#3CC877", placeholder: "https://eo.pipedream.net/..." },
  teams:     { name: "MS Teams",         icon: "🟦", color: "#6264A7", placeholder: "https://...webhook.office.com/..." },
  telegram:  { name: "Telegram",         icon: "✈️", color: "#2AABEE", placeholder: "https://api.telegram.org/bot.../sendMessage" },
  custom:    { name: "Özel HTTP",        icon: "🌐", color: "#6B7280", placeholder: "https://example.com/webhook" },
};

const EVENT_GROUPS = [
  { label: "🎬 Video",    events: ["video.created","video.updated","video.deleted","video.published","video.approved","video.rejected"] },
  { label: "👤 Kullanıcı", events: ["user.registered","user.banned","user.role_changed"] },
  { label: "💳 Ödeme",   events: ["payment.completed","payment.failed","subscription.created","subscription.cancelled","subscription.expired"] },
  { label: "🎤 Creator", events: ["creator.approved","creator.rejected"] },
  { label: "💬 İçerik",  events: ["comment.created","report.created","live.started","live.ended","tip.received"] },
];

const ALL_EVENTS = EVENT_GROUPS.flatMap(g => g.events);

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.round(diff/1000)}s önce`;
  if (diff < 3600000) return `${Math.round(diff/60000)}dk önce`;
  if (diff < 86400000) return `${Math.round(diff/3600000)}sa önce`;
  return `${Math.round(diff/86400000)}g önce`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    success:  { color: "text-green-400 bg-green-500/10 border-green-500/20", icon: <CheckCircle2 className="h-3 w-3" />, label: "Başarılı" },
    failed:   { color: "text-red-400 bg-red-500/10 border-red-500/20",       icon: <XCircle className="h-3 w-3" />,      label: "Başarısız" },
    retrying: { color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: <RefreshCw className="h-3 w-3 animate-spin" />, label: "Tekrar" },
    pending:  { color: "text-blue-400 bg-blue-500/10 border-blue-500/20",    icon: <Clock className="h-3 w-3" />,         label: "Bekliyor" },
    active:   { color: "text-green-400 bg-green-500/10 border-green-500/20", icon: <Activity className="h-3 w-3" />,      label: "Aktif" },
    failing:  { color: "text-red-400 bg-red-500/10 border-red-500/20",       icon: <AlertCircle className="h-3 w-3" />,   label: "Hata" },
    unknown:  { color: "text-[#555] bg-[#1a1a1a] border-[#2a2a2a]",         icon: <Clock className="h-3 w-3" />,         label: "Bilinmiyor" },
    paused:   { color: "text-[#888] bg-[#1a1a1a] border-[#2a2a2a]",         icon: <Pause className="h-3 w-3" />,         label: "Duraklatıldı" },
  };
  const s = map[status] || map.unknown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium", s.color)}>
      {s.icon}{s.label}
    </span>
  );
}

// ── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ stats, globalEnabled, onToggleGlobal }: { stats: Stats; globalEnabled: boolean; onToggleGlobal: () => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[
        { label: "Toplam Gönderim", value: stats.deliveries.total.toLocaleString(), icon: <Send className="h-3.5 w-3.5 text-blue-400" />, sub: null },
        { label: "Başarı Oranı",    value: stats.deliveries.successRate != null ? `%${stats.deliveries.successRate}` : "—", icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />, sub: `${stats.deliveries.success} başarılı` },
        { label: "Başarısız",       value: stats.deliveries.failed.toLocaleString(), icon: <XCircle className="h-3.5 w-3.5 text-red-400" />, sub: stats.deliveries.failed > 0 ? "Retry gerekiyor" : "Temiz" },
        { label: "Ort. Süre",       value: stats.deliveries.avgResponseMs != null ? `${stats.deliveries.avgResponseMs}ms` : "—", icon: <Activity className="h-3.5 w-3.5 text-purple-400" />, sub: null },
      ].map(({ label, value, icon, sub }) => (
        <div key={label} className="bg-[#111] border border-[#222] rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">{icon}<span className="text-[10px] text-[#555] uppercase tracking-wider">{label}</span></div>
          <p className="text-xl font-bold text-white">{value}</p>
          {sub && <p className="text-[10px] text-[#555] mt-0.5">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Endpoint Form ─────────────────────────────────────────────────────────────
function EndpointForm({ initial, onSave, onCancel }: {
  initial?: Partial<Endpoint>; onSave: (data: any) => Promise<void>; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    platform: initial?.platform || "custom",
    url: initial?.url || "",
    secret: "",
    events: initial?.events || [],
    isEnabled: initial?.isEnabled ?? true,
    maxRetries: initial?.maxRetries ?? 3,
    timeoutSecs: initial?.timeoutSecs ?? 10,
  });
  const [saving, setSaving] = useState(false);
  const meta = PLATFORM_META[form.platform] || PLATFORM_META.custom;

  const toggleEvent = (e: string) =>
    setForm(f => ({ ...f, events: f.events.includes(e) ? f.events.filter(x => x !== e) : [...f.events, e] }));

  const selectGroup = (events: string[]) =>
    setForm(f => {
      const all = f.events.includes(events[0]) && events.every(e => f.events.includes(e));
      return { ...f, events: all ? f.events.filter(e => !events.includes(e)) : [...new Set([...f.events, ...events])] };
    });

  const handleSave = async () => {
    if (!form.url) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="bg-[#111] border border-primary/20 rounded-xl p-4 space-y-4">
      <p className="text-xs font-bold text-[#666] uppercase tracking-wider">
        {initial?.id ? "Webhook Düzenle" : "Yeni Webhook Endpoint"}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[#666] uppercase tracking-wider block mb-1">İsim</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={meta.name} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[10px] text-[#666] uppercase tracking-wider block mb-1">Platform</label>
          <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value, name: f.name || PLATFORM_META[e.target.value]?.name || '' }))}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary/40">
            {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-[#666] uppercase tracking-wider block mb-1">Webhook URL <span className="text-red-400">*</span></label>
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          placeholder={meta.placeholder}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary/40 font-mono" />
      </div>

      <div>
        <label className="text-[10px] text-[#666] uppercase tracking-wider block mb-1">
          {initial?.id ? "Secret / Token (boş bırakılırsa değişmez)" : "Secret / Token (opsiyonel)"}
        </label>
        <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
          type="password" placeholder={initial?.hasSecret ? "••••••••" : "whsec_... veya boş bırakın"}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary/40 font-mono" />
        {['custom','n8n','pipedream','zapier','make','ifttt'].includes(form.platform) && form.secret && (
          <p className="text-[10px] text-[#555] mt-1">HMAC-SHA256 imzası X-Webhook-Signature başlığına eklenir.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[#666] uppercase tracking-wider block mb-1">Maks. Deneme</label>
          <select value={form.maxRetries} onChange={e => setForm(f => ({ ...f, maxRetries: +e.target.value }))}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary/40">
            {[1,2,3,5].map(n => <option key={n} value={n}>{n} deneme</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[#666] uppercase tracking-wider block mb-1">Timeout</label>
          <select value={form.timeoutSecs} onChange={e => setForm(f => ({ ...f, timeoutSecs: +e.target.value }))}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary/40">
            {[5,10,15,30].map(n => <option key={n} value={n}>{n}s</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] text-[#666] uppercase tracking-wider">
            Olaylar <span className="text-[#444] normal-case">({form.events.length === 0 ? "Tüm olaylar" : `${form.events.length} seçili`})</span>
          </label>
          <div className="flex gap-1.5">
            <button onClick={() => setForm(f => ({ ...f, events: [] }))} className="text-[10px] text-[#555] hover:text-[#aaa]">Tümü</button>
            <span className="text-[#333]">·</span>
            <button onClick={() => setForm(f => ({ ...f, events: [...ALL_EVENTS] }))} className="text-[10px] text-[#555] hover:text-[#aaa]">Hepsini seç</button>
          </div>
        </div>
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {EVENT_GROUPS.map(group => {
            const allSelected = group.events.every(e => form.events.includes(e));
            return (
              <div key={group.label}>
                <button onClick={() => selectGroup(group.events)}
                  className={cn("text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 hover:opacity-80 transition-opacity",
                    allSelected ? "text-primary" : "text-[#555]")}>
                  <span>{group.label}</span>
                  {allSelected && <Check className="h-2.5 w-2.5" />}
                </button>
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {group.events.map(event => (
                    <button key={event} onClick={() => toggleEvent(event)}
                      className={cn("px-2 py-1 rounded-full text-[10px] border transition-all",
                        form.events.includes(event) ? "bg-primary/15 text-primary border-primary/30" : "bg-[#1a1a1a] text-[#555] border-[#2a2a2a] hover:text-[#aaa] hover:border-[#333]")}>
                      {event}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-[#1a1a1a]">
        <button onClick={handleSave} disabled={saving || !form.url}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-all">
          {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Kaydediliyor...</> : <><Check className="h-3.5 w-3.5" /> Kaydet</>}
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-[#1a1a1a] text-[#666] text-xs rounded-lg hover:text-[#aaa] transition-all">İptal</button>
      </div>
    </div>
  );
}

// ── Endpoint Card ─────────────────────────────────────────────────────────────
function EndpointCard({ ep, token, onUpdate, onDelete }: {
  ep: Endpoint; token: string; onUpdate: (ep: Endpoint) => void; onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const meta = PLATFORM_META[ep.platform] || PLATFORM_META.custom;

  const toggle = async () => {
    const r = await fetch(`${API}/webhooks/admin/endpoints/${ep.id}/toggle`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    onUpdate({ ...ep, isEnabled: d.isEnabled });
  };

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch(`${API}/webhooks/admin/endpoints/${ep.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event: 'video.created' }),
      });
      const d = await r.json();
      setTestResult(d.delivery);
      if (d.endpoint) onUpdate(d.endpoint);
    } finally { setTesting(false); }
  };

  const handleSave = async (data: any) => {
    const r = await fetch(`${API}/webhooks/admin/endpoints/${ep.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    const d = await r.json();
    onUpdate(d.endpoint);
    setEditing(false);
  };

  const handleDelete = async () => {
    await fetch(`${API}/webhooks/admin/endpoints/${ep.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    onDelete(ep.id);
  };

  if (editing) {
    return <EndpointForm initial={ep} onSave={handleSave} onCancel={() => setEditing(false)} />;
  }

  return (
    <div className={cn("bg-[#111] border rounded-xl overflow-hidden transition-all",
      ep.isEnabled ? "border-[#222]" : "border-[#1a1a1a] opacity-60")}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <span className="text-xl shrink-0">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white truncate">{ep.name}</p>
              <StatusBadge status={ep.status} />
            </div>
            <p className="text-[11px] text-[#555] truncate font-mono">{ep.url}</p>
          </div>
          <ChevronRight className={cn("h-4 w-4 text-[#444] transition-transform shrink-0", expanded && "rotate-90")} />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {/* Success rate pill */}
          {ep.totalDeliveries > 0 && (
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
              (ep.successRate ?? 0) >= 80 ? "bg-green-500/10 text-green-400" :
              (ep.successRate ?? 0) >= 50 ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400")}>
              %{ep.successRate ?? 0}
            </span>
          )}
          {/* Toggle */}
          <button onClick={toggle}
            className={cn("w-9 h-5 rounded-full relative shrink-0 transition-all", ep.isEnabled ? "bg-primary" : "bg-[#333]")}>
            <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", ep.isEnabled ? "left-4" : "left-0.5")} />
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-[#1a1a1a] px-4 py-3 space-y-3">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Toplam", value: ep.totalDeliveries },
              { label: "Başarılı", value: ep.successDeliveries },
              { label: "Son Kod", value: ep.lastStatusCode ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-lg px-3 py-2 text-center">
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[10px] text-[#555]">{label}</p>
              </div>
            ))}
          </div>

          {/* Events */}
          <div>
            <p className="text-[10px] text-[#444] uppercase tracking-wider mb-1.5">
              Abone Olaylar {ep.events.length === 0 && <span className="text-primary">(tüm olaylar)</span>}
            </p>
            {ep.events.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {ep.events.map(e => (
                  <span key={e} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">{e}</span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-[#555]">Tüm olaylar için dinleniyor</p>
            )}
          </div>

          {/* Config info */}
          <div className="flex gap-3 text-[10px] text-[#555]">
            <span>⏱ Timeout: {ep.timeoutSecs}s</span>
            <span>🔄 Maks. {ep.maxRetries} deneme</span>
            {ep.hasSecret && <span>🔑 İmzalı</span>}
            {ep.lastTriggeredAt && <span>🕐 {timeAgo(ep.lastTriggeredAt)}</span>}
          </div>

          {/* Test result */}
          {testResult && (
            <div className={cn("rounded-lg px-3 py-2 border text-xs",
              testResult.status === 'success' ? "bg-green-500/5 border-green-500/20 text-green-400" : "bg-red-500/5 border-red-500/20 text-red-400")}>
              {testResult.status === 'success'
                ? `✅ Test başarılı — HTTP ${testResult.responseStatus} (${testResult.responseTimeMs}ms)`
                : `❌ Test başarısız — ${testResult.responseStatus ? `HTTP ${testResult.responseStatus}` : testResult.error?.slice(0, 80) || 'Bağlantı hatası'}`}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={test} disabled={testing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg disabled:opacity-50 transition-all">
              {testing ? <><RefreshCw className="h-3 w-3 animate-spin" /> Test...</> : <><Play className="h-3 w-3" /> Test Gönder</>}
            </button>
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[#aaa] border border-[#2a2a2a] rounded-lg transition-all">
              <Edit2 className="h-3 w-3" /> Düzenle
            </button>
            {confirmDel ? (
              <div className="flex items-center gap-1.5 ml-auto">
                <button onClick={handleDelete} className="text-xs px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-900/40 rounded-lg">Sil</button>
                <button onClick={() => setConfirmDel(false)} className="text-xs text-[#555] px-2 py-1.5">İptal</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-[#555] hover:text-red-400 transition-colors ml-auto">
                <Trash2 className="h-3 w-3" /> Sil
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Delivery Log ──────────────────────────────────────────────────────────────
function DeliveryLog({ token }: { token: string }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', event: '', endpoint: '' });
  const [selected, setSelected] = useState<any>(null);
  const [retrying, setRetrying] = useState<Record<number, boolean>>({});

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '30' });
    if (filters.status)   params.set('status', filters.status);
    if (filters.event)    params.set('event', filters.event);
    if (filters.endpoint) params.set('endpoint', filters.endpoint);
    const r = await fetch(`${API}/webhooks/admin/deliveries?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    setDeliveries(d.deliveries || []);
    setTotal(d.total || 0);
    setPages(d.pages || 1);
    setPage(p);
    setLoading(false);
  }, [token, filters]);

  useEffect(() => { load(1); }, [load]);

  const loadDetail = async (id: number) => {
    const r = await fetch(`${API}/webhooks/admin/deliveries/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    setSelected(d.delivery);
  };

  const retry = async (id: number) => {
    setRetrying(r => ({ ...r, [id]: true }));
    try {
      const r = await fetch(`${API}/webhooks/admin/deliveries/${id}/retry`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setDeliveries(prev => prev.map(x => x.id === id ? { ...x, ...d.delivery } : x));
    } finally { setRetrying(r => ({ ...r, [id]: false })); }
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="bg-[#111] border border-[#222] rounded-lg px-2.5 py-1.5 text-xs text-[#aaa] focus:outline-none focus:border-primary/40">
          <option value="">Tüm Durumlar</option>
          <option value="success">✅ Başarılı</option>
          <option value="failed">❌ Başarısız</option>
          <option value="retrying">🔄 Tekrar</option>
          <option value="pending">⏳ Bekliyor</option>
        </select>
        <select value={filters.event} onChange={e => setFilters(f => ({ ...f, event: e.target.value }))}
          className="bg-[#111] border border-[#222] rounded-lg px-2.5 py-1.5 text-xs text-[#aaa] focus:outline-none focus:border-primary/40 flex-1 min-w-[140px]">
          <option value="">Tüm Olaylar</option>
          {ALL_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={() => load(1)} disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#111] border border-[#222] rounded-lg text-xs text-[#666] hover:text-[#aaa] transition-all ml-auto">
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          {total} kayıt
        </button>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Gönderim Detayı #{selected.id}</p>
            <button onClick={() => setSelected(null)} className="text-[#555] hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[['Olay', selected.event],['Durum', selected.status],['HTTP', selected.responseStatus ?? '—'],['Süre', selected.responseTimeMs ? `${selected.responseTimeMs}ms` : '—'],['Deneme', `${selected.attempt}/${selected.maxAttempts}`],['Endpoint', selected.endpointName]].map(([k,v]) => (
              <div key={k} className="bg-[#111] border border-[#1a1a1a] rounded-lg px-2.5 py-2">
                <p className="text-[10px] text-[#555] mb-0.5">{k}</p>
                <p className="text-white font-medium">{v}</p>
              </div>
            ))}
          </div>
          {selected.error && (
            <div className="bg-red-900/10 border border-red-900/30 rounded-lg px-3 py-2">
              <p className="text-[10px] text-[#555] mb-1">Hata</p>
              <p className="text-xs text-red-400 font-mono">{selected.error}</p>
            </div>
          )}
          {selected.requestBody && (
            <div>
              <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">Gönderilen Payload</p>
              <pre className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-lg p-2.5 text-[10px] text-[#888] font-mono overflow-auto max-h-32 whitespace-pre-wrap">
                {(() => { try { return JSON.stringify(JSON.parse(selected.requestBody), null, 2); } catch { return selected.requestBody; } })()}
              </pre>
            </div>
          )}
          {selected.responseBody && (
            <div>
              <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">Yanıt</p>
              <pre className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-lg p-2.5 text-[10px] text-[#888] font-mono overflow-auto max-h-20 whitespace-pre-wrap">{selected.responseBody}</pre>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
        {loading && deliveries.length === 0 ? (
          <div className="py-10 text-center text-[#555] text-sm">Yükleniyor...</div>
        ) : deliveries.length === 0 ? (
          <div className="py-10 text-center text-[#555] text-sm">Gönderim kaydı yok</div>
        ) : (
          <div className="divide-y divide-[#1a1a1a]">
            {deliveries.map(d => (
              <div key={d.id} className={cn("flex items-center gap-3 px-4 py-2.5 hover:bg-[#1a1a1a]/50 transition-colors",
                d.status === 'failed' && "border-l-2 border-red-500/30")}>
                <StatusBadge status={d.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{d.event}</p>
                  <p className="text-[10px] text-[#555] truncate">{d.endpointName} • {d.platform}</p>
                </div>
                <div className="text-right shrink-0">
                  {d.responseStatus && (
                    <p className={cn("text-[10px] font-mono font-bold",
                      d.responseStatus < 300 ? "text-green-400" : d.responseStatus < 500 ? "text-yellow-400" : "text-red-400")}>
                      {d.responseStatus}
                    </p>
                  )}
                  {d.responseTimeMs && <p className="text-[10px] text-[#555]">{d.responseTimeMs}ms</p>}
                </div>
                <p className="text-[10px] text-[#444] shrink-0 w-20 text-right">{timeAgo(d.triggeredAt)}</p>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => loadDetail(d.id)} className="p-1 text-[#444] hover:text-[#aaa] transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                  {d.status === 'failed' && (
                    <button onClick={() => retry(d.id)} disabled={retrying[d.id]}
                      className="p-1 text-[#444] hover:text-yellow-400 transition-colors">
                      {retrying[d.id] ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[#555]">{total} kayıt • Sayfa {page}/{pages}</p>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => load(page - 1)}
              className="px-3 py-1.5 text-xs bg-[#111] border border-[#222] rounded-lg text-[#666] hover:text-white disabled:opacity-30 transition-all">
              ← Önceki
            </button>
            <button disabled={page >= pages} onClick={() => load(page + 1)}
              className="px-3 py-1.5 text-xs bg-[#111] border border-[#222] rounded-lg text-[#666] hover:text-white disabled:opacity-30 transition-all">
              Sonraki →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Manual Fire ───────────────────────────────────────────────────────────────
function ManualFirePanel({ token, endpoints }: { token: string; endpoints: Endpoint[] }) {
  const [event, setEvent] = useState("video.created");
  const [epId, setEpId] = useState("");
  const [firing, setFiring] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fire = async () => {
    setFiring(true); setResult(null);
    try {
      const body: any = { event };
      if (epId) body.endpointId = parseInt(epId);
      const r = await fetch(`${API}/webhooks/admin/fire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setResult(d);
    } finally { setFiring(false); }
  };

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-[#666] uppercase tracking-wider flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-yellow-400" /> Manuel Olay Tetikle
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[#555] block mb-1">Olay</label>
          <select value={event} onChange={e => setEvent(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary/40">
            {EVENT_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.events.map(e => <option key={e} value={e}>{e}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[#555] block mb-1">Endpoint (Tümü için boş bırak)</label>
          <select value={epId} onChange={e => setEpId(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary/40">
            <option value="">→ Tüm Aktif Endpointler</option>
            {endpoints.map(ep => <option key={ep.id} value={ep.id}>{PLATFORM_META[ep.platform]?.icon || '🌐'} {ep.name}</option>)}
          </select>
        </div>
      </div>
      <button onClick={fire} disabled={firing}
        className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-lg text-xs font-medium transition-all disabled:opacity-50">
        {firing ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Gönderiliyor...</> : <><Send className="h-3.5 w-3.5" /> Olayı Gönder</>}
      </button>
      {result && (
        <div className={cn("rounded-lg px-3 py-2 border text-xs",
          result.ok || result.deliveries?.[0]?.status === 'success'
            ? "bg-green-500/5 border-green-500/20 text-green-400"
            : "bg-red-500/5 border-red-500/20 text-red-400")}>
          {result.message || (result.deliveries?.[0]?.status === 'success' ? `✅ Başarıyla gönderildi (${result.deliveries[0].responseTimeMs}ms)` : `❌ ${result.deliveries?.[0]?.error || 'Hata'}`)}
        </div>
      )}
    </div>
  );
}

// ── Main WebhookDashboard ──────────────────────────────────────────────────────
export default function WebhookDashboard() {
  const { token } = useAuth() as any;
  const [tab, setTab] = useState<"endpoints" | "logs" | "stats" | "fire">("endpoints");
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

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
    intervalRef.current = setInterval(loadStats, 15000);
    return () => clearInterval(intervalRef.current);
  }, [loadEndpoints, loadStats]);

  const toggleGlobal = async () => {
    setToggling(true);
    try {
      const r = await fetch(`${API}/webhooks/admin/global`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isEnabled: !globalEnabled }),
      });
      const d = await r.json();
      setGlobalEnabled(d.isEnabled);
    } finally { setToggling(false); }
  };

  const handleCreate = async (data: any) => {
    const r = await fetch(`${API}/webhooks/admin/endpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (d.endpoint) {
      setEndpoints(prev => [d.endpoint, ...prev]);
      setShowForm(false);
      await loadStats();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", globalEnabled ? "bg-green-400 animate-pulse" : "bg-[#333]")} />
          <span className="text-xs text-[#666]">
            {globalEnabled ? "Sistem aktif" : "Sistem pasif"}
            {stats && ` • ${stats.endpoints.active}/${stats.endpoints.total} endpoint`}
          </span>
        </div>
        <button onClick={toggleGlobal} disabled={toggling}
          className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all disabled:opacity-50",
            globalEnabled ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-[#aaa]")}>
          {toggling ? <RefreshCw className="h-3 w-3 animate-spin" /> : globalEnabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {globalEnabled ? "Sistemi Durdur" : "Sistemi Başlat"}
        </button>
      </div>

      {/* Stats bar */}
      {stats && <StatsBar stats={stats} globalEnabled={globalEnabled} onToggleGlobal={toggleGlobal} />}

      {/* Recent failures alert */}
      {stats && stats.recentFailures.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-red-400 mb-1">{stats.recentFailures.length} yakın başarısız gönderim</p>
            <div className="space-y-0.5">
              {stats.recentFailures.slice(0, 3).map((f: any) => (
                <p key={f.id} className="text-[10px] text-red-400/70 truncate">
                  {f.event} → {f.endpointName} {f.responseStatus ? `(HTTP ${f.responseStatus})` : f.error?.slice(0, 50)}
                </p>
              ))}
            </div>
          </div>
          <button onClick={() => setTab("logs")} className="text-[10px] text-red-400 border border-red-500/20 px-2 py-1 rounded-lg shrink-0 hover:bg-red-500/10 transition-all">
            Loglar →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0e0e0e] p-1 rounded-xl border border-[#1a1a1a]">
        {[
          { id: "endpoints", label: "Endpointler", count: endpoints.length },
          { id: "logs", label: "Delivery Log", count: stats?.deliveries.total },
          { id: "stats", label: "İstatistik" },
          { id: "fire", label: "Manuel Tetikle" },
        ].map(({ id, label, count }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
              tab === id ? "bg-[#1e1e1e] text-white border border-[#2a2a2a]" : "text-[#555] hover:text-[#aaa]")}>
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full", tab === id ? "bg-primary/20 text-primary" : "bg-[#222] text-[#555]")}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "endpoints" && (
        <div className="space-y-3">
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#2a2a2a] text-xs text-[#555] hover:border-primary/30 hover:text-primary transition-all">
              <Plus className="h-4 w-4" /> Yeni Webhook Endpoint Ekle
            </button>
          )}
          {showForm && <EndpointForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}
          {loading ? (
            <div className="py-8 text-center text-[#555] text-sm">Yükleniyor...</div>
          ) : endpoints.length === 0 && !showForm ? (
            <div className="py-10 text-center space-y-2">
              <Webhook className="h-8 w-8 text-[#333] mx-auto" />
              <p className="text-sm text-[#555]">Henüz webhook endpoint yok</p>
              <p className="text-xs text-[#444]">Discord, Slack, Zapier ve daha fazlasına otomatik bildirim gönder</p>
            </div>
          ) : (
            endpoints.map(ep => (
              <EndpointCard key={ep.id} ep={ep} token={token}
                onUpdate={updated => setEndpoints(prev => prev.map(e => e.id === updated.id ? updated : e))}
                onDelete={id => { setEndpoints(prev => prev.filter(e => e.id !== id)); loadStats(); }} />
            ))
          )}
        </div>
      )}

      {tab === "logs" && <DeliveryLog token={token} />}

      {tab === "stats" && stats && (
        <div className="space-y-4">
          {/* Top events */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart2 className="h-3.5 w-3.5 text-blue-400" /> En Sık Tetiklenen Olaylar
            </p>
            {stats.topEvents.length === 0 ? (
              <p className="text-xs text-[#555]">Henüz veri yok</p>
            ) : (
              <div className="space-y-2">
                {stats.topEvents.map((ev, i) => {
                  const max = stats.topEvents[0]?.count || 1;
                  return (
                    <div key={ev.event} className="flex items-center gap-3">
                      <span className="text-[10px] text-[#444] w-4 text-right">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-white">{ev.event}</span>
                          <span className="text-[10px] text-[#555]">{ev.count}</span>
                        </div>
                        <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(ev.count / max) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Per-endpoint health */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-green-400" /> Endpoint Sağlığı
            </p>
            {stats.endpointStats.length === 0 ? (
              <p className="text-xs text-[#555]">Endpoint yok</p>
            ) : (
              <div className="space-y-2">
                {stats.endpointStats.map(ep => {
                  const meta = PLATFORM_META[ep.platform] || PLATFORM_META.custom;
                  return (
                    <div key={ep.id} className="flex items-center gap-3 bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl px-3 py-2">
                      <span>{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-white truncate">{ep.name}</p>
                          <StatusBadge status={ep.status} />
                        </div>
                        {ep.totalDeliveries > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 bg-[#222] rounded-full overflow-hidden">
                              <div className="h-full bg-green-400/70 rounded-full" style={{ width: `${ep.successRate ?? 0}%` }} />
                            </div>
                            <span className="text-[10px] text-[#555]">%{ep.successRate ?? 0}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-white">{ep.totalDeliveries}</p>
                        <p className="text-[10px] text-[#555]">gönderim</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "fire" && <ManualFirePanel token={token} endpoints={endpoints} />}
    </div>
  );
}
