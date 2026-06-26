import { AppLayout } from "@/components/layout/app-layout";
import { useGetCurrentSubscription, useCancelSubscription } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Crown, CheckCircle2, Calendar, CreditCard, Zap,
  ArrowRight, Sparkles, Clock, AlertTriangle, Loader2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const PLAN_PERKS: Record<string, string[]> = {
  ücretsiz: ["SD kalite", "Reklamlı izleme", "Temel içerik"],
  basic:    ["Reklamsız izleme", "HD kalite (720p)", "Sınırsız video", "İndirme özelliği"],
  premium:  ["Reklamsız izleme", "4K Ultra HD kalite", "Sınırsız video", "İndirme özelliği", "Öncelikli destek", "Özel içeriklere erişim", "Aylık 50 bonus token"],
  creator:  ["Tüm Premium özellikler", "Creator dashboard", "Gelir analitikleri", "Öncelikli destek", "API erişimi"],
  vip:      ["Reklamsız izleme", "8K + Canlı yayın kalitesi", "Sınırsız video + Arşiv", "Sınırsız indirme", "7/24 Öncelikli destek", "Tüm özel içerikler", "Aylık 200 bonus token", "Creator mesajlarına öncelik", "VIP rozeti"],
};

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-green-900/20 text-green-400 border-green-500/30",
  trialing: "bg-blue-900/20 text-blue-400 border-blue-500/30",
  past_due: "bg-red-900/20 text-red-400 border-red-500/30",
  canceled: "bg-[#222] text-[#666] border-[#333]",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Aktif", trialing: "Deneme", past_due: "Gecikmiş", canceled: "İptal Edildi",
};

function CancelDialog({ onConfirm, onClose, loading }: { onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1">Aboneliği İptal Et</h3>
            <p className="text-sm text-[#777] leading-relaxed">
              Aboneliğini iptal etmek istediğine emin misin? Mevcut dönemin sonuna kadar erişimin devam eder.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onConfirm} disabled={loading} variant="destructive" className="flex-1 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            {loading ? "İptal ediliyor..." : "Evet, İptal Et"}
          </Button>
          <Button onClick={onClose} disabled={loading} variant="outline" className="flex-1 border-[#333] text-[#aaa] hover:text-white">
            Geri Dön
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Subscriptions() {
  const { data: rawData, isLoading } = useGetCurrentSubscription();
  const sub = (rawData as any)?.subscription ?? rawData;
  const { mutate: cancelSub, isPending: canceling } = useCancelSubscription();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);

  const planName = (sub?.plan?.name ?? "").toLowerCase();
  const perks = PLAN_PERKS[planName] ?? PLAN_PERKS.premium;
  const renewDate = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const handleCancel = () => {
    cancelSub(undefined, {
      onSuccess: () => {
        toast({ title: "Abonelik iptal edildi", description: "Mevcut dönem sonuna kadar erişimin devam eder." });
        queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
        setShowCancel(false);
      },
      onError: () => {
        toast({ title: "Hata", description: "İptal işlemi başarısız oldu. Tekrar deneyin.", variant: "destructive" });
        setShowCancel(false);
      },
    });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
            <Crown className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Aboneliğim</h1>
            <p className="text-sm text-[#666]">Plan yönetimi ve ayrıcalıklar</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="h-48 bg-[#161616] border border-[#222] rounded-2xl animate-pulse" />
            <div className="h-32 bg-[#161616] border border-[#222] rounded-2xl animate-pulse" />
          </div>
        ) : sub ? (
          <>
            <div className="relative bg-[#161616] border border-[#222] rounded-2xl overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-500 via-primary to-violet-500" />
              <div className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <Crown className="h-5 w-5 text-yellow-400" />
                      <h2 className="text-xl font-bold text-white">{sub.plan?.name ?? planName} Plan</h2>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", STATUS_STYLE[sub.status] ?? STATUS_STYLE.active)}>
                        {STATUS_LABEL[sub.status] ?? sub.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#666]">Aktif aboneliğin süre ve detayları</p>
                  </div>
                  {sub.plan?.price != null && (
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">
                        ${sub.plan.price}<span className="text-sm text-[#666] font-normal">/ay</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] text-[#555] uppercase tracking-widest font-bold">Yenileme Tarihi</span>
                    </div>
                    <p className="text-sm font-bold text-white">{renewDate ?? "—"}</p>
                  </div>
                  <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-[11px] text-[#555] uppercase tracking-widest font-bold">Ödeme Durumu</span>
                    </div>
                    <p className={cn("text-sm font-bold", sub.status === "active" ? "text-green-400" : "text-[#888]")}>
                      {STATUS_LABEL[sub.status] ?? "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-[#555] font-bold uppercase tracking-widest mb-3">Planına Dahil Ayrıcalıklar</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perks.map((perk) => (
                      <div key={perk} className="flex items-center gap-2 text-sm text-[#ccc]">
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /> {perk}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2 border-t border-[#1e1e1e] flex-wrap">
                  <Link href="/pricing">
                    <Button variant="outline" className="border-[#333] text-[#aaa] hover:text-white gap-2">
                      <Zap className="h-4 w-4" /> Plan Değiştir
                    </Button>
                  </Link>
                  {sub.status !== "canceled" && (
                    <Button
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/10 gap-2"
                      onClick={() => setShowCancel(true)}
                    >
                      <XCircle className="h-4 w-4" /> Aboneliği İptal Et
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
              <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Aboneliğini en iyi şekilde kullan</p>
                <p className="text-xs text-[#888] mt-0.5">
                  Premium özel içerikleri keşfetmek için{" "}
                  <Link href="/videos?isPremium=true">
                    <span className="text-primary underline cursor-pointer">buraya tıkla</span>
                  </Link>. Tokenlerin ile yaratıcılara bahşiş verebilirsin.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="relative bg-[#161616] border border-[#222] rounded-2xl overflow-hidden text-center py-14 px-6">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-500 via-primary to-violet-500" />
              <div className="inline-flex p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 mb-5">
                <Crown className="h-8 w-8 text-yellow-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Aktif Abonelik Yok</h2>
              <p className="text-[#666] text-sm max-w-md mx-auto mb-6">
                Premium plana geçerek reklamsız izleme, özel içerikler ve daha fazlasına erişin.
              </p>
              <Link href="/pricing">
                <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
                  <Sparkles className="h-4 w-4" /> Planları İncele <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: "🚀", title: "Reklamsız", desc: "Kesintisiz izleme deneyimi" },
                { icon: "🎬", title: "4K Kalite", desc: "En yüksek görüntü kalitesi" },
                { icon: "🪙", title: "Token Bonusu", desc: "Her ay ücretsiz token" },
              ].map(f => (
                <div key={f.title} className="bg-[#161616] border border-[#1e1e1e] rounded-xl p-4 text-center">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <p className="font-semibold text-white text-sm">{f.title}</p>
                  <p className="text-xs text-[#666] mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showCancel && (
        <CancelDialog
          onConfirm={handleCancel}
          onClose={() => setShowCancel(false)}
          loading={canceling}
        />
      )}
    </AppLayout>
  );
}
