import { useEffect, useState } from "react";
import { Plus, Trash2, Play, Pause, StopCircle, RotateCcw, ChevronDown, ChevronUp, TrendingUp, FlaskConical, BarChart2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Variant {
  id: number;
  testId: number;
  name: string;
  description?: string;
  weight: number;
  viewCount: number;
  conversionCount: number;
}

interface ABTest {
  id: number;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "ended";
  createdAt: string;
  variants: Variant[];
}

const STATUS_COLORS: Record<string, string> = {
  draft:  "text-[#888] bg-[#2a2a2a] border-[#333]",
  active: "text-green-400 bg-green-900/20 border-green-500/30",
  paused: "text-amber-400 bg-amber-900/20 border-amber-500/30",
  ended:  "text-[#666] bg-[#1e1e1e] border-[#2a2a2a]",
};

const STATUS_TR: Record<string, string> = {
  draft: "Taslak", active: "Aktif", paused: "Duraklatıldı", ended: "Sonlandı",
};

const token = () => localStorage.getItem("token") ?? "";
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

function conversionRate(v: Variant) {
  if (v.viewCount === 0) return 0;
  return (v.conversionCount / v.viewCount) * 100;
}

function winner(variants: Variant[]): number | null {
  if (variants.length < 2) return null;
  const best = variants.reduce((a, b) => conversionRate(a) > conversionRate(b) ? a : b);
  if (conversionRate(best) === 0) return null;
  return best.id;
}

export default function AdminABTests() {
  const [tests, setTests]     = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving]   = useState(false);

  const [newTest, setNewTest] = useState({ name: "", description: "" });
  const [newVariants, setNewVariants] = useState([
    { name: "Kontrol", description: "", weight: 50 },
    { name: "Varyant A", description: "", weight: 50 },
  ]);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [resetConfirm, setResetConfirm] = useState<number | null>(null);

  useEffect(() => { loadTests(); }, []);

  const loadTests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ab-tests", { headers: headers() });
      if (!res.ok) { setTests([]); return; }
      const data = await res.json();
      setTests(data.tests ?? []);
    } catch { setTests([]); }
    finally { setLoading(false); }
  };

  const createTest = async () => {
    if (!newTest.name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/admin/ab-tests", {
        method: "POST", headers: headers(),
        body: JSON.stringify({ ...newTest, variants: newVariants.filter(v => v.name.trim()) }),
      });
      await loadTests();
      setShowCreate(false);
      setNewTest({ name: "", description: "" });
      setNewVariants([{ name: "Kontrol", description: "", weight: 50 }, { name: "Varyant A", description: "", weight: 50 }]);
    } finally { setSaving(false); }
  };

  const setStatus = async (id: number, status: string) => {
    await fetch(`/api/admin/ab-tests/${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ status }) });
    setTests(prev => prev.map(t => t.id === id ? { ...t, status: status as any } : t));
  };

  const deleteTest = async (id: number) => {
    await fetch(`/api/admin/ab-tests/${id}`, { method: "DELETE", headers: headers() });
    setTests(prev => prev.filter(t => t.id !== id));
    setDeleteConfirm(null);
  };

  const resetStats = async (id: number) => {
    await fetch(`/api/admin/ab-tests/${id}/reset`, { method: "POST", headers: headers() });
    await loadTests();
    setResetConfirm(null);
  };

  const addVariantRow = () =>
    setNewVariants(p => [...p, { name: `Varyant ${String.fromCharCode(64 + p.length)}`, description: "", weight: 50 }]);

  const removeVariantRow = (i: number) => setNewVariants(p => p.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            A/B Testleri
          </h2>
          <p className="text-sm text-[#666] mt-0.5">Farklı varyantları karşılaştırın, en iyi performansı bulun</p>
        </div>
        <button
          onClick={() => setShowCreate(p => !p)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="h-4 w-4" /> Yeni Test
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white">Yeni A/B Testi Oluştur</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Test Adı <span className="text-red-400">*</span></label>
              <input
                value={newTest.name}
                onChange={e => setNewTest(p => ({ ...p, name: e.target.value }))}
                placeholder="örn. homepage-cta-button"
                className="field-input"
              />
              <p className="text-[11px] text-[#555] mt-1">Kod içinde bu ismi kullanacaksınız</p>
            </div>
            <div>
              <label className="field-label">Açıklama</label>
              <input
                value={newTest.description}
                onChange={e => setNewTest(p => ({ ...p, description: e.target.value }))}
                placeholder="Bu testin amacı..."
                className="field-input"
              />
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="field-label mb-0">Varyantlar</label>
              <button onClick={addVariantRow} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Varyant Ekle
              </button>
            </div>
            <div className="space-y-2">
              {newVariants.map((v, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    value={v.name}
                    onChange={e => setNewVariants(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    placeholder="Varyant adı"
                    className="field-input flex-1"
                  />
                  <input
                    value={v.description}
                    onChange={e => setNewVariants(p => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    placeholder="Açıklama (opsiyonel)"
                    className="field-input flex-1"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number" min={1} max={100}
                      value={v.weight}
                      onChange={e => setNewVariants(p => p.map((x, j) => j === i ? { ...x, weight: parseInt(e.target.value) || 50 } : x))}
                      className="field-input w-16 text-center"
                    />
                    <span className="text-xs text-[#666]">%</span>
                  </div>
                  {newVariants.length > 2 && (
                    <button onClick={() => removeVariantRow(i)} className="p-2 text-[#555] hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={createTest} disabled={saving || !newTest.name.trim()}
              className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? "Oluşturuluyor…" : "Oluştur"}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2 bg-[#2a2a2a] hover:bg-[#333] text-[#aaa] text-sm rounded-xl transition-colors">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Tests list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-24 bg-[#1e1e1e] rounded-2xl animate-pulse" />)}
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[#1e1e1e] rounded-2xl">
          <FlaskConical className="h-10 w-10 mx-auto text-[#2a2a2a] mb-3" />
          <p className="text-[#555] font-medium">Henüz A/B testi yok</p>
          <p className="text-xs text-[#444] mt-1">Üstteki "Yeni Test" butonuyla başlayın</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map(test => {
            const isOpen = expanded === test.id;
            const win    = winner(test.variants);
            const total  = test.variants.reduce((s, v) => s + v.viewCount, 0);

            return (
              <div key={test.id} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl overflow-hidden">
                {/* Test header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#222] transition-colors"
                  onClick={() => setExpanded(isOpen ? null : test.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white text-sm">{test.name}</span>
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", STATUS_COLORS[test.status])}>
                        {STATUS_TR[test.status]}
                      </span>
                    </div>
                    {test.description && <p className="text-xs text-[#666] mt-0.5 truncate">{test.description}</p>}
                    <p className="text-xs text-[#444] mt-0.5">{test.variants.length} varyant · {total.toLocaleString()} görüntülenme</p>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {test.status === "draft" && (
                      <button onClick={() => setStatus(test.id, "active")}
                        title="Başlat" className="p-2 rounded-lg text-[#555] hover:text-green-400 hover:bg-green-900/15 transition-colors">
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {test.status === "active" && (
                      <button onClick={() => setStatus(test.id, "paused")}
                        title="Duraklat" className="p-2 rounded-lg text-[#555] hover:text-amber-400 hover:bg-amber-900/15 transition-colors">
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    {test.status === "paused" && (
                      <button onClick={() => setStatus(test.id, "active")}
                        title="Devam Et" className="p-2 rounded-lg text-[#555] hover:text-green-400 hover:bg-green-900/15 transition-colors">
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {(test.status === "active" || test.status === "paused") && (
                      <button onClick={() => setStatus(test.id, "ended")}
                        title="Sonlandır" className="p-2 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/15 transition-colors">
                        <StopCircle className="h-4 w-4" />
                      </button>
                    )}
                    {resetConfirm === test.id ? (
                      <span className="flex items-center gap-1">
                        <span className="text-[10px] text-amber-400">Sıfırla?</span>
                        <button onClick={() => resetStats(test.id)} className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">Evet</button>
                        <button onClick={() => setResetConfirm(null)} className="px-2 py-0.5 rounded text-[10px] bg-[#2a2a2a] text-[#666] hover:bg-[#333]">Hayır</button>
                      </span>
                    ) : (
                      <button onClick={() => setResetConfirm(test.id)}
                        title="İstatistikleri Sıfırla" className="p-2 rounded-lg text-[#555] hover:text-blue-400 hover:bg-blue-900/15 transition-colors">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                    {deleteConfirm === test.id ? (
                      <span className="flex items-center gap-1">
                        <span className="text-[10px] text-red-400">Sil?</span>
                        <button onClick={() => deleteTest(test.id)} className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30">Evet</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 rounded text-[10px] bg-[#2a2a2a] text-[#666] hover:bg-[#333]">Hayır</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeleteConfirm(test.id)}
                        title="Sil" className="p-2 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/15 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <div className="text-[#444]">{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
                  </div>
                </div>

                {/* Variant breakdown */}
                {isOpen && (
                  <div className="border-t border-[#2a2a2a] px-5 pb-5 pt-4 space-y-3">
                    <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <BarChart2 className="h-3.5 w-3.5" /> Varyant Sonuçları
                    </h4>
                    {test.variants.length === 0 && <p className="text-xs text-[#555]">Henüz varyant yok</p>}
                    {test.variants.map(v => {
                      const rate = conversionRate(v);
                      const maxRate = Math.max(...test.variants.map(conversionRate), 1);
                      const isWinner = win === v.id;
                      return (
                        <div key={v.id} className={cn(
                          "rounded-xl p-4 border transition-colors",
                          isWinner
                            ? "bg-green-900/10 border-green-500/20"
                            : "bg-[#161616] border-[#222]"
                        )}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-sm text-white">{v.name}</span>
                                {isWinner && (
                                  <span className="flex items-center gap-1 text-[11px] text-amber-400 font-bold">
                                    <Crown className="h-3 w-3" /> Kazanan
                                  </span>
                                )}
                              </div>
                              {v.description && <p className="text-xs text-[#555] mt-0.5">{v.description}</p>}
                            </div>
                            <span className="text-xs text-[#666] shrink-0">ağırlık: {v.weight}%</span>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="text-center">
                              <p className="text-lg font-bold text-white">{v.viewCount.toLocaleString()}</p>
                              <p className="text-[11px] text-[#666]">Görüntülenme</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-white">{v.conversionCount.toLocaleString()}</p>
                              <p className="text-[11px] text-[#666]">Dönüşüm</p>
                            </div>
                            <div className="text-center">
                              <p className={cn("text-lg font-bold", isWinner ? "text-green-400" : "text-white")}>
                                {rate.toFixed(2)}%
                              </p>
                              <p className="text-[11px] text-[#666]">Dönüşüm Oranı</p>
                            </div>
                          </div>

                          <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-700", isWinner ? "bg-green-400" : "bg-primary")}
                              style={{ width: `${maxRate > 0 ? (rate / maxRate) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Usage hint */}
                    <div className="mt-4 p-3 bg-[#141414] border border-[#232323] rounded-xl">
                      <p className="text-xs text-[#555] font-mono leading-relaxed">
                        <span className="text-[#888]">// Kullanım örneği (React):</span><br />
                        <span className="text-amber-400">const</span> {"{"} variantName {"}"} = <span className="text-blue-400">useABTest</span>(<span className="text-green-400">"{test.name}"</span>);<br />
                        <span className="text-[#555]">// variantName → "{test.variants[0]?.name ?? "Kontrol"}" veya "{test.variants[1]?.name ?? "Varyant A"}"</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Docs card */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[#aaa] mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Nasıl Kullanılır?
        </h3>
        <div className="text-xs text-[#555] font-mono space-y-1 leading-relaxed">
          <p><span className="text-amber-400">import</span> {"{ useABTest, trackABConversion }"} <span className="text-amber-400">from</span> <span className="text-green-400">"@/hooks/use-ab-test"</span>;</p>
          <p className="mt-2"><span className="text-[#888]">// Varyantı al</span></p>
          <p><span className="text-amber-400">const</span> {"{"} variantName {"}"} = <span className="text-blue-400">useABTest</span>(<span className="text-green-400">"test-adı"</span>);</p>
          <p className="mt-2"><span className="text-[#888]">// Dönüşümü kaydet (ör. buton tıklandığında)</span></p>
          <p><span className="text-blue-400">trackABConversion</span>(<span className="text-green-400">"test-adı"</span>);</p>
        </div>
      </div>
    </div>
  );
}
