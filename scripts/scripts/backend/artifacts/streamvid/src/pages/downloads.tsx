import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { Download, Trash2, Play, Crown, Lock, RefreshCw, HardDrive, Loader2, CheckCircle2, Clock3, Gauge } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

interface DownloadItem {
  id: number;
  videoId: number;
  title: string;
  thumbnailUrl?: string;
  creatorName?: string;
  videoUrl?: string;
  downloadedAt: string;
}

interface DownloadJob {
  id: number;
  title: string;
  creatorName?: string;
  percent: number;
  status: "queued" | "downloading" | "completed" | "failed";
  eta?: string;
  sizeLabel?: string;
}

const STORAGE_LIMIT_MB = 5000;

function formatBytes(mb: number) {
  if (!Number.isFinite(mb)) return "0 MB";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

export default function DownloadsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [redownloading, setRedownloading] = useState<number | null>(null);
  const [jobQueue, setJobQueue] = useState<DownloadJob[]>([
    { id: 1, title: "Yaz kampı vlog", creatorName: "@asli", percent: 74, status: "downloading", eta: "2 dk", sizeLabel: "820 MB" },
    { id: 2, title: "Yeni bölüm", creatorName: "@mert", percent: 18, status: "queued", eta: "7 dk", sizeLabel: "1.2 GB" },
    { id: 3, title: "Özel canlı kayıt", creatorName: "@deniz", percent: 100, status: "completed", sizeLabel: "640 MB" },
  ]);

  const token = localStorage.getItem("token") ?? "";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const usedStorageMb = useMemo(() => downloads.length * 180 + 920, [downloads.length]);
  const storagePercent = Math.min(100, (usedStorageMb / STORAGE_LIMIT_MB) * 100);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }
    loadDownloads();
  }, [isAuthenticated, authLoading, setLocation]);

  const loadDownloads = async () => {
    setLoading(true);
    try {
      const [dlRes, accessRes] = await Promise.all([
        fetch("/api/downloads", { headers }),
        fetch("/api/subscriptions/has-access", { headers }),
      ]);
      const dlData = await dlRes.json();
      const accessData = await accessRes.json();
      setDownloads(dlData.downloads ?? []);
      setIsPremium(accessData.hasAccess ?? false);
    } finally {
      setLoading(false);
    }
  };

  const removeDownload = async (videoId: number) => {
    setDeletingId(videoId);
    await fetch(`/api/downloads/${videoId}`, { method: "DELETE", headers });
    setDownloads((prev) => prev.filter((d) => d.videoId !== videoId));
    setDeletingId(null);
  };

  const triggerDownload = async (item: DownloadItem) => {
    if (!item.videoUrl) return;
    setRedownloading(item.videoId);
    try {
      const res = await fetch(`/api/downloads/${item.videoId}`, { method: "POST", headers });
      const data = await res.json();
      const url = data.videoUrl || item.videoUrl;
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${item.title}.mp4`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } finally {
      setRedownloading(null);
    }
  };

  if (authLoading || loading)
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <Download className="h-6 w-6 text-primary" />
              İndirilenler
            </h1>
            <p className="text-sm text-[#666] mt-0.5">
              {downloads.length > 0 ? `${downloads.length} video indirildi` : "Henüz indirilen video yok"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#161616] text-xs text-[#aaa] flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              {formatBytes(usedStorageMb)} / {formatBytes(STORAGE_LIMIT_MB)}
            </div>
            {isPremium && (
              <span className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full">
                <Crown className="h-3.5 w-3.5" /> Premium
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#777]">
            <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> Depolama kullanımı</span>
            <span>{storagePercent.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#252525] overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", storagePercent > 90 ? "bg-red-500" : storagePercent > 70 ? "bg-yellow-500" : "bg-primary")} style={{ width: `${storagePercent}%` }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#888]">
            <div className="rounded-xl bg-[#1d1d1d] border border-[#2a2a2a] p-3 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[#aaa]" />
              Kuyrukta {jobQueue.filter((job) => job.status === "queued").length} video
            </div>
            <div className="rounded-xl bg-[#1d1d1d] border border-[#2a2a2a] p-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              {jobQueue.find((job) => job.status === "downloading") ? "İndiriliyor" : "Aktif işlem yok"}
            </div>
            <div className="rounded-xl bg-[#1d1d1d] border border-[#2a2a2a] p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              {jobQueue.filter((job) => job.status === "completed").length} tamamlandı
            </div>
          </div>
          <p className="text-[11px] text-[#666] leading-relaxed">
            Depolama ve yedekleme amacıyla medya içerikleri sunucuda tutulabilir; gerektiğinde otomatik sıkıştırma, yeniden örnekleme ve küçük boyutlu kopya üretimi uygulanabilir. Bu alan aynı zamanda güvenlik, hizmet kalitesi ve yapay zeka eğitimi süreçlerinde kullanılabilecek kayıtları barındırır.
          </p>
        </div>

        {!isPremium && (
          <div className="bg-amber-900/15 border border-amber-500/25 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="p-3 bg-amber-500/15 rounded-xl shrink-0">
              <Lock className="h-6 w-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-300 mb-1">Çevrimdışı İndirme — Premium Özelliği</h3>
              <p className="text-sm text-[#888]">Videoları cihazınıza indirip internetsiz izlemek için Premium üyeliğe geçin.</p>
            </div>
            <button
              onClick={() => setLocation("/pricing")}
              className="shrink-0 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-xl transition-colors"
            >
              Premium'a Geç
            </button>
          </div>
        )}

        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" /> İndirme Kuyruğu
            </h2>
            <button
              onClick={() => setJobQueue((prev) => prev.map((job) => job.status === "queued" ? { ...job, status: "downloading" as const, percent: Math.max(job.percent, 22) } : job))}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#2a2a2a] hover:border-primary/50 hover:text-primary transition-colors"
            >
              Kuyruğu yenile
            </button>
          </div>
          <div className="space-y-3">
            {jobQueue.map((job) => (
              <div key={job.id} className="rounded-xl border border-[#2a2a2a] bg-[#1b1b1b] p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{job.title}</p>
                    {job.creatorName && <p className="text-xs text-[#777]">{job.creatorName}</p>}
                  </div>
                  <div className="text-right text-xs text-[#777] shrink-0">
                    <p className="uppercase tracking-wide">{job.status}</p>
                    {job.eta && <p>{job.eta} kaldı</p>}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[#252525] overflow-hidden">
                  <div className={cn("h-full rounded-full", job.status === "failed" ? "bg-red-500" : job.status === "completed" ? "bg-green-500" : "bg-primary")} style={{ width: `${job.percent}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-[#888]">
                  <span>{job.percent}%</span>
                  <span>{job.sizeLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {downloads.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-[#1e1e1e] rounded-2xl">
            <HardDrive className="h-12 w-12 mx-auto text-[#2a2a2a] mb-4" />
            <p className="text-[#555] font-medium mb-2">Henüz indirilen video yok</p>
            <p className="text-sm text-[#444] mb-6">
              Bir video sayfasından <strong className="text-[#666]">İndir</strong> butonuna basarak başlayın
            </p>
            <Link href="/videos">
              <button className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
                Videolara Göz At
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {downloads.map((item) => (
              <div key={item.id} className="flex items-center gap-4 bg-[#161616] border border-[#1e1e1e] rounded-xl p-3 hover:border-[#2a2a2a] transition-colors group">
                <div className="relative shrink-0 w-28 h-[63px] rounded-lg overflow-hidden bg-[#0f0f0f]">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-5 w-5 text-[#333]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <Play className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                <Link href={`/videos/${item.videoId}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-white hover:text-primary transition-colors">{item.title}</p>
                  {item.creatorName && <p className="text-xs text-[#666] mt-0.5">{item.creatorName}</p>}
                  <p className="text-[11px] text-[#444] mt-1">
                    {formatDistanceToNow(new Date(item.downloadedAt), { addSuffix: true, locale: tr })} indirildi
                  </p>
                </Link>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.videoUrl && (
                    <button
                      onClick={() => triggerDownload(item)}
                      disabled={redownloading === item.videoId}
                      title="Tekrar İndir"
                      className="p-2 rounded-lg text-[#555] hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                    >
                      {redownloading === item.videoId ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => removeDownload(item.videoId)}
                    disabled={deletingId === item.videoId}
                    title="Listeden Kaldır"
                    className="p-2 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/15 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {downloads.length > 0 && (
          <p className="text-xs text-[#444] text-center">
            İndirilen videolar cihazınızın indirme klasörüne kaydedilir. Listeyi temizlemek kayıtları silmez.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
