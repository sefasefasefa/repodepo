import { useState, useEffect } from "react";
import {
  HardDrive, Plus, Trash2, CheckCircle, ExternalLink, Copy,
  CloudUpload, Globe, Server, AlertTriangle, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CDN_PROVIDERS = [
  { id: "bunny",         name: "Bunny CDN",        logo: "🐰", desc: "Ucuz ve hızlı video CDN. Stream + Storage.",          docsUrl: "https://bunny.net" },
  { id: "cloudflare_r2", name: "Cloudflare R2",    logo: "☁️", desc: "Ücretsiz egress. S3-uyumlu depolama.",               docsUrl: "https://developers.cloudflare.com/r2" },
  { id: "aws_s3",        name: "Amazon S3",         logo: "📦", desc: "Endüstri standardı. CloudFront ile CDN.",            docsUrl: "https://aws.amazon.com/s3" },
  { id: "backblaze",    name: "Backblaze B2",       logo: "🔵", desc: "En ucuz depolama. Cloudflare ile ücretsiz egress.",  docsUrl: "https://www.backblaze.com/cloud-storage" },
  { id: "wasabi",        name: "Wasabi",            logo: "🟢", desc: "Sabit fiyatlı depolama. Egress ücretsiz.",           docsUrl: "https://wasabi.com" },
  { id: "streamtape",   name: "Streamtape Host",    logo: "📼", desc: "Video hosting + otomatik embed kodu.",              docsUrl: "https://streamtape.com" },
  { id: "custom",        name: "Özel S3 / CDN",     logo: "⚙️", desc: "Kendi S3-uyumlu endpoint'in.",                     docsUrl: "" },
];

interface CDNConfig {
  id: string;
  provider: string;
  name: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  region?: string;
  cdnUrl?: string;
  isActive: boolean;
  isDefault: boolean;
  usedStorage?: number;
  totalStorage?: number;
}

const EMPTY_FORM = {
  provider: "bunny", name: "", endpoint: "",
  accessKey: "", secretKey: "", bucket: "", region: "auto", cdnUrl: "",
};

function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

export function AdminCDN() {
  const [configs, setConfigs]       = useState<CDNConfig[]>([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [showSecret, setShowSecret] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, "idle" | "testing" | "ok" | "fail">>({});
  const [error, setError]           = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch("/admin/cdn");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setConfigs(d.configs || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.provider) return;
    setSaving(true);
    try {
      const r = await apiFetch("/admin/cdn", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setShowAdd(false);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu CDN bağlantısını silmek istediğine emin misin?")) return;
    await apiFetch(`/admin/cdn/${id}`, { method: "DELETE" });
    load();
  };

  const handleSetDefault = async (id: string) => {
    await apiFetch(`/admin/cdn/${id}/default`, { method: "POST" });
    load();
  };

  const handleTest = async (id: string) => {
    setTestStatus((p) => ({ ...p, [id]: "testing" }));
    const r = await apiFetch(`/admin/cdn/${id}/test`, { method: "POST" });
    setTestStatus((p) => ({ ...p, [id]: r.ok ? "ok" : "fail" }));
    setTimeout(() => setTestStatus((p) => ({ ...p, [id]: "idle" })), 4000);
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); };

  const selectedProvider = CDN_PROVIDERS.find((p) => p.id === form.provider);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" /> CDN & Depolama
        </h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> CDN Ekle
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 text-red-400 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Providers info */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
        <p className="text-sm font-medium text-[#ccc] mb-3">Desteklenen Sağlayıcılar</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {CDN_PROVIDERS.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 bg-[#252525] rounded-lg">
              <span className="text-lg">{p.logo}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#ddd] truncate">{p.name}</p>
                {p.docsUrl && (
                  <a href={p.docsUrl} target="_blank" rel="noreferrer"
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                    Docs <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[#1e1e1e] border border-primary/30 rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <CloudUpload className="h-4 w-4 text-primary" /> Yeni CDN Bağlantısı
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-[#777] block mb-1">Sağlayıcı *</label>
              <select
                value={form.provider}
                onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white"
              >
                {CDN_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.logo} {p.name}</option>
                ))}
              </select>
              {selectedProvider && (
                <p className="text-xs text-[#555] mt-1">{selectedProvider.desc}</p>
              )}
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs text-[#777] block mb-1">Bağlantı Adı *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white"
                placeholder="Örn: Ana Depolama"
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs text-[#777] block mb-1">CDN URL (medya öneki)</label>
              <input
                value={form.cdnUrl}
                onChange={(e) => setForm((p) => ({ ...p, cdnUrl: e.target.value }))}
                className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white"
                placeholder="https://cdn.example.com"
              />
            </div>
            {form.provider !== "streamtape" && (
              <>
                <div className="col-span-2">
                  <label className="text-xs text-[#777] block mb-1">
                    {form.provider === "bunny" ? "Storage Zone API Anahtarı"
                      : form.provider === "cloudflare_r2" ? "Account ID / Endpoint"
                      : "Endpoint URL"}
                  </label>
                  <input
                    value={form.endpoint}
                    onChange={(e) => setForm((p) => ({ ...p, endpoint: e.target.value }))}
                    className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white"
                    placeholder={form.provider === "cloudflare_r2"
                      ? "https://<account>.r2.cloudflarestorage.com"
                      : "https://storage.bunnycdn.com"}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#777] block mb-1">Access Key / API Key</label>
                  <input
                    value={form.accessKey}
                    onChange={(e) => setForm((p) => ({ ...p, accessKey: e.target.value }))}
                    className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white font-mono text-xs"
                    placeholder="Access key..."
                  />
                </div>
                <div>
                  <label className="text-xs text-[#777] block mb-1">Secret Key</label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      value={form.secretKey}
                      onChange={(e) => setForm((p) => ({ ...p, secretKey: e.target.value }))}
                      className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 pr-9 text-sm text-white font-mono text-xs"
                      placeholder="Secret key..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#aaa]"
                    >
                      {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#777] block mb-1">Bucket / Zone Adı</label>
                  <input
                    value={form.bucket}
                    onChange={(e) => setForm((p) => ({ ...p, bucket: e.target.value }))}
                    className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white"
                    placeholder="my-bucket"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#777] block mb-1">Bölge (Region)</label>
                  <input
                    value={form.region}
                    onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
                    className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white"
                    placeholder="eu-central-1 / auto"
                  />
                </div>
              </>
            )}
          </div>
          <div className="bg-[#252525] border border-[#333] rounded-lg p-3 text-xs text-[#666] space-y-1">
            <p className="text-[#aaa] font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-500" /> Güvenlik Notu
            </p>
            <p>API anahtarları şifrelenmiş olarak veritabanında saklanır. Bu bilgileri kimseyle paylaşma.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAdd(false); setForm({ ...EMPTY_FORM }); }}
              className="px-4 py-1.5 rounded text-sm bg-[#333] text-[#aaa] hover:bg-[#444]"
            >
              İptal
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !form.name}
              className="px-4 py-1.5 rounded text-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      {/* Existing configs */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#1e1e1e] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : configs.length === 0 ? (
        <div className="text-center py-14 text-[#555]">
          <HardDrive className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-[#aaa]">Henüz CDN bağlantısı eklenmedi</p>
          <p className="text-sm mt-1">Video dosyalarını depolamak için bir CDN sağlayıcısı ekle</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => {
            const provider = CDN_PROVIDERS.find((p) => p.id === cfg.provider);
            const status = testStatus[cfg.id] ?? "idle";
            const used = cfg.usedStorage ? (cfg.usedStorage / (cfg.totalStorage ?? 1)) * 100 : 0;
            return (
              <div
                key={cfg.id}
                className={cn("bg-[#1e1e1e] border rounded-xl p-4", cfg.isDefault ? "border-primary/40" : "border-[#2a2a2a]")}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{provider?.logo ?? "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[#ddd]">{cfg.name}</p>
                      {cfg.isDefault && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Varsayılan</span>
                      )}
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", cfg.isActive ? "bg-green-900/30 text-green-400" : "bg-[#333] text-[#555]")}>
                        {cfg.isActive ? "Aktif" : "Pasif"}
                      </span>
                      <span className="text-xs text-[#555]">{provider?.name}</span>
                    </div>
                    {cfg.cdnUrl && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Globe className="h-3 w-3 text-[#555]" />
                        <span className="text-xs text-[#666] font-mono">{cfg.cdnUrl}</span>
                        <button onClick={() => copyToClipboard(cfg.cdnUrl!)} className="text-[#444] hover:text-primary transition-colors">
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {cfg.usedStorage !== undefined && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-[#666] mb-1">
                          <span>{formatBytes(cfg.usedStorage)} kullanıldı</span>
                          <span>{formatBytes(cfg.totalStorage)} toplam</span>
                        </div>
                        <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", used > 90 ? "bg-red-500" : used > 70 ? "bg-yellow-500" : "bg-primary")}
                            style={{ width: `${Math.min(used, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleTest(cfg.id)}
                      disabled={status === "testing"}
                      className={cn("px-2.5 py-1.5 rounded text-xs flex items-center gap-1 transition-colors",
                        status === "ok" ? "bg-green-900/30 text-green-400"
                          : status === "fail" ? "bg-red-900/30 text-red-400"
                          : "bg-[#333] text-[#888] hover:bg-[#3a3a3a]")}
                    >
                      {status === "testing" ? <><Server className="h-3 w-3 animate-pulse" /> Test...</>
                        : status === "ok" ? <><CheckCircle className="h-3 w-3" /> Tamam</>
                        : status === "fail" ? <><AlertTriangle className="h-3 w-3" /> Hata</>
                        : <><Server className="h-3 w-3" /> Test</>}
                    </button>
                    {!cfg.isDefault && (
                      <button
                        onClick={() => handleSetDefault(cfg.id)}
                        className="px-2.5 py-1.5 rounded text-xs bg-[#333] text-[#888] hover:bg-[#3a3a3a] transition-colors"
                      >
                        Varsayılan Yap
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(cfg.id)}
                      className="p-1.5 rounded hover:bg-red-900/30 text-[#666] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload guide */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
        <h2 className="font-bold text-sm flex items-center gap-2">
          <CloudUpload className="h-4 w-4 text-primary" /> Video Yükleme Akışı
        </h2>
        <div className="space-y-2">
          {[
            { step: "1", text: "Kullanıcı video seçer → frontend doğrudan CDN'e yükler (presigned URL)", note: "Sunucuya yük bindirmez" },
            { step: "2", text: "Yükleme tamamlanınca CDN URL'si API'ye gönderilir", note: "POST /api/videos" },
            { step: "3", text: "API video kaydını oluşturur, CDN URL'yi saklar", note: "Veritabanı" },
            { step: "4", text: "Video player CDN URL'sini kullanarak oynatır", note: "HLS / MP4" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3 p-3 bg-[#252525] rounded-lg">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5">
                {item.step}
              </div>
              <div>
                <p className="text-sm text-[#ccc]">{item.text}</p>
                <p className="text-xs text-[#555] mt-0.5">{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
