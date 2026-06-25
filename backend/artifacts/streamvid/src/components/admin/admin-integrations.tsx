import { useState, useEffect } from "react";
import {
  Plus, Trash2, RefreshCw, Link2, Upload,
  ToggleLeft, ToggleRight, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  { id: "streamtape",  name: "Streamtape",  color: "text-orange-400", bg: "bg-orange-900/20", logo: "ST", fields: ["login", "key"],    docs: "https://streamtape.com/account" },
  { id: "doodstream",  name: "Doodstream",  color: "text-blue-400",   bg: "bg-blue-900/20",   logo: "DS", fields: ["apiKey"],          docs: "https://doodstream.com/api-docs" },
  { id: "mixdrop",     name: "Mixdrop",     color: "text-purple-400", bg: "bg-purple-900/20", logo: "MX", fields: ["email", "apiKey"], docs: "https://mixdrop.ag/api" },
  { id: "streamlare",  name: "Streamlare",  color: "text-green-400",  bg: "bg-green-900/20",  logo: "SL", fields: ["apiKey"],          docs: "https://streamlare.com" },
  { id: "vidoza",      name: "Vidoza",      color: "text-red-400",    bg: "bg-red-900/20",    logo: "VZ", fields: ["apiKey"],          docs: "https://vidoza.net" },
  { id: "filemoon",    name: "Filemoon",    color: "text-yellow-400", bg: "bg-yellow-900/20", logo: "FM", fields: ["apiKey"],          docs: "https://filemoon.sx" },
];

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
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

const EMPTY_FORM = {
  platform: "streamtape", name: "", login: "", key: "", apiKey: "", email: "", autoUpload: true,
};

