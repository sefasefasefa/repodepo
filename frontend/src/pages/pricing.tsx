import { AppLayout } from "@/components/layout/app-layout";
import { useListSubscriptionPlans } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Link } from "wouter";

export default function Pricing() {
  const { data: plans, isLoading } = useListSubscriptionPlans();

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <h1 className="text-4xl font-bold mb-4">Unlock Premium Content</h1>
          <p className="text-muted-foreground text-lg">Support your favorite creators and get access to exclusive videos, behind-the-scenes content, and more.</p>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Yıllık abonelikte %20 indirim</Badge>
          <Badge variant="secondary" className="bg-[#222] text-[#888] border-[#333] ml-2">Ücretsiz deneme yakında</Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="h-96 animate-pulse bg-card/50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans?.map(plan => {
              const yearlyPrice = (plan.price * 12 * 0.8).toFixed(2);
              return (
                <Card key={plan.id} className={`relative flex flex-col ${plan.isPopular ? 'border-primary shadow-[0_0_30px_-10px_rgba(168,85,247,0.4)]' : 'border-border'}`}>
                  {plan.isPopular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div>
                      <div className="mb-2">
                        <span className="text-4xl font-bold">${plan.price}</span>
                        <span className="text-muted-foreground">/{plan.billingCycle}</span>
                      </div>
                      <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">Yıllıkta ${yearlyPrice}</Badge>
                    </div>
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <Check className="h-5 w-5 text-primary shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/payment?plan=${plan.id}&billing=yearly`} className="w-full">
                      <Button className="w-full" variant={plan.isPopular ? "default" : "outline"}>
                        Yıllık Abonelikle Satın Al
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}