import { useState, useEffect } from "react";
import { X, Coins, Heart, Send, Loader2, Zap, Star, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const PRESETS = [
  { tokens: 10,   label: "10",   icon: Heart,  color: "text-pink-400  border-pink-800  bg-pink-900/20"  },
  { tokens: 50,   label: "50",   icon: Star,   color: "text-yellow-400 border-yellow-800 bg-yellow-900/20" },
  { tokens: 100,  label: "100",  icon: Zap,    color: "text-blue-400  border-blue-800  bg-blue-900/20"  },
  { tokens: 500,  label: "500",  icon: Crown,  color: "text-primary   border-primary/40 bg-primary/10"  },
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

interface Props {
  creator: { id: number; username: string; displayName?: string; avatarUrl?: string };
  videoId?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TokenTipModal({ creator, videoId, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [balance, setBalance]     = useState<number | null>(null);
  const [amount, setAmount]       = useState<number>(50);
  const [custom, setCustom]       = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [message, setMessage]     = useState("");
  const [sending, setSending]     = useState(false);
  const [success, setSuccess]     = useState(false);

  useEffect(() => {
    apiFetch("/tokens/balance").then(d => setBalance(d.balance)).catch(() => setBalance(0));
  }, []);

  const finalAmount = useCustom ? parseInt(custom || "0") : amount;
  const usd         = (finalAmount * 0.01).toFixed(2);
  const creatorGets = Math.floor(finalAmount * 0.80);
  const hasEnough   = balance !== null && balance >= finalAmount;

  const handleSend = async () => {
    if (!finalAmount || finalAmount < 1) {
      toast({ title: "Geçersiz miktar", variant: "destructive" });
      return;
    }
    if (!hasEnough) {
      toast({ title: "Yetersiz bakiye", description: "Token satın al", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await apiFetch("/tokens/tip", {
        method: "POST",
        body: JSON.stringify({ creatorId: creator.id, amount: finalAmount, videoId, message }),
      });
      setBalance(b => (b ?? 0) - finalAmount);
      setSuccess(true);
      onSuccess?.();
      setTimeout(onClose, 2000);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Başlık */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#242424]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-yellow-500/15 rounded-lg">
              <Coins className="h-4 w-4 text-yellow-400" />
            </div>
            <span className="font-bold text-base">Bahşiş Gönder</span>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          /* Başarı ekranı */
          <div className="px-5 py-10 text-center space-y-3">
            <div className="w-16 h-16 bg-green-500/15 border-2 border-green-500/30 rounded-full flex items-center justify-center mx-auto">
              <Heart className="h-7 w-7 text-green-400 fill-green-400" />
            </div>
            <p className="text-lg font-bold text-white">Bahşiş Gönderildi!</p>
            <p className="text-sm text-[#888]">
              <span className="text-yellow-400 font-semibold">{finalAmount} 🪙</span> gönderdin,{" "}
              <span className="font-semibold text-white">@{creator.username}</span> aldı.
            </p>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            {/* Creator */}
            <div className="flex items-center gap-3 bg-[#222] rounded-xl p-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={creator.avatarUrl || ""} />
                <AvatarFallback>{creator.username.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{creator.displayName || creator.username}</p>
                <p className="text-xs text-[#666]">@{creator.username}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-[#666]">Bakiyen</p>
                <p className={cn("text-sm font-bold", balance === null ? "text-[#555]" : balance === 0 ? "text-red-400" : "text-yellow-400")}>
                  {balance === null ? "—" : `${balance.toLocaleString("tr")} 🪙`}
                </p>
              </div>
            </div>

            {/* Hızlı seçim */}
            <div>
              <p className="text-xs text-[#666] mb-2 font-medium">Hızlı Seçim</p>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p.tokens}
                    onClick={() => { setAmount(p.tokens); setUseCustom(false); }}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all",
                      !useCustom && amount === p.tokens ? p.color : "border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-white bg-[#1e1e1e]"
                    )}
                  >
                    <p.icon className="h-4 w-4" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Özel miktar */}
            <div>
              <p className="text-xs text-[#666] mb-2 font-medium">Özel Miktar</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Token miktarı..."
                  value={custom}
                  onChange={e => { setCustom(e.target.value); setUseCustom(true); }}
                  onFocus={() => setUseCustom(true)}
                  className="bg-[#242424] border-[#333] focus-visible:ring-yellow-500/50 flex-1"
                />
                <div className="flex items-center px-3 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg text-xs text-[#666]">
                  🪙
                </div>
              </div>
            </div>

            {/* Mesaj */}
            <div>
              <p className="text-xs text-[#666] mb-2 font-medium">Mesaj <span className="text-[#444]">(opsiyonel)</span></p>
              <Input
                placeholder="Bir şey yaz..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={100}
                className="bg-[#242424] border-[#333] focus-visible:ring-yellow-500/50"
              />
            </div>

            {/* Özet */}
            {finalAmount > 0 && (
              <div className="bg-[#111] border border-[#222] rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#888]">
                  <span>Gönderilecek</span>
                  <span className="text-white font-semibold">{finalAmount} 🪙 ≈ ${usd}</span>
                </div>
                <div className="flex justify-between text-[#888]">
                  <span>Creator alacak (%80)</span>
                  <span className="text-green-400 font-semibold">{creatorGets} 🪙</span>
                </div>
                <div className="flex justify-between text-[#888]">
                  <span>Platform komisyonu (%20)</span>
                  <span className="text-[#555]">{finalAmount - creatorGets} 🪙</span>
                </div>
              </div>
            )}

            {/* Yetersiz bakiye */}
            {balance !== null && !hasEnough && finalAmount > 0 && (
              <div className="bg-red-900/20 border border-red-800 rounded-xl p-3 text-xs text-red-400 flex items-center justify-between gap-3">
                <span>Yeterli token yok ({finalAmount - (balance ?? 0)} eksik)</span>
                <button onClick={() => { onClose(); setLocation("/payment"); }} className="text-red-300 underline whitespace-nowrap">
                  Token Al →
                </button>
              </div>
            )}

            {/* Gönder butonu */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1 border-[#333] text-[#888] hover:text-white">
                İptal
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !finalAmount || finalAmount < 1 || !hasEnough}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Gönder
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