export function AdminIntegrations() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [showAdd, setShowAdd]           = useState(false);
  const [testing, setTesting]           = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/integrations");
      setIntegrations(d.integrations || []);
    } catch (e: any) {
      toast({ title: "Yüklenemedi", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.platform) return;
    setSaving(true);
    try {
      const d = await apiFetch("/admin/integrations", { method: "POST", body: JSON.stringify(form) });
      setIntegrations((p) => [...p, d.integration]);
      setShowAdd(false);
      setForm({ ...EMPTY_FORM });
      toast({ title: "Eklendi", description: `${form.name} entegrasyonu eklendi.` });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch(`/admin/integrations/${id}`, { method: "DELETE" });
      setIntegrations((p) => p.filter((i) => i.id !== id));
      toast({ title: "Silindi" });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const test = async (id: string) => {
    setTesting(id);
    try {
      const d = await apiFetch(`/admin/integrations/${id}/test`, { method: "POST" });
      toast({
        title: d.ok ? "Bağlantı başarılı ✓" : "Bağlantı başarısız",
        description: d.ok ? JSON.stringify(d.info) : d.error,
        variant: d.ok ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const toggle = async (id: string, field: "autoUpload" | "isActive", val: boolean) => {
    try {
      await apiFetch(`/admin/integrations/${id}`, { method: "PATCH", body: JSON.stringify({ [field]: val }) });
      setIntegrations((p) => p.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
    } catch {}
  };

  const selectedPlatform = PLATFORMS.find((p) => p.id === form.platform);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Video Platform Entegrasyonları</h2>
          <p className="text-[#666] text-sm mt-1">
            Videolar yüklendiğinde otomatik olarak bu platformlara gönderilir
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg bg-[#2a2a2a] text-[#888] hover:bg-[#333] transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" /> Platform Ekle
          </button>
        </div>
      </div>

      {/* Platform kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {PLATFORMS.map((p) => {
          const added = integrations.find((i) => i.platform === p.id);
          return (
            <div
              key={p.id}
              className={cn("border rounded-xl p-4 transition-all", added ? `${p.bg} border-current/30` : "bg-[#1a1a1a] border-[#2a2a2a]")}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold", p.bg, p.color)}>
                  {p.logo}
                </div>
                <div>
                  <p className={cn("font-semibold text-sm", added ? p.color : "text-[#aaa]")}>{p.name}</p>
                  <p className="text-[10px] text-[#555]">
                    {added ? `${added.uploadCount || 0} yükleme` : "Eklenmedi"}
                  </p>
                </div>
              </div>
              {added ? (
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => test(added.id)}
                    disabled={testing === added.id}
                    className="flex-1 text-[10px] py-1 rounded bg-[#222] hover:bg-[#333] text-[#aaa] transition-colors flex items-center justify-center gap-1"
                  >
                    {testing === added.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Test"}
                  </button>
                  <button
                    onClick={() => remove(added.id)}
                    className="p-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setForm((f) => ({ ...f, platform: p.id, name: p.name })); setShowAdd(true); }}
                  className="w-full text-[10px] py-1.5 rounded bg-[#222] hover:bg-[#2a2a2a] text-[#666] hover:text-white transition-colors mt-2"
                >
                  + Ekle
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Eklenmiş entegrasyonlar listesi */}
      {integrations.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#222]">
            <h3 className="text-sm font-semibold text-[#aaa]">Aktif Entegrasyonlar</h3>
          </div>
          <div className="divide-y divide-[#222]">
            {integrations.map((int) => {
              const p = PLATFORMS.find((x) => x.id === int.platform);
              return (
                <div key={int.id} className="flex items-center gap-4 px-4 py-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0", p?.bg, p?.color)}>
                    {p?.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{int.name}</p>
                    <p className="text-[11px] text-[#555]">{int.platform} • {int.uploadCount || 0} yükleme</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#666]">
                      <span>Otomatik</span>
                      <button onClick={() => toggle(int.id, "autoUpload", !int.autoUpload)}>
                        {int.autoUpload
                          ? <ToggleRight className="h-4 w-4 text-primary" />
                          : <ToggleLeft className="h-4 w-4 text-[#444]" />}
                      </button>
                    </div>
                    <button
                      onClick={() => test(int.id)}
                      disabled={testing === int.id}
                      className="text-[11px] px-2 py-1 rounded bg-[#222] hover:bg-[#2a2a2a] text-[#888] transition-colors flex items-center gap-1"
                    >
                      {testing === int.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <><Link2 className="h-3 w-3" /> Test</>}
                    </button>
                    <button
                      onClick={() => remove(int.id)}
                      className="p-1.5 rounded hover:bg-red-900/30 text-[#555] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && integrations.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#1a1a1a] rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Otomatik yükleme bilgisi */}
      <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4">
        <div className="flex gap-3">
          <Upload className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-200">Otomatik Dağıtım Nasıl Çalışır?</p>
            <p className="text-xs text-blue-200/60 mt-1 leading-relaxed">
              Kullanıcı video yüklediğinde, "Otomatik Yükleme" açık entegrasyonlara dosya otomatik gönderilir.
              Yükleme arka planda gerçekleşir — kullanıcı beklemek zorunda kalmaz.
              500 MB üzeri dosyalar otomatik dağıtımdan hariç tutulur.
            </p>
          </div>
        </div>
      </div>

      {/* Modal: Platform Ekle */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}
        >
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Platform Ekle</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#888] mb-1 block">Platform</label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                  className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"
                >
                  {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#888] mb-1 block">Görünen Ad</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={`Örn: ${selectedPlatform?.name} Ana`}
                  className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555]"
                />
              </div>
              {selectedPlatform?.fields.includes("login") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">Login (Kullanıcı Adı)</label>
                  <input
                    value={form.login}
                    onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              )}
              {selectedPlatform?.fields.includes("key") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">API Key</label>
                  <input
                    type="password"
                    value={form.key}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              )}
              {selectedPlatform?.fields.includes("apiKey") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">API Key</label>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              )}
              {selectedPlatform?.fields.includes("email") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">E-posta</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoUpload"
                  checked={form.autoUpload}
                  onChange={(e) => setForm((f) => ({ ...f, autoUpload: e.target.checked }))}
                />
                <label htmlFor="autoUpload" className="text-sm text-[#aaa]">Otomatik yüklemeyi etkinleştir</label>
              </div>
              {selectedPlatform && (
                <a href={selectedPlatform.docs} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">
                  {selectedPlatform.name} API docs →
                </a>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={save}
                disabled={!form.name || saving}
                className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 bg-[#222] hover:bg-[#2a2a2a] text-[#aaa] font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
