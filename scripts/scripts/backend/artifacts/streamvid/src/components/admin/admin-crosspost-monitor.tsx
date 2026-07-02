import { useState, useEffect, useCallback } from "react";
import {
  Share2, RefreshCw, RotateCcw, ExternalLink, Copy, CheckCircle2,
  XCircle, Clock, Loader2, AlertTriangle, Play, Search, X,
  TrendingUp, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

type JobStatus = "pending" | "running" | "success" | "failed" | "skipped";

interface ProviderJob {
  jobId: number;
  provider: string;
  providerKey: string;
  status: JobStatus;
  remoteUrl: string;
  error: string;
  attempts: number;
  color: string;
  letter: string;
  updatedAt: string | null;
}

interface VideoEntry {
  videoId: number;
  videoTitle: string;
  videoThumb: string;
  videoUrl: string;
  creatorUsername: string;
  providers: ProviderJob[];
}

interface Stats {
  totalVideos: number;
  totalJobs: number;
  success: number;
  failed: number;
  running: number;
  pending: number;
  skipped: number;
}

const STATUS_META: Record<JobStatus, { label: string; icon: any; color: string; bg: string }> = {
  pending:  { label: "Bekliyor",   icon: Clock,        color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  running:  { label: "Çalışıyor", icon: Loader2,       color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/30"    },
  success:  { label: "Başarılı",  icon: CheckCircle2,  color: "text-green-400",  bg: "bg-green-400/10 border-green-400/30"  },
  failed:   { label: "Başarısız", icon: XCircle,       color: "text-red-400",    bg: "bg-red-400/10 border-red-400/30"      },
  skipped:  { label: "Atlandı",   icon: AlertTriangle, color: "text-[#777]",     bg: "bg-[#1e1e1e] border-[#2a2a2a]"       },
};

function ProviderBadge({
  job,
  onRetry,
  retrying,
}: {
  job: ProviderJob;
  onRetry: (id: number) => void;
  retrying: number | null;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const m = STATUS_META[job.status];
  const Icon = m.icon;
  const isRetryable = job.status === "failed" || job.status === "skipped";

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-default select-none transition-all",
          m.bg, m.color,
          isRetryable && "cursor-pointer hover:opacity-80",
        )}
        onClick={() => isRetryable && onRetry(job.jobId)}
      >
        <div
          className="w-4 h-4 rounded flex items-center justify-center text-white font-bold text-[9px] shrink-0"
          style={{ backgroundColor: job.color }}
        >
          {job.letter.length > 2 ? job.letter.slice(0, 2) : job.letter}
        </div>
        <span className="hidden sm:inline truncate max-w-[60px]">{job.provider}</span>
        {retrying === job.jobId ? (
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        ) : (
          <Icon className={cn("h-3 w-3 shrink-0", job.status === "running" ? "animate-spin" : "")} />
        )}
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 min-w-[180px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-2.5 shadow-xl text-[11px] pointer-events-none">
          <p className="font-semibold text-white mb-1">{job.provider}</p>
          <p className={cn("mb-1", m.color)}>{m.label}{job.attempts > 1 ? ` (${job.attempts}. deneme)` : ""}</p>
          {job.status === "success" && job.remoteUrl && (
            <p className="text-[#888] truncate">{job.remoteUrl}</p>
          )}
          {job.status === "failed" && job.error && (
            <p className="text-red-400/80 line-clamp-2">{job.error}</p>
          )}
          {isRetryable && (
            <p className="text-[#555] mt-1 italic">Tıkla → yeniden dene</p>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-[#555] hover:text-primary transition-colors"
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function VideoRow({
  entry,
  onRetry,
  retrying,
}: {
  entry: VideoEntry;
  onRetry: (id: number) => void;
  retrying: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasRunning = entry.providers.some(p => p.status === "running" || p.status === "pending");
  const hasFailed = entry.providers.some(p => p.status === "failed");
  const successCount = entry.providers.filter(p => p.status === "success").length;
  const total = entry.providers.length;

  const successPct = total > 0 ? Math.round((successCount / total) * 100) : 0;

  return (
    <div className={cn(
      "bg-[#0e0e0e] border rounded-xl overflow-hidden transition-colors",
      hasFailed ? "border-red-900/40" : hasRunning ? "border-blue-900/40" : "border-[#1e1e1e]",
    )}>
      {/* Video Başlık Satırı */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[#141414] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Thumbnail */}
        {entry.videoThumb ? (
          <img
            src={entry.videoThumb}
            alt={entry.videoTitle}
            className="w-14 h-9 object-cover rounded-lg shrink-0 bg-[#1a1a1a]"
          />
        ) : (
          <div className="w-14 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0">
            <Play className="h-3.5 w-3.5 text-[#444]" />
          </div>
        )}

        {/* Başlık + Yaratıcı */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{entry.videoTitle}</p>
          <p className="text-xs text-[#555]">@{entry.creatorUsername}</p>
        </div>

        {/* İlerleme çubuğu */}
        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 w-24">
          <span className="text-[10px] text-[#666]">{successCount}/{total} başarılı</span>
          <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                hasFailed && successPct < 100 ? "bg-gradient-to-r from-green-500 to-red-500" : "bg-green-500"
              )}
              style={{ width: `${successPct}%` }}
            />
          </div>
        </div>

        {/* Durum indikatörleri */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasRunning && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Aktif
            </span>
          )}
          {hasFailed && (
            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
              <XCircle className="h-2.5 w-2.5" /> Hata
            </span>
          )}
        </div>

        {/* Genişlet oku */}
        <span className={cn("text-[#444] text-sm transition-transform", expanded ? "rotate-90" : "")}>›</span>
      </div>

      {/* Provider Satırları (genişletilmiş) */}
      {expanded && (
        <div className="border-t border-[#1a1a1a] divide-y divide-[#141414]">
          {entry.providers.map(prov => {
            const m = STATUS_META[prov.status];
            const Icon = m.icon;
            const isRetryable = prov.status === "failed" || prov.status === "skipped";
            return (
              <div key={prov.jobId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#111] transition-colors">
                {/* Sağlayıcı rozeti */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: prov.color }}
                >
                  {prov.letter.length > 2 ? prov.letter.slice(0, 2) : prov.letter}
                </div>
                <span className="text-sm text-[#ccc] w-28 shrink-0 truncate">{prov.provider}</span>

                {/* Durum */}
                <span className={cn("flex items-center gap-1.5 text-xs font-medium w-24 shrink-0", m.color)}>
                  <Icon className={cn("h-3 w-3", prov.status === "running" ? "animate-spin" : "")} />
                  {m.label}
                  {prov.attempts > 1 && <span className="text-[#555]">×{prov.attempts}</span>}
                </span>

                {/* URL veya hata */}
                <div className="flex-1 min-w-0">
                  {prov.status === "success" && prov.remoteUrl ? (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={prov.remoteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate"
                      >
                        {prov.remoteUrl}
                      </a>
                      <CopyButton text={prov.remoteUrl} />
                      <a href={prov.remoteUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 text-[#555] hover:text-primary transition-colors" />
                      </a>
                    </div>
                  ) : prov.status === "failed" && prov.error ? (
                    <p className="text-xs text-red-400/70 truncate" title={prov.error}>{prov.error}</p>
                  ) : null}
                </div>

                {/* Yeniden dene */}
                {isRetryable && (
                  <button
                    onClick={() => onRetry(prov.jobId)}
                    disabled={retrying === prov.jobId}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 border border-[#2a2a2a] rounded-lg text-[11px] text-[#777] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50"
                  >
                    {retrying === prov.jobId
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RotateCcw className="h-3 w-3" />}
                    Tekrar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminCrosspostMonitor() {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/cross-post/admin/monitor");
      setVideos(data.videos ?? []);
      setStats(data.stats ?? null);
      setLastUpdated(new Date());
    } catch {
      // sessiz hata
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Aktif iş varsa 5s'de bir otomatik yenile
  useEffect(() => {
    const hasActive = videos.some(v =>
      v.providers.some(p => p.status === "pending" || p.status === "running")
    );
    if (!hasActive) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [videos, load]);

  const retry = async (jobId: number) => {
    setRetrying(jobId);
    try {
      await apiFetch(`/cross-post/admin/jobs/${jobId}/retry`, { method: "POST" });
      await load();
    } finally {
      setRetrying(null);
    }
  };

  const filtered = videos.filter(v => {
    const matchSearch = !search ||
      v.videoTitle.toLowerCase().includes(search.toLowerCase()) ||
      v.creatorUsername.toLowerCase().includes(search.toLowerCase()) ||
      v.providers.some(p => p.provider.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" ||
      v.providers.some(p => p.status === statusFilter);
    return matchSearch && matchStatus;
  });

  const successRate = stats && stats.totalJobs > 0
    ? Math.round((stats.success / stats.totalJobs) * 100)
    : 0;

  const FILTER_BTNS: { key: "all" | JobStatus; label: string; color: string }[] = [
    { key: "all",     label: "Tümü",       color: "" },
    { key: "success", label: "✓ Başarılı", color: "text-green-400" },
    { key: "running", label: "⟳ Çalışıyor", color: "text-blue-400" },
    { key: "pending", label: "◷ Bekliyor", color: "text-yellow-400" },
    { key: "failed",  label: "✕ Başarısız", color: "text-red-400" },
    { key: "skipped", label: "– Atlandı",  color: "text-[#777]" },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Başlık */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Crosspost Durum İzleme</h1>
            <p className="text-xs text-[#555]">
              {lastUpdated
                ? `Son güncelleme: ${lastUpdated.toLocaleTimeString("tr-TR")}`
                : "Yükleniyor…"}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#aaa] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
          Yenile
        </button>
      </div>

      {/* İstatistik Kartları */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Video", value: stats.totalVideos, icon: Activity, color: "text-white" },
            { label: "Toplam İş", value: stats.totalJobs, icon: Share2, color: "text-white" },
            { label: "Başarılı", value: stats.success, icon: CheckCircle2, color: "text-green-400" },
            { label: "Başarısız", value: stats.failed, icon: XCircle, color: "text-red-400" },
            { label: "Çalışıyor", value: stats.running + stats.pending, icon: Loader2, color: "text-blue-400" },
            { label: "Başarı Oranı", value: `%${successRate}`, icon: TrendingUp, color: successRate >= 80 ? "text-green-400" : successRate >= 50 ? "text-yellow-400" : "text-red-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[#666]">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[11px]">{label}</span>
              </div>
              <p className={cn("text-xl font-bold", color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Genel İlerleme Çubuğu */}
      {stats && stats.totalJobs > 0 && (
        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs text-[#666]">
            <span>Toplam dağıtım durumu</span>
            <span>{stats.success + stats.failed + stats.skipped} / {stats.totalJobs} tamamlandı</span>
          </div>
          <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden flex gap-px">
            <div className="h-full bg-green-500 transition-all duration-700 rounded-l-full" style={{ width: `${(stats.success / stats.totalJobs) * 100}%` }} />
            <div className="h-full bg-red-500 transition-all duration-700" style={{ width: `${(stats.failed / stats.totalJobs) * 100}%` }} />
            <div className="h-full bg-blue-400/70 animate-pulse transition-all duration-700" style={{ width: `${((stats.running + stats.pending) / stats.totalJobs) * 100}%` }} />
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] text-[#666]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Başarılı: {stats.success}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Başarısız: {stats.failed}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Aktif: {stats.running + stats.pending}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#333] inline-block" /> Atlandı: {stats.skipped}</span>
          </div>
        </div>
      )}

      {/* Arama + Filtre */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555] pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Video başlığı, yaratıcı veya sağlayıcı ara…"
            className="w-full bg-[#111] border border-[#222] rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#444] transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_BTNS.map(btn => (
            <button
              key={btn.key}
              onClick={() => setStatusFilter(btn.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                statusFilter === btn.key
                  ? "bg-primary text-white border-primary"
                  : "bg-[#111] border-[#222] text-[#777] hover:text-white hover:border-[#444]",
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Video Listesi */}
      {loading && videos.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-[#555]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-[#555]">
          <Share2 className="h-12 w-12 opacity-20" />
          <p className="text-sm">
            {videos.length === 0
              ? "Henüz hiç crosspost işlemi yapılmamış."
              : "Arama kriterine uyan sonuç bulunamadı."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[#555]">{filtered.length} video gösteriliyor</p>
          {filtered.map(entry => (
            <VideoRow
              key={entry.videoId}
              entry={entry}
              onRetry={retry}
              retrying={retrying}
            />
          ))}
        </div>
      )}
    </div>
  );
}
