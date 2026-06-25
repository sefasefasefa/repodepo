import { useState, useEffect } from "react";
import {
  AlertTriangle, CheckCircle, RefreshCw, X, MessageSquare,
  Video, User, Clock, ChevronDown, ChevronUp, Flag, StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

const REASON_LABELS: Record<string, string> = {
  spam:            "Spam / Yanıltıcı",
  nudity:          "Uygunsuz İçerik",
  violence:        "Şiddet / Tehdit",
  harassment:      "Taciz / Zorbalık",
  underage:        "Reşit Olmayan",
  copyright:       "Telif Hakkı İhlali",
  misinformation:  "Yanlış Bilgi",
  other:           "Diğer",
};

const REASON_COLORS: Record<string, string> = {
  spam:           "bg-yellow-900/20 text-yellow-400 border-yellow-800/30",
  nudity:         "bg-pink-900/20 text-pink-400 border-pink-800/30",
  violence:       "bg-red-900/20 text-red-400 border-red-800/30",
  harassment:     "bg-orange-900/20 text-orange-400 border-orange-800/30",
  underage:       "bg-purple-900/20 text-purple-400 border-purple-800/30",
  copyright:      "bg-blue-900/20 text-blue-400 border-blue-800/30",
  misinformation: "bg-cyan-900/20 text-cyan-400 border-cyan-800/30",
  other:          "bg-[#222] text-[#888] border-[#2a2a2a]",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  video:   Video,
  comment: MessageSquare,
  user:    User,
};

const TYPE_LABELS: Record<string, string> = {
  video:   "Video",
  comment: "Yorum",
  user:    "Kullanıcı",
};

const STATUS_FILTERS = [
  { value: "all",       label: "Tümü" },
  { value: "pending",   label: "Bekleyen" },
  { value: "resolved",  label: "Çözüldü" },
  { value: "dismissed", label: "Reddedildi" },
];

const TYPE_FILTERS = [
  { value: "all",     label: "Tümü" },
  { value: "video",   label: "Video" },
  { value: "comment", label: "Yorum" },
  { value: "user",    label: "Kullanıcı" },
];

export function AdminReports() {
  const [reports, setReports]     = useState<any[]>([]);
  const [total, setTotal]         = useState(0);
  const [pending, setPending]     = useState(0);
  const [loading, setLoading]     = useState(false);
  const [statusFilter, setStatus] = useState("pending");
  const [typeFilter, setType]     = useState("all");
  const [page, setPage]           = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter   !== "all") params.set("contentType", typeFilter);
      const d = await apiFetch(`/admin/reports?${params}`);
      setReports(d.reports ?? []);
      setTotal(d.total ?? 0);
      setPending(d.pending ?? 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter, typeFilter, page]);

  const updateStatus = async (id: number, status: string, adminNote?: string) => {
    await apiFetch(`/admin/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, adminNote }),
    });
    load();
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-400" /> İçerik Şikayetleri
            {pending > 0 && (
              <span className="text-sm bg-red-900/40 text-red-400 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                {pending} bekliyor
              </span>
            )}
          </h2>
          <p className="text-xs text-[#555] mt-0.5">Toplam {total} şikayet</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] text-[#888] hover:text-white text-sm transition-colors">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Yenile
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-[#111] border border-[#1e1e1e] rounded-xl p-1">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => { setStatus(f.value); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f.value ? "bg-[#1e1e1e] text-white border border-[#2a2a2a]" : "text-[#555] hover:text-[#aaa]")}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#111] border border-[#1e1e1e] rounded-xl p-1">
          {TYPE_FILTERS.map(f => (
            <button key={f.value} onClick={() => { setType(f.value); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                typeFilter === f.value ? "bg-[#1e1e1e] text-white border border-[#2a2a2a]" : "text-[#555] hover:text-[#aaa]")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#1a1a1a] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-[#444] bg-[#111] border border-[#1a1a1a] rounded-2xl">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500/20" />
          <p className="text-sm">Bu filtrede şikayet yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => <ReportRow key={r.id} report={r} onUpdate={updateStatus} />)}
        </div>
      )}

      {/* Sayfalama */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#888] hover:text-white disabled:opacity-30 transition-colors">
            ← Önceki
          </button>
          <span className="text-[#555]">Sayfa {page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#888] hover:text-white disabled:opacity-30 transition-colors">
            Sonraki →
          </button>
        </div>
      )}
    </div>
  );
}

function ReportRow({ report: r, onUpdate }: { report: any; onUpdate: (id: number, status: string, note?: string) => void }) {
  const [expanded, setExpanded]  = useState(false);
  const [note, setNote]          = useState(r.adminNote ?? "");
  const [acting, setActing]      = useState(false);

  const TypeIcon = TYPE_ICONS[r.contentType] ?? Flag;

  const act = async (status: string) => {
    setActing(true);
    await onUpdate(r.id, status, note);
    setActing(false);
  };

  return (
    <div className={cn("bg-[#1a1a1a] border rounded-xl overflow-hidden transition-all",
      r.status === "pending" ? "border-[#2a2a2a]" : "border-[#1e1e1e] opacity-70")}>
      {/* Ana satır */}
      <div className="flex items-start gap-3 p-4">
        {/* Tip ikonu */}
        <div className="w-8 h-8 rounded-lg bg-[#222] flex items-center justify-center shrink-0 mt-0.5">
          <TypeIcon className="h-4 w-4 text-[#666]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* İçerik tipi */}
            <span className="text-[10px] font-bold text-[#555] uppercase tracking-wide">
              {TYPE_LABELS[r.contentType] ?? r.contentType}
              {r.videoId && <span className="ml-1 text-[#444]">#{r.videoId}</span>}
            </span>

            {/* Sebep */}
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              REASON_COLORS[r.reason] ?? REASON_COLORS.other)}>
              {REASON_LABELS[r.reason] ?? r.reason}
            </span>

            {/* Durum */}
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
              r.status === "pending"   ? "bg-yellow-900/20 text-yellow-400" :
              r.status === "resolved"  ? "bg-green-900/20 text-green-400" :
                                         "bg-[#222] text-[#555]")}>
              {r.status === "pending" ? "Bekliyor" : r.status === "resolved" ? "Çözüldü" : "Reddedildi"}
            </span>
          </div>

          {/* Açıklama */}
          {r.description && (
            <p className="text-xs text-[#888] mt-1 leading-relaxed">{r.description}</p>
          )}

          {/* Şikayetçi + zaman */}
          <p className="text-[11px] text-[#555] mt-1.5 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
            <span className="text-[#333]">·</span>
            <span>@{r.reporter?.username}</span>
            {r.adminNote && <span className="text-[#333]">·</span>}
            {r.adminNote && (
              <span className="flex items-center gap-1 text-primary"><StickyNote className="h-2.5 w-2.5" />Not var</span>
            )}
          </p>
        </div>

        {/* Aksiyon butonları */}
        <div className="flex items-center gap-1.5 shrink-0">
          {r.status === "pending" && (
            <>
              <button onClick={() => act("resolved")} disabled={acting}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-900/20 border border-green-800/30 text-green-400 hover:bg-green-900/40 text-xs transition-all disabled:opacity-40">
                <CheckCircle className="h-3.5 w-3.5" /> Çözüldü
              </button>
              <button onClick={() => act("dismissed")} disabled={acting}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#222] border border-[#2a2a2a] text-[#666] hover:text-white text-xs transition-all disabled:opacity-40">
                <X className="h-3.5 w-3.5" /> Reddet
              </button>
            </>
          )}
          {r.status !== "pending" && (
            <button onClick={() => act("pending")} disabled={acting}
              className="px-2.5 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] text-[#555] hover:text-[#aaa] text-xs transition-all">
              Yeniden Aç
            </button>
          )}
          <button onClick={() => setExpanded(p => !p)}
            className="p-1.5 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] text-[#555] hover:text-white transition-colors">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Genişletilmiş — admin notu */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#1e1e1e] pt-3 space-y-2">
          <label className="text-[10px] text-[#555] font-medium uppercase tracking-wide flex items-center gap-1.5">
            <StickyNote className="h-3 w-3" /> Admin Notu
          </label>
          <div className="flex gap-2">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="İç not ekle (kullanıcıya gösterilmez)..."
              className="flex-1 bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#2a2a2a] resize-none"
            />
            <button onClick={() => onUpdate(r.id, r.status, note)} disabled={acting}
              className="px-3 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 text-xs transition-all disabled:opacity-40">
              Kaydet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
