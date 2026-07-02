import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Star, Globe } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface Player {
  id: number;
  videoId: number;
  playerName: string;
  embedCode?: string;
  directUrl?: string;
  isDefault: boolean;
  quality: string;
  language: string;
  sortOrder: number;
  isActive: boolean;
}

const KNOWN_PLAYERS = [
  "Kendi Oynatıcı (HLS)",
  "Streamtape",
  "Doodstream",
  "Mixdrop",
  "Filemoon",
  "Vidmoly",
  "Upstream",
  "Özel Embed",
];

export function VideoPlayerManager({ videoId, onBack }: { videoId: number; onBack: () => void }) {
  const { token } = useAuth() as any;
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ playerName: "Kendi Oynatıcı (HLS)", embedCode: "", directUrl: "", quality: "HD", language: "TR", isDefault: false });

  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/videos/${videoId}/players`, { headers });
      if (!r.ok) { setPlayers([]); return; }
      const d = await r.json();
      setPlayers(d.players || []);
    } catch { setPlayers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [videoId]);

  const handleAdd = async () => {
    if (!newPlayer.playerName) return;
    await fetch(`/api/videos/${videoId}/players`, { method: "POST", headers, body: JSON.stringify(newPlayer) });
    setShowAdd(false);
    setNewPlayer({ playerName: "Kendi Oynatıcı (HLS)", embedCode: "", directUrl: "", quality: "HD", language: "TR", isDefault: false });
    load();
  };

  const handleDelete = async (playerId: number) => {
    await fetch(`/api/videos/${videoId}/players/${playerId}`, { method: "DELETE", headers });
    load();
  };

  const handleSetDefault = async (playerId: number) => {
    await fetch(`/api/videos/${videoId}/players/${playerId}`, { method: "PATCH", headers, body: JSON.stringify({ isDefault: true }) });
    load();
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded hover:bg-[#222] text-[#888] hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold">Video #{videoId} — Oynatıcılar</h2>
      </div>

      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 text-sm text-[#888] space-y-1">
        <p className="text-[#ccc] font-medium">Nasıl çalışır?</p>
        <p>Her videoya birden fazla oynatıcı ekleyebilirsin (Streamtape embed kodu, direct URL veya kendi HLS oynatıcımız). İzleyici istediği oynatıcıyı seçer.</p>
        <p>Varsayılan oynatıcı ilk açıldığında görünür. Streamtape vb. için embed kodunu (<code className="text-primary">&lt;iframe ...&gt;</code>) yapıştır.</p>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({length:2}).map((_,i) => <div key={i} className="h-16 bg-[#1e1e1e] rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {players.map(p => (
            <div key={p.id} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 flex items-center gap-3">
              <Globe className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[#ddd]">{p.playerName}</p>
                  {p.isDefault && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Varsayılan</span>}
                  <span className="text-xs text-[#555]">{p.quality} • {p.language}</span>
                </div>
                {p.embedCode && <p className="text-xs text-[#555] truncate mt-0.5">{p.embedCode.substring(0, 80)}...</p>}
                {p.directUrl && <p className="text-xs text-[#555] truncate mt-0.5">{p.directUrl}</p>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {!p.isDefault && (
                  <button onClick={() => handleSetDefault(p.id)} title="Varsayılan yap" className="p-1.5 rounded hover:bg-[#333] text-[#666] hover:text-yellow-400 transition-colors">
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-900/30 text-[#666] hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
          <p className="font-medium text-sm">Yeni Oynatıcı Ekle</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-[#777] mb-1 block">Oynatıcı Tipi</label>
              <select value={newPlayer.playerName} onChange={e => setNewPlayer(p => ({...p, playerName: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white">
                {KNOWN_PLAYERS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-[#777] mb-1 block">Embed Kodu (iframe) — Streamtape, Doodstream vb.</label>
              <textarea value={newPlayer.embedCode} onChange={e => setNewPlayer(p => ({...p, embedCode: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white h-20 resize-none" placeholder='<iframe src="https://streamtape.com/e/..." ...></iframe>' />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-[#777] mb-1 block">Direct URL (HLS .m3u8 veya MP4)</label>
              <input value={newPlayer.directUrl} onChange={e => setNewPlayer(p => ({...p, directUrl: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white" placeholder="https://example.com/video.m3u8" />
            </div>
            <div>
              <label className="text-xs text-[#777] mb-1 block">Kalite</label>
              <select value={newPlayer.quality} onChange={e => setNewPlayer(p => ({...p, quality: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white">
                {["4K","1080p","720p","480p","360p","HD","SD"].map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#777] mb-1 block">Dil</label>
              <select value={newPlayer.language} onChange={e => setNewPlayer(p => ({...p, language: e.target.value}))} className="w-full bg-[#252525] border border-[#333] rounded px-3 py-2 text-sm text-white">
                {["TR","EN","DE","FR","ES","RU"].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isDefault" checked={newPlayer.isDefault} onChange={e => setNewPlayer(p => ({...p, isDefault: e.target.checked}))} className="w-4 h-4" />
              <label htmlFor="isDefault" className="text-sm text-[#aaa]">Varsayılan oynatıcı olarak ayarla</label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 rounded text-sm bg-[#333] text-[#aaa] hover:bg-[#444]">İptal</button>
            <button onClick={handleAdd} className="px-4 py-1.5 rounded text-sm bg-primary text-white hover:bg-primary/90">Ekle</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-[#333] text-[#777] hover:border-primary hover:text-primary transition-colors text-sm w-full justify-center">
          <Plus className="h-4 w-4" /> Yeni Oynatıcı Ekle
        </button>
      )}
    </div>
  );
}
