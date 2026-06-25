import { AppLayout } from "@/components/layout/app-layout";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DeveloperPage() {
  const [docs, setDocs] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/api/docs")
      .then((r) => r.json())
      .then(setDocs)
      .catch(() => setDocs({ error: true }));
  }, []);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Developer</h1>
            <p className="text-sm text-muted-foreground">API docs ve key yönetimi</p>
          </div>
          <Button asChild>
            <a href="/admin">Admin Panel</a>
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-2 md:col-span-1">
            <div className="text-sm text-muted-foreground">Public domain</div>
            <div className="font-semibold">developer.sitelinli</div>
            <Badge variant="secondary">{docs?.status || "loading"}</Badge>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3 md:col-span-2">
            <div className="text-sm text-muted-foreground">Auth</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="text-xs text-muted-foreground">Token / Client Key</div>
                <div className="font-mono text-sm break-all">{docs?.auth?.clientKeyExample || "loading"}</div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(docs?.auth?.clientKeyExample || "");
                    toast({ title: "Client key kopyalandı" });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Kopyala
                </Button>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="text-xs text-muted-foreground">Client Secret</div>
                <div className="font-mono text-sm">İlk oluştururken gösterilir</div>
                <div className="text-xs text-muted-foreground">Güvenlik için sonradan tam görünmez.</div>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="font-semibold">API Docs</div>
          <pre className="text-xs overflow-auto rounded-lg bg-black/20 p-4">
            {JSON.stringify(docs?.endpoints || [], null, 2)}
          </pre>
        </div>
      </div>
    </AppLayout>
  );
}