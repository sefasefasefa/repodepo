import { useState } from "react";
import { Flag, X, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportContentType = "video" | "comment" | "user";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  contentType: ReportContentType;
  videoId?: number;
  commentId?: number;
  reportedUserId?: number;
  contentLabel?: string;
}

const REASONS: { value: string; label: string; desc: string }[] = [
  { value: "spam",        label: "Spam / Yanıltıcı",      desc: "Tekrar eden, yanıltıcı veya reklam içerikli" },
  { value: "nudity",      label: "Uygunsuz İçerik",       desc: "İzin verilmeyen veya kuralları ihlal eden içerik" },
  { value: "violence",    label: "Şiddet / Tehdit",        desc: "Fiziksel zarar, şiddet veya tehdit içeriyor" },
  { value: "harassment",  label: "Taciz / Zorbalık",       desc: "Kişiyi hedef alan saldırgan veya aşağılayıcı içerik" },
  { value: "underage",    label: "Reşit Olmayan",          desc: "18 yaşın altındaki bireyler içeriyor olabilir" },
  { value: "copyright",   label: "Telif Hakkı İhlali",     desc: "İzinsiz kullanılan müzik, video veya görsel" },
  { value: "misinformation", label: "Yanlış Bilgi",        desc: "Yanlış veya zararlı bilgi yayıyor" },
  { value: "other",       label: "Diğer",                  desc: "Yukarıdaki kategorilere girmeyen başka bir sorun" },
];

const TYPE_LABELS: Record<ReportContentType, string> = {
  video:   "Video",
  comment: "Yorum",
  user:    "Kullanıcı",
};

async function submitReport(payload: {
  contentType: ReportContentType;
  videoId?: number;
  commentId?: number;
  reportedUserId?: number;
  reason: string;
  description: string;
}) {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Şikayet gönderilemedi");
  }
  return res.json();
}

export function ReportModal({
  open, onClose, contentType, videoId, commentId, reportedUserId, contentLabel,
}: ReportModalProps) {
  const [reason, setReason]           = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus]           = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg]       = useState("");

  const reset = () => {
    setReason(""); setDescription(""); setStatus("idle"); setErrorMsg("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!reason) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      await submitReport({ contentType, videoId, commentId, reportedUserId, reason, description });
      setStatus("success");
    } catch (e: any) {
      setErrorMsg(e.message || "Bir hata oluştu");
      setStatus("error");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-900/20 flex items-center justify-center">
              <Flag className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">İçerik Şikayeti</h2>
              <p className="text-[11px] text-[#555]">
                {TYPE_LABELS[contentType]} şikayet et
                {contentLabel && <span className="text-[#444]"> · {contentLabel}</span>}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-[#555] hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* İçerik */}
        <div className="p-5">
          {status === "success" ? (
            <div className="text-center py-6 space-y-3">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-green-900/20 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-green-400" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-white">Şikayetiniz Alındı</p>
                <p className="text-xs text-[#666] mt-1">Moderasyon ekibimiz en kısa sürede inceleyecek.</p>
              </div>
              <button onClick={handleClose}
                className="mt-2 px-6 py-2 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl text-sm text-[#aaa] hover:text-white transition-colors">
                Kapat
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sebep seçimi */}
              <div className="space-y-2">
                <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">Şikayet Sebebi</label>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {REASONS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => setReason(r.value)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl border transition-all",
                        reason === r.value
                          ? "border-red-500/50 bg-red-900/15"
                          : "border-[#1e1e1e] bg-[#0e0e0e] hover:border-[#2a2a2a]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className={cn("text-xs font-semibold", reason === r.value ? "text-red-300" : "text-[#ccc]")}>
                          {r.label}
                        </p>
                        {reason === r.value && (
                          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                            <CheckCircle className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-[#555] mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Açıklama */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#555] font-medium uppercase tracking-wide">
                  Ek Açıklama <span className="text-[#444] normal-case font-normal">(isteğe bağlı)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Sorunu daha ayrıntılı açıklayın..."
                  className="w-full bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#2a2a2a] resize-none"
                />
                <p className="text-right text-[10px] text-[#444]">{description.length}/500</p>
              </div>

              {/* Hata */}
              {status === "error" && (
                <div className="flex items-center gap-2 bg-red-900/10 border border-red-800/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{errorMsg}</p>
                </div>
              )}

              {/* Uyarı */}
              <p className="text-[10px] text-[#444] leading-relaxed">
                Asılsız şikayetler hesabınıza kısıtlama getirebilir. Gönderilen bilgiler moderasyon ekibimiz tarafından işlenir.
              </p>

              {/* Butonlar */}
              <div className="flex gap-2 pt-1">
                <button onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] text-sm text-[#888] hover:text-white transition-colors">
                  İptal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!reason || status === "loading"}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
                >
                  {status === "loading"
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</>
                    : <><Flag className="h-4 w-4" /> Şikayet Et</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
