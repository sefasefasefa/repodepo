import { useState, useEffect, useCallback } from "react";
import { Crown, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Search, Settings2, Save, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type AppStatus = "pending" | "approved" | "denied";

const STATUS_FILTERS = [
  { value: "", label: "Tümü" },
  { value: "pending", label: "Bekleyen" },
  { value: "approved", label: "Onaylı" },
  { value: "denied", label: "Reddedilmiş" },
];

function StatusBadge({ status }: { status: AppStatus }) {
  const cfg: Record<AppStatus, { icon: any; label: string; cls: string }> = {
    pending:  { icon: Clock,        label: "Bekliyor",   cls: "bg-yellow-900/30 text-yellow-400" },
    approved: { icon: CheckCircle,  label: "Onaylandı",  cls: "bg-green-900/30 text-green-400" },
    denied:   { icon: XCircle,      label: "Reddedildi", cls: "bg-red-900/30 text-red-400" },
  };
  const { icon: Icon, label, cls } = cfg[status] ?? cfg.pending;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cls)}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );
}

export function AdminCreators() {
  const token = localStorage.getItem("token");
  const headers: any = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const [tab, setTab] = useState<"applications" | "limits">("applications");
  const [apps, setApps] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewModal, setReviewModal] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const [limitCreatorId, setLimitCreatorId] = useState("");
  const [limitsData, setLimitsData] = useState<any | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsForm, setLimitsForm] = useState({
    maxFileSizeMb: 2048, maxDurationSec: 3600, maxDailyUploads: 5,
    maxResolution: "4K", premiumAllowed: true, ppvAllowed: true, notes: "",
  });

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), ...(statusFilter ? { status: statusFilter } : {}) });
      const res = await fetch(`/api/admin/creator-applications?${params}`, { headers });
      const data = await res.json();
      setApps(data.applications ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { loadApps(); }, [loadApps]);

  const handleReview = async (action: "approve" | "deny") => {
    if (!reviewModal) return;
    await fetch(`/api/admin/creator-applications/${reviewModal.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action, reviewNote }),
    });
    setReviewModal(null);
    setReviewNote("");
    loadApps();
  };

  const loadLimits = async () => {
    if (!limitCreatorId.trim()) return;
    setLimitsLoading(true);
    try {
      const res = await fetch(`/api/admin/creator-limits/${limitCreatorId}`, { headers });
      const data = await res.json();
      if (data.limits) {
        setLimitsData(data.limits);
        setLimitsForm({
          maxFileSizeMb: data.limits.maxFileSizeMb,
          maxDurationSec: data.limits.maxDurationSec,
          maxDailyUploads: data.limits.maxDailyUploads,
          maxResolution: data.limits.maxResolution,
          premiumAllowed: data.limits.premiumAllowed,
          ppvAllowed: data.limits.ppvAllowed,
          notes: data.limits.notes || "",
        });
      } else {
        setLimitsData(null);
      }
    } finally {
      setLimitsLoading(false);
    }
  };

  const saveLimits = async () => {
    if (!limitCreatorId.trim()) return;
    setLimitsSaving(true);
    try {
      await fetch(`/api/admin/creator-limits/${limitCreatorId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(limitsForm),
      });
      await loadLimits();
    } finally {
      setLimitsSaving(false);
    }
  };

  const totalPages = Math.ceil(total / 20);
  const filtered = apps.filter(a => !search || a.applicant?.username?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" /> Yükleyici Yönetimi
        </h1>
        <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1">
          <button onClick={() => setTab("applications")} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition", tab === "applications" ? "bg-primary text-white" : "text-[#888] hover:text-white")}>
            Başvurular
          </button>
          <button onClick={() => setTab("limits")} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition", tab === "limits" ? "bg-primary text-white" : "text-[#888] hover:text-white")}>
            Limitler
          </button>
        </div>
      </div>

      {/* ── BAŞVURULAR ── */}
      {tab === "applications" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kullanıcı ara..."
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
              {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button onClick={loadApps} className="p-2 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] text-[#888] hover:text-white transition">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({length: 5}).map((_, i) => <div key={i} className="h-16 bg-[#1e1e1e] rounded-lg animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#555] text-sm">Başvuru yok</div>
          ) : (
            <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#222] text-[#888] text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Kullanıcı</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">İçerik Türü</th>
                    <th className="text-left px-4 py-3">Durum</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Tarih</th>
                    <th className="text-right px-4 py-3">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {filtered.map(app => (
                    <tr key={app.id} className="hover:bg-[#1e1e1e] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {app.applicant?.username?.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-[#ddd]">@{app.applicant?.username}</p>
                            <p className="text-xs text-[#555]">{app.applicant?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-[#888] max-w-[180px] truncate">{app.contentType || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[#666] text-xs">
                        {new Date(app.createdAt).toLocaleDateString("tr-TR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setReviewModal(app); setReviewNote(app.reviewNote || ""); }}
                            className="px-3 py-1.5 rounded text-xs bg-[#252525] text-[#aaa] hover:bg-[#333] hover:text-white transition">
                            İncele
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-[#222] disabled:opacity-30 text-[#888]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-[#888]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-[#222] disabled:opacity-30 text-[#888]">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── LİMİTLER ── */}
      {tab === "limits" && (
        <div className="space-y-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4 text-[#888]" /> Yükleyici Limitlerini Düzenle
            </h2>
            <div className="flex gap-3">
              <input value={limitCreatorId} onChange={e => setLimitCreatorId(e.target.value)} placeholder="Kullanıcı ID"
                className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white w-40 focus:outline-none focus:border-primary" />
              <button onClick={loadLimits} disabled={limitsLoading}
                className="px-4 py-2 rounded-lg bg-[#252525] border border-[#333] text-sm text-[#aaa] hover:text-white hover:border-primary transition">
                {limitsLoading ? "Yükleniyor..." : "Yükle"}
              </button>
            </div>

            {(limitsData !== null || limitCreatorId) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs text-[#666] mb-1.5 block">Maks. Dosya Boyutu (MB)</label>
                  <input type="number" value={limitsForm.maxFileSizeMb} onChange={e => setLimitsForm(f => ({...f, maxFileSizeMb: Number(e.target.value)}))}
                    className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1.5 block">Maks. Süre (saniye)</label>
                  <input type="number" value={limitsForm.maxDurationSec} onChange={e => setLimitsForm(f => ({...f, maxDurationSec: Number(e.target.value)}))}
                    className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1.5 block">Günlük Yükleme Limiti</label>
                  <input type="number" value={limitsForm.maxDailyUploads} onChange={e => setLimitsForm(f => ({...f, maxDailyUploads: Number(e.target.value)}))}
                    className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1.5 block">Maks. Çözünürlük</label>
                  <select value={limitsForm.maxResolution} onChange={e => setLimitsForm(f => ({...f, maxResolution: e.target.value}))}
                    className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
                    {["480p", "720p", "1080p", "4K"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-[#666] mb-1.5 block">Notlar</label>
                  <input value={limitsForm.notes} onChange={e => setLimitsForm(f => ({...f, notes: e.target.value}))}
                    placeholder="Admin notu (opsiyonel)"
                    className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                </div>
                <div className="sm:col-span-2 flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-[#aaa] cursor-pointer">
                    <input type="checkbox" checked={limitsForm.premiumAllowed} onChange={e => setLimitsForm(f => ({...f, premiumAllowed: e.target.checked}))} className="accent-primary" />
                    Premium video izni
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#aaa] cursor-pointer">
                    <input type="checkbox" checked={limitsForm.ppvAllowed} onChange={e => setLimitsForm(f => ({...f, ppvAllowed: e.target.checked}))} className="accent-primary" />
                    PPV video izni
                  </label>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button onClick={saveLimits} disabled={limitsSaving}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50">
                    <Save className="h-4 w-4" />
                    {limitsSaving ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── İnceleme Modalı ── */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setReviewModal(null)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg">Başvuru İnceleme</h3>
                <p className="text-[#888] text-sm">@{reviewModal.applicant?.username}</p>
              </div>
              <StatusBadge status={reviewModal.status} />
            </div>

            <div className="bg-[#252525] rounded-xl p-4 space-y-3 text-sm">
              <div>
                <p className="text-xs text-[#666] mb-1">İçerik Türü</p>
                <p className="text-[#ddd]">{reviewModal.contentType || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[#666] mb-1">Motivasyon</p>
                <p className="text-[#ddd] whitespace-pre-wrap">{reviewModal.motivation}</p>
              </div>
              {reviewModal.socialLinks && (
                <div>
                  <p className="text-xs text-[#666] mb-1">Sosyal Medya</p>
                  <p className="text-[#ddd]">{reviewModal.socialLinks}</p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-[#666] mb-1.5 block">Admin Notu (opsiyonel)</label>
              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={3}
                placeholder="Onay / red nedeni..."
                className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-primary" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleReview("deny")}
                className="flex-1 py-2.5 rounded-xl bg-red-900/30 text-red-400 text-sm font-medium hover:bg-red-900/50 transition flex items-center justify-center gap-2">
                <XCircle className="h-4 w-4" /> Reddet
              </button>
              <button onClick={() => handleReview("approve")}
                className="flex-1 py-2.5 rounded-xl bg-green-900/30 text-green-400 text-sm font-medium hover:bg-green-900/50 transition flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" /> Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
