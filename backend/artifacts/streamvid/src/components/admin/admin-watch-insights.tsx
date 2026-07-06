import { useState, useEffect } from "react";
import { Eye, Users, PieChart, Link2, Loader2 } from "lucide-react";

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
}

interface CoWatchedPair {
  videoA: { id: number; title: string };
  videoB: { id: number; title: string };
  sharedViewers: number;
}

interface WatchInsights {
  totalWatchRecords: number;
  uniqueViewers: number;
  avgCompletionRate: number;
  topWatchedVideos: TopWatchedVideo[];
  topCoWatchedPairs: CoWatchedPair[];
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="bg-[#161616] border border-[#1e1e1e] rounded-xl p-4 flex items-center gap-3">
      <div className="p-2.5 bg-primary/10 rounded-lg">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-[#888]">{label}</p>
      </div>
    </div>
  );
}

export default function AdminWatchInsights() {
  const [data, setData] = useState<WatchInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    pulseFetch("/admin/watch-insights")
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError("Veriler yüklenemedi."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" /> İzleme Analitiği
        </h2>
        <p className="text-xs text-[#888] mt-1">
          Kullanıcıların izleme geçmişinden üretilen içgörüler — ilgili video önerilerinin
          (işbirlikçi filtreleme) hangi verilere dayandığını gösterir.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={Eye} label="Toplam İzleme Kaydı" value={data.totalWatchRecords.toLocaleString("tr")} />
        <StatCard icon={Users} label="Benzersiz İzleyici" value={data.uniqueViewers.toLocaleString("tr")} />
        <StatCard icon={PieChart} label="Ortalama Tamamlama Oranı" value={`%${data.avgCompletionRate}`} />
      </div>

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
                  <th className="px-4 py-2 font-medium text-right">Ort. Tamamlama</th>
                </tr>
              </thead>
              <tbody>
                {data.topWatchedVideos.map(v => (
                  <tr key={v.videoId} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#1a1a1a]">
                    <td className="px-4 py-2 text-white max-w-xs truncate">{v.title}</td>
                    <td className="px-4 py-2 text-[#aaa]">{v.category || "—"}</td>
                    <td className="px-4 py-2 text-[#aaa]">{v.creator || "—"}</td>
                    <td className="px-4 py-2 text-right text-[#ccc]">{v.viewers}</td>
                    <td className="px-4 py-2 text-right text-[#ccc]">%{v.avgCompletion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-[#161616] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Birlikte En Çok İzlenen Video Çiftleri</h3>
        </div>
        <p className="text-xs text-[#666] px-4 pt-2">
          Aynı kullanıcılar tarafından izlenen video ikilileri — "ilgili videolar" bölümündeki
          işbirlikçi filtreleme önerilerinin temelini oluşturur.
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
                </tr>
              </thead>
              <tbody>
                {data.topCoWatchedPairs.map((p, i) => (
                  <tr key={i} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#1a1a1a]">
                    <td className="px-4 py-2 text-white max-w-xs truncate">{p.videoA.title}</td>
                    <td className="px-4 py-2 text-white max-w-xs truncate">{p.videoB.title}</td>
                    <td className="px-4 py-2 text-right text-primary font-semibold">{p.sharedViewers}</td>
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
