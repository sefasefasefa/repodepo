import { Crown, Lock, Play, Star, Zap, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface Props {
  video: any;
  isPPV?: boolean;
  onLoginClick?: () => void;
  isLoggedIn?: boolean;
}

export function PremiumPaywall({ video, isPPV = false, onLoginClick, isLoggedIn = false }: Props) {
  const [, setLocation] = useLocation();

  const benefits = [
    "Tüm premium videolara sınırsız erişim",
    "Reklamsız izleme deneyimi",
    "4K & HD kalite",
    "İçerikleri offline kaydetme",
    "Creator'larla özel etkileşim",
  ];

  return (
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden select-none">
      {/* Bulanık arka plan thumbnail */}
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-25 pointer-events-none"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] to-[#0a0a1a]" />
      )}

      {/* Koyu overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />

      {/* İçerik */}
      <div className="relative h-full flex flex-col items-center justify-center px-6 text-center gap-4">

        {/* Üst ikon */}
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center mb-1",
          isPPV ? "bg-yellow-500/20 border-2 border-yellow-500/40" : "bg-primary/20 border-2 border-primary/40"
        )}>
          {isPPV
            ? <Zap className="h-7 w-7 text-yellow-400" />
            : <Crown className="h-7 w-7 text-primary" />
          }
        </div>

        {/* Başlık */}
        <div>
          <p className={cn(
            "text-xs font-bold uppercase tracking-widest mb-1",
            isPPV ? "text-yellow-400" : "text-primary"
          )}>
            {isPPV ? "Kilit Açma Gerekli" : "Premium İçerik"}
          </p>
          <h3 className="text-xl font-bold text-white">
            {isPPV ? "Bu videoyu izlemek için satın al" : "Bu video premium üyeler için"}
          </h3>
        </div>

        {/* Creator bilgisi */}
        {video.creator && (
          <div className="flex items-center gap-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={video.creator.avatarUrl || ""} />
              <AvatarFallback className="text-xs">{video.creator.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-white font-medium">@{video.creator.username}</span>
            {video.creator.isVerified && (
              <span className="w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[8px] text-white font-bold">✓</span>
            )}
          </div>
        )}

        {/* PPV fiyat veya avantajlar */}
        {isPPV && video.ppvPrice ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-6 py-3 text-center">
            <p className="text-3xl font-bold text-yellow-400">${Number(video.ppvPrice).toFixed(2)}</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">tek seferlik ödeme</p>
          </div>
        ) : (
          <div className="hidden md:flex flex-wrap justify-center gap-x-4 gap-y-1.5 max-w-sm">
            {benefits.slice(0, 3).map((b, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-white/60">
                <Check className="h-3 w-3 text-primary shrink-0" />{b}
              </span>
            ))}
          </div>
        )}

        {/* Aksiyon butonları */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          {!isLoggedIn ? (
            <>
              <Button
                onClick={() => setLocation("/pricing")}
                className="flex-1 gap-2 bg-primary hover:bg-primary/90"
              >
                <Crown className="h-4 w-4" />
                {isPPV ? "Satın Al" : "Premium'a Geç"}
              </Button>
              <Button
                variant="outline"
                onClick={onLoginClick || (() => setLocation("/login"))}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Giriş Yap
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => setLocation("/pricing")}
                className="flex-1 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                size="lg"
              >
                {isPPV ? <Zap className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                {isPPV ? `$${Number(video.ppvPrice || 0).toFixed(2)} — Satın Al` : "Premium'a Geç"}
              </Button>
              {!isPPV && (
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/creators/${video.creator?.id}`)}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  <Star className="h-4 w-4 mr-1.5" />
                  Creator'ı Takip Et
                </Button>
              )}
            </>
          )}
        </div>

        {/* Alt bilgi */}
        {!isPPV && (
          <p className="text-xs text-white/30 mt-1">
            İptal etmek her zaman mümkün • Tüm kartlar güvenli
          </p>
        )}
      </div>

      {/* Köşe rozeti */}
      <div className={cn(
        "absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm border",
        isPPV
          ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
          : "bg-primary/20 border-primary/40 text-primary"
      )}>
        <Lock className="h-3 w-3" />
        {isPPV ? "PPV" : "PREMIUM"}
      </div>
    </div>
  );
}
