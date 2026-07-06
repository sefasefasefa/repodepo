import { useState, useEffect } from "react";
import { X, Coins, Check, Loader2, Zap, Star, Gift, Crown, BadgePercent, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

const FALLBACK_PACKAGES = [
  { id: -1, name: "Başlangıç",  tokens: 100,  priceUsd: "1.00",  bonus: 0,   isPopular: false, icon: Zap    },
  { id: -2, name: "Standart",   tokens: 500,  priceUsd: "4.50",  bonus: 50,  isPopular: false, icon: Star   },
  { id: -3, name: "Popüler",    tokens: 1000, priceUsd: "8.00",  bonus: 150, isPopular: true,  icon: Crown  },
  { id: -4, name: "Premium",    tokens: 5000, priceUsd: "35.00", bonus: 1000,isPopular: false, icon: Gift   },
];

const ICONS: Record<string, any> = { Zap, Star, Crown, Gift, Coins };

interface Props { onClose: () => void; onPurchased?: (tokens: number) => void; }

export function TokenBuyModal({ onClose, onPurchased }: Props) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [buying, setBuying]     = useState(false);
  const [success, setSuccess]   = useState<{ tokens: number; pkg: string } | null>(null);
  const [couponEnabled] = useState(false);
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    apiFetch("/tokens/packages")
      .then(d => {
        const pkgs = d.packages?.length ? d.packages : FALLBACK_PACKAGES;
        setPackages(pkgs);
        const popular = pkgs.find((p: any) => p.isPopular) || pkgs[1];
        if (popular) setSelected(popular.id);
      })
      .catch(() => {
        setPackages(FALLBACK_PACKAGES);
        setSelected(-3);
      });
  }, []);

  const handleBuy = async () => {
    if (!selected) return;
    const pkg = packages.find(p => p.id === selected);
    if (!pkg) return;
    setBuying(true);
    try {
      const d = await apiFetch("/tokens/purchase", {
        method: "POST",
        body: JSON.stringify({ packageId: selected, couponCode: couponEnabled ? couponCode.trim() || undefined : undefined }),
      });
      setSuccess({ tokens: d.tokens, pkg: pkg.name });
      onPurchased?.(d.tokens);
      setTimeout(onClose, 2500);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  const selectedPkg = packages.find(p => p.id === selected);

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "min(90vh, 90dvh)" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#242424] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-yellow-500/15 rounded-lg">
              <Coins className="h-4 w-4 text-yellow-400" />
            </div>
            <span className="font-bold text-base">Token Satın Al</span>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="flex-1 min-h-0 px-5 py-12 text-center space-y-3 overflow-y-auto">
            <div className="w-16 h-16 bg-yellow-500/15 border-2 border-yellow-500/30 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-7 w-7 text-yellow-400" />
            </div>
            <p className="text-lg font-bold">Satın Alındı!</p>
            <p className="text-sm text-[#888]">
              <span className="text-yellow-400 font-bold">{success.tokens.toLocaleString("tr")} 🪙</span> hesabına eklendi.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 px-5 py-5 space-y-4 overflow-y-auto overscroll-contain">
            <p className="text-xs text-[#666] text-center">
              1 Token = $0.01 • Creator'lar %80 alır, %20 platform komisyonu
            </p>

            <div className="rounded-xl border border-[#2a2a2a] bg-[#111] p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <BadgePercent className="h-4 w-4 text-[#777]" />
                    Kupon Kodu
                  </p>
                  <p className="text-[11px] text-[#666] mt-1">Şu an kapalı. Sonra aktif edeceksin.</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold bg-[#222] text-[#888] border border-[#333]">
                  <Lock className="h-3 w-3" /> Pasif
                </span>
              </div>
              <div className="flex gap-2 opacity-60 pointer-events-none select-none">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="KUPON KODU"
                  className="flex-1 h-10 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] px-3 text-sm text-white placeholder:text-[#555] outline-none"
                  disabled
                />
                <Button type="button" variant="secondary" className="h-10 px-4 bg-[#222] text-[#777]" disabled>
                  Kullan
                </Button>
              </div>
              <div className="rounded-lg border border-dashed border-[#333] bg-black/20 px-3 py-2 text-[11px] text-[#777] flex items-center gap-2">
                <BadgePercent className="h-3.5 w-3.5" />
                Yıllık abonelikte indirim aktif olabilir; kupon alanı daha sonra açılacak.
              </div>
              <div className="rounded-lg border border-dashed border-[#333] bg-black/20 px-3 py-2 text-[11px] text-[#777] flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                Ücretsiz deneme şu an pasif.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {packages.map(pkg => {
                const totalTokens = pkg.tokens + (pkg.bonus || 0);
                const isSelected  = selected === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelected(pkg.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 py-4 px-3 rounded-xl border transition-all text-center",
                      isSelected
                        ? "border-yellow-500/60 bg-yellow-500/10 shadow-lg shadow-yellow-500/10"
                        : "border-[#2a2a2a] bg-[#1e1e1e] hover:border-[#444]"
                    )}
                  >
                    {pkg.isPopular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                        En Popüler
                      </span>
                    )}
                    <span className="text-2xl">🪙</span>
                    <div>
                      <p className={cn("text-lg font-black", isSelected ? "text-yellow-400" : "text-white")}>{totalTokens.toLocaleString("tr")}</p>
                      {pkg.bonus > 0 && <p className="text-[10px] text-green-400 font-semibold">+{pkg.bonus} bonus</p>}
                    </div>
                    <p className="text-xs text-[#888]">{pkg.name}</p>
                    <p className={cn("text-sm font-bold", isSelected ? "text-yellow-400" : "text-white")}>${parseFloat(pkg.priceUsd).toFixed(2)}</p>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-black" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedPkg && (
              <div className="bg-[#111] border border-[#222] rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between text-[#888]"><span>Alacaksın</span><span className="text-yellow-400 font-bold">{(selectedPkg.tokens + (selectedPkg.bonus || 0)).toLocaleString("tr")} 🪙</span></div>
                {selectedPkg.bonus > 0 && <div className="flex justify-between text-[#888]"><span>Bonus</span><span className="text-green-400 font-semibold">+{selectedPkg.bonus} token ücretsiz</span></div>}
                <div className="flex justify-between text-[#888]"><span>Ödenecek</span><span className="text-white font-bold">${parseFloat(selectedPkg.priceUsd).toFixed(2)}</span></div>
              </div>
            )}

            <p className="text-[10px] text-[#444] text-center">Demo modda: Gerçek ödeme alınmaz. Üretim ortamında ödeme entegrasyonu bağlanır.</p>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1 border-[#333] text-[#888] hover:text-white">İptal</Button>
              <Button onClick={handleBuy} disabled={!selected || buying} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-2">
                {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                Satın Al
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
