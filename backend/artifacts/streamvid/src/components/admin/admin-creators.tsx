import { useState } from "react";
import { Crown, Settings2, Save } from "lucide-react";

export function AdminCreators() {
  const token = localStorage.getItem("token");
  const headers: any = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const [limitCreatorId, setLimitCreatorId] = useState("");
  const [limitsData, setLimitsData] = useState<any | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsForm, setLimitsForm] = useState({
    maxFileSizeMb: 2048, maxDurationSec: 3600, maxDailyUploads: 5,
    maxResolution: "4K", premiumAllowed: true, ppvAllowed: true, notes: "",
  });

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
      await fetch(`/api/admin/creator-limits/${limitCreatorId}/set`, {
        method: "POST",
        headers,
        body: JSON.stringify(limitsForm),
      });
      await loadLimits();
    } finally {
      setLimitsSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" /> Yükleyici Limitleri
        </h1>
      </div>

      <div className="space-y-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <Settings2 className="h-4 w-4 text-[#888]" /> Yükleyici Limitlerini Düzenle
          </h2>
          <p className="text-xs text-[#666]">Creator başvurularını incelemek için "Creator Başvuruları" menüsünü kullanın.</p>
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
    </div>
  );
}
