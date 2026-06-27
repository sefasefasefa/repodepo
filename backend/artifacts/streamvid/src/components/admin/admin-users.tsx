import { useState } from "react";
import { useListUsers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Search, Ban, CheckCircle, ChevronLeft, ChevronRight, Edit2, X, Check, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const ROLES = ["user","creator","moderator","admin"];

interface EditState {
  userId: number;
  username: string;
  displayName: string;
  email: string;
  password: string;
}

export function AdminUsers() {
  const { token } = useAuth() as any;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [banAction, setBanAction] = useState<{ userId: number; isBanned: boolean } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaved, setEditSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data, isLoading } = useListUsers({ page, limit: 20, role: roleFilter || undefined } as any);
  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const handleBan = async () => {
    if (!banAction) return;
    const { userId, isBanned } = banAction;
    if (isBanned) {
      await fetch(`/api/admin/users/${userId}/unban`, { method: "POST", headers });
    } else {
      await fetch(`/api/admin/users/${userId}/ban`, { method: "POST", headers, body: JSON.stringify({ reason: banReason.trim() || "Kural ihlali" }) });
    }
    setBanAction(null); setBanReason("");
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const handleRoleChange = async (userId: number, role: string) => {
    await fetch(`/api/admin/users/${userId}/role`, { method: "PATCH", headers, body: JSON.stringify({ role }) });
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const openEdit = (u: any) => {
    setEditState({ userId: u.id, username: u.username, displayName: u.displayName || "", email: u.email || "", password: "" });
    setEditError(null);
    setEditSaved(false);
    setShowPassword(false);
  };

  const handleEditSave = async () => {
    if (!editState) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const body: any = {
        username: editState.username.trim(),
        displayName: editState.displayName.trim(),
        email: editState.email.trim(),
      };
      if (editState.password) body.password = editState.password;
      const r = await fetch(`/api/admin/users/${editState.userId}/edit`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setEditError(d.error ?? `Kayıt başarısız (${r.status})`); return; }
      setEditSaved(true);
      setTimeout(() => {
        setEditState(null);
        setEditSaved(false);
      }, 1000);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch {
      setEditError("Sunucuya bağlanılamadı.");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Kullanıcı Yönetimi</h1>
        <span className="text-sm text-[#666]">{total} kullanıcı</span>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kullanıcı ara..." className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-primary" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
          <option value="">Tüm Roller</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i) => <div key={i} className="h-14 bg-[#1e1e1e] rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#222] text-[#888] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Kullanıcı</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3">Rol</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Durum</th>
                <th className="text-right px-4 py-3">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {users.filter(u => !search || u.username.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())).map(u => (
                <tr key={u.id} className="hover:bg-[#1e1e1e] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {u.username.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-[#ddd]">{u.displayName || u.username}</p>
                        <p className="text-xs text-[#555]">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[#888]">{u.email}</td>
                  <td className="px-4 py-3">
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} className="bg-[#252525] border border-[#333] rounded px-2 py-1 text-xs text-white focus:outline-none">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", (u as any).isBanned ? "bg-red-900/40 text-red-400" : "bg-green-900/40 text-green-400")}>
                      {(u as any).isBanned ? "Yasaklı" : "Aktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded hover:bg-blue-900/30 text-[#666] hover:text-blue-400 transition-colors"
                        title="Düzenle"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setBanAction({ userId: u.id, isBanned: !!(u as any).isBanned })} className={cn("p-1.5 rounded transition-colors", (u as any).isBanned ? "hover:bg-green-900/30 text-[#666] hover:text-green-400" : "hover:bg-red-900/30 text-[#666] hover:text-red-400")}>
                        {(u as any).isBanned ? <CheckCircle className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
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
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-1.5 rounded hover:bg-[#222] disabled:opacity-30 text-[#888]"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm text-[#888]">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-[#222] disabled:opacity-30 text-[#888]"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}

      {banAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base">
              {banAction.isBanned ? "Yasağı Kaldır" : "Kullanıcıyı Yasakla"}
            </h3>
            {!banAction.isBanned && (
              <div>
                <label className="text-xs text-[#666] block mb-1.5">Yasaklama Nedeni</label>
                <input value={banReason} onChange={e => setBanReason(e.target.value)}
                  placeholder="Kural ihlali"
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50" />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setBanAction(null); setBanReason(""); }}
                className="px-4 py-2 rounded-xl text-sm bg-[#2a2a2a] text-[#aaa] hover:bg-[#333] transition-colors">
                İptal
              </button>
              <button onClick={handleBan}
                className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                  banAction.isBanned ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30")}>
                {banAction.isBanned ? "Yasağı Kaldır" : "Yasakla"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" /> Kullanıcı Düzenle
              </h3>
              <button onClick={() => setEditState(null)} className="text-[#555] hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {editError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{editError}</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#666] block mb-1.5">Kullanıcı Adı</label>
                <input
                  value={editState.username}
                  onChange={e => setEditState(s => s ? { ...s, username: e.target.value } : s)}
                  placeholder="kullaniciadi"
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-[#666] block mb-1.5">Görünen Ad</label>
                <input
                  value={editState.displayName}
                  onChange={e => setEditState(s => s ? { ...s, displayName: e.target.value } : s)}
                  placeholder="Görünen Ad"
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-[#666] block mb-1.5">E-posta</label>
                <input
                  value={editState.email}
                  onChange={e => setEditState(s => s ? { ...s, email: e.target.value } : s)}
                  placeholder="ornek@mail.com"
                  type="email"
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-[#666] block mb-1.5">
                  Yeni Şifre <span className="text-[#444]">(boş bırakırsan değişmez)</span>
                </label>
                <div className="relative">
                  <input
                    value={editState.password}
                    onChange={e => setEditState(s => s ? { ...s, password: e.target.value } : s)}
                    type={showPassword ? "text" : "password"}
                    placeholder="Yeni şifre gir..."
                    className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#aaa] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setEditState(null)}
                className="px-4 py-2 rounded-xl text-sm bg-[#2a2a2a] text-[#aaa] hover:bg-[#333] transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving || editSaved}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-60",
                  editSaved ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary hover:bg-primary/30"
                )}
              >
                {editSaving ? "Kaydediliyor..." : editSaved ? <><Check className="h-3.5 w-3.5" /> Kaydedildi!</> : <><Check className="h-3.5 w-3.5" /> Kaydet</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
