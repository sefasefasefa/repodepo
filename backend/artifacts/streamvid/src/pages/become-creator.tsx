import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Crown, CheckCircle2, Clock, XCircle, ChevronRight,
  Star, TrendingUp, DollarSign, Users, UploadCloud,
  Globe, Loader2, AlertCircle, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PERKS = [
  { icon: UploadCloud, title: "Video Yükle", desc: "Sınırsız içerik yükleyin, HD kalite desteği." },
  { icon: DollarSign, title: "Gelir Kazan", desc: "Abonelik, bahşiş ve özel içerikle para kazan." },
  { icon: TrendingUp, title: "Analitikler", desc: "İzlenme, gelir ve takipçi istatistikleri." },
  { icon: Users, title: "Topluluk", desc: "Takipçilerinizle etkileşimde kal." },
  { icon: Star, title: "Creator Rozeti", desc: "Profilinde özel doğrulama rozeti." },
  { icon: Globe, title: "Crosspost", desc: "İçeriğini diğer platformlara otomatik dağıt." },
];

function StatusCard({ app }: { app: any }) {
  const status = app.status;
  if (status === "pending") return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="p-5 rounded-full bg-yellow-500/10">
        <Clock className="h-12 w-12 text-yellow-400" />
      </div>
      <h2 className="text-2xl font-bold text-white">Başvurunuz İnceleniyor</h2>
      <p className="text-[#888] max-w-md">
        Başvurunuz ekibimiz tarafından inceleniyor. Genellikle 1-3 iş günü içinde geri dönüş yapılır.
      </p>
      <div className="mt-2 bg-[#1a1a1a] border border-yellow-500/20 rounded-xl px-6 py-4 text-sm text-left max-w-sm w-full space-y-1">
        <p className="text-[#555] text-xs uppercase tracking-wider mb-2">Başvuru Detayı</p>
        <p className="text-[#999]"><span className="text-[#666]">Durum:</span> <span className="text-yellow-400 font-semibold">Beklemede</span></p>
        <p className="text-[#999]"><span className="text-[#666]">Tarih:</span> {new Date(app.createdAt).toLocaleDateString("tr-TR")}</p>
      </div>
    </div>
  );

  if (status === "approved") return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="p-5 rounded-full bg-green-500/10">
        <CheckCircle2 className="h-12 w-12 text-green-400" />
      </div>
      <h2 className="text-2xl font-bold text-white">Başvurunuz Onaylandı! 🎉</h2>
      <p className="text-[#888] max-w-md">
        Artık Creator'sın! Dashboard'una giderek içerik yüklemeye başlayabilirsin.
      </p>
      <Link href="/creator/dashboard">
        <Button className="mt-2 bg-primary hover:bg-primary/90 text-white gap-2">
          Creator Dashboard'a Git <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );

  if (status === "rejected") return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="p-5 rounded-full bg-red-500/10">
        <XCircle className="h-12 w-12 text-red-400" />
      </div>
      <h2 className="text-2xl font-bold text-white">Başvurunuz Reddedildi</h2>
      {app.adminNote && (
        <div className="bg-[#1a1a1a] border border-red-500/20 rounded-xl px-6 py-4 text-sm text-[#999] max-w-sm w-full">
          <p className="text-[#555] text-xs uppercase tracking-wider mb-2">Yönetici Notu</p>
          <p>{app.adminNote}</p>
        </div>
      )}
      <p className="text-[#666] text-sm">Farklı bir başvuru göndermek için aşağıdaki formu kullanabilirsiniz.</p>
    </div>
  );

  return null;
}

