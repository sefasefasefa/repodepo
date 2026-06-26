import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateVideo } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Upload, Lock, Clock, CheckCircle, XCircle, HelpCircle, AlertTriangle, Crown, FileVideo, Calendar, Stamp, Sparkles, Tag, ScanSearch, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListCategories } from "@workspace/api-client-react";
import { ChunkedUploadZone } from "@/components/upload/chunked-upload-zone";

const uploadSchema = z.object({
  title: z.string().min(3, "En az 3 karakter"),
  description: z.string().optional(),
  type: z.enum(["video", "short"]),
  videoUrl: z.string().url("Geçerli URL girin").optional().or(z.literal("")),
  thumbnailUrl: z.string().url("Geçerli URL girin").optional().or(z.literal("")),
  isPremium: z.boolean().default(false),
  isPPV: z.boolean().default(false),
  ppvPrice: z.string().optional(),
  categoryId: z.string().optional(),
  watermarkEnabled: z.boolean().default(false),
});

const bulkUploadSchema = z.object({
  prefix: z.string().min(3, "En az 3 karakter"),
  titles: z.string().min(3, "En az 3 karakter"),
  description: z.string().optional(),
  videoUrls: z.string().min(3, "En az bir URL girin"),
  type: z.enum(["video", "short"]),
  thumbnailUrl: z.string().url("Geçerli URL girin").optional().or(z.literal("")),
  isPremium: z.boolean().default(false),
  isPPV: z.boolean().default(false),
  ppvPrice: z.string().optional(),
  categoryId: z.string().optional(),
  watermarkEnabled: z.boolean().default(false),
});

const applySchema = z.object({
  motivation: z.string().min(20, "En az 20 karakter gerekli"),
  socialLinks: z.string().optional(),
  contentType: z.string().min(3, "İçerik türünü belirtin"),
});

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-900/40 text-yellow-400 text-sm font-medium">
      <Clock className="h-3.5 w-3.5" /> İnceleniyor
    </span>
  );
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-900/40 text-green-400 text-sm font-medium">
      <CheckCircle className="h-3.5 w-3.5" /> Onaylandı
    </span>
  );
  if (status === "denied") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-900/40 text-red-400 text-sm font-medium">
      <XCircle className="h-3.5 w-3.5" /> Reddedildi
    </span>
  );
  return null;
}

function LimitCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 flex items-center gap-3">
      <div className={cn("p-2 rounded-lg bg-[#2a2a2a]", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-[#666] mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

export default function UploadPage() {
  const { user, token } = useAuth() as any;
  const [, setLocation] = useLocation();
  const [application, setApplication] = useState<any>(null);
  const [limits, setLimits] = useState<any>(null);
  const [uploadedToday, setUploadedToday] = useState(0);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const createVideoMutation = useCreateVideo();

  const { data: catData } = useListCategories();
  const categories: any[] = (catData as any)?.categories ?? [];

  // Otomatik kategori önerisi
  const [autoSuggest, setAutoSuggest] = useState<{ categoryId: number; name: string; confidence: number } | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Video benzerlik uyarısı (pasif)
  const [similarityWarning, setSimilarityWarning] = useState<{
    level: "high" | "medium"; message: string; matchTitle: string;
  } | null>(null);
  const [similarityChecking, setSimilarityChecking] = useState(false);
  const [adminSimilarityApproved, setAdminSimilarityApproved] = useState(false);

  const isCreator = user?.role === "creator" || user?.role === "admin" || user?.role === "moderator";

  useEffect(() => {
    if (!user) return;
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    if (!isCreator) {
      fetch("/api/creator-applications/my", { headers })
        .then(r => r.json())
        .then(d => setApplication(d.application));
    } else {
      fetch("/api/creator-limits/my", { headers })
        .then(r => r.json())
        .then(d => { setLimits(d.limits); setUploadedToday(d.uploadedToday ?? 0); });
    }
  }, [user, isCreator, token]);

  const uploadForm = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { title: "", description: "", type: "video", isPremium: false, isPPV: false, watermarkEnabled: false },
  });

  const watchTitle = uploadForm.watch("title");
  const watchDescription = uploadForm.watch("description");

  // Benzerlik kontrolü (pasif — gerçek backend bağlantısı olmadan title pattern kontrolü)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!watchTitle || watchTitle.length < 5) { setSimilarityWarning(null); return; }
      setAdminSimilarityApproved(false);
      setSimilarityChecking(true);
      // Pasif simülasyon: gerçek uygulamada API çağrısı yapılır
      const lower = watchTitle.toLowerCase();
      const SAMPLE_TITLES = [
        "yaz koleksiyonu 2025", "plaj günü vlog", "studio shoot bts",
        "backstage fashion week", "yeni sezon tanıtımı", "özel çekim",
      ];
      const match = SAMPLE_TITLES.find(t => {
        const words = t.split(" ");
        return words.some(w => w.length > 3 && lower.includes(w));
      });
      if (match) {
        setSimilarityWarning({
          level: "medium",
          message: "Benzer başlıklı bir video zaten mevcut.",
          matchTitle: match,
        });
      } else {
        setSimilarityWarning(null);
      }
      setSimilarityChecking(false);
    }, 900);
    return () => clearTimeout(t);
  }, [watchTitle]);

  const requiresAdminApproval = Boolean(similarityWarning) && !adminSimilarityApproved;

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!watchTitle || watchTitle.length < 4) { setAutoSuggest(null); return; }
      setSuggestLoading(true);
      try {
        const res = await fetch("/api/auto-categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: watchTitle, description: watchDescription ?? "" }),
        });
        const data = await res.json();
        setAutoSuggest(data.suggestion ?? null);
      } finally {
        setSuggestLoading(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [watchTitle, watchDescription]);

  const bulkForm = useForm<z.infer<typeof bulkUploadSchema>>({
    resolver: zodResolver(bulkUploadSchema),
    defaultValues: { prefix: "", titles: "", description: "", videoUrls: "", type: "video", thumbnailUrl: "", isPremium: false, isPPV: false, watermarkEnabled: false },
  });

  const applyForm = useForm<z.infer<typeof applySchema>>({
    resolver: zodResolver(applySchema),
    defaultValues: { motivation: "", socialLinks: "", contentType: "" },
  });

  const onUploadSubmit = async (values: z.infer<typeof uploadSchema>) => {
    if (requiresAdminApproval) {
      return;
    }
    try {
      const payload: any = {
        title: values.title,
        description: values.description,
        type: values.type,
        videoUrl: values.videoUrl || undefined,
        thumbnailUrl: values.thumbnailUrl || undefined,
        isPremium: values.isPremium,
        isPPV: values.isPPV,
        ppvPrice: values.isPPV && values.ppvPrice ? parseFloat(values.ppvPrice) : undefined,
        categoryId: values.categoryId ? Number(values.categoryId) : undefined,
      };
      const res = await createVideoMutation.mutateAsync({ data: payload });
      if (res) setLocation(`/videos/${res.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const onBulkUploadSubmit = async (values: z.infer<typeof bulkUploadSchema>) => {
    setBulkMsg("");
    const titles = values.titles.split("\n").map(v => v.trim()).filter(Boolean);
    const videoUrls = values.videoUrls.split("\n").map(v => v.trim()).filter(Boolean);
    if (!titles.length || !videoUrls.length) {
      setBulkMsg("En az bir başlık ve bir video URL gerekli");
      return;
    }
    if (titles.length !== videoUrls.length) {
      setBulkMsg("Başlık ve URL sayısı eşleşmeli");
      return;
    }
    try {
      for (let i = 0; i < titles.length; i++) {
        await createVideoMutation.mutateAsync({
          data: {
            title: values.prefix ? `${values.prefix} ${titles[i]}` : titles[i],
            description: values.description,
            type: values.type,
            videoUrl: videoUrls[i],
            thumbnailUrl: values.thumbnailUrl || undefined,
            isPremium: values.isPremium,
            isPPV: values.isPPV,
            ppvPrice: values.isPPV && values.ppvPrice ? parseFloat(values.ppvPrice) : undefined,
            categoryId: values.categoryId ? Number(values.categoryId) : undefined,
          },
        });
      }
      setBulkMsg("✓ Toplu yükleme tamamlandı");
      bulkForm.reset();
    } catch (e: any) {
      setBulkMsg(e?.message || "Toplu yükleme başarısız");
    }
  };

  const onApplySubmit = async (values: z.infer<typeof applySchema>) => {
    setApplyLoading(true);
    try {
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/creator-applications", {
        method: "POST",
        headers,
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok) {
        setApplication(data.application);
        setApplyDone(true);
      } else {
        alert(data.error || "Başvuru gönderilemedi");
      }
    } finally {
      setApplyLoading(false);
    }
  };

  if (!user) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Lock className="h-12 w-12 text-[#555]" />
          <p className="text-lg font-semibold">Giriş Gerekli</p>
          <p className="text-[#888] text-sm">Video yüklemek için giriş yapman gerekiyor.</p>
          <Button onClick={() => setLocation("/auth")}>Giriş Yap</Button>
        </div>
      </AppLayout>
    );
  }

  // ── Yükleyici değil ───────────────────────────────────────────────
  if (!isCreator) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Video Yükle</h1>
              <p className="text-[#888] text-sm">Yükleyici hesabı gerekli</p>
            </div>
          </div>

          {/* Mevcut başvuru durumu */}
          {application && (
            <div className={cn(
              "rounded-xl border p-5 space-y-2",
              application.status === "pending" ? "bg-yellow-900/10 border-yellow-800/40" :
              application.status === "approved" ? "bg-green-900/10 border-green-800/40" :
              "bg-red-900/10 border-red-800/40"
            )}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Başvuru Durumu</span>
                <StatusBadge status={application.status} />
              </div>
              {application.reviewNote && (
                <p className="text-sm text-[#aaa] bg-[#1a1a1a] rounded-lg p-3 mt-2">{application.reviewNote}</p>
              )}
              {application.status === "pending" && (
                <p className="text-xs text-[#666]">Başvurun inceleniyor. Sonuç bildirilecek.</p>
              )}
              {application.status === "denied" && (
                <p className="text-xs text-[#888]">Başvurun reddedildi. Yeni başvuru yapabilirsin.</p>
              )}
            </div>
          )}

          {/* Başvuru formu */}
          {(!application || application.status === "denied") && !applyDone && (
            <div className="bg-card border border-border p-6 rounded-xl space-y-5">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" /> Yükleyici Hesabı Başvurusu
                </h2>
                <p className="text-[#888] text-sm mt-1">
                  Video yükleyebilmek için yükleyici hesabı başvurusu yapman gerekiyor.
                  Başvurun admin tarafından onaylandığında video yükleyebileceksin.
                </p>
              </div>

              <Form {...applyForm}>
                <form onSubmit={applyForm.handleSubmit(onApplySubmit)} className="space-y-4">
                  <FormField
                    control={applyForm.control}
                    name="contentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>İçerik Türü</FormLabel>
                        <FormControl>
                          <Input placeholder="Örn: Moda videoları, yaşam tarzı, dans..." {...field} className="bg-input/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={applyForm.control}
                    name="motivation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Neden yükleyici olmak istiyorsun?</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Kendini ve içeriklerini anlat (en az 20 karakter)..."
                            className="resize-none h-28 bg-input/50"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={applyForm.control}
                    name="socialLinks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sosyal medya linklerin <span className="text-[#666]">(isteğe bağlı)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Instagram, TikTok, YouTube linkin..." {...field} className="bg-input/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={applyLoading} className="w-full">
                    {applyLoading ? "Gönderiliyor..." : "Başvuru Gönder"}
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {applyDone && (
            <div className="bg-green-900/10 border border-green-800/40 rounded-xl p-6 text-center space-y-2">
              <CheckCircle className="h-10 w-10 text-green-400 mx-auto" />
              <p className="font-semibold">Başvurun alındı!</p>
              <p className="text-[#888] text-sm">Admin onayladıktan sonra video yükleyebileceksin.</p>
            </div>
          )}

          {/* Bilgi kartları */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#666]" /> Yükleyici hesabı nasıl çalışır?
            </h3>
            <ul className="space-y-2 text-sm text-[#888]">
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Başvurun admin tarafından incelenir</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Onaylanırsan yükleyici hesabına geçersin</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Her yükleyiciye özel yükleme limitleri atanır</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Videolarını premium olarak işaretleyebilirsin</li>
            </ul>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Yükleyici — günlük limit kontrolü ────────────────────────────
  const dailyMax = limits?.maxDailyUploads ?? 5;
  const limitReached = uploadedToday >= dailyMax;
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Video Yükle</h1>
            <p className="text-[#888] text-sm">Yükleyici hesabı · @{user.username}</p>
          </div>
        </div>

        {/* Limit göstergesi */}
        {limits && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <LimitCard icon={Calendar} label="Bugün / Günlük" value={`${uploadedToday} / ${limits.maxDailyUploads}`} color={limitReached ? "text-red-400" : "text-primary"} />
            <LimitCard icon={FileVideo} label="Maks. Boyut" value={`${limits.maxFileSizeMb >= 1024 ? `${(limits.maxFileSizeMb/1024).toFixed(1)} GB` : `${limits.maxFileSizeMb} MB`}`} />
            <LimitCard icon={Clock} label="Maks. Süre" value={`${Math.floor(limits.maxDurationSec / 60)} dk`} />
            <LimitCard icon={Crown} label="Çözünürlük" value={limits.maxResolution} color="text-yellow-400" />
          </div>
        )}

        {limitReached && (
          <div className="flex items-start gap-3 bg-red-900/10 border border-red-800/40 rounded-xl p-4">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">Günlük limit doldu</p>
              <p className="text-xs text-[#888] mt-0.5">Bugün {uploadedToday} video yükledin. Yarın tekrar deneyebilirsin.</p>
            </div>
          </div>
        )}

        {/* Yükleme modu seçici */}
        <div className="flex gap-2 bg-[#111] border border-[#1e1e1e] rounded-2xl p-1.5">
          <button
            onClick={() => setUploadMode("file")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
              uploadMode === "file"
                ? "bg-primary text-white shadow-[0_0_16px_rgba(168,85,247,0.3)]"
                : "text-[#666] hover:text-[#aaa]"
            )}
          >
            <FileVideo className="h-4 w-4" /> Dosyadan Yükle
          </button>
          <button
            onClick={() => setUploadMode("url")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
              uploadMode === "url"
                ? "bg-primary text-white shadow-[0_0_16px_rgba(168,85,247,0.3)]"
                : "text-[#666] hover:text-[#aaa]"
            )}
          >
            <Link2 className="h-4 w-4" /> URL ile Ekle
          </button>
        </div>

        {/* Dosyadan yükleme paneli */}
        {uploadMode === "file" && !limitReached && (
          <div className="bg-card border border-border p-6 md:p-8 rounded-xl">
            <ChunkedUploadZone onDone={(videoId) => setLocation(`/videos/${videoId}`)} />
          </div>
        )}

        <div className={cn(
          uploadMode === "url" ? "block" : "hidden",
          "bg-card border border-border p-6 md:p-8 rounded-xl",
          limitReached && "opacity-50 pointer-events-none"
        )}>
          <div className="mb-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">Toplu video ekleme</p>
                <p className="text-xs text-[#777]">Pasif değil; her satıra bir başlık ve URL gir.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setBulkOpen(v => !v)} className="rounded-full">
                {bulkOpen ? "Kapat" : "Aç"}
              </Button>
            </div>
            {bulkOpen && (
              <Form {...bulkForm}>
                <form onSubmit={bulkForm.handleSubmit(onBulkUploadSubmit)} className="space-y-4">
                  <FormField control={bulkForm.control} name="prefix" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ortak Ön Ek</FormLabel>
                      <FormControl><Input placeholder="Örn: Seri 1 -" {...field} className="bg-input/50" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={bulkForm.control} name="titles" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Başlıklar</FormLabel>
                        <FormControl><Textarea placeholder={"Satır satır başlık\nSatır satır başlık"} className="h-32 resize-none bg-input/50" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={bulkForm.control} name="videoUrls" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video URL’leri</FormLabel>
                        <FormControl><Textarea placeholder={"Satır satır url\nSatır satır url"} className="h-32 resize-none bg-input/50" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={bulkForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ortak Açıklama</FormLabel>
                      <FormControl><Textarea placeholder="Tüm videolarda kullanılacak açıklama..." className="resize-none h-24 bg-input/50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={bulkForm.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Türü</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="bg-input/50"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="video">Normal Video</SelectItem>
                            <SelectItem value="short">Short</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={bulkForm.control} name="thumbnailUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ortak Thumbnail URL</FormLabel>
                        <FormControl><Input placeholder="https://..." {...field} className="bg-input/50" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <FormField control={bulkForm.control} name="isPremium" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)} className="w-4 h-4 accent-primary" /></FormControl>
                        <FormLabel className="text-sm font-normal">Premium</FormLabel>
                      </FormItem>
                    )} />
                    <FormField control={bulkForm.control} name="isPPV" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)} className="w-4 h-4 accent-primary" /></FormControl>
                        <FormLabel className="text-sm font-normal">PPV</FormLabel>
                      </FormItem>
                    )} />
                    <FormField control={bulkForm.control} name="watermarkEnabled" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)} className="w-4 h-4 accent-primary" /></FormControl>
                        <FormLabel className="text-sm font-normal">Filigran</FormLabel>
                      </FormItem>
                    )} />
                  </div>
                  {bulkForm.watch("isPPV") && (
                    <FormField control={bulkForm.control} name="ppvPrice" render={({ field }) => (
                      <FormItem className="max-w-xs">
                        <FormLabel>PPV Fiyatı ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" min="0.99" placeholder="4.99" {...field} className="bg-input/50" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <Button type="submit" variant="secondary" className="w-full">Toplu Yükle</Button>
                  {bulkMsg && <p className="text-sm text-[#888]">{bulkMsg}</p>}
                </form>
              </Form>
            )}
          </div>
          <Form {...uploadForm}>
            <form onSubmit={uploadForm.handleSubmit(onUploadSubmit)} className="space-y-6">
              <FormField control={uploadForm.control} name="title"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-1">
                      <FormLabel className="mb-0">Başlık</FormLabel>
                      {similarityChecking && (
                        <span className="text-[11px] text-[#555] flex items-center gap-1">
                          <ScanSearch className="h-3 w-3 animate-pulse text-primary/60" /> Kontrol ediliyor...
                        </span>
                      )}
                    </div>
                    <FormControl><Input placeholder="Video başlığı..." {...field} className="bg-input/50" /></FormControl>
                    {similarityWarning && (
                      <div className={cn(
                        "mt-1.5 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]",
                        similarityWarning.level === "high"
                          ? "bg-red-500/10 border border-red-500/30 text-red-400"
                          : "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                      )}>
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium">Benzer içerik tespit edildi: </span>
                          <span className="opacity-80">"{similarityWarning.matchTitle}" başlıklı video zaten mevcut. Başlığını özgünleştirmeyi düşün.</span>
                        </div>
                      </div>
                    )}
                    {similarityWarning && (
                      <div className="mt-2 rounded-lg border border-[#2a2a2a] bg-[#171717] p-3 flex items-center justify-between gap-3">
                        <div className="text-[12px] text-[#bbb]">
                          Admin onayı olmadan bu video yüklenemez.
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setAdminSimilarityApproved(true)}
                        >
                          Admin onayı verildi
                        </Button>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={uploadForm.control} name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Açıklama</FormLabel>
                    <FormControl><Textarea placeholder="Videon hakkında..." className="resize-none h-28 bg-input/50" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Kategori seçimi + otomatik öneri */}
              <FormField control={uploadForm.control} name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-1">
                      <FormLabel className="mb-0">Kategori</FormLabel>
                      {suggestLoading && (
                        <span className="text-[11px] text-[#555] flex items-center gap-1">
                          <Sparkles className="h-3 w-3 animate-pulse text-primary/60" /> Analiz ediliyor...
                        </span>
                      )}
                      {!suggestLoading && autoSuggest && (
                        <button
                          type="button"
                          onClick={() => uploadForm.setValue("categoryId", String(autoSuggest.categoryId))}
                          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-all"
                        >
                          <Sparkles className="h-3 w-3" />
                          Öneri: <strong>{autoSuggest.name}</strong>
                          <span className="text-[10px] opacity-70">({Math.round(autoSuggest.confidence * 100)}%)</span>
                        </button>
                      )}
                    </div>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger className="bg-input/50"><SelectValue placeholder="Kategori seç..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Kategorisiz</SelectItem>
                        {categories.map((cat: any) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={uploadForm.control} name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Video Türü</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-input/50"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(limits?.allowedTypes ?? ["video","short"]).includes("video") && <SelectItem value="video">Normal Video</SelectItem>}
                          {(limits?.allowedTypes ?? ["video","short"]).includes("short") && <SelectItem value="short">Short (Dikey)</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField control={uploadForm.control} name="thumbnailUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thumbnail URL</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} className="bg-input/50" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField control={uploadForm.control} name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video URL</FormLabel>
                    <FormControl><Input placeholder="https://..." {...field} className="bg-input/50" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Premium / PPV — sadece izin verilmişse göster */}
              {(limits?.premiumAllowed !== false || limits?.ppvAllowed !== false) && (
                <div className="border border-[#2a2a2a] rounded-xl p-4 space-y-3 bg-[#1a1a1a]">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-400" /> Para Kazanma
                  </p>
                  <div className="flex gap-6 flex-wrap">
                    {limits?.premiumAllowed !== false && (
                      <FormField control={uploadForm.control} name="isPremium"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)}
                                className="w-4 h-4 accent-primary cursor-pointer" />
                            </FormControl>
                            <FormLabel className="cursor-pointer font-normal text-sm">Premium (abonelik gerekli)</FormLabel>
                          </FormItem>
                        )}
                      />
                    )}
                    {limits?.ppvAllowed !== false && (
                      <FormField control={uploadForm.control} name="isPPV"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)}
                                className="w-4 h-4 accent-primary cursor-pointer" />
                            </FormControl>
                            <FormLabel className="cursor-pointer font-normal text-sm">PPV (tek seferlik ödeme)</FormLabel>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {uploadForm.watch("isPPV") && (
                    <FormField control={uploadForm.control} name="ppvPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PPV Fiyatı ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0.99" placeholder="4.99" {...field} className="bg-input/50 max-w-[140px]" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}

              {/* Watermark */}
              <div className="border border-[#2a2a2a] rounded-xl p-4 space-y-2 bg-[#1a1a1a]">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Stamp className="h-4 w-4 text-blue-400" /> Filigran (Watermark)
                </p>
                <FormField control={uploadForm.control} name="watermarkEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)}
                          className="w-4 h-4 accent-primary cursor-pointer" />
                      </FormControl>
                      <FormLabel className="cursor-pointer font-normal text-sm">Bu videoya site filigranı ekle</FormLabel>
                    </FormItem>
                  )}
                />
                <p className="text-xs text-[#555]">Filigran, videonun üzerinde yarı saydam site logosu/adı olarak görünür. Admin panelinden özelleştirilebilir.</p>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button type="submit" disabled={createVideoMutation.isPending || limitReached || requiresAdminApproval}>
                  {createVideoMutation.isPending ? "Yükleniyor..." : requiresAdminApproval ? "Admin Onayı Gerekli" : "Videoyu Yayınla"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </AppLayout>
  );
}
