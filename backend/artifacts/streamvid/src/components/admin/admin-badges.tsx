import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Award, Plus, Trash2, RefreshCw, Users, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Edit2, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth";

const CRITERIA_LABELS: Record<string, string> = {
  manual: "Elle Verilir",
  video_count: "Video Sayısı",
  view_count: "İzlenme",
  follower_count: "Takipçi",
  tip_given: "Bahşiş Gönderir",
  tip_received: "Bahşiş Alır",
  subscriber: "Abonelik",
  verified: "Doğrulanmış",
  creator_role: "Creator Rolü",
  comment_count: "Yorum Sayısı",
  live_stream: "Canlı Yayın",
};

const CRITERIA_OPTIONS = Object.entries(CRITERIA_LABELS);

export function AdminBadges() {
  const { token } = useAuth() as any;
  const [settings, setSettings] = useState<any>(null);
  const [defs, setDefs] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [tab, setTab] = useState<"defs" | "users" | "award">("defs");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoAwarding, setAutoAwarding] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [newBadge, setNewBadge] = useState({
    slug: "", name: "", description: "", icon: "🏅", color: "#a855f7",
    criteria: "manual", threshold: 1, sortOrder: 0,
  });

  const [awardForm, setAwardForm] = useState({ userId: "", badgeId: "", note: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<number | null>(null);
  const [awardMsg, setAwardMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);

  const authHeader = useCallback(() =>
    token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>,
  [token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = authHeader();
      const [s, d, u] = await Promise.all([
        fetch("/api/badges/admin/settings", { headers: h }).then(r => r.json()),
        fetch("/api/badges/admin/definitions", { headers: h }).then(r => r.json()),
        fetch("/api/badges/admin/users", { headers: h }).then(r => r.json()),
      ]);
      setSettings(s.settings ?? null);
      setDefs(d.definitions || []);
      setUserBadges(u.userBadges || []);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  const toggleSystem = async (field: "isActive" | "autoAwardEnabled") => {
    setSaving(true);
    const val = field === "isActive" ? !settings?.isActive : !settings?.autoAwardEnabled;
    const res = await fetch("/api/badges/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ [field]: val }),
    });
    const d = await res.json();
    setSettings(d.settings);
    setSaving(false);
  };

  const createBadge = async () => {
    if (!newBadge.slug || !newBadge.name) return;
    const res = await fetch("/api/badges/admin/definitions", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(newBadge),
    });
    if (res.ok) {
      setShowNewBadge(false);
      setNewBadge({ slug: "", name: "", description: "", icon: "🏅", color: "#a855f7", criteria: "manual", threshold: 1, sortOrder: 0 });
      load();
    }
  };

  const updateBadge = async (id: number) => {
    await fetch(`/api/badges/admin/definitions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    load();
  };

  const deleteBadge = async (id: number) => {
    await fetch(`/api/badges/admin/definitions/${id}`, { method: "DELETE", headers: authHeader() });
    setDeleteConfirm(null);
    load();
  };

  const toggleBadgeEnabled = async (b: any) => {
    await fetch(`/api/badges/admin/definitions/${b.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ isEnabled: !b.isEnabled }),
    });
    load();
  };

  const awardBadge = async () => {
    if (!awardForm.userId || !awardForm.badgeId) return;
    const res = await fetch("/api/badges/admin/award", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ userId: parseInt(awardForm.userId), badgeId: parseInt(awardForm.badgeId), note: awardForm.note }),
    });
    if (res.ok) {
      setAwardForm({ userId: "", badgeId: "", note: "" });
      setAwardMsg({ ok: true, text: "Rozet başarıyla verildi!" });
      setTimeout(() => setAwardMsg(null), 3000);
      load();
    } else {
      const e = await res.json();
      setAwardMsg({ ok: false, text: e.error || "Hata oluştu" });
      setTimeout(() => setAwardMsg(null), 3000);
    }
  };

  const revokeAward = async (id: number) => {
    await fetch(`/api/badges/admin/award/${id}`, { method: "DELETE", headers: authHeader() });
    setRevokeConfirm(null);
    load();
  };

  const autoAward = async () => {
    setAutoAwarding(true);
    try {
      const res = await fetch("/api/badges/admin/auto-award", { method: "POST", headers: authHeader() });
      const d = await res.json();
      setAutoMsg(`Otomatik dağıtım tamamlandı. ${d.awarded} yeni rozet verildi.`);
      setTimeout(() => setAutoMsg(null), 4000);
      load();
    } finally { setAutoAwarding(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="h-6 w-6 animate-spin text-[#555]" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-yellow-500/10">
            <Award className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Rozet Sistemi</h2>
            <p className="text-xs text-[#666]">Kullanıcı rozetlerini yönetin</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-[#1e1e1e] text-[#555] hover:text-white transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Sistem Ayarları */}
      <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#aaa] uppercase tracking-wider">Sistem Durumu</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Rozet Sistemi</p>
            <p className="text-xs text-[#555]">Rozet sistemi aktif olduğunda kullanıcılar rozet kazanabilir ve profillerinde gösterebilir</p>
          </div>
          <button
            onClick={() => toggleSystem("isActive")}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all border",
              settings?.isActive
                ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                : "bg-[#1e1e1e] border-[#333] text-[#666] hover:text-white"
            )}
          >
            {settings?.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {settings?.isActive ? "Aktif" : "Pasif"}
          </button>
        </div>

        {settings?.isActive && (
          <div className="flex items-center justify-between border-t border-[#1e1e1e] pt-4">
            <div>
              <p className="font-medium text-sm">Otomatik Rozet Dağıtımı</p>
              <p className="text-xs text-[#555]">Kullanıcılar kriterlere ulaşınca otomatik rozet kazansın</p>
            </div>
            <button
              onClick={() => toggleSystem("autoAwardEnabled")}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all border",
                settings?.autoAwardEnabled
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                  : "bg-[#1e1e1e] border-[#333] text-[#666] hover:text-white"
              )}
            >
              {settings?.autoAwardEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              {settings?.autoAwardEnabled ? "Aktif" : "Pasif"}
            </button>
          </div>
        )}

        {!settings?.isActive && (
          <div className="flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
            <Award className="h-4 w-4 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-500/80">Rozet sistemi şu an pasif. Kullanıcılar rozetleri göremez ve kazanamaz.</p>
          </div>
        )}
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 bg-[#111] border border-[#1e1e1e] rounded-xl p-1">
        {([
          { id: "defs", label: "Rozet Tanımları", count: defs.length },
          { id: "users", label: "Kullanıcı Rozetleri", count: userBadges.length },
          { id: "award", label: "Elle Ver" },
        ] as any[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
              tab === t.id ? "bg-[#1e1e1e] text-white shadow" : "text-[#555] hover:text-[#aaa]")}>
            {t.label}
            {t.count !== undefined && (
              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]", tab === t.id ? "bg-[#2a2a2a] text-[#aaa]" : "bg-[#1a1a1a] text-[#555]")}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Rozet Tanımları */}
      {tab === "defs" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#888]">{defs.length} rozet tanımı</p>
            <div className="flex gap-2">
              {settings?.isActive && (
                <button onClick={autoAward} disabled={autoAwarding}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all">
                  {autoAwarding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                  Otomatik Dağıt
                </button>
              )}
              <button onClick={() => setShowNewBadge(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all">
                <Plus className="h-3.5 w-3.5" /> Yeni Rozet
              </button>
            </div>
          </div>

          {showNewBadge && (
            <div className="bg-[#161616] border border-primary/20 rounded-2xl p-5 space-y-3">
              <h4 className="font-semibold text-sm text-primary">Yeni Rozet Ekle</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-[#666] block mb-1">Slug *</label>
                  <input value={newBadge.slug} onChange={e => setNewBadge({ ...newBadge, slug: e.target.value })}
                    placeholder="ornek-rozet" className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-xs text-[#666] block mb-1">İsim *</label>
                  <input value={newBadge.name} onChange={e => setNewBadge({ ...newBadge, name: e.target.value })}
                    placeholder="Rozet Adı" className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-xs text-[#666] block mb-1">İkon (emoji)</label>
                  <input value={newBadge.icon} onChange={e => setNewBadge({ ...newBadge, icon: e.target.value })}
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-xs text-[#666] block mb-1">Renk</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={newBadge.color} onChange={e => setNewBadge({ ...newBadge, color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                    <input value={newBadge.color} onChange={e => setNewBadge({ ...newBadge, color: e.target.value })}
                      className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[#666] block mb-1">Açıklama</label>
                  <input value={newBadge.description} onChange={e => setNewBadge({ ...newBadge, description: e.target.value })}
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-xs text-[#666] block mb-1">Kriter</label>
                  <select value={newBadge.criteria} onChange={e => setNewBadge({ ...newBadge, criteria: e.target.value })}
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
                    {CRITERIA_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#666] block mb-1">Eşik Değer</label>
                  <input type="number" value={newBadge.threshold} onChange={e => setNewBadge({ ...newBadge, threshold: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={createBadge} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-all">
                  <Plus className="h-3.5 w-3.5" /> Oluştur
                </button>
                <button onClick={() => setShowNewBadge(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#555] hover:text-white transition-all">
                  İptal
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {defs.map(def => (
              <div key={def.id} className={cn("bg-[#161616] border rounded-xl p-4 transition-all", def.isEnabled ? "border-[#222]" : "border-[#1a1a1a] opacity-60")}>
                {editingId === def.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <input value={editForm.name || def.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="İsim" className="bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                      <input value={editForm.description !== undefined ? editForm.description : def.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Açıklama" className="bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                      <input value={editForm.icon !== undefined ? editForm.icon : def.icon} onChange={e => setEditForm({ ...editForm, icon: e.target.value })}
                        placeholder="İkon" className="bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                      <div className="flex gap-1">
                        <button onClick={() => updateBadge(def.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20">
                          <Check className="h-3 w-3" /> Kaydet
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-2 py-1.5 rounded-lg text-xs text-[#555] hover:text-white">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 border-2"
                      style={{ backgroundColor: def.color + "20", borderColor: def.color + "60" }}>
                      {def.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-white">{def.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1e1e1e] text-[#555]">{def.slug}</span>
                        {!def.isEnabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">Devre dışı</span>}
                      </div>
                      <p className="text-xs text-[#666] mt-0.5">{def.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-2 py-1 rounded-full bg-[#1e1e1e] text-[#666]">{CRITERIA_LABELS[def.criteria]}</span>
                      {def.threshold > 1 && <span className="text-[10px] px-2 py-1 rounded-full bg-[#1e1e1e] text-[#666]">≥{def.threshold.toLocaleString()}</span>}
                      <button onClick={() => { setEditingId(def.id); setEditForm({}); }} className="p-1.5 rounded-lg hover:bg-[#1e1e1e] text-[#555] hover:text-blue-400 transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleBadgeEnabled(def)} className={cn("p-1.5 rounded-lg transition-colors", def.isEnabled ? "hover:bg-[#1e1e1e] text-[#555] hover:text-yellow-400" : "text-yellow-400 hover:bg-yellow-500/10")}>
                        {def.isEnabled ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      </button>
                      {deleteConfirm === def.id ? (
                        <span className="flex items-center gap-1">
                          <span className="text-[10px] text-red-400">Sil?</span>
                          <button onClick={() => deleteBadge(def.id)} className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30">Evet</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 rounded text-[10px] bg-[#2a2a2a] text-[#666] hover:bg-[#333]">Hayır</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(def.id)} className="p-1.5 rounded-lg hover:bg-[#1e1e1e] text-[#555] hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kullanıcı Rozetleri */}
      {tab === "users" && (
        <div className="space-y-3">
          <p className="text-sm text-[#666]">Son 100 rozet dağıtımı</p>
          {userBadges.length === 0 ? (
            <div className="text-center py-12 text-[#555]">
              <Award className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Henüz rozet verilmedi</p>
            </div>
          ) : (
            <div className="space-y-2">
              {userBadges.map((ub: any) => (
                <div key={ub.id} className="bg-[#161616] border border-[#222] rounded-xl p-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 border"
                    style={{ backgroundColor: ub.badge.color + "20", borderColor: ub.badge.color + "40" }}>
                    {ub.badge.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{ub.badge.name}</p>
                      {ub.awardedByAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">Admin</span>}
                    </div>
                    <p className="text-xs text-[#555]">@{ub.user?.username} — {new Date(ub.earnedAt).toLocaleString("tr")}</p>
                    {ub.note && <p className="text-xs text-[#666] italic mt-0.5">"{ub.note}"</p>}
                  </div>
                  {revokeConfirm === ub.id ? (
                    <span className="flex items-center gap-1">
                      <span className="text-[10px] text-red-400">Geri al?</span>
                      <button onClick={() => revokeAward(ub.id)} className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30">Evet</button>
                      <button onClick={() => setRevokeConfirm(null)} className="px-2 py-0.5 rounded text-[10px] bg-[#2a2a2a] text-[#666] hover:bg-[#333]">Hayır</button>
                    </span>
                  ) : (
                    <button onClick={() => setRevokeConfirm(ub.id)} className="p-1.5 rounded-lg text-[#444] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Elle Rozet Ver */}
      {tab === "award" && (
        <div className="space-y-4">
          <p className="text-sm text-[#666]">Belirli bir kullanıcıya elle rozet verin (sistem pasif olsa da çalışır)</p>
          <div className="bg-[#161616] border border-[#222] rounded-2xl p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#666] block mb-1.5">Kullanıcı ID *</label>
                <input type="number" value={awardForm.userId} onChange={e => setAwardForm({ ...awardForm, userId: e.target.value })}
                  placeholder="Kullanıcı ID numarası" className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-xs text-[#666] block mb-1.5">Rozet *</label>
                <select value={awardForm.badgeId} onChange={e => setAwardForm({ ...awardForm, badgeId: e.target.value })}
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50">
                  <option value="">Rozet seçin...</option>
                  {defs.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#666] block mb-1.5">Not (isteğe bağlı)</label>
              <input value={awardForm.note} onChange={e => setAwardForm({ ...awardForm, note: e.target.value })}
                placeholder="Neden bu rozet verildi?" className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={awardBadge}
                disabled={!awardForm.userId || !awardForm.badgeId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <Award className="h-4 w-4" /> Rozet Ver
              </button>
              {awardMsg && (
                <span className={cn("text-xs px-3 py-1.5 rounded-lg border", awardMsg.ok ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
                  {awardMsg.text}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {autoMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm px-4 py-3 rounded-xl shadow-xl">
          {autoMsg}
        </div>
      )}
    </div>
  );
}
