import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useFeatureFlags } from "@/lib/feature-flags";
import {
  MessageCircle, Mic, Phone, Video, Radio, MessageSquare, Film, Search, FolderOpen, PlaySquare, Bell, History, Bookmark, Coins, Upload, Crown, LayoutDashboard, Trophy, Download, UserRound, Star, ShoppingBag, ListVideo, FileText, ShieldAlert, Shuffle,
  Loader2, CheckCircle2, AlertTriangle, Languages, Wand2, Globe, Users, PenTool,
} from "lucide-react";

const TOKEN = () => localStorage.getItem("token") || "";

interface FlagDef {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  group: string;
}

const FLAG_DEFS: FlagDef[] = [
  { key: "dm_messages", label: "Direkt Mesajlar", description: "DM ekranını ve üst menüdeki butonu kontrol eder.", icon: MessageCircle, color: "text-blue-400", group: "Mesajlaşma" },
  { key: "voice_messages", label: "Sesli Mesajlar", description: "DM içindeki mikrofon butonunu kontrol eder.", icon: Mic, color: "text-green-400", group: "Mesajlaşma" },
  { key: "audio_calls", label: "Sesli Aramalar", description: "DM içindeki telefon butonunu kontrol eder.", icon: Phone, color: "text-emerald-400", group: "Mesajlaşma" },
  { key: "video_calls", label: "Görüntülü Aramalar", description: "DM içindeki kamera butonunu kontrol eder.", icon: Video, color: "text-purple-400", group: "Mesajlaşma" },
  { key: "live_streams", label: "Canlı Yayınlar", description: "Canlı yayın listesini ve yayın sayfasını kontrol eder.", icon: Radio, color: "text-red-400", group: "Canlı Yayın" },
  { key: "live_chat", label: "Canlı Sohbet", description: "Canlı yayın sohbet panelini kontrol eder.", icon: MessageSquare, color: "text-orange-400", group: "Canlı Yayın" },
  { key: "videos", label: "Videolar", description: "Video keşif sayfası ve video kartlarını kontrol eder.", icon: Film, color: "text-cyan-400", group: "İçerik" },
  { key: "shorts", label: "Shorts", description: "Kısa video akışını kontrol eder.", icon: PlaySquare, color: "text-pink-400", group: "İçerik" },
  { key: "search", label: "Arama", description: "Arama çubuğu ve arama sayfasını kontrol eder.", icon: Search, color: "text-yellow-400", group: "İçerik" },
  { key: "categories", label: "Kategoriler", description: "Kategori sayfalarını kontrol eder.", icon: FolderOpen, color: "text-indigo-400", group: "İçerik" },
  { key: "creators", label: "Creatorlar", description: "Creator listesi ve profil sayfalarını kontrol eder.", icon: UserRound, color: "text-emerald-400", group: "İçerik" },
  { key: "stories", label: "Stories", description: "Story akışı ve yorum/yanıt butonlarını kontrol eder.", icon: Film, color: "text-rose-400", group: "İçerik" },
  { key: "playlists", label: "Playlistler", description: "Playlist sayfalarını kontrol eder.", icon: ListVideo, color: "text-sky-400", group: "Hesap" },
  { key: "notifications", label: "Bildirimler", description: "Bildirim ikonunu ve sayfasını kontrol eder.", icon: Bell, color: "text-blue-300", group: "Hesap" },
  { key: "history", label: "Geçmiş", description: "İzleme geçmişi sayfasını kontrol eder.", icon: History, color: "text-neutral-300", group: "Hesap" },
  { key: "bookmarks", label: "Kaydedilenler", description: "Kaydedilenler sayfasını kontrol eder.", icon: Bookmark, color: "text-neutral-300", group: "Hesap" },
  { key: "subscriptions", label: "Abonelikler", description: "Abonelik sayfasını kontrol eder.", icon: Coins, color: "text-amber-400", group: "Hesap" },
  { key: "pricing", label: "Fiyatlandırma", description: "Fiyatlandırma sayfasını kontrol eder.", icon: ShoppingBag, color: "text-amber-300", group: "Hesap" },
  { key: "payment", label: "Ödeme", description: "Ödeme ekranını kontrol eder.", icon: Coins, color: "text-green-300", group: "Hesap" },
  { key: "upload", label: "Yükleme", description: "Video yükleme ekranını kontrol eder.", icon: Upload, color: "text-orange-400", group: "Üretici" },
  { key: "creator_dashboard", label: "Creator Dashboard", description: "Creator panelini kontrol eder.", icon: LayoutDashboard, color: "text-violet-400", group: "Üretici" },
  { key: "leaderboard", label: "Sıralama", description: "Sadakat sıralaması sayfasını kontrol eder.", icon: Trophy, color: "text-yellow-300", group: "Topluluk" },
  { key: "downloads", label: "İndirilenler", description: "İndirilenler sayfasını kontrol eder.", icon: Download, color: "text-cyan-300", group: "Hesap" },
  { key: "match", label: "Eşleşme", description: "Rastgele eşleşme odalarını kontrol eder.", icon: Shuffle, color: "text-pink-300", group: "Topluluk" },
  { key: "affiliate", label: "Affiliate", description: "Affiliate sayfasını kontrol eder.", icon: Crown, color: "text-orange-300", group: "Topluluk" },
  { key: "admin_panel",        label: "Admin Panel",            description: "Admin panel girişini kontrol eder.",                                    icon: ShieldAlert, color: "text-red-300",     group: "Yönetim" },

  // ── Transcript ──
  { key: "transcript_view",      label: "Transcript Görüntüleme", description: "İzleyicilerin altyazı/transcript sekmesini açıp içerikleri okuyabilmesi.", icon: FileText,   color: "text-sky-300",    group: "Transcript" },
  { key: "transcript_ai_generate",label: "AI Altyazı Üret",       description: "Creator'ların metin yapıştırıp AI ile zaman damgalı VTT üretebilmesi.",   icon: Wand2,      color: "text-violet-400", group: "Transcript" },
  { key: "transcript_ai_write",  label: "AI Transcript Yaz",      description: "AI yazma asistanı: notlardan/prompttan düzgün transcript oluşturma.",       icon: PenTool,    color: "text-purple-400", group: "Transcript" },
  { key: "transcript_translate", label: "Altyazı Çevirisi",       description: "Mevcut altyazıyı başka bir dile AI ile çevirme özelliği.",                  icon: Globe,      color: "text-emerald-400",group: "Transcript" },
  { key: "transcript_community", label: "Topluluk Katkıları",     description: "İzleyicilerin transcript önermesi ve creator onaylaması.",                   icon: Users,      color: "text-orange-400", group: "Transcript" },
  { key: "transcript_export",    label: "Transcript Dışa Aktar",  description: "Altyazıları VTT, SRT ve TXT olarak indirme butonu.",                        icon: Download,   color: "text-cyan-300",   group: "Transcript" },
  { key: "transcript_upload",    label: "VTT Yükleme",            description: "Creator'ların hazır VTT/SRT dosyası yükleyebilmesi.",                       icon: Upload,     color: "text-blue-400",   group: "Transcript" },
];

