import { AppLayout } from "@/components/layout/app-layout";
import { useListSubscriptionPlans } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PLAN_ICONS: Record<string, typeof Crown> = {
  basic: Zap,
  premium: Crown,
  creator: Star,
};

export default function Pricing() {
  const { data, isLoading } = useListSubscriptionPlans();
  const plans = (data as any)?.plans ?? data;
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-10">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-2">Premium Üyelik</Badge>
          <h1 className="text-4xl font-black text-white tracking-tight">
            Favori içerik üreticilerini destekle
          </h1>
          <p className="text-[#666] text-base leading-relaxed">
            Özel videolara, sahne arkası içeriklere ve çok daha fazlasına erişim sağla.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 bg-[#161616] border border-[#222] rounded-xl p-1 mt-4">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-semibold transition-all",
                billing === "monthly"
                  ? "bg-primary text-white shadow"
                  : "text-[#666] hover:text-[#aaa]"
              )}
            >
              Aylık
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
                billing === "yearly"
                  ? "bg-primary text-white shadow"
                  : "text-[#666] hover:text-[#aaa]"
              )}
            >
              Yıllık
              <span className="text-[10px] font-black bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/20">
                %20 İNDİRİM
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-96 rounded-2xl bg-[#161616] border border-[#1e1e1e] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans?.map(plan => {
              const Icon = PLAN_ICONS[(plan.name ?? "").toLowerCase()] ?? Crown;
              const monthlyPrice = plan.price;
              const yearlyMonthly = +(monthlyPrice * 0.8).toFixed(2);
              const displayPrice = billing === "yearly" ? yearlyMonthly : monthlyPrice;
              const yearlyTotal = +(monthlyPrice * 12 * 0.8).toFixed(2);

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-1",
                    plan.isPopular
                      ? "border-primary shadow-[0_0_40px_rgba(168,85,247,0.2)] bg-[#161616]"
                      : "border-[#1e1e1e] bg-[#111] hover:border-[#2a2a2a]"
                  )}
                >
                  {plan.isPopular && (
                    <>
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-violet-400 to-primary" />
                      <div className="absolute top-4 right-4">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-primary text-white uppercase tracking-wider">
                          Popüler
                        </span>
                      </div>
                    </>
                  )}

                  <div className="p-6 flex-1 flex flex-col">
                    {/* Plan header */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className={cn(
                        "p-2.5 rounded-xl border",
                        plan.isPopular
                          ? "bg-primary/10 border-primary/20"
                          : "bg-[#1a1a1a] border-[#2a2a2a]"
                      )}>
                        <Icon className={cn("h-5 w-5", plan.isPopular ? "text-primary" : "text-[#666]")} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg leading-tight">{plan.name}</h3>
                        {plan.description && (
                          <p className="text-xs text-[#555] mt-0.5 leading-snug">{plan.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-5">
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-black text-white">${displayPrice}</span>
                        <span className="text-[#555] text-sm mb-1">/ay</span>
                      </div>
                      {billing === "yearly" && (
                        <p className="text-xs text-green-400 mt-1">
                          Yıllık ödeme: ${yearlyTotal} — ${(monthlyPrice * 12 - yearlyTotal).toFixed(2)} tasarruf
                        </p>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5 flex-1 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <Check className={cn("h-4 w-4 shrink-0 mt-0.5", plan.isPopular ? "text-primary" : "text-green-400")} />
                          <span className="text-[#bbb] leading-snug">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      href={`/payment?plan=${plan.id}&billing=${billing}`}
                      className="w-full"
                    >
                      <Button
                        className={cn("w-full rounded-xl font-bold", plan.isPopular
                          ? "bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                          : "bg-[#1e1e1e] hover:bg-[#2a2a2a] text-[#aaa] hover:text-white border border-[#2a2a2a]"
                        )}
                      >
                        {billing === "yearly" ? "Yıllık Abonelik" : "Aylık Abonelik"}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 pt-4">
          {[
            "✅ İptal anında geçerli",
            "🔒 Güvenli ödeme",
            "🎯 7/24 Destek",
          ].map(item => (
            <span key={item} className="text-sm text-[#555]">{item}</span>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
