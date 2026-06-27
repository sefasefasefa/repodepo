import { useEffect, useState, useCallback, useRef } from "react";
import {
  Share2, Loader2, Check, AlertTriangle, ExternalLink, X,
  CheckSquare, Square, RotateCcw, CheckCircle2, XCircle,
  Clock, Copy, ChevronDown, ChevronUp, Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Site {
  id: number;
  name: string;
  providerKey: string;
  providerColor: string;
  providerLetter: string;
  enabled: boolean;
}

interface Job {
  id: number;
  siteName: string;
  providerColor: string;
  providerLetter: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  streamUrl: string;
  error: string;
  attempts: number;
}

const STATUS = {
  pending:  { label: "Bekliyor",   color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/20", icon: Clock },
  running:  { label: "Yükleniyor", color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20",    icon: Loader2 },
  success:  { label: "Başarılı",   color: "text-green-400",   bg: "bg-green-400/10 border-green-400/20",  icon: CheckCircle2 },
  failed:   { label: "Başarısız",  color: "text-red-400",     bg: "bg-red-400/10 border-red-400/20",      icon: XCircle },
  skipped:  { label: "Atlandı",    color: "text-[#888]",      bg: "bg-[#1e1e1e] border-[#2a2a2a]",        icon: AlertTriangle },
} as const;

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })}
      className="shrink-0 text-[#555] hover:text-primary transition-colors"
      title="Kopyala"
    >
      {copied
        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
        : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ProviderBadge({ color, letter }: { color: string; letter: string }) {
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm"
      style={{ backgroundColor: color }}
    >
      {letter}
    </div>
  );
}

