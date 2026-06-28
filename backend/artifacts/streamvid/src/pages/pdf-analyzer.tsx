import { useState, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  FileText, Upload, X, Loader2, BookOpen, Tag,
  Clock, Hash, AlignLeft, CheckCircle2, Lightbulb,
  BarChart2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  topTerms: string[];
  stats: {
    pageCount: number;
    wordCount: number;
    sentenceCount: number;
    readingMinutes: number;
    charCount: number;
  };
  contextUsed: boolean;
}

function StatCard({ icon: Icon, label, value, color = "text-primary" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <Icon className={cn("h-4 w-4", color)} />
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-[#666]">{label}</p>
    </div>
  );
}

export default function PdfAnalyzer() {
  const { user, token } = useAuth() as any;
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFullSummary, setShowFullSummary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Sadece PDF dosyaları desteklenmektedir.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("Dosya boyutu 20 MB'ı geçemez.");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      if (context.trim()) form.append("context", context.trim());

      const res = await fetch("/api/documents/analyze-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bir hata oluştu.");
      } else {
        setResult(data);
        setShowFullSummary(false);
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setContext("");
    setShowFullSummary(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!user) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <FileText className="h-16 w-16 text-[#333]" />
          <h2 className="text-xl font-bold text-white">PDF Analizi</h2>
          <p className="text-[#666] max-w-xs">Bu özelliği kullanmak için giriş yapman gerekiyor.</p>
          <Link href="/login">
            <Button className="bg-primary hover:bg-primary/90">Giriş Yap</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const summaryWords = result?.summary.split(" ") ?? [];
  const summaryPreview = summaryWords.slice(0, 60).join(" ");
  const summaryTruncated = summaryWords.length > 60;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/15 border border-primary/30 rounded-xl p-2.5">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">PDF Analizi</h1>
            <p className="text-sm text-[#666]">
              Dökümanı yükle, bağlam duyarlı özet ve anahtar noktalar al
            </p>
          </div>
        </div>

        {/* Upload zone */}
        {!result && (
          <div
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer",
              dragging
                ? "border-primary bg-primary/10"
                : file
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-[#2a2a2a] bg-[#111] hover:border-[#3a3a3a] hover:bg-[#161616]"
            )}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-green-500/15 border border-green-500/30 rounded-xl p-3">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-lg">{file.name}</p>
                  <p className="text-sm text-[#666] mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  className="text-xs text-[#555] hover:text-red-400 flex items-center gap-1 transition-colors mt-1"
                  onClick={e => { e.stopPropagation(); reset(); }}
                >
                  <X className="h-3 w-3" /> Kaldır
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-[#1e1e1e] rounded-xl p-3 border border-[#2a2a2a]">
                  <Upload className="h-8 w-8 text-[#555]" />
                </div>
                <div>
                  <p className="font-semibold text-white">PDF'i sürükle & bırak</p>
                  <p className="text-sm text-[#555] mt-1">ya da tıkla ve seç (maks. 20 MB)</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Context input */}
        {!result && file && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#aaa] flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Bağlam / Odak Noktası
              <span className="text-[#555] font-normal">(opsiyonel)</span>
            </label>
            <Textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Örn: &quot;Finansal riskler&quot;, &quot;Teknik gereksinimler&quot;, &quot;Hukuki maddeler&quot; — istediğin konuya odaklanır"
              className="bg-[#111] border-[#2a2a2a] text-white placeholder:text-[#444] resize-none h-20 focus:border-primary/50"
              maxLength={300}
            />
            <p className="text-xs text-[#444] text-right">{context.length}/300</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
            <X className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Analyze button */}
        {!result && (
          <Button
            onClick={analyze}
            disabled={!file || loading}
            className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Analiz ediliyor…
              </>
            ) : (
              <>
                <BookOpen className="h-5 w-5 mr-2" />
                Analiz Et
              </>
            )}
          </Button>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-5">

            {/* Context badge */}
            {result.contextUsed && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
                <Lightbulb className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm text-primary">
                  Özet, belirttiğin bağlama göre ağırlıklandırıldı.
                </p>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={BookOpen} label="Sayfa" value={result.stats.pageCount} />
              <StatCard icon={Hash}     label="Kelime" value={result.stats.wordCount.toLocaleString("tr-TR")} color="text-blue-400" />
              <StatCard icon={AlignLeft} label="Cümle" value={result.stats.sentenceCount} color="text-green-400" />
              <StatCard icon={Clock}    label="Okuma" value={`~${result.stats.readingMinutes} dk`} color="text-orange-400" />
            </div>

            {/* Summary */}
            <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-white text-sm">Özet</h2>
              </div>
              <p className="text-[15px] text-[#ccc] leading-relaxed">
                {summaryTruncated && !showFullSummary ? summaryPreview + "…" : result.summary}
              </p>
              {summaryTruncated && (
                <button
                  onClick={() => setShowFullSummary(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                >
                  {showFullSummary
                    ? <><ChevronUp className="h-3.5 w-3.5" /> Daha az göster</>
                    : <><ChevronDown className="h-3.5 w-3.5" /> Tamamını oku</>}
                </button>
              )}
            </div>

            {/* Key points */}
            {result.keyPoints.length > 0 && (
              <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <h2 className="font-semibold text-white text-sm">Anahtar Noktalar</h2>
                </div>
                <ul className="space-y-3">
                  {result.keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="shrink-0 mt-0.5 h-5 w-5 bg-green-500/15 border border-green-500/30 rounded-full flex items-center justify-center text-[11px] font-bold text-green-400">
                        {i + 1}
                      </span>
                      <p className="text-sm text-[#bbb] leading-relaxed">{point}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Top terms */}
            {result.topTerms.length > 0 && (
              <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-blue-400" />
                  <h2 className="font-semibold text-white text-sm">Öne Çıkan Kavramlar</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.topTerms.map(term => (
                    <span
                      key={term}
                      className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300 font-medium"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* New analysis button */}
            <Button
              variant="outline"
              onClick={reset}
              className="w-full border-[#2a2a2a] text-[#aaa] hover:text-white hover:bg-[#1e1e1e]"
            >
              <Upload className="h-4 w-4 mr-2" />
              Yeni PDF Analiz Et
            </Button>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
