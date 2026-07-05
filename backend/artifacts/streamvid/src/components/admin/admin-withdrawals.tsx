import { useState, useEffect, useCallback } from "react";
import { Wallet, Check, X, RefreshCw } from "lucide-react";
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

const STATUS_FILTERS = [
  { id: "all", label: "Tümü" },
  { id: "pending", label: "Bekleyen" },
  { id: "approved", label: "Onaylanan" },
  { id: "rejected", label: "Reddedilen" },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-900/20 border-yellow-800/40",
  approved: "text-green-400 bg-green-900/20 border-green-800/40",
  rejected: "text-red-400 bg-red-900/20 border-red-800/40",
};

export default function AdminWithdrawals() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [acting, setActing] = useState<number | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/admin/withdrawals`)
      .then(d => setRequests(d.requests || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const process = async (id: number, status: "approved" | "rejected") => {
    setActing(id);
    try {
      await apiFetch(`/admin/withdrawals/${id}/process`, {
        method: "POST",
        body: JSON.stringify({ status, adminNote: noteDrafts[id] || "" }),
      });
      load();
    } catch (e) {
      // sessizce geç
    } finally {
      setActing(null);
    }
  };

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;
  const totalUsd = requests.filter(r => r.status === "pending").reduce((s, r) => s + (r.usdAmount || 0), 0);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Para Çekme Talepleri
        </h1>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white px-3 py-1.5 rounded-lg border border-[#2a2a2a] hover:border-primary transition">
          <RefreshCw className="h-3.5 w-3.5" /> Yenile
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#888]">Bekleyen Talep</p>
          <p className="text-2xl font-bold text-white">{pendingCount}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#888]">Bekleyen Toplam Tutar</p>
          <p className="text-2xl font-bold text-white">${totalUsd.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={cn("px-3 py-1.5 rounded-lg text-xs border transition",
              filter === f.id ? "border-primary text-primary bg-primary/10" : "border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a]")}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
        {loading ? (
          <p className="p-6 text-sm text-[#666]">Yükleniyor...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-[#666]">Talep bulunamadı.</p>
        ) : (
          filtered.map(r => (
            <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-white">{r.creator?.displayName || r.creator?.username || `Kullanıcı #${r.creatorId}`}</p>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", STATUS_STYLES[r.status] || "text-[#888] border-[#333]")}>{r.status}</span>
                </div>
                <p className="text-xs text-[#666] mt-1">
                  {r.tokenAmount} token · ${Number(r.usdAmount).toFixed(2)} · {r.method} · {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                </p>
                {r.status === "pending" && (
                  <input value={noteDrafts[r.id] || ""} onChange={e => setNoteDrafts(p => ({ ...p, [r.id]: e.target.value }))}
                    placeholder="Admin notu (opsiyonel)"
                    className="mt-2 w-full max-w-sm bg-[#252525] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary" />
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2 flex-shrink-0">
                  <button disabled={acting === r.id} onClick={() => process(r.id, "approved")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 border border-green-800/40 text-green-400 text-xs hover:bg-green-900/30 transition disabled:opacity-40">
                    <Check className="h-3.5 w-3.5" /> Onayla
                  </button>
                  <button disabled={acting === r.id} onClick={() => process(r.id, "rejected")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-800/40 text-red-400 text-xs hover:bg-red-900/30 transition disabled:opacity-40">
                    <X className="h-3.5 w-3.5" /> Reddet
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
