import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Pencil, Play, ToggleLeft, ToggleRight,
  X, Check, AlertCircle, Loader2, Code2, Globe, ChevronDown, ChevronUp,
  Copy, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Method = typeof METHODS[number];

const METHOD_COLORS: Record<Method, string> = {
  GET: "text-green-400 bg-green-900/20 border-green-800",
  POST: "text-blue-400 bg-blue-900/20 border-blue-800",
  PUT: "text-yellow-400 bg-yellow-900/20 border-yellow-800",
  PATCH: "text-orange-400 bg-orange-900/20 border-orange-800",
  DELETE: "text-red-400 bg-red-900/20 border-red-800",
};

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

const EMPTY: any = {
  name: "", description: "", url: "", method: "GET",
  headers: "{}", body: "", category: "Genel", isActive: true,
};

const CATEGORIES = ["Genel", "Ödeme", "CDN", "Video", "Analitik", "Bildirim", "Güvenlik", "Diğer"];

export function AdminApiEndpoints() {
  const { toast } = useToast();
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, any>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [clientName, setClientName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/api-endpoints");
      setEndpoints(d.endpoints || []);
      const c = await apiFetch("/admin/api-clients");
      setClients(c.clients || []);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setShowModal(true);
  };

  const openEdit = (ep: any) => {
    setEditing(ep);
    setForm({
      name: ep.name,
      description: ep.description || "",
      url: ep.url,
      method: ep.method,
      headers: ep.headers || "{}",
      body: ep.body || "",
      category: ep.category || "Genel",
      isActive: ep.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast({ title: "Hata", description: "Ad ve URL zorunlu", variant: "destructive" });
      return;
    }
    try {
      JSON.parse(form.headers || "{}");
    } catch {
      toast({ title: "Geçersiz JSON", description: "Headers alanı geçerli JSON olmalı", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/admin/api-endpoints/${editing.id}`, { method: "PUT", body: JSON.stringify(form) });
        toast({ title: "Güncellendi" });
      } else {
        await apiFetch("/admin/api-endpoints", { method: "POST", body: JSON.stringify(form) });
        toast({ title: "Oluşturuldu" });
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ep: any) => {
    try {
      await apiFetch(`/admin/api-endpoints/${ep.id}/toggle`, { method: "PATCH" });
      setEndpoints(prev => prev.map(e => e.id === ep.id ? { ...e, isActive: !e.isActive } : e));
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/admin/api-endpoints/${id}`, { method: "DELETE" });
      setEndpoints(prev => prev.filter(e => e.id !== id));
      setDeleteConfirm(null);
      toast({ title: "Silindi" });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handleTest = async (ep: any) => {
    setTesting(ep.id);
    try {
      const result = await apiFetch(`/admin/api-endpoints/${ep.id}/test`, { method: "POST" });
      setTestResults(prev => ({ ...prev, [ep.id]: result }));
      setExpandedId(ep.id);
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [ep.id]: { success: false, status: 0, statusText: e.message, elapsed: 0, response: "" } }));
    } finally {
      setTesting(null);
    }
  };

  const createClient = async () => {
    if (!clientName.trim()) return;
    const d = await apiFetch("/admin/api-clients", { method: "POST", body: JSON.stringify({ name: clientName, developerDomain: "developer.sitelinli" }) });
    setClients((p) => [d.client, ...p]);
    setClientName("");
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Kopyalandı" });
  };

  const filtered = endpoints.filter(ep => {
    const matchCat = filterCategory === "Tümü" || ep.category === filterCategory;
    const matchSearch = !search || ep.name.toLowerCase().includes(search.toLowerCase()) || ep.url.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const usedCategories = ["Tümü", ...Array.from(new Set(endpoints.map(e => e.category || "Genel")))];

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" /> API Endpoint Yöneticisi
          </h1>
          <p className="text-sm text-[#666] mt-0.5">Platform tarafından kullanılan tüm dış API endpoint'lerini yönet</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-[#333] text-[#aaa] hover:text-white">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="h-4 w-4" /> Yeni Endpoint
          </Button>
        </div>
      </div>

      <Tabs defaultValue="endpoints" className="w-full">
        <TabsList className="bg-[#111] border border-[#2a2a2a]">
          <TabsTrigger value="endpoints">Docs</TabsTrigger>
          <TabsTrigger value="clients">API Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="endpoints" className="mt-4">
          {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Endpoint ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#1e1e1e] border-[#2a2a2a] w-56 h-8 text-sm"
        />
        <div className="flex gap-1 flex-wrap">
          {usedCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                filterCategory === cat
                  ? "bg-primary/15 border-primary text-primary"
                  : "border-[#333] text-[#666] hover:text-white hover:border-[#555]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#555] ml-auto">{filtered.length} endpoint</span>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#555]">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Yükleniyor...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#555]">
          <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Henüz endpoint yok. Yeni endpoint ekle.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ep => (
            <div key={ep.id} className={cn("border rounded-xl overflow-hidden transition-all", ep.isActive ? "border-[#2a2a2a] bg-[#1a1a1a]" : "border-[#222] bg-[#161616] opacity-60")}>
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Method badge */}
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border shrink-0", METHOD_COLORS[ep.method as Method] || METHOD_COLORS.GET)}>
                  {ep.method}
                </span>

                {/* Name & URL */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white truncate">{ep.name}</span>
                    <span className="text-[10px] bg-[#252525] border border-[#333] text-[#888] px-2 py-0.5 rounded-full shrink-0">{ep.category}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-[#555] font-mono truncate">{ep.url}</span>
                    <button onClick={() => copyUrl(ep.url)} className="text-[#444] hover:text-[#888] transition-colors shrink-0">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Test sonucu göstergesi */}
                {testResults[ep.id] && (
                  <span className={cn("text-xs font-mono shrink-0 px-2 py-0.5 rounded border", testResults[ep.id].success ? "bg-green-900/20 border-green-800 text-green-400" : "bg-red-900/20 border-red-800 text-red-400")}>
                    {testResults[ep.id].status} • {testResults[ep.id].elapsed}ms
                  </span>
                )}

                {/* Aksiyon butonları */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleTest(ep)}
                    disabled={testing === ep.id}
                    title="Test Et"
                    className="p-1.5 rounded-lg text-[#666] hover:text-green-400 hover:bg-green-900/20 transition-colors disabled:opacity-50"
                  >
                    {testing === ep.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(ep)}
                    title="Düzenle"
                    className="p-1.5 rounded-lg text-[#666] hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(ep)}
                    title={ep.isActive ? "Devre Dışı Bırak" : "Etkinleştir"}
                    className="p-1.5 rounded-lg text-[#666] hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    {ep.isActive ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  {deleteConfirm === ep.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(ep.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="p-1.5 rounded-lg text-[#666] hover:text-white transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(ep.id)}
                      title="Sil"
                      className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
                    className="p-1.5 rounded-lg text-[#666] hover:text-white transition-colors"
                  >
                    {expandedId === ep.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Genişletilmiş detay */}
              {expandedId === ep.id && (
                <div className="border-t border-[#242424] px-4 py-3 space-y-3 bg-[#141414]">
                  {ep.description && (
                    <p className="text-xs text-[#888]">{ep.description}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-[#555] uppercase font-bold mb-1">Headers</p>
                      <pre className="text-xs text-[#aaa] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 overflow-auto max-h-32 font-mono">
                        {JSON.stringify(JSON.parse(ep.headers || "{}"), null, 2)}
                      </pre>
                    </div>
                    {ep.body && (
                      <div>
                        <p className="text-[10px] text-[#555] uppercase font-bold mb-1">Request Body</p>
                        <pre className="text-xs text-[#aaa] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 overflow-auto max-h-32 font-mono">
                          {ep.body}
                        </pre>
                      </div>
                    )}
                  </div>
                  {testResults[ep.id] && (
                    <div>
                      <p className="text-[10px] text-[#555] uppercase font-bold mb-1 flex items-center gap-2">
                        Test Sonucu
                        {testResults[ep.id].success
                          ? <span className="text-green-400 normal-case font-normal">Başarılı</span>
                          : <span className="text-red-400 normal-case font-normal">Başarısız</span>
                        }
                      </p>
                      <pre className="text-xs text-[#aaa] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 overflow-auto max-h-40 font-mono">
                        {testResults[ep.id].response || "(boş yanıt)"}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </TabsContent>
        <TabsContent value="clients" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client adı" className="bg-[#1e1e1e] border-[#2a2a2a]" />
            <Button onClick={createClient}>Oluştur</Button>
          </div>
          <div className="space-y-2">
            {clients.map((client) => (
              <div key={client.id} className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{client.name}</p>
                  <p className="text-xs text-[#777]">developer.sitelinli</p>
                  <p className="text-xs text-[#777] font-mono">Token: {client.clientKey}</p>
                  <p className="text-[11px] text-[#555] font-mono">Client Secret: {`${client.clientSecret.slice(0, 8)}••••••••••`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] px-2 py-1 rounded-full border", client.isActive ? "border-green-800 text-green-400 bg-green-950/30" : "border-red-800 text-red-400 bg-red-950/30")}>
                    {client.isActive ? "Aktif" : "Pasif"}
                  </span>
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(client.clientKey)}>Token kopyala</Button>
                  <Button variant="secondary" onClick={() => navigator.clipboard.writeText(client.clientSecret)}>Secret kopyala</Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#2a2a2a]">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                {editing ? "Endpoint Düzenle" : "Yeni Endpoint Ekle"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-[#666] hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Ad */}
              <div>
                <label className="text-xs text-[#888] font-medium mb-1.5 block">Endpoint Adı *</label>
                <Input
                  placeholder="örn. Stripe Webhook"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="bg-[#242424] border-[#333] focus-visible:ring-primary"
                />
              </div>

              {/* Açıklama */}
              <div>
                <label className="text-xs text-[#888] font-medium mb-1.5 block">Açıklama</label>
                <Input
                  placeholder="Ne işe yarar?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="bg-[#242424] border-[#333] focus-visible:ring-primary"
                />
              </div>

              {/* Method + URL */}
              <div>
                <label className="text-xs text-[#888] font-medium mb-1.5 block">URL *</label>
                <div className="flex gap-2">
                  <select
                    value={form.method}
                    onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                    className="bg-[#242424] border border-[#333] rounded-lg px-2 py-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <Input
                    placeholder="https://api.example.com/webhook"
                    value={form.url}
                    onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    className="bg-[#242424] border-[#333] focus-visible:ring-primary font-mono text-sm flex-1"
                  />
                </div>
              </div>

              {/* Kategori */}
              <div>
                <label className="text-xs text-[#888] font-medium mb-1.5 block">Kategori</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-[#242424] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Headers */}
              <div>
                <label className="text-xs text-[#888] font-medium mb-1.5 block">Headers <span className="text-[#555] font-normal">(JSON)</span></label>
                <textarea
                  value={form.headers}
                  onChange={e => setForm(f => ({ ...f, headers: e.target.value }))}
                  rows={3}
                  placeholder='{"Authorization": "Bearer TOKEN", "Content-Type": "application/json"}'
                  className="w-full bg-[#242424] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#ccc] font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Body */}
              {form.method !== "GET" && form.method !== "HEAD" && (
                <div>
                  <label className="text-xs text-[#888] font-medium mb-1.5 block">Request Body <span className="text-[#555] font-normal">(opsiyonel)</span></label>
                  <textarea
                    value={form.body}
                    onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    rows={3}
                    placeholder='{"key": "value"}'
                    className="w-full bg-[#242424] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#ccc] font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              )}

              {/* Aktif */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={cn("relative w-10 h-5 rounded-full transition-colors border", form.isActive ? "bg-primary border-primary" : "bg-[#333] border-[#444]")}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow", form.isActive ? "translate-x-5" : "translate-x-0.5")} />
                </button>
                <span className="text-sm text-[#aaa]">{form.isActive ? "Aktif" : "Devre dışı"}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 pb-5 pt-2 border-t border-[#2a2a2a]">
              <Button variant="outline" onClick={() => setShowModal(false)} className="border-[#333] text-[#aaa] hover:text-white">
                İptal
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 min-w-24">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Güncelle" : "Ekle"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
