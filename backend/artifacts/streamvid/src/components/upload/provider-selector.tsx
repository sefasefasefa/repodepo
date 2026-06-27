import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Check, Plus, Settings, Globe, AlertTriangle, Loader2, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Provider {
  key: string;
  name: string;
  acceptsAdult: boolean;
  baseUrl: string;
  color: string;
  letter: string;
  siteId: number | null;
  configured: boolean;
  enabled: boolean;
}

interface Props {
  isAdult: boolean;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

// Her sağlayıcı için hangi kimlik alanları gerekli
const PROVIDER_CREDENTIALS: Record<string, { needsUsername?: boolean; userLabel?: string; userPlaceholder?: string; needsApiKey?: boolean; apiKeyLabel?: string; apiKeyPlaceholder?: string; needsPassword?: boolean; hint?: string }> = {
  streamtape:   { needsUsername: true, userLabel: "Login (kullanıcı adı)", userPlaceholder: "kullaniciadı", needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx-xxxx-xxxx", hint: "streamtape.com/api adresinden alabilirsin" },
  doodstream:   { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "doodapi.com üzerinden API anahtarı al" },
  mixdrop:      { needsUsername: true, userLabel: "E-posta", userPlaceholder: "email@örnek.com", needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "mixdrop.ag hesabından API anahtarı al" },
  vidoza:       { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "vidoza.net hesabından API anahtarı al" },
  filemoon:     { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "filemoon.sx hesabından API anahtarı al" },
  streamwish:   { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "streamwish.com hesabından API anahtarı al" },
  voe:          { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "voe.sx hesabından API anahtarı al" },
  upstream:     { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "upstream.to hesabından API anahtarı al" },
  vidhide:      { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "vidhide.com hesabından API anahtarı al" },
  luluvdo:      { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "luluvdo.com hesabından API anahtarı al" },
  uqload:       { needsUsername: true, userLabel: "E-posta", userPlaceholder: "email@örnek.com", needsPassword: true, hint: "uqload.io hesap bilgilerini gir" },
  streamhide:   { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "streamhide.com hesabından API anahtarı al" },
  supervideo:   { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "supervideo.tv hesabından API anahtarı al" },
  dropload:     { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "dropload.io hesabından API anahtarı al" },
  embedsito:    { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "embedsito.com hesabından API anahtarı al" },
  vidlox:       { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "vidlox.me hesabından API anahtarı al" },
  streamlare:   { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "streamlare.com hesabından API anahtarı al" },
  clipwatching: { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "clipwatching.com hesabından API anahtarı al" },
  streamsb:     { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "streamsb.net hesabından API anahtarı al" },
  hxfile:       { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "hxfile.ch hesabından API anahtarı al" },
  vidplay:      { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "vidplay.online hesabından API anahtarı al" },
  nxbex:        { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "nxbex.com hesabından API anahtarı al" },
  dropgalaxy:   { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "dropgalaxy.com hesabından API anahtarı al" },
  evoload:      { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "evoload.io hesabından API anahtarı al" },
  fembed:       { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "fembed.com hesabından API anahtarı al" },
  hotlinking:   { needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx...", hint: "hotlinking.co hesabından API anahtarı al" },
};

const DEFAULT_CREDS = { needsUsername: true, userLabel: "Kullanıcı Adı", userPlaceholder: "kullanici", needsApiKey: true, apiKeyLabel: "API Anahtarı", apiKeyPlaceholder: "xxxx..." };

function AddSiteModal({
  provider,
  onClose,
  onAdded,
}: {
  provider: Provider;
  onClose: () => void;
  onAdded: (siteId: number) => void;
}) {
  const { token } = useAuth() as any;
  const creds = PROVIDER_CREDENTIALS[provider.key] ?? DEFAULT_CREDS;
  const [form, setForm] = useState({ username: "", password: "", apiKey: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/cross-post/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          name: provider.name,
          providerKey: provider.key,
          username: form.username,
          password: form.password,
          apiKey: form.apiKey,
          enabled: true,
          autoPost: false,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Kayıt başarısız");
        return;
      }
      const d = await res.json();
      onAdded(d.site.id);
      onClose();
    } catch {
      setError("Sunucu hatası");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0" style={{ backgroundColor: provider.color }}>
            {provider.letter}
          </div>
          <div>
            <p className="font-semibold text-white">{provider.name} Hesabı Ekle</p>
            <p className="text-xs text-[#555]">{provider.baseUrl}</p>
          </div>
        </div>

        {/* Hint */}
        {creds.hint && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary/80">
            💡 {creds.hint}
          </div>
        )}

        <div className="space-y-3">
          {creds.needsUsername && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#888]">{creds.userLabel ?? "Kullanıcı Adı"}</label>
              <input
                className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder={creds.userPlaceholder ?? ""}
              />
            </div>
          )}
          {creds.needsPassword && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#888]">Şifre</label>
              <input
                type="password"
                className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
          )}
          {creds.needsApiKey && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#888]">{creds.apiKeyLabel ?? "API Anahtarı"}</label>
              <input
                className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={creds.apiKeyPlaceholder ?? ""}
              />
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0" /> {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Kaydet
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-[#2a2a2a] text-[#aaa] hover:text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}

function EditSiteModal({
  provider, token, onClose, onSaved, onDeleted,
}: {
  provider: Provider; token: string; onClose: () => void; onSaved: () => void; onDeleted: () => void;
}) {
  const creds = PROVIDER_CREDENTIALS[provider.key] ?? DEFAULT_CREDS;
  const [form, setForm] = useState({ username: "", apiKey: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const body: any = {};
      if (form.username.trim()) body.username = form.username.trim();
      if (form.apiKey.trim())   body.apiKey   = form.apiKey.trim();
      if (form.password.trim()) body.password  = form.password.trim();

      const res = await fetch(`/api/cross-post/sites/${provider.siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Kaydedilemedi"); return; }
      onSaved();
    } catch { setError("Sunucu hatası"); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true); setError("");
    try {
      const res = await fetch(`/api/cross-post/sites/${provider.siteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) { setError("Silinemedi"); return; }
      onDeleted();
    } catch { setError("Sunucu hatası"); } finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0" style={{ backgroundColor: provider.color }}>
            {provider.letter}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">{provider.name} Hesabını Düzenle</p>
            <p className="text-xs text-[#555]">Boş bırakılan alanlar değiştirilmez</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#1e1e1e] text-[#555] hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {creds.needsUsername && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#888]">{creds.userLabel ?? "Kullanıcı Adı"} <span className="text-[#444]">(yeni değer)</span></label>
              <input
                className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder={creds.userPlaceholder ?? ""}
              />
            </div>
          )}
          {creds.needsPassword && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#888]">Şifre <span className="text-[#444]">(yeni değer)</span></label>
              <input
                type="password"
                className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
          )}
          {creds.needsApiKey && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#888]">{creds.apiKeyLabel ?? "API Anahtarı"} <span className="text-[#444]">(yeni değer)</span></label>
              <input
                className="w-full bg-[#161616] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
                value={form.apiKey}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder={creds.apiKeyPlaceholder ?? ""}
              />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" /> {error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Kaydet
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 border border-red-900/40 text-red-400 hover:bg-red-900/20 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sil?"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProviderSelector({ isAdult, selectedIds, onChange }: Props) {
  const { token } = useAuth() as any;
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingProvider, setAddingProvider] = useState<Provider | null>(null);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [filter, setFilter] = useState<"all" | "adult" | "general">("all");

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/cross-post/catalog", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.ok) {
        const d = await res.json();
        setProviders(d.providers ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const toggle = (provider: Provider) => {
    if (!provider.configured) {
      setAddingProvider(provider);
      return;
    }
    if (!provider.siteId) return;
    const id = provider.siteId;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleAdded = async (siteId: number) => {
    await fetchProviders();
    onChange([...selectedIds, siteId]);
  };

  const visibleProviders = providers.filter((p) => {
    if (filter === "adult") return p.acceptsAdult;
    if (filter === "general") return !p.acceptsAdult;
    return true;
  });

  const adultProviders = providers.filter((p) => p.acceptsAdult);
  const generalProviders = providers.filter((p) => !p.acceptsAdult);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[#555]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Sağlayıcılar yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-[#888] uppercase tracking-widest">
            Sağlayıcı Seç
          </p>
          <p className="text-[11px] text-[#555]">
            {selectedIds.length > 0
              ? `${selectedIds.length} sağlayıcı seçili — video yüklendikten sonra otomatik gönderilir`
              : "Videonun paylaşılacağı platformları seç"}
          </p>
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[11px] text-[#555] hover:text-red-400 transition-colors"
          >
            Temizle
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {[
          { key: "all", label: `Tümü (${providers.length})` },
          { key: "adult", label: `+18 (${adultProviders.length})` },
          { key: "general", label: `Genel (${generalProviders.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-medium transition-all",
              filter === key
                ? "bg-primary text-white"
                : "bg-[#1a1a1a] text-[#666] hover:text-[#aaa] border border-[#2a2a2a]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Adult content warning */}
      {!isAdult && adultProviders.some((p) => p.configured && selectedIds.includes(p.siteId!)) && (
        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
          <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-300/80">
            +18 platformlar seçildi ama video +18 değil. +18 platformlar yalnızca yetişkin içeriği kabul eder.
          </p>
        </div>
      )}

      {/* Provider grid */}
      <div className="grid grid-cols-4 gap-2">
        {visibleProviders.map((provider) => {
          const isSelected = provider.siteId !== null && selectedIds.includes(provider.siteId);
          const isGrayedOut = !isAdult && provider.acceptsAdult && provider.configured;

          return (
            <div key={provider.key} className="relative group/card">
              <button
                onClick={() => !isGrayedOut && toggle(provider)}
                title={
                  !provider.configured
                    ? `${provider.name} hesabı ekle`
                    : isGrayedOut
                    ? `${provider.name} yalnızca +18 içerik kabul eder`
                    : provider.name
                }
                className={cn(
                  "relative w-full flex flex-col items-center gap-1.5 rounded-xl p-2.5 border text-center transition-all group",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                    : provider.configured
                    ? isGrayedOut
                      ? "border-[#1e1e1e] bg-[#111] opacity-40 cursor-not-allowed"
                      : "border-[#2a2a2a] bg-[#111] hover:border-[#444] hover:bg-[#161616] cursor-pointer"
                    : "border-[#1e1e1e] bg-[#0d0d0d] hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                )}
              >
                {/* Logo badge */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: isSelected
                      ? provider.color
                      : provider.configured
                      ? provider.color + "cc"
                      : "#1f1f1f",
                    color: provider.configured ? "#fff" : "#666",
                  }}
                >
                  {provider.configured ? provider.letter : <Plus className="h-3.5 w-3.5" />}
                </div>

                <p
                  className={cn(
                    "text-[10px] leading-tight font-medium w-full truncate",
                    isSelected ? "text-white" : provider.configured ? "text-[#aaa]" : "text-[#555]"
                  )}
                >
                  {provider.name}
                </p>

                {/* Badges */}
                {provider.acceptsAdult && (
                  <span className="absolute top-1 right-1 text-[8px] font-bold text-red-400/70 leading-none">
                    18+
                  </span>
                )}
                {isSelected && (
                  <span className="absolute top-1 left-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-2 w-2 text-white" strokeWidth={3} />
                  </span>
                )}
                {provider.configured && !isSelected && (
                  <span className="absolute bottom-1 right-1">
                    <Globe className="h-2.5 w-2.5 text-[#444]" />
                  </span>
                )}
              </button>

              {/* Edit button — only for configured providers */}
              {provider.configured && (
                <button
                  onClick={e => { e.stopPropagation(); setEditingProvider(provider); }}
                  title="Düzenle / Sil"
                  className="absolute -top-1.5 -left-1.5 z-10 w-5 h-5 rounded-full bg-[#222] border border-[#333] text-[#666] hover:text-white hover:bg-primary hover:border-primary flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[#444] text-center">
        Henüz hesap eklenmemiş platformlara tıklayarak kimlik bilgilerini ekleyebilirsin
      </p>

      {addingProvider && (
        <AddSiteModal
          provider={addingProvider}
          onClose={() => setAddingProvider(null)}
          onAdded={handleAdded}
        />
      )}

      {editingProvider && (
        <EditSiteModal
          provider={editingProvider}
          token={token}
          onClose={() => setEditingProvider(null)}
          onSaved={() => { setEditingProvider(null); fetchProviders(); }}
          onDeleted={() => {
            setEditingProvider(null);
            fetchProviders();
            if (editingProvider.siteId) onChange(selectedIds.filter(id => id !== editingProvider.siteId));
          }}
        />
      )}
    </div>
  );
}
