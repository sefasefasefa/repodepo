import { useState, useEffect } from "react";
import { Eye, Users, PieChart, Link2, Loader2, RefreshCw, Repeat2, SkipForward, Pause } from "lucide-react";

async function pulseFetch(path: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

interface TopWatchedVideo {
  videoId: number;
  title: string;
  thumbnailUrl: string | null;
  category: string | null;
  creator: string | null;
  viewers: number;
  avgCompletion: number;
  totalSessions: number;
  avgPause: number;
  avgSeek: number;
}

interface StickyVideo {
  videoId: number;
  title: string;
  totalReplays: number;
  replayers: number;
}

interface CoWatchedPair {
  videoA: { id: number; title: string };
  videoB: { id: number; title: string };
  sharedViewers: number;
  engagementScore: number;
}

interface CompletionBuckets {
  "0_25": number;
  "25_50": number;
  "50_75": number;
  "75_100": number;
}

interface WatchInsights {
  totalWatchRecords: number;
  uniqueViewers: number;
  avgCompletionRate: number;
  avgPauseCount: number;
  avgSeekCount: number;
  avgReplayCount: number;
  replayRate: number;
  totalSessions: number;
  completionBuckets: CompletionBuckets;
  topWatchedVideos: TopWatchedVideo[];
  stickyVideos: StickyVideo[];
  topCoWatchedPairs: CoWatchedPair[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-[#161616] border border-[#1e1e1e] rounded-xl p-4 flex items-center gap-3">
      <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-[#888]">{label}</p>
        {sub && <p className="text-[10px] text-[#555] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function BucketBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-[#888] w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-[#1e1e1e] rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[#aaa] w-10 text-right">{pct}%</span>
      <span className="text-[#555] w-10 text-right">{count.toLocaleString("tr")}</span>
    </div>
  );
}

export default function AdminWatchInsights() {
  const [data, setData] = useState<WatchInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    pulseFetch("/admin/watch-insights")
      .then(setData)
      .catch(() => setError("Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-red-400 py-10 text-center">{error || "Veri bulunamadı."}</p>;
  }

  const totalBucket = Object.values(data.completionBuckets).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> İzleme Analitiği
          </h2>
          <p className="text-xs text-[#888] mt-1">
            Kullanıcıların izleme geçmişinden üretilen içgörüler — ilgili video önerilerinin
            işbirlikçi filtreleme sinyalinin hangi verilere dayandığını gösterir.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white border border-[#1e1e1e] hover:border-[#333] rounded-lg px-3 py-1.5 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Yenile
        </button>
      </div>

      {/* Primary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Eye}    label="Toplam İzleme Kaydı"     value={data.totalWatchRecords.toLocaleString("tr")} />
        <StatCard icon={Users}  label="Benzersiz İzleyici"       value={data.uniqueViewers.toLocaleString("tr")} />
        <StatCard icon={PieChart} label="Ort. Tamamlama Oranı"  value={`%${data.avgCompletionRate}`} />
        <StatCard icon={RefreshCw} label="Toplam Seans"          value={data.totalSessions.toLocaleString("tr")}
          sub="benzersiz izleme oturumu" />
      </div>

      {/* Engagement signals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Pause}      label="Ort. Duraklama / Seans" value={data.avgPauseCount}
          sub="0 = veri henüz gelmiyor" />
        <StatCard icon={SkipForward} label="Ort. İleri-Geri Sarma"  value={data.avgSeekCount} />
        <StatCard icon={Repeat2}    label="Ort. Tekrar İzleme"      value={data.avgReplayCount} />
        <StatCard icon={Eye}        label="Tekrar İzleme Oranı"     value={`%${data.replayRate}`}
          sub="en az 1 kez tekrarlayan" />
      </div>

      {/* Completion depth buckets */}
      <div className="bg-[#161616] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">İzleme Derinliği Dağılımı</h3>
        <p className="text-xs text-[#666]">
          Hangi tamamlama oranı diliminde kaç izleyici kalıyor — işbirlikçi filtreleme için
          yüksek tamamlama oranı ağırlıklı çiftler daha güçlü sinyal üretir.
        </p>
        <div className="space-y-2.5 pt-1">
          <BucketBar label="0–25%"   count={data.completionBuckets["0_25"]}  total={totalBucket} color="bg-red-500/70" />
          <BucketBar label="25–50%"  count={data.completionBuckets["25_50"]} total={totalBucket} color="bg-orange-400/70" />
          <BucketBar label="50–75%"  count={data.completionBuckets["50_75"]} total={totalBucket} color="bg-yellow-400/70" />
          <BucketBar label="75–100%" count={data.completionBuckets["75_100"]} total={totalBucket} color="bg-green-400/70" />
        </div>
      </div>

      {/* Top watched videos — enriched */}
      <div className="bg-[#161616] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e1e]">
          <h3 className="text-sm font-semibold text-white">En Çok İzlenen Videolar</h3>
        </div>
        {data.topWatchedVideos.length === 0 ? (
          <p className="text-xs text-[#666] px-4 py-6 text-center">Henüz izleme verisi yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#888] text-xs border-b border-[#1e1e1e]">
                  <th className="px-4 py-2 font-medium">Video</th>
                  <th className="px-4 py-2 font-medium">Kategori</th>
                  <th className="px-4 py-2 font-medium">Kanal</th>
                  <th className="px-4 py-2 font-medium text-right">İzleyici</th>
                  <th className="px-4 py-2 font-medium text-right">Seans</th>
                  <th className="px-4 py-2 font-medium text-right">Ort. %</th>
                  <th className="px-4 py-2 font-medium text-right">Ort. Dur.</th>
                  <th className="px-4 py-2 font-medium text-right">Ort. Sar.</th>
                </tr>
              </thead>
              <tbody>
                {data.topWatchedVideos.map(v => (
                  <tr key={v.videoId} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#1a1a1a]">
                    <td className="px-4 py-2 text-white max-w-xs truncate">{v.title}</td>
                    <td className="px-4 py-2 text-[#aaa]">{v.category || "—"}</td>
                    <td className="px-4 py-2 text-[#aaa]">{v.creator || "—"}</td>
                    <td className="px-4 py-2 text-right text-[#ccc]">{v.viewers}</td>
                    <td className="px-4 py-2 text-right text-[#ccc]">{v.totalSessions}</td>
                    <td className="px-4 py-2 text-right text-[#ccc]">%{v.avgCompletion}</td>
                    <td className="px-4 py-2 text-right text-[#aaa]">{v.avgPause}</td>
                    <td className="px-4 py-2 text-right text-[#aaa]">{v.avgSeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sticky videos */}
      {data.stickyVideos.length > 0 && (
        <div className="bg-[#161616] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center gap-2">
            <Repeat2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-white">En Çok Tekrar İzlenen Videolar</h3>
          </div>
          <p className="text-xs text-[#666] px-4 pt-2">
            Yüksek tekrar sayısı içeriğin "yapışkan" olduğunu gösterir — öneri algoritması için güçlü bir sinyal.
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#888] text-xs border-b border-[#1e1e1e]">
                  <th className="px-4 py-2 font-medium">Video</th>
                  <th className="px-4 py-2 font-medium text-right">Toplam Tekrar</th>
                  <th className="px-4 py-2 font-medium text-right">Tekrarlayan Kullanıcı</th>
                </tr>
              </thead>
              <tbody>
                {data.stickyVideos.map(v => (
                  <tr key={v.videoId} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#1a1a1a]">
                    <td className="px-4 py-2 text-white max-w-xs truncate">{v.title}</td>
                    <td className="px-4 py-2 text-right text-primary font-semibold">{v.totalReplays}</td>
                    <td className="px-4 py-2 text-right text-[#ccc]">{v.replayers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Co-watched pairs — now with engagement score */}
      <div className="bg-[#161616] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Birlikte En Çok İzlenen Video Çiftleri</h3>
        </div>
        <p className="text-xs text-[#666] px-4 pt-2">
          Aynı kullanıcılar tarafından izlenen çiftler — skor tamamlama oranı ile ağırlıklandırılmıştır;
          skor ne kadar yüksekse "gerçekten izlenmiş" bir bağlantıyı temsil eder.
        </p>
        {data.topCoWatchedPairs.length === 0 ? (
          <p className="text-xs text-[#666] px-4 py-6 text-center">Henüz yeterli ortak izleme verisi yok.</p>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#888] text-xs border-b border-[#1e1e1e]">
                  <th className="px-4 py-2 font-medium">Video A</th>
                  <th className="px-4 py-2 font-medium">Video B</th>
                  <th className="px-4 py-2 font-medium text-right">Ortak İzleyici</th>
                  <th className="px-4 py-2 font-medium text-right">Etkileşim Skoru</th>
                </tr>
              </thead>
              <tbody>
                {data.topCoWatchedPairs.map((p, i) => (
                  <tr key={i} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#1a1a1a]">
                    <td className="px-4 py-2 text-white max-w-xs truncate">{p.videoA.title}</td>
                    <td className="px-4 py-2 text-white max-w-xs truncate">{p.videoB.title}</td>
                    <td className="px-4 py-2 text-right text-[#ccc]">{p.sharedViewers}</td>
                    <td className="px-4 py-2 text-right text-primary font-semibold">{p.engagementScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