type StatusMap = Record<string, "idle" | "saving" | "saved" | "error">;

export function AdminFeatureFlags() {
  const { flags, refetch } = useFeatureFlags();
  const [local, setLocal] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<StatusMap>({});
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!initialised) {
      setLocal({ ...flags });
      setInitialised(true);
    }
  }, [flags, initialised]);

  const toggle = async (key: string, state: string) => {
    setLocal(prev => ({ ...prev, [key]: state }));
    setStatus(prev => ({ ...prev, [key]: "saving" }));
    try {
      const res = await fetch(`/api/features/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN()}` },
        body: JSON.stringify({ state }),
      });
      if (!res.ok) throw new Error();
      setStatus(prev => ({ ...prev, [key]: "saved" }));
      refetch();
      setTimeout(() => setStatus(prev => ({ ...prev, [key]: "idle" })), 2000);
    } catch {
      setLocal(prev => ({ ...prev, [key]: flags[key] ?? "enabled" }));
      setStatus(prev => ({ ...prev, [key]: "error" }));
      setTimeout(() => setStatus(prev => ({ ...prev, [key]: "idle" })), 3000);
    }
  };

  const groups = Array.from(new Set(FLAG_DEFS.map(f => f.group)));

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold mb-1">Özellik Yönetimi</h1>
        <p className="text-sm text-[#666]">enabled: görünür ve çalışır, maintenance: görünür ama tıklanınca uyarı verir, disabled: tamamen gizlenir.</p>
      </div>

      {groups.map(group => (
        <div key={group}>
          <h2 className="text-xs font-bold text-[#555] uppercase tracking-widest mb-3">{group}</h2>
          <div className="space-y-3">
            {FLAG_DEFS.filter(f => f.group === group).map(def => {
              const state = (local[def.key] ?? flags[def.key] ?? "enabled") as string;
              const st = status[def.key] ?? "idle";
              return (
                <div key={def.key} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-5 py-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-[#2a2a2a] shrink-0">
                    <def.icon className={`h-5 w-5 ${def.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-semibold text-sm text-white">{def.label}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${state === "enabled" ? "bg-green-900/40 text-green-400" : state === "maintenance" ? "bg-yellow-900/40 text-yellow-400" : "bg-red-900/40 text-red-400"}`}>
                        {state === "enabled" ? "AKTİF" : state === "maintenance" ? "BAKIM" : "PASİF"}
                      </span>
                    </div>
                    <p className="text-xs text-[#666] leading-relaxed">{def.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {st === "saving" && <Loader2 className="h-4 w-4 text-[#666] animate-spin" />}
                    {st === "saved" && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                    {st === "error" && <AlertTriangle className="h-4 w-4 text-red-400" />}
                    <select value={state} onChange={(e) => toggle(def.key, e.target.value)} className="bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white">
                      <option value="enabled">Aktif</option>
                      <option value="maintenance">Bakım</option>
                      <option value="disabled">Pasif</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
