import { Link } from "wouter";
import { Home, Search, ArrowLeft, Play, Compass, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function NotFound() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] px-4 overflow-hidden relative">
      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-500/8 rounded-full blur-[120px]" />
      </div>

      <div
        className="relative text-center max-w-lg w-full"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        {/* Big 404 */}
        <div className="relative mb-6 select-none">
          <p
            className="text-[200px] font-black leading-none tracking-tighter"
            style={{
              background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            404
          </p>
          {/* Floating icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative"
              style={{ animation: "float 3s ease-in-out infinite" }}
            >
              <div className="p-5 bg-primary/10 rounded-3xl border border-primary/20 backdrop-blur-sm shadow-[0_0_40px_rgba(168,85,247,0.15)]">
                <Play className="h-14 w-14 text-primary" fill="currentColor" />
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-3xl border border-primary/30 animate-ping opacity-30" />
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-black text-white mb-3 tracking-tight">
          Sayfa Bulunamadı
        </h1>
        <p className="text-[#666] text-base mb-10 leading-relaxed max-w-sm mx-auto">
          Aradığın içerik taşınmış, silinmiş ya da hiç var olmamış olabilir.
          Yolunu kaybettin ama platform burada!
        </p>

        {/* Main CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link href="/">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white gap-2 rounded-full px-6 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
            >
              <Home className="h-4 w-4" /> Ana Sayfaya Dön
            </Button>
          </Link>
          <Link href="/search">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-[#2a2a2a] text-[#aaa] hover:text-white hover:border-[#444] gap-2 rounded-full px-6"
            >
              <Search className="h-4 w-4" /> İçerik Ara
            </Button>
          </Link>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto mb-8">
          {[
            { href: "/videos", icon: TrendingUp, label: "Videolar" },
            { href: "/creators", icon: Compass, label: "Yaratıcılar" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#161616] border border-[#1e1e1e] hover:border-[#333] hover:bg-[#1e1e1e] transition-all cursor-pointer group">
                <Icon className="h-3.5 w-3.5 text-[#555] group-hover:text-primary transition-colors" />
                <span className="text-sm text-[#666] group-hover:text-[#aaa] transition-colors">{label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Back link */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-[#444] hover:text-[#777] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Önceki Sayfaya Dön
        </button>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
