import { useState } from "react";
import { useListSubscriptionPlans } from "@workspace/api-client-react";
import { CreditCard, Users, CheckCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminSubscriptions() {
  const { data } = useListSubscriptionPlans();
  const plans = data?.plans ?? (data as any)?.subscriptionPlans ?? [];

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-bold flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Üyelik Planları</h1>

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan: any) => (
          <div key={plan.id} className={cn("bg-[#1e1e1e] border rounded-xl p-5 relative", plan.isPopular ? "border-primary" : "border-[#2a2a2a]")}>
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-3 py-0.5 rounded-full flex items-center gap-1">
                <Star className="h-3 w-3" /> Popüler
              </div>
            )}
            <h3 className="font-bold text-lg">{plan.name}</h3>
            <div className="text-3xl font-black text-primary my-3">${plan.price}<span className="text-sm text-[#666] font-normal">/{plan.billingCycle === "monthly" ? "ay" : plan.billingCycle}</span></div>
            <p className="text-sm text-[#888] mb-4">{plan.description}</p>
            <ul className="space-y-2">
              {plan.features?.map((f: string, i: number) => (
                <li key={i} className="flex items-center gap-2 text-sm text-[#ccc]">
                  <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />{f}
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-[#2a2a2a] flex items-center gap-2 text-sm text-[#666]">
              <Users className="h-4 w-4" />
              <span>{plan.isActive ? "Aktif" : "Pasif"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5">
        <h2 className="font-bold mb-3 text-[#ddd]">Ödeme Entegrasyonları</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: "Stripe", status: "Hazır", note: "Kart ödemeleri" },
            { name: "PayPal", status: "Yakında", note: "PayPal ödemeleri" },
            { name: "Kripto", status: "Yakında", note: "BTC/ETH" },
            { name: "Papara", status: "Yakında", note: "Türk lirası" },
          ].map(p => (
            <div key={p.name} className="bg-[#252525] rounded-lg p-3">
              <p className="font-medium text-sm text-[#ddd]">{p.name}</p>
              <p className="text-xs text-[#555] mt-0.5">{p.note}</p>
              <span className={cn("text-xs mt-2 inline-block px-2 py-0.5 rounded-full", p.status === "Hazır" ? "bg-green-900/40 text-green-400" : "bg-[#333] text-[#555]")}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