export default function BecomeCreator() {
  const { user, token } = useAuth() as any;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [existingApp, setExistingApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [reason, setReason] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [socialMedia, setSocialMedia] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (user.role === "creator" || user.role === "admin") {
      setLoading(false);
      return;
    }
    fetch("/api/creator-applications/my", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setExistingApp(d.application))
      .finally(() => setLoading(false));
  }, [user, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 30) {
      toast({ title: "Hata", description: "Lütfen en az 30 karakter neden yazın.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/creator-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason, portfolioUrl, socialMedia }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Hata", description: data.error || "Başvuru gönderilemedi.", variant: "destructive" });
      } else {
        toast({ title: "Başvuru Gönderildi", description: "En kısa sürede değerlendireceğiz!" });
        setExistingApp(data);
      }
    } catch {
      toast({ title: "Hata", description: "Sunucuya ulaşılamadı.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-[#666] hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Ana Sayfa
          </button>
        </Link>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a1a] via-[#111] to-black border border-[#2a2a2a] mb-8 p-8 md:p-12">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
            <div className="p-4 bg-primary/10 rounded-2xl w-fit">
              <Crown className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Creator Ol</h1>
              <p className="text-[#888] text-base md:text-lg max-w-xl">
                İçerik oluşturmaya başla, topluluğunu büyüt ve gelir elde et.
                Başvurunu göndermek yeterli — ekibimiz seni değerlendirecek.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Sol: Avantajlar */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold text-[#555] uppercase tracking-wider mb-4">Creator Avantajları</h2>
            {PERKS.map((p) => (
              <div key={p.title} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0 mt-0.5">
                  <p.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{p.title}</p>
                  <p className="text-xs text-[#666] mt-0.5">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Sağ: Form / Durum */}
          <div className="lg:col-span-3">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 md:p-8">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[#555]" />
                </div>
              ) : !user ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <AlertCircle className="h-10 w-10 text-[#555]" />
                  <p className="text-[#888]">Başvuru göndermek için giriş yapmalısın.</p>
                  <Link href="/login">
                    <Button className="bg-primary hover:bg-primary/90 text-white">Giriş Yap</Button>
                  </Link>
                </div>
              ) : user.role === "creator" ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                  <h2 className="text-xl font-bold text-white">Zaten Creator'sın!</h2>
                  <Link href="/creator/dashboard">
                    <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                      Dashboard'a Git <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : user.role === "admin" ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <Crown className="h-10 w-10 text-yellow-400" />
                  <h2 className="text-xl font-bold text-white">Admin Hesabı</h2>
                  <p className="text-[#777] text-sm">Tüm creator özellikleri zaten aktif.</p>
                  <Link href="/admin">
                    <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                      Admin Paneli <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : existingApp && existingApp.status !== "rejected" ? (
                <StatusCard app={existingApp} />
              ) : (
                <>
                  {existingApp?.status === "rejected" && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 items-start">
                      <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-400">Önceki başvurunuz reddedildi</p>
                        {existingApp.adminNote && <p className="text-xs text-[#888] mt-1">{existingApp.adminNote}</p>}
                        <p className="text-xs text-[#666] mt-1">Yeni bir başvuru gönderebilirsin.</p>
                      </div>
                    </div>
                  )}

                  <h2 className="text-xl font-bold text-white mb-1">Başvuru Formu</h2>
                  <p className="text-[#666] text-sm mb-6">Tüm alanları doldurarak başvurunu gönder.</p>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-[#ccc]">
                        Neden Creator olmak istiyorsun? <span className="text-red-400">*</span>
                      </Label>
                      <Textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Kendinizden bahsedin, ne tür içerik üretmek istediğinizi ve hedeflerinizi yazın. (min. 30 karakter)"
                        rows={5}
                        className="bg-[#1a1a1a] border-[#333] text-white placeholder:text-[#444] focus:border-primary resize-none"
                        required
                      />
                      <p className={cn("text-xs text-right transition-colors", reason.length >= 30 ? "text-green-500" : "text-[#555]")}>
                        {reason.length}/30 min karakter
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#ccc]">Portfolio / Web Sitesi</Label>
                      <Input
                        type="url"
                        value={portfolioUrl}
                        onChange={e => setPortfolioUrl(e.target.value)}
                        placeholder="https://portfolio.com"
                        className="bg-[#1a1a1a] border-[#333] text-white placeholder:text-[#444] focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#ccc]">Sosyal Medya Hesapları</Label>
                      <Input
                        value={socialMedia}
                        onChange={e => setSocialMedia(e.target.value)}
                        placeholder="@twitter, instagram.com/sen, vb."
                        className="bg-[#1a1a1a] border-[#333] text-white placeholder:text-[#444] focus:border-primary"
                      />
                    </div>

                    <div className="pt-2 space-y-3">
                      <Button
                        type="submit"
                        disabled={submitting || reason.trim().length < 30}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-11 gap-2 disabled:opacity-50"
                      >
                        {submitting ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</>
                        ) : (
                          <><Crown className="h-4 w-4" /> Başvuruyu Gönder</>
                        )}
                      </Button>
                      <p className="text-xs text-center text-[#555]">
                        Başvurular genellikle 1-3 iş günü içinde değerlendirilir.
                      </p>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
