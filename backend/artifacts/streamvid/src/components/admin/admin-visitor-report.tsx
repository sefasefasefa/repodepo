import { useState, useEffect } from "react";
import { Mail, Send, Eye, Plus, X, Clock, Check, AlertCircle, ChevronDown, ChevronUp, Bell, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportSettings {
  isEnabled: boolean;
  recipients: string[];
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek: number;
  hour: number;
  lastSent: string | null;
}

const FREQUENCY_OPTIONS = [
  { value: "daily",   label: "Günlük",   desc: "Her gün belirlenen saatte" },
  { value: "weekly",  label: "Haftalık", desc: "Her hafta belirlenen gün" },
  { value: "monthly", label: "Aylık",    desc: "Her ayın 1. günü" },
];

const DAY_OPTIONS = [
  "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00`,
}));

function formatRelativeTime(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} dakika önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

interface Props {
  period?: string;
}

export default function AdminVisitorReport({ period }: Props) {
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const token = localStorage.getItem("token") ?? "";

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch("/api/admin/visitor-report/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setSettings(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function save(patch: Partial<ReportSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await fetch("/api/admin/visitor-report/settings", {
        method: "PUT", headers,
        body: JSON.stringify({
          isEnabled: next.isEnabled,
          recipients: next.recipients,
          frequency: next.frequency,
          dayOfWeek: next.dayOfWeek,
          hour: next.hour,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendNow() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/visitor-report/send", { method: "POST", headers });
      const d = await res.json();
      setSendResult({ ok: d.ok, msg: d.message });
      // refresh last_sent
      const cfg = await fetch("/api/admin/visitor-report/settings", { headers: { Authorization: `Bearer ${token}` } });
      setSettings(await cfg.json());
    } catch (e: any) {
      setSendResult({ ok: false, msg: String(e) });
    } finally {
      setSending(false);
    }
  }

  function openPreview() {
    const url = `/api/admin/visitor-report/preview`;
    setPreviewUrl(url);
    setPreviewOpen(true);
  }

  function addEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (settings?.recipients.includes(email)) return;
    save({ recipients: [...(settings?.recipients ?? []), email] });
    setNewEmail("");
  }

  function removeEmail(email: string) {
    save({ recipients: settings!.recipients.filter(e => e !== email) });
  }

  if (loading) return null;

  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl overflow-hidden">
      {/* Header row — always visible, click to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{ touchAction: "manipulation" }}
        className="w-full flex items-center justify-between p-5 hover:bg-[#252525] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center",
            settings?.isEnabled ? "bg-primary/20" : "bg-[#2a2a2a]"
          )}>
            <Mail className={cn("h-4 w-4", settings?.isEnabled ? "text-primary" : "text-[#555]")} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              Otomatik E-posta Raporu
              {settings?.isEnabled && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                  Aktif
                </span>
              )}
            </p>
            <p className="text-xs text-[#555]">
              {settings?.isEnabled
                ? `${FREQUENCY_OPTIONS.find(f => f.value === settings.frequency)?.label} · ${settings.recipients.length} alıcı`
                : "Ziyaretçi istatistikleri e-posta ile gönderilsin"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {settings?.lastSent && (
            <span className="text-xs text-[#444] hidden sm:block">
              Son: {formatRelativeTime(settings.lastSent)}
            </span>
          )}
          {saving && <RefreshCw className="h-3 w-3 text-[#555] animate-spin" />}
          {expanded ? <ChevronUp className="h-4 w-4 text-[#555]" /> : <ChevronDown className="h-4 w-4 text-[#555]" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[#2a2a2a] p-5 space-y-5">

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Raporu Etkinleştir</p>
              <p className="text-xs text-[#555]">Belirlenen takvime göre e-posta gönderilir</p>
            </div>
            <button
              onClick={() => save({ isEnabled: !settings?.isEnabled })}
              style={{ touchAction: "manipulation" }}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                settings?.isEnabled ? "bg-primary" : "bg-[#333]"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                settings?.isEnabled ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>

          {/* Frequency */}
          <div>
            <p className="text-xs font-semibold text-[#888] mb-2 uppercase tracking-wide">Sıklık</p>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map(f => (
                <button
                  key={f.value}
                  onClick={() => save({ frequency: f.value as any })}
                  style={{ touchAction: "manipulation" }}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    settings?.frequency === f.value
                      ? "border-primary bg-primary/10"
                      : "border-[#2a2a2a] bg-[#161616] hover:border-[#444]"
                  )}
                >
                  <p className={cn("text-xs font-semibold", settings?.frequency === f.value ? "text-primary" : "text-white")}>
                    {f.label}
                  </p>
                  <p className="text-[11px] text-[#555] mt-0.5">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Day of week + hour */}
          <div className="grid grid-cols-2 gap-3">
            {settings?.frequency === "weekly" && (
              <div>
                <p className="text-xs font-semibold text-[#888] mb-2 uppercase tracking-wide">Gün</p>
                <select
                  value={settings?.dayOfWeek ?? 0}
                  onChange={e => save({ dayOfWeek: Number(e.target.value) })}
                  className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  {DAY_OPTIONS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-[#888] mb-2 uppercase tracking-wide">Saat</p>
              <select
                value={settings?.hour ?? 8}
                onChange={e => save({ hour: Number(e.target.value) })}
                className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
              >
                {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
          </div>

          {/* Recipients */}
          <div>
            <p className="text-xs font-semibold text-[#888] mb-2 uppercase tracking-wide">
              Alıcılar ({settings?.recipients.length ?? 0})
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addEmail()}
                className="flex-1 bg-[#161616] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary"
              />
              <button
                onClick={addEmail}
                style={{ touchAction: "manipulation" }}
                className="px-3 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-xl text-primary transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {settings?.recipients.length === 0 ? (
              <p className="text-xs text-[#444] text-center py-3">Henüz alıcı eklenmedi</p>
            ) : (
              <div className="space-y-1.5">
                {settings?.recipients.map(email => (
                  <div key={email} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[#161616] border border-[#252525]">
                    <span className="text-xs text-[#ccc]">{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      style={{ touchAction: "manipulation" }}
                      className="text-[#444] hover:text-red-400 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SMTP note */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-900/10 border border-amber-500/20">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-300 font-medium">SMTP Ayarları</p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">
                Gerçek e-posta göndermek için <code className="bg-amber-900/30 px-1 rounded">EMAIL_HOST</code>, <code className="bg-amber-900/30 px-1 rounded">EMAIL_HOST_USER</code> ve <code className="bg-amber-900/30 px-1 rounded">EMAIL_HOST_PASSWORD</code> ortam değişkenlerini ayarlayın. Geliştirme ortamında e-postalar konsola yazdırılır.
              </p>
            </div>
          </div>

          {/* Send result */}
          {sendResult && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-xl border",
              sendResult.ok
                ? "bg-green-900/10 border-green-500/20 text-green-400"
                : "bg-red-900/10 border-red-500/20 text-red-400"
            )}>
              {sendResult.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <p className="text-xs">{sendResult.msg}</p>
            </div>
          )}

          {/* Last sent */}
          {settings?.lastSent && (
            <div className="flex items-center gap-2 text-xs text-[#555]">
              <Clock className="h-3.5 w-3.5" />
              Son gönderim: {formatRelativeTime(settings.lastSent)}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={openPreview}
              style={{ touchAction: "manipulation" }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-[#2a2a2a] bg-[#161616] hover:bg-[#1e1e1e] text-sm text-[#aaa] hover:text-white transition-colors"
            >
              <Eye className="h-4 w-4" />
              E-posta Önizle
            </button>
            <button
              onClick={sendNow}
              disabled={sending || !settings?.recipients.length}
              style={{ touchAction: "manipulation" }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all",
                sending || !settings?.recipients.length
                  ? "bg-[#2a2a2a] text-[#444] cursor-not-allowed"
                  : "bg-primary hover:bg-primary/90 text-white"
              )}
            >
              {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Gönderiliyor…" : "Şimdi Gönder"}
            </button>
          </div>
        </div>
      )}

      {/* Email preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> E-posta Önizlemesi
              </h3>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{ touchAction: "manipulation" }}
                className="text-[#555] hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              src={`/api/admin/visitor-report/preview?_t=${Date.now()}`}
              className="flex-1 w-full rounded-b-2xl"
              style={{ border: "none", minHeight: 400 }}
              title="E-posta Önizlemesi"
            />
          </div>
        </div>
      )}
    </div>
  );
}
