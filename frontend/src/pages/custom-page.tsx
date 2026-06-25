import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { Lock, LogIn, Crown } from "lucide-react";

// ── Tipler ───────────────────────────────────────────────────────────────────
interface BlockLock { enabled: boolean; type: "login" | "subscription"; message?: string; }
type BlockType = "hero" | "text" | "image" | "two-col" | "cta" | "divider" | "video" | "html";
interface Block { type: BlockType; id: string; lock?: BlockLock; [k: string]: any; }
interface Page  { id: number; slug: string; title: string; blocks: Block[]; metaTitle?: string; metaDescription?: string; }

// ── Kilit Overlay ─────────────────────────────────────────────────────────────
function LockOverlay({ lock }: { lock: BlockLock }) {
  const [, setLocation] = useLocation();
  const isSubscription = lock.type === "subscription";

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md rounded-xl">
      <div className={`p-4 rounded-2xl mb-4 ${isSubscription ? "bg-amber-500/20 border border-amber-500/30" : "bg-blue-500/20 border border-blue-500/30"}`}>
        {isSubscription
          ? <Crown className="h-8 w-8 text-amber-400" />
          : <Lock  className="h-8 w-8 text-blue-400"  />}
      </div>

      <h3 className="text-base font-bold text-white mb-1">
        {isSubscription ? "Premium İçerik" : "Üye İçeriği"}
      </h3>

      <p className="text-sm text-[#aaa] text-center max-w-xs mb-5 px-4">
        {lock.message?.trim()
          ? lock.message
          : isSubscription
            ? "Bu içeriği görüntülemek için aktif bir aboneliğiniz olmalıdır."
            : "Bu içeriği görüntülemek için giriş yapmanız gerekmektedir."}
      </p>

      <button
        onClick={() => setLocation(isSubscription ? "/pricing" : "/login")}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          isSubscription
            ? "bg-amber-500 hover:bg-amber-400 text-black"
            : "bg-blue-600  hover:bg-blue-500  text-white"
        }`}
      >
        {isSubscription ? <Crown className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
        {isSubscription ? "Abone Ol" : "Giriş Yap"}
      </button>
    </div>
  );
}

// ── Abonelik kontrolü — /api/subscriptions/current ───────────────────────────
function useHasActiveSubscription(isAuthenticated: boolean) {
  const [hasSub, setHasSub] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) { setHasSub(false); return; }
    const token = localStorage.getItem("token") ?? "";
    fetch("/api/subscriptions/current", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setHasSub(!!(d && d.subscription && d.subscription.status === "active")))
      .catch(() => setHasSub(false));
  }, [isAuthenticated]);
  return hasSub;
}

// ── Erişim kontrolü ──────────────────────────────────────────────────────────
function useBlockAccess(lock: BlockLock | undefined, isAuthenticated: boolean, hasSub: boolean) {
  if (!lock?.enabled) return true;
  if (lock.type === "login")        return isAuthenticated;
  if (lock.type === "subscription") return isAuthenticated && hasSub;
  return true;
}

// ── Blok Sarmalayıcı ──────────────────────────────────────────────────────────
function BlockWrapper({ block, isAuthenticated, hasSub, children }: {
  block: Block; isAuthenticated: boolean; hasSub: boolean; children: React.ReactNode;
}) {
  const hasAccess = useBlockAccess(block.lock, isAuthenticated, hasSub);
  if (!block.lock?.enabled || hasAccess) return <>{children}</>;

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none" aria-hidden>{children}</div>
      <LockOverlay lock={block.lock} />
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function CustomPage() {
  const params = useParams<{ slug: string }>();
  const { isAuthenticated, user } = useAuth();
  const hasSub = useHasActiveSubscription(isAuthenticated);

  const [page, setPage]         = useState<Page | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Admin rolü varsa subscription sayılsın
  const effectiveHasSub = hasSub || user?.role === "admin";

  useEffect(() => {
    if (!params.slug) return;
    setLoading(true); setNotFound(false);
    fetch(`/api/pages/${params.slug}`)
      .then(r => { if (!r.ok) throw new Error("not-found"); return r.json(); })
      .then(d => setPage(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  useEffect(() => {
    if (page?.metaTitle) document.title = page.metaTitle;
    else if (page?.title) document.title = page.title;
  }, [page]);

  if (loading) return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </AppLayout>
  );

  if (notFound || !page) return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-6xl font-bold text-[#333] mb-4">404</p>
        <p className="text-xl text-[#666]">Sayfa bulunamadı</p>
        <a href="/" className="inline-block mt-6 text-primary hover:underline text-sm">Ana Sayfaya Dön</a>
      </div>
    </AppLayout>
  );

  const fontSizeClass: Record<string, string> = { sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl" };
  const widthClass:    Record<string, string> = { small: "max-w-xs mx-auto", medium: "max-w-md mx-auto", wide: "max-w-2xl mx-auto", full: "w-full" };

  return (
    <AppLayout>
      <div className="pb-16">
        {page.blocks.map(block => (
          <BlockWrapper key={block.id} block={block} isAuthenticated={isAuthenticated} hasSub={effectiveHasSub}>
            {block.type === "hero" && (
              <div className="relative py-20 px-6" style={{
                backgroundColor: block.bgColor,
                backgroundImage: block.bgImage ? `url(${block.bgImage})` : undefined,
                backgroundSize: "cover", backgroundPosition: "center",
                textAlign: block.align,
              }}>
                {block.bgImage && <div className="absolute inset-0 bg-black/50" />}
                <div className="relative z-10 max-w-4xl mx-auto">
                  <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: block.textColor }}>{block.title}</h1>
                  {block.subtitle && <p className="text-lg md:text-xl mb-8 opacity-80" style={{ color: block.textColor }}>{block.subtitle}</p>}
                  {block.btnText && (
                    <a href={block.btnUrl} className="inline-block bg-violet-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-violet-700 transition-colors">
                      {block.btnText}
                    </a>
                  )}
                </div>
              </div>
            )}

            {block.type === "text" && (
              <div className="max-w-4xl mx-auto px-6 py-8">
                <p className={`text-[#ccc] whitespace-pre-wrap leading-relaxed ${fontSizeClass[block.fontSize] ?? "text-base"}`} style={{ textAlign: block.align }}>
                  {block.content}
                </p>
              </div>
            )}

            {block.type === "image" && (
              <div className="max-w-4xl mx-auto px-6 py-6">
                <div className={widthClass[block.width] ?? "w-full"}>
                  <img src={block.url} alt={block.alt} className="w-full rounded-xl shadow-2xl" />
                  {block.caption && <p className="text-sm text-[#666] text-center mt-3">{block.caption}</p>}
                </div>
              </div>
            )}

            {block.type === "two-col" && (
              <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <p className="text-[#ccc] leading-relaxed whitespace-pre-wrap text-sm">{block.leftContent}</p>
                  <p className="text-[#ccc] leading-relaxed whitespace-pre-wrap text-sm">{block.rightContent}</p>
                </div>
              </div>
            )}

            {block.type === "cta" && (
              <div className="py-16 px-6 text-center" style={{ backgroundColor: block.bgColor }}>
                <div className="max-w-2xl mx-auto">
                  <h2 className="text-3xl font-bold text-white mb-3">{block.title}</h2>
                  {block.subtitle && <p className="text-white/70 text-lg mb-8">{block.subtitle}</p>}
                  {block.btnText && (
                    <a href={block.btnUrl} className="inline-block bg-white text-black px-8 py-3.5 rounded-xl font-semibold hover:bg-white/90 transition-colors">
                      {block.btnText}
                    </a>
                  )}
                </div>
              </div>
            )}

            {block.type === "divider" && (
              <div className="max-w-4xl mx-auto px-6 py-2">
                <hr style={{ borderStyle: block.style === "none" ? "hidden" : block.style, borderColor: block.color, borderTopWidth: "1px" }} />
              </div>
            )}

            {block.type === "video" && (
              <div className="max-w-4xl mx-auto px-6 py-6">
                <div className="aspect-video w-full rounded-xl overflow-hidden shadow-2xl bg-black">
                  <iframe src={block.url} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
                </div>
                {block.caption && <p className="text-sm text-[#666] text-center mt-3">{block.caption}</p>}
              </div>
            )}

            {block.type === "html" && (
              <div className="max-w-4xl mx-auto px-6 py-4" dangerouslySetInnerHTML={{ __html: block.code }} />
            )}
          </BlockWrapper>
        ))}

        {page.blocks.length === 0 && (
          <div className="max-w-4xl mx-auto px-6 py-20 text-center text-[#555]">
            <p>Bu sayfa henüz içerik içermiyor.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
