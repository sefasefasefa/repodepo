import { Link } from "wouter";
import { Home, Search, ArrowLeft, Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="text-center max-w-md w-full">
        <div className="relative mb-8 select-none">
          <p className="text-[160px] font-black leading-none text-[#111] tracking-tighter">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
              <Film className="h-12 w-12 text-primary" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Sayfa Bulunamadı</h1>
        <p className="text-[#666] text-sm mb-8 leading-relaxed">
          Aradığın sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white gap-2">
              <Home className="h-4 w-4" /> Ana Sayfaya Dön
            </Button>
          </Link>
          <Link href="/search">
            <Button variant="outline" className="w-full sm:w-auto border-[#333] text-[#aaa] hover:text-white gap-2">
              <Search className="h-4 w-4" /> İçerik Ara
            </Button>
          </Link>
        </div>

        <button
          onClick={() => window.history.back()}
          className="mt-6 flex items-center gap-1.5 text-sm text-[#555] hover:text-[#888] transition-colors mx-auto"
        >
          <ArrowLeft className="h-4 w-4" /> Geri Dön
        </button>
      </div>
    </div>
  );
}
