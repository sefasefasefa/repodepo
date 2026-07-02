import { useState } from "react";
import { X, Send, Coins, AlertCircle, CheckCircle2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CustomRequestModalProps {
  creator: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null };
  currentBalance: number;
  onClose: () => void;
  onSent?: () => void;
}

const PRESET_OFFERS = [0, 50, 100, 250, 500, 1000];

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

export function CustomRequestModal({ creator, currentBalance, onClose, onSent }: CustomRequestModalProps) {
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [tokenOffer, setTokenOffer] = useState(0);
  const [sending, setSending]       = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState(false);

  const usdValue = (tokenOffer * 0.01).toFixed(2);
  const canAfford = currentBalance >= tokenOffer;
  const valid = title.trim().length >= 5 && description.trim().length >= 10;

  const handleSend = async () => {
    if (!valid) return;
    setSending(true); setError("");
    try {
      await apiFetch("/custom-requests", {
        method: "POST",
        body: JSON.stringify({ toCreatorId: creator.id, title, description, tokenOffer }),
      });
      setSuccess(true);
      setTimeout(() => { onSent?.(); onClose(); }, 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">Özel İstek Gönder</h2>
              <p className="text-xs text-[#555]">@{creator.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#222] text-[#666] hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-white font-semibold">İstek gönderildi!</p>
            <p className="text-[#666] text-sm mt-1">@{creator.username} isteğini inceleyecek</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">

            {/* Başlık */}
            <div>
              <label className="text-xs text-[#666] mb-1.5 block font-medium">İstek Başlığı <span className="text-red-500">*</span></label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Kısa ve açıklayıcı bir başlık..."
                maxLength={100}
                className="bg-[#1e1e1e] border-[#2a2a2a] focus:border-primary"
              />
              <p className="text-[10px] text-[#444] mt-1 text-right">{title.length}/100</p>
            </div>

            {/* Açıklama */}
            <div>
              <label className="text-xs text-[#666] mb-1.5 block font-medium">İstek Detayları <span className="text-red-500">*</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="İçerikten ne beklediğinizi detaylı açıklayın..."
                maxLength={1000}
                rows={5}
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary resize-none"
              />
              <p className="text-[10px] text-[#444] mt-1 text-right">{description.length}/1000</p>
            </div>

            {/* Token teklifi */}
            <div>
              <label className="text-xs text-[#666] mb-1.5 flex items-center gap-1 font-medium">
                <Coins className="h-3.5 w-3.5 text-yellow-400" />
                Token Teklifi
                <span className="text-[#555] font-normal ml-1">(isteğe bağlı)</span>
              </label>

              {/* Preset butonlar */}
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_OFFERS.map(v => (
                  <button
                    key={v}
                    onClick={() => setTokenOffer(v)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                      tokenOffer === v
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-600"
                        : "bg-[#1e1e1e] text-[#666] border-[#2a2a2a] hover:border-[#444] hover:text-white"
                    )}
                  >
                    {v === 0 ? "Ücretsiz" : `${v} 🪙`}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min={0}
                  value={tokenOffer || ""}
                  onChange={e => setTokenOffer(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Özel miktar..."
                  className="bg-[#1e1e1e] border-[#2a2a2a]"
                />
                <div className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-xs text-[#666] whitespace-nowrap shrink-0">
                  ≈ ${usdValue}
                </div>
              </div>

              {/* Bakiye göstergesi */}
              <div className={cn("flex items-center justify-between mt-2 px-3 py-2 rounded-lg text-xs border",
                canAfford
                  ? "bg-[#1a1a1a] border-[#222] text-[#666]"
                  : "bg-red-900/10 border-red-800 text-red-400"
              )}>
                <span>Bakiyeniz: <strong className="text-yellow-400">{currentBalance} 🪙</strong></span>
                {!canAfford && tokenOffer > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Yetersiz bakiye
                  </span>
                )}
              </div>
            </div>

            {/* Bilgi notu */}
            <div className="bg-[#1a1a1a] border border-[#222] rounded-xl px-4 py-3 text-xs text-[#555] space-y-1">
              <p>• Token teklifiniz istek kabul edilene kadar dondurulur</p>
              <p>• Reddedilirse tokenlar iade edilir</p>
              <p>• Tamamlandığında yaratıcı %80 kazanır, %20 platform komisyonu</p>
              <p>• Bekleyen istekler 7 gün sonra otomatik sona erer</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Gönder */}
            <Button
              onClick={handleSend}
              disabled={sending || !valid || !canAfford}
              className="w-full bg-primary hover:bg-primary/90 gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {tokenOffer > 0 ? `${tokenOffer} Token ile İstek Gönder` : "İstek Gönder"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