export function CrosspostDispatchModal({
  videoId,
  videoTitle,
  onClose,
}: {
  videoId: number;
  videoTitle: string;
  onClose: () => void;
}) {
  const { token } = useAuth() as any;

  /* ── Site seçim aşaması ── */
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState("");

  /* ── İzleme aşaması ── */
  const [jobs, setJobs] = useState<Job[]>([]);
  const [phase, setPhase] = useState<"select" | "tracking">("select");
  const [retrying, setRetrying] = useState<number | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const trackedIds = useRef<Set<number>>(new Set());
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Site listesini yükle */
  useEffect(() => {
    fetch("/api/cross-post/sites", { headers: { Authorization: `Bearer ${token ?? ""}` } })
      .then(r => r.json())
      .then(d => {
        const list: Site[] = (d.sites ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          providerKey: s.providerKey ?? s.provider_key ?? "",
          providerColor: s.providerColor ?? s.provider_color ?? "#555",
          providerLetter: s.providerLetter ?? s.provider_letter ?? s.name?.substring(0, 2).toUpperCase(),
          enabled: s.enabled,
        }));
        setSites(list);
        setSelected(new Set(list.filter(s => s.enabled).map(s => s.id)));
      })
      .catch(() => {})
      .finally(() => setLoadingSites(false));
  }, [token]);

  /* Job durumu polling */
  const fetchJobs = useCallback(async () => {
    if (trackedIds.current.size === 0) return;
    try {
      const res = await fetch("/api/cross-post/jobs", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) return;
      const d = await res.json();
      const all: any[] = d.jobs ?? [];
      const mine = all
        .filter(j => trackedIds.current.has(j.id))
        .map(j => ({
          id: j.id,
          siteName: j.siteName ?? j.site_name ?? "",
          providerColor: j.providerColor ?? j.provider_color ?? "#555",
          providerLetter: j.providerLetter ?? j.provider_letter ?? "?",
          status: j.status as Job["status"],
          streamUrl: j.streamUrl ?? j.stream_url ?? j.remoteUrl ?? j.remote_url ?? "",
          error: j.error ?? j.response_text ?? "",
          attempts: j.attempts ?? 1,
        }));
      setJobs(mine);
    } catch { /* ignore */ }
  }, [token]);

  /* Tek polling useEffect — phase=tracking iken başlar, tüm işler bitince durur */
  useEffect(() => {
    if (phase !== "tracking") return;
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    fetchJobs();
    pollTimer.current = setInterval(fetchJobs, 3500);
    return () => {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    };
  }, [phase, fetchJobs]);

  /* Tüm işler tamamlanınca polling'i durdur */
  useEffect(() => {
    if (phase !== "tracking" || !pollTimer.current) return;
    const allDoneNow = jobs.length > 0 && jobs.every(j => j.status === "success" || j.status === "failed" || j.status === "skipped");
    if (allDoneNow) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, [jobs, phase]);

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const dispatch = async () => {
    if (selected.size === 0) return;
    setDispatching(true);
    setDispatchError("");
    try {
      const res = await fetch("/api/cross-post/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ videoId, siteIds: [...selected] }),
      });
      const d = await res.json();
      if (!res.ok) { setDispatchError(d.error ?? "Gönderilemedi"); return; }
      const dispatched: any[] = d.jobs ?? [];
      dispatched.forEach(j => trackedIds.current.add(j.id));
      /* İlk job listesini anında oluştur (polling gelmeden önce skeleton göster) */
      setJobs(dispatched.map(j => ({
        id: j.id,
        siteName: j.siteName ?? j.site_name ?? "",
        providerColor: j.providerColor ?? j.provider_color ?? "#555",
        providerLetter: j.providerLetter ?? j.provider_letter ?? "?",
        status: (j.status as Job["status"]) ?? "pending",
        streamUrl: "",
        error: "",
        attempts: 1,
      })));
      setPhase("tracking");
    } catch {
      setDispatchError("Sunucu hatası");
    } finally {
      setDispatching(false);
    }
  };

  const retry = async (jobId: number) => {
    setRetrying(jobId);
    try {
      await fetch(`/api/cross-post/jobs/${jobId}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      await fetchJobs();
    } finally {
      setRetrying(null);
    }
  };

  /* ── İstatistikler ── */
  const total = jobs.length;
  const done = jobs.filter(j => ["success", "failed", "skipped"].includes(j.status)).length;
  const successes = jobs.filter(j => j.status === "success").length;
  const failures = jobs.filter(j => j.status === "failed").length;
  const running = jobs.filter(j => j.status === "running").length;
  const pending = jobs.filter(j => j.status === "pending").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const successPct = total > 0 ? Math.round((successes / total) * 100) : 0;
  const failPct = total > 0 ? Math.round((failures / total) * 100) : 0;
  const runPct = total > 0 ? Math.round((running / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Share2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm">Crosspost Gönder</p>
              <p className="text-xs text-[#555] truncate max-w-[260px]">{videoTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors p-1 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ══════════════════ SEÇİM AŞAMASI ══════════════════ */}
        {phase === "select" && (
          <div className="flex flex-col overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto">
              {loadingSites ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#444]" />
                </div>
              ) : sites.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Share2 className="h-10 w-10 mx-auto text-[#2a2a2a]" />
                  <p className="text-sm text-[#666]">Henüz crosspost sitesi eklenmemiş.</p>
                  <a href="/upload" className="inline-block text-xs text-primary hover:underline">
                    Upload sayfasından sağlayıcı ekle →
                  </a>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#555]">
                      <span className="text-white font-semibold">{selected.size}</span> / {sites.length} sağlayıcı seçili
                    </span>
                    <div className="flex gap-3 text-xs text-[#555]">
                      <button onClick={() => setSelected(new Set(sites.map(s => s.id)))} className="hover:text-primary transition-colors">Tümünü seç</button>
                      <span>·</span>
                      <button onClick={() => setSelected(new Set())} className="hover:text-red-400 transition-colors">Temizle</button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {sites.map(site => {
                      const isSel = selected.has(site.id);
                      return (
                        <button
                          key={site.id}
                          onClick={() => toggle(site.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                            isSel
                              ? "bg-primary/8 border-primary/25"
                              : "bg-[#141414] border-[#1e1e1e] hover:border-[#2e2e2e]"
                          )}
                        >
                          <ProviderBadge color={site.providerColor} letter={site.providerLetter} />
                          <span className={cn("flex-1 text-sm font-medium", isSel ? "text-white" : "text-[#999]")}>
                            {site.name}
                          </span>
                          {!site.enabled && (
                            <span className="text-[10px] text-[#444] border border-[#282828] px-1.5 py-0.5 rounded">Devre dışı</span>
                          )}
                          {isSel
                            ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                            : <Square className="h-4 w-4 text-[#333] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {dispatchError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-900/10 border border-red-900/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {dispatchError}
                </p>
              )}
            </div>

            {sites.length > 0 && (
              <div className="px-5 pb-5 flex gap-3 shrink-0">
                <button
                  onClick={dispatch}
                  disabled={dispatching || selected.size === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
                >
                  {dispatching
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Başlatılıyor…</>
                    : <><Zap className="h-4 w-4" /> {selected.size} Sağlayıcıya Gönder</>}
                </button>
                <button
                  onClick={onClose}
                  className="px-5 border border-[#2a2a2a] text-[#777] hover:text-white rounded-xl text-sm transition-colors"
                >
                  İptal
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ TAKİP AŞAMASI ══════════════════ */}
        {phase === "tracking" && (
          <div className="flex flex-col overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto flex-1">

              {/* Genel ilerleme */}
              <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white flex items-center gap-2">
                    {allDone
                      ? <><CheckCircle2 className="h-4 w-4 text-green-400" /> Dağıtım Tamamlandı</>
                      : <><Loader2 className="h-4 w-4 text-blue-400 animate-spin" /> Dağıtım Sürüyor…</>}
                  </span>
                  <span className="text-[#666] text-xs font-medium">
                    {done} / {total} — <span className="text-white">%{pct}</span>
                  </span>
                </div>
                {/* Segmentli ilerleme çubuğu */}
                <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500 transition-all duration-700 rounded-l-full" style={{ width: `${successPct}%` }} />
                  <div className="h-full bg-red-500 transition-all duration-700" style={{ width: `${failPct}%` }} />
                  <div className="h-full bg-blue-400/70 animate-pulse transition-all duration-700" style={{ width: `${runPct}%` }} />
                </div>
                {/* Durum özeti */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  {successes > 0 && <span className="flex items-center gap-1 text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Başarılı: {successes}</span>}
                  {running > 0  && <span className="flex items-center gap-1 text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />Yükleniyor: {running}</span>}
                  {pending > 0  && <span className="flex items-center gap-1 text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />Bekliyor: {pending}</span>}
                  {failures > 0 && <span className="flex items-center gap-1 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />Başarısız: {failures}</span>}
                </div>
              </div>

              {/* Sağlayıcı bazında durum listesi */}
              <div className="space-y-2">
                {jobs.map(job => {
                  const meta = STATUS[job.status] ?? STATUS.skipped;
                  const Icon = meta.icon;
                  const hasError = job.status === "failed" && job.error;
                  const errExpanded = expandedErrors.has(job.id);

                  return (
                    <div
                      key={job.id}
                      className={cn(
                        "rounded-xl border p-3 transition-all",
                        meta.bg
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <ProviderBadge color={job.providerColor} letter={job.providerLetter} />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{job.siteName}</p>
                          {job.status === "success" && job.streamUrl ? (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <a
                                href={job.streamUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-primary hover:underline truncate"
                              >
                                {job.streamUrl}
                              </a>
                              <CopyBtn text={job.streamUrl} />
                              <a href={job.streamUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 text-[#555] hover:text-primary transition-colors shrink-0" />
                              </a>
                            </div>
                          ) : job.status === "failed" && job.error ? (
                            <button
                              onClick={() => setExpandedErrors(prev => {
                                const next = new Set(prev);
                                next.has(job.id) ? next.delete(job.id) : next.add(job.id);
                                return next;
                              })}
                              className="flex items-center gap-1 text-[11px] text-red-400/70 hover:text-red-400 mt-0.5 transition-colors"
                            >
                              <span className="truncate max-w-[180px]">{job.error.slice(0, 60)}{job.error.length > 60 ? "…" : ""}</span>
                              {errExpanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                            </button>
                          ) : (
                            <p className={cn("text-[11px] mt-0.5", meta.color)}>
                              {job.status === "running" ? "Yükleniyor, lütfen bekleyin…" :
                               job.status === "pending" ? "Sıraya alındı" :
                               job.status === "skipped" ? "Manuel mod, atlandı" : ""}
                            </p>
                          )}
                        </div>

                        {/* Durum ikonu */}
                        <div className="shrink-0 flex items-center gap-2">
                          <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", meta.color)}>
                            <Icon className={cn("h-4 w-4", job.status === "running" ? "animate-spin" : "")} />
                            <span className="hidden sm:inline">{meta.label}</span>
                          </span>
                        </div>

                        {/* Yeniden dene */}
                        {(job.status === "failed" || job.status === "skipped") && (
                          <button
                            onClick={() => retry(job.id)}
                            disabled={retrying === job.id}
                            title="Yeniden dene"
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg text-[11px] text-[#888] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50"
                          >
                            {retrying === job.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <RotateCcw className="h-3 w-3" />}
                            <span className="hidden sm:inline">Tekrar</span>
                          </button>
                        )}
                      </div>

                      {/* Hata detayı (açılır) */}
                      {hasError && errExpanded && (
                        <div className="mt-2 ml-12 text-[11px] text-red-400/80 bg-red-900/10 rounded-lg p-2 break-words">
                          {job.error}
                        </div>
                      )}

                      {/* Deneme sayısı */}
                      {job.attempts > 1 && (
                        <p className="text-[10px] text-[#444] mt-1 ml-12">{job.attempts}. deneme</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-2 flex gap-3 shrink-0 border-t border-[#1a1a1a]">
              <a
                href="/crosspost-jobs"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#141414] border border-[#222] text-[#aaa] hover:text-white hover:border-[#333] rounded-xl text-sm transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Tüm Görevler
              </a>
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Check className="h-4 w-4" />
                Tamam
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
