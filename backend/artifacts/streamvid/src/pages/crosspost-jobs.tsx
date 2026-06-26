import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  RefreshCw, RotateCcw, ExternalLink, Copy, CheckCircle2,
  XCircle, Clock, Loader2, AlertTriangle, Play, Share2
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";

interface Job {
  id: number;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  siteName: string;
  providerColor: string;
  providerLetter: string;
  videoTitle: string;
  videoThumb: string;
  videoUrl: string;
  streamUrl: string;
  error: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_META = {
  pending:  { label: "Bekliyor",   icon: Clock,         color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/20" },
  running:  { label: "Çalışıyor", icon: Loader2,        color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20"    },
  success:  { label: "Başarılı",  icon: CheckCircle2,   color: "text-green-400",   bg: "bg-green-400/10 border-green-400/20"  },
  failed:   { label: "Başarısız", icon: XCircle,        color: "text-red-400",     bg: "bg-red-400/10 border-red-400/20"      },
  skipped:  { label: "Atlandı",   icon: AlertTriangle,  color: "text-[#888]",      bg: "bg-[#222] border-[#333]"              },
} as const;

function StatusBadge({ status }: { status: Job["status"] }) {
  const m = STATUS_META[status] ?? STATUS_META.skipped;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${m.bg} ${m.color}`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {m.label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy} title="Kopyala" className="text-[#555] hover:text-primary transition-colors shrink-0">
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)}g önce`;
}

export default function CrosspostJobsPage() {
  const { token } = useAuth() as any;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | Job["status"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cross-post/jobs", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.ok) {
        const d = await res.json();
        setJobs(d.jobs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const retry = async (jobId: number) => {
    setRetrying(jobId);
    try {
      await fetch(`/api/cross-post/jobs/${jobId}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      await load();
    } finally {
      setRetrying(null);
    }
  };

  const filtered = filter === "all" ? jobs : jobs.filter(j => j.status === filter);

  const counts = jobs.reduce((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filterBtns: { key: "all" | Job["status"]; label: string }[] = [
    { key: "all",     label: `Tümü (${jobs.length})` },
    { key: "success", label: `✓ Başarılı (${counts.success ?? 0})` },
    { key: "running", label: `⟳ Çalışıyor (${counts.running ?? 0})` },
    { key: "pending", label: `◷ Bekliyor (${counts.pending ?? 0})` },
    { key: "failed",  label: `✕ Başarısız (${counts.failed ?? 0})` },
    { key: "skipped", label: `– Atlandı (${counts.skipped ?? 0})` },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#080808] text-white px-4 md:px-8 py-8 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Share2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Crosspost Görevleri</h1>
              <p className="text-sm text-[#666]">Videolarınızın host sitelerine yükleme durumu</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#aaa] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </button>
        </div>

        {/* Özet istatistikler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["success", "running", "failed", "pending"] as const).map(s => {
            const m = STATUS_META[s];
            const Icon = m.icon;
            return (
              <div key={s} className={`p-4 rounded-xl border ${m.bg} space-y-1`}>
                <div className={`flex items-center gap-2 ${m.color}`}>
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{m.label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{counts[s] ?? 0}</p>
              </div>
            );
          })}
        </div>

        {/* Filtreler */}
        <div className="flex flex-wrap gap-2">
          {filterBtns.map(btn => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                filter === btn.key
                  ? "bg-primary text-white border-primary"
                  : "bg-[#111] border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444]"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-[#555]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-[#555]">
            <Share2 className="h-12 w-12 opacity-30" />
            <p className="text-sm">
              {filter === "all"
                ? "Henüz crosspost görevi yok. Bir video yüklerken sağlayıcı seç."
                : "Bu kategoride görev bulunamadı."}
            </p>
            {filter === "all" && (
              <Link href="/upload" className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors">
                Video Yükle
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(job => (
              <div
                key={job.id}
                className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-[#2a2a2a] transition-colors"
              >
                {/* Thumbnail + video başlık */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {job.videoThumb ? (
                    <Link href={job.videoUrl}>
                      <img
                        src={job.videoThumb}
                        alt={job.videoTitle}
                        className="w-16 h-10 object-cover rounded-lg shrink-0 bg-[#1a1a1a]"
                      />
                    </Link>
                  ) : (
                    <div className="w-16 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0">
                      <Play className="h-4 w-4 text-[#444]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <Link href={job.videoUrl} className="text-sm font-medium text-white hover:text-primary transition-colors truncate block">
                      {job.videoTitle || "(İsimsiz Video)"}
                    </Link>
                    <p className="text-xs text-[#555] mt-0.5">{timeAgo(job.createdAt)}</p>
                  </div>
                </div>

                {/* Sağlayıcı */}
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                    style={{ backgroundColor: job.providerColor }}
                  >
                    {job.providerLetter}
                  </div>
                  <span className="text-sm text-[#aaa] font-medium">{job.siteName}</span>
                </div>

                {/* Durum */}
                <div className="shrink-0">
                  <StatusBadge status={job.status} />
                  {job.attempts > 1 && (
                    <p className="text-[10px] text-[#555] mt-1 text-center">{job.attempts}. deneme</p>
                  )}
                </div>

                {/* Stream URL / Hata */}
                <div className="flex-1 min-w-0">
                  {job.status === "success" && job.streamUrl ? (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={job.streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate"
                      >
                        {job.streamUrl}
                      </a>
                      <CopyButton text={job.streamUrl} />
                      <a href={job.streamUrl} target="_blank" rel="noopener noreferrer" title="Yeni sekmede aç">
                        <ExternalLink className="h-3.5 w-3.5 text-[#555] hover:text-primary transition-colors" />
                      </a>
                    </div>
                  ) : job.status === "failed" && job.error ? (
                    <p className="text-xs text-red-400/80 truncate" title={job.error}>{job.error}</p>
                  ) : null}
                </div>

                {/* Yeniden dene butonu */}
                {(job.status === "failed" || job.status === "skipped") && (
                  <button
                    onClick={() => retry(job.id)}
                    disabled={retrying === job.id}
                    title="Yeniden dene"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-[#2a2a2a] rounded-lg text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50"
                  >
                    {retrying === job.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RotateCcw className="h-3.5 w-3.5" />}
                    Tekrar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
