import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Check, X, Flag, AlertTriangle, RefreshCw } from "lucide-react";
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

const STATUS_TABS = [
  { id: "pending", label: "Bekleyen" },
  { id: "reported", label: "Şikayet Edilen" },
  { id: "approved", label: "Onaylanan" },
  { id: "rejected", label: "Reddedilen" },
  { id: "flagged", label: "İşaretlenen" },
];

export default function AdminModeration() {
  const [status, setStatus] = useState("pending");
  const [videos, setVideos] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/admin/moderation/queue?status=${status}&limit=50`),
      apiFetch(`/admin/moderation/stats`),
    ])
      .then(([q, s]) => { setVideos(q.videos || []); setStats(s || {}); })
      .catch(() => { setVideos([]); })
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: number, action: "approve" | "reject" | "flag") => {
    setActing(id);
    try {
      await apiFetch(`/admin/moderation/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ note: noteDrafts[id] || "" }),
      });
      load();
    } catch (e) {
      // sessizce geç
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Video Moderasyon
        </h1>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white px-3 py-1.5 rounded-lg border border-[#2a2a2a] hover:border-primary transition">
          <RefreshCw className="h-3.5 w-3.5" /> Yenile
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_TABS.map(t => (
          <button key={t.id} onClick={() => setStatus(t.id)}
            className={cn("bg-[#1a1a1a] border rounded-xl p-3 text-left transition",
              status === t.id ? "border-primary" : "border-[#2a2a2a] hover:border-[#3a3a3a]")}>
            <p className="text-xs text-[#888]">{t.label}</p>
            <p className="text-xl font-bold text-white">{stats[t.id] ?? "–"}</p>
          </button>
        ))}
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
        {loading ? (
          <p className="p-6 text-sm text-[#666]">Yükleniyor...</p>
        ) : videos.length === 0 ? (
          <p className="p-6 text-sm text-[#666]">Bu kategoride video yok.</p>
        ) : (
          videos.map(v => (
            <div key={v.id} className="p-4 flex flex-col sm:flex-row gap-4">
              <img src={v.thumbnailUrl || "/placeholder.png"} alt="" className="w-full sm:w-32 h-20 object-cover rounded-lg bg-[#222] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-white truncate">{v.title}</p>
                  {v.reportCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-full px-2 py-0.5">
                      <AlertTriangle className="h-3 w-3" /> {v.reportCount} şikayet
                    </span>
                  )}
                  <span className="text-xs text-[#666] px-2 py-0.5 rounded-full border border-[#333]">{v.moderationStatus}</span>
                </div>
                <p className="text-xs text-[#666] mt-1 truncate">{v.description}</p>
                <p className="text-xs text-[#555] mt-1">Yükleyici: {v.creator?.displayName || v.creator?.username || "—"}</p>
                <input value={noteDrafts[v.id] || ""} onChange={e => setNoteDrafts(p => ({ ...p, [v.id]: e.target.value }))}
                  placeholder="Not (opsiyonel)"
                  className="mt-2 w-full max-w-sm bg-[#252525] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary" />
              </div>
              <div className="flex sm:flex-col gap-2 flex-shrink-0">
                <button disabled={acting === v.id} onClick={() => act(v.id, "approve")}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 border border-green-800/40 text-green-400 text-xs hover:bg-green-900/30 transition disabled:opacity-40">
                  <Check className="h-3.5 w-3.5" /> Onayla
                </button>
                <button disabled={acting === v.id} onClick={() => act(v.id, "reject")}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-800/40 text-red-400 text-xs hover:bg-red-900/30 transition disabled:opacity-40">
                  <X className="h-3.5 w-3.5" /> Reddet
                </button>
                <button disabled={acting === v.id} onClick={() => act(v.id, "flag")}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-900/20 border border-yellow-800/40 text-yellow-400 text-xs hover:bg-yellow-900/30 transition disabled:opacity-40">
                  <Flag className="h-3.5 w-3.5" /> İşaretle
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
