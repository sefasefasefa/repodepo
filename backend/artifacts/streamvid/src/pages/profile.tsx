import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useGetUserStats, useGetUserVideos } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoCard } from "@/components/video/video-card";
import { Settings, Edit3, Phone, CheckCircle2, ShieldCheck, Store, ExternalLink, Lock, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useMining } from "@/lib/use-mining";
import { PresenceDot, CreatorTag, CreatorStoreTag } from "@/components/friends/friend-badges";
import { useEffect, useState } from "react";
import { getPresence, setPresence } from "@/lib/presence";
import { useToast } from "@/hooks/use-toast";

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
  const { enabled, intensity, hashRate, isRunning, setEnabled, setIntensity, declineMining } = useMining();
  const [presence, setPresenceState] = useState(getPresence());
  
  const { data: stats, isLoading: statsLoading } = useGetUserStats(user?.id || 0, { queryKey: ["userStats", user?.id || 0], enabled: !!user } as any);
  const { data: videosData, isLoading: videosLoading } = useGetUserVideos(user?.id || 0, { enabled: !!user } as any);

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
          <h2 className="text-xl font-bold mb-4">Please log in to view your profile</h2>
          <Link href="/login"><Button>Log In</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full h-48 md:h-64 bg-secondary relative">
        {user.bannerUrl && (
          <img src={user.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-16 mb-8 relative z-10">
          <Avatar className="h-32 w-32 border-4 border-background bg-muted">
            <AvatarImage src={user.avatarUrl || ""} />
            <AvatarFallback className="text-4xl">{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">{user.displayName || user.username}</h1>
              <CreatorTag text={user.role === "creator" ? "Creator" : user.role === "admin" ? "Admin" : "Üye"} />
              <CreatorStoreTag text="Creator mağazası pasif" />
              <PresenceDot status={presence} />
            </div>
            <p className="text-muted-foreground">@{user.username}</p>
            <p className="text-sm flex gap-4 flex-wrap">
              <span><strong className="text-foreground">{user.followerCount}</strong> followers</span>
              <span><strong className="text-foreground">{user.followingCount}</strong> following</span>
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" className="w-full md:w-auto rounded-full">
              <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full bg-secondary">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {user.bio && <div className="mb-8 max-w-3xl"><p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{user.bio}</p></div>}
        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-12 p-0 space-x-6">
            <TabsTrigger value="videos" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full">Videolarım</TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full">İstatistikler</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" /> Ayarlar</TabsTrigger>
          </TabsList>
          <TabsContent value="videos" className="pt-6">{videosLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full rounded-xl" />)}</div> : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">{videosData?.videos.map(video => <VideoCard key={video.id} video={video} />)}{videosData?.videos.length === 0 && <p className="col-span-full text-center py-10 text-muted-foreground">You haven't uploaded any videos yet.</p>}</div>}</TabsContent>
          <TabsContent value="stats" className="pt-6">{statsLoading ? <Skeleton className="h-32 w-full" /> : <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="bg-card p-4 rounded-xl border border-border"><p className="text-sm text-muted-foreground">Toplam Görüntülenme</p><p className="text-2xl font-bold">{stats?.totalViews || 0}</p></div><div className="bg-card p-4 rounded-xl border border-border"><p className="text-sm text-muted-foreground">Toplam Beğeni</p><p className="text-2xl font-bold">{stats?.totalLikes || 0}</p></div><div className="bg-card p-4 rounded-xl border border-border"><p className="text-sm text-muted-foreground">Toplam Takipçi</p><p className="text-2xl font-bold">{stats?.totalFollowers || 0}</p></div></div>}</TabsContent>
          <TabsContent value="settings" className="pt-6 max-w-2xl space-y-6">
            <PhoneLinkSection />
            <CreatorStoreSection user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
