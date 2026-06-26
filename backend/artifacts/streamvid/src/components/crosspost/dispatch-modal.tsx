import { useEffect, useState } from "react";
import {
  Share2, Loader2, Check, AlertTriangle, ExternalLink, X, CheckSquare, Square,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface Site {
  id: number;
  name: string;
  providerKey: string;
  providerColor: string;
  providerLetter: string;
  enabled: boolean;
}

interface DispatchedJob {
  id: number;
  siteName: string;
  status: string;
  streamUrl?: string;
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
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [result, setResult] = useState<DispatchedJob[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cross-post/sites", {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    })
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
        // Varsayılan olarak etkin olanları seç
        setSelected(new Set(list.filter(s => s.enabled).map(s => s.id)));
      })
      .catch(() => {})
      .finally(() => setLoadingSites(false));
  }, [token]);

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(sites.map(s => s.id)));
  const clearAll = () => setSelected(new Set());

  const dispatch = async () => {
    if (selected.size === 0) return;
    setDispatching(true);
    setError("");
    try {
      const res = await fetch("/api/cross-post/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ videoId, siteIds: [...selected] }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Gönderilemedi"); return; }
      setResult(
        (d.jobs ?? []).map((j: any) => ({
          id: j.id,
          siteName: j.siteName ?? j.site_name ?? "",
          status: j.status,
          streamUrl: j.streamUrl ?? j.stream_url ?? "",
        }))
      );
    } catch {
      setError("Sunucu hatası");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0f0f0f] border border-[#222] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Share2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Crosspost Gönder</p>
              <p className="text-xs text-[#555] truncate max-w-[280px]">{videoTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Başarı sonucu */}
        {result ? (
          <div className="p-5 space-y-3">
            <p className="text-sm font-medium text-white mb-4">
              {result.length} göreve yükleme başlatıldı →{" "}
              <a href="/crosspost-jobs" className="text-primary hover:underline inline-flex items-center gap-1">
                Görevleri İzle <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {result.map(job => (
                <div key={job.id} className="flex items-center justify-between bg-[#161616] border border-[#222] rounded-lg px-3 py-2 text-sm">
                  <span className="text-[#ccc]">{job.siteName}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    job.status === "success" ? "bg-green-400/10 text-green-400" :
                    job.status === "failed"  ? "bg-red-400/10 text-red-400" :
                    "bg-primary/10 text-primary"
                  }`}>
                    {job.status === "success" ? "✓ Başarılı" :
                     job.status === "failed"  ? "✕ Başarısız" : "⟳ Kuyrukta"}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-full mt-2 py-2.5 bg-[#161616] border border-[#2a2a2a] rounded-xl text-sm text-[#aaa] hover:text-white transition-colors"
            >
              Kapat
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Site listesi */}
            {loadingSites ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#555]" />
              </div>
            ) : sites.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <Share2 className="h-10 w-10 mx-auto text-[#333]" />
                <p className="text-sm text-[#666]">Henüz crosspost sitesi eklenmemiş.</p>
                <a href="/upload" className="inline-block text-xs text-primary hover:underline">
                  Upload sayfasından sağlayıcı ekle →
                </a>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-[#555]">
                  <span>{selected.size} / {sites.length} seçili</span>
                  <div className="flex gap-3">
                    <button onClick={selectAll} className="hover:text-white transition-colors">Tümünü seç</button>
                    <span>·</span>
                    <button onClick={clearAll} className="hover:text-white transition-colors">Temizle</button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {sites.map(site => {
                    const isSelected = selected.has(site.id);
                    return (
                      <button
                        key={site.id}
                        onClick={() => toggle(site.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                          isSelected
                            ? "bg-primary/8 border-primary/30"
                            : "bg-[#161616] border-[#222] hover:border-[#333]"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
                          style={{ backgroundColor: site.providerColor }}
                        >
                          {site.providerLetter}
                        </div>
                        <span className={`flex-1 text-sm font-medium ${isSelected ? "text-white" : "text-[#aaa]"}`}>
                          {site.name}
                        </span>
                        {!site.enabled && (
                          <span className="text-[10px] text-[#555] border border-[#2a2a2a] px-1.5 py-0.5 rounded">
                            Devre dışı
                          </span>
                        )}
                        {isSelected
                          ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          : <Square className="h-4 w-4 text-[#444] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
              </p>
            )}

            {sites.length > 0 && (
              <div className="flex gap-3 pt-1">
                <button
                  onClick={dispatch}
                  disabled={dispatching || selected.size === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {dispatching
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor…</>
                    : <><Check className="h-4 w-4" /> {selected.size} Siteye Gönder</>}
                </button>
                <button
                  onClick={onClose}
                  className="px-5 border border-[#2a2a2a] text-[#888] hover:text-white rounded-xl text-sm transition-colors"
                >
                  İptal
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
