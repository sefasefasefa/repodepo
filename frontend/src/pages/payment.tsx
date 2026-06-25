import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, BadgePercent, Clock3 } from "lucide-react";
import { useLocation } from "wouter";
import { useSubscribe } from "@workspace/api-client-react";
import { useMemo, useState } from "react";

export default function Payment() {
  const searchParams = new URLSearchParams(window.location.search);
  const planId = parseInt(searchParams.get("plan") || "0");
  const billing = searchParams.get("billing") || "monthly";
  const [, setLocation] = useLocation();
  const subscribeMutation = useSubscribe();
  const [loading, setLoading] = useState(false);

  const annualDiscount = 20;
  const billingLabel = billing === "yearly" ? "Yıllık" : "Aylık";

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId) return;
    setLoading(true);
    try {
      await subscribeMutation.mutateAsync({ data: { planId, paymentMethod: "pm_card_dummy" } });
      setLocation("/subscriptions");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-lg space-y-6 flex flex-col justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-card border border-border p-8 rounded-xl shadow-lg space-y-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" /> Checkout
          </h1>
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{billingLabel} ödeme</span>
              {billing === "yearly" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-[11px] font-semibold text-green-400 border border-green-500/20">
                  <BadgePercent className="h-3 w-3" /> %20 indirim
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {billing === "yearly" ? `Yıllık abonelikte ${annualDiscount}% indirim uygulanır.` : "Aylık abonelik seçildi."}
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-[#333] bg-[#111] p-3 text-sm opacity-70">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[#777]" />
              <span className="font-semibold text-[#aaa]">Ücretsiz deneme</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#222] px-2 py-1 text-[10px] font-semibold text-[#888] border border-[#333]">
                Pasif
              </span>
            </div>
            <p className="text-[#666] mt-1">Bu alan sonradan açılacak, şu anda devre dışı.</p>
          </div>

          {planId === 0 ? (
            <p className="text-destructive mb-4">No plan selected.</p>
          ) : (
            <form onSubmit={handleCheckout} className="space-y-4">
              <div className="space-y-2 mb-6">
                <label className="text-sm font-medium">Card Number</label>
                <Input placeholder="0000 0000 0000 0000" className="bg-input/50 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expiry</label>
                  <Input placeholder="MM/YY" className="bg-input/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CVC</label>
                  <Input placeholder="123" className="bg-input/50" />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Processing..." : billing === "yearly" ? "Pay Yearly" : "Pay Now"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  );
}