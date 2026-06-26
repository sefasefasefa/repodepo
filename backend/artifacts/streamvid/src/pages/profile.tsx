import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useGetUserStats, useGetUserVideos, useDeleteVideo } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoCard } from "@/components/video/video-card";
import { Settings, Edit3, Phone, CheckCircle2, ShieldCheck, Store, ExternalLink, Lock, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useMining } from "@/lib/use-mining";
import { PresenceDot, CreatorTag, CreatorStoreTag } from "@/components/friends/friend-badges";
import { useEffect, useState } from "react";
import { getPresence, setPresence } from "@/lib/presence";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function PhoneLinkSection() {
  const { toast } = useToast();
  const token = localStorage.getItem("token") || "";
  const [phase, setPhase] = useState<"idle" | "input" | "verify">("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/phone/link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.dev_otp) setDevOtp(d.dev_otp);
      setPhase("verify");
      toast({ title: "Kod gönderildi", description: d.message });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const confirmCode = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "Başarılı", description: "Telefon numarası doğrulandı!" });
      setPhase("idle");
      setDevOtp(null);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-card p-5 rounded-xl border border-border space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">SMS Doğrulama (2FA)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Hesabınızı telefon numaranızla bağlayarak ek güvenlik katmanı ekleyin.
      </p>
      {phase === "idle" && (
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setPhase("input")}>
          <Phone className="h-3.5 w-3.5 mr-1.5" /> Telefon Numarası Bağla
        </Button>
      )}
      {phase === "input" && (
        <div className="flex gap-2">
          <Input
            placeholder="+905xxxxxxxxx"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="h-8 text-sm bg-background border-border"
          />
          <Button size="sm" onClick={sendCode} disabled={busy || !phone}>
            {busy ? "..." : "Gönder"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPhase("idle")}>İptal</Button>
        </div>
      )}
      {phase === "verify" && (
        <div className="space-y-2">
          {devOtp && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-yellow-400 text-xs font-mono">
              Dev kodu: {devOtp}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="6 haneli kod"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value)}
              className="h-8 text-sm bg-background border-border font-mono text-center"
            />
            <Button size="sm" onClick={confirmCode} disabled={busy || code.length !== 6}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {busy ? "..." : "Doğrula"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPhase("idle")}>İptal</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreatorStoreSection({ user }: { user: any }) {
  const isCreator = user?.role === "creator" || user?.role === "admin";

  if (!isCreator) {
    return (
      <div className="bg-card p-5 rounded-xl border border-border space-y-3">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-[#555]" />
          <h3 className="font-medium text-sm">Creator Mağazası</h3>
          <Lock className="h-3.5 w-3.5 text-[#555]" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Creator mağazası özelliği yalnızca onaylı yaratıcılara açıktır. Creator hesabına geçerek dijital ürün, özel paket ve özel teklifler satabilirsin.
        </p>
        <Link href="/creator-applications">
          <Button size="sm" variant="outline" className="rounded-full gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Creator Başvurusu Yap
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card p-5 rounded-xl border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">Creator Mağazası</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Aktif</span>
        </div>
        <Link href={`/creators/${user.username}`}>
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" /> Mağazayı Gör
          </Button>
        </Link>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Dijital ürünler, özel paketler ve abonelik teklifleri için profilinden mağaza sayfana yönlendirilebilirsin.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/creators/${user.username}`}>
          <Button size="sm" className="w-full rounded-full gap-1.5 bg-primary hover:bg-primary/90">
            <Store className="h-3.5 w-3.5" /> Mağazama Git
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button size="sm" variant="outline" className="w-full rounded-full gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [presence, setPresenceState] = useState(getPresence());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = useGetUserStats(user?.id || 0, { queryKey: ["userStats", user?.id || 0], enabled: !!user } as any);
  const { data: videosData, isLoading: videosLoading } = useGetUserVideos(user?.id || 0, { enabled: !!user } as any);

  const deleteMutation = useDeleteVideo({
    mutation: {
      onSuccess: () => {
        setDeleteConfirmId(null);
        queryClient.invalidateQueries({ queryKey: ["getUserVideos"] });
        queryClient.invalidateQueries({ queryKey: ["videos"] });
        toast({ title: "Video silindi", description: "Video başarıyla kaldırıldı." });
      },
      onError: () => {
        toast({ title: "Hata", description: "Video silinirken bir hata oluştu.", variant: "destructive" });
      },
    },
  });

  useEffect(() => {
    const onOnline = () => { setPresence("online"); setPresenceState("online"); };
    const onOffline = () => { setPresence("offline"); setPresenceState("offline"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!user) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[50vh]">
          <h2 className="text-xl font-bold mb-4">Profili görüntülemek için giriş yap</h2>
          <Link href="/login"><Button>Giriş Yap</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const videoToDelete = videosData?.videos.find(v => v.id === deleteConfirmId);

  return (
    <AppLayout>
      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent className="bg-[#1a1a1a] border-[#333] max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Videoyu Sil
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#888]">
              <span className="font-semibold text-white">"{videoToDelete?.title}"</span> adlı video kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              className="bg-[#2a2a2a] border-[#444] text-white hover:bg-[#333] mt-0"
              disabled={deleteMutation.isPending}
            >
              İptal
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirmId && deleteMutation.mutate({ id: deleteConfirmId })}
            >
              {deleteMutation.isPending ? "Siliniyor…" : "Evet, Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Banner */}
      <div className="w-full h-32 sm:h-48 md:h-64 bg-secondary relative">
        {user.bannerUrl && (
          <img src={user.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="container mx-auto px-3 sm:px-4 md:px-6 pb-8 max-w-7xl">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end -mt-12 sm:-mt-16 mb-6 relative z-10">
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background bg-muted shrink-0">
            <AvatarImage src={user.avatarUrl || ""} />
            <AvatarFallback className="text-2xl sm:text-4xl">{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-3xl font-bold truncate">{user.displayName || user.username}</h1>
              <CreatorTag text={user.role === "creator" ? "Creator" : user.role === "admin" ? "Admin" : "Üye"} />
              <CreatorStoreTag text="Creator mağazası pasif" />
              <PresenceDot status={presence} />
            </div>
            <p className="text-muted-foreground text-sm">@{user.username}</p>
            <p className="text-sm flex gap-4 flex-wrap text-muted-foreground">
              <span><strong className="text-foreground">{user.followerCount}</strong> takipçi</span>
              <span><strong className="text-foreground">{user.followingCount}</strong> takip</span>
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none rounded-full text-sm">
              <Edit3 className="mr-2 h-4 w-4" /> Profili Düzenle
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full bg-secondary shrink-0">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {user.bio && (
          <div className="mb-6 max-w-3xl">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
          </div>
        )}

        {/* Tabs — scrollable on mobile */}
        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-11 p-0 overflow-x-auto scrollbar-hide gap-4 sm:gap-6">
            <TabsTrigger
              value="videos"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-full shrink-0 text-sm"
            >
              Videolarım
              {videosData?.videos && videosData.videos.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  {videosData.videos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-full shrink-0 text-sm"
            >
              İstatistikler
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-full shrink-0 text-sm flex items-center gap-1.5"
            >
              <Settings className="h-3.5 w-3.5" /> Ayarlar
            </TabsTrigger>
          </TabsList>

          {/* Videos tab */}
          <TabsContent value="videos" className="pt-5">
            {videosLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="aspect-video w-full rounded-xl" />
                    <div className="flex gap-2">
                      <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-2.5 w-3/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : videosData?.videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border bg-card/50">
                <Sparkles className="h-10 w-10 text-primary mb-3 opacity-40" />
                <p className="font-semibold text-base">Henüz video yüklemediniz</p>
                <p className="text-muted-foreground text-sm mt-1 max-w-xs">İlk videonuzu yükleyerek izleyicilerle buluşun.</p>
                <Link href="/upload">
                  <Button size="sm" className="mt-4 rounded-full">Video Yükle</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 gap-y-6 sm:gap-y-8">
                {videosData?.videos.map(video => (
                  <div key={video.id} className="relative group">
                    <VideoCard video={video} />
                    {/* Delete button — visible on hover (desktop) or always visible (mobile) */}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirmId(video.id); }}
                      className="absolute top-1.5 left-1.5 z-10 p-1.5 rounded-lg bg-black/70 text-red-400 hover:bg-red-600 hover:text-white transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 touch-manipulation backdrop-blur-sm"
                      title="Videoyu sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Stats tab */}
          <TabsContent value="stats" className="pt-5">
            {statsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-card p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">Toplam Görüntülenme</p>
                  <p className="text-2xl font-bold mt-1">{(stats?.totalViews || 0).toLocaleString("tr")}</p>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">Toplam Beğeni</p>
                  <p className="text-2xl font-bold mt-1">{(stats?.totalLikes || 0).toLocaleString("tr")}</p>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">Toplam Takipçi</p>
                  <p className="text-2xl font-bold mt-1">{(stats?.totalFollowers || 0).toLocaleString("tr")}</p>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">Video Sayısı</p>
                  <p className="text-2xl font-bold mt-1">{videosData?.videos.length || 0}</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Settings tab */}
          <TabsContent value="settings" className="pt-5 max-w-2xl space-y-6">
            <PhoneLinkSection />
            <CreatorStoreSection user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
