import { useState, useEffect } from "react";
import { getPendingLinks, updateLinkStatus, PendingLink } from "@/lib/link-filter";
import { Check, X, Link2, Clock, ShieldAlert, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const CONTEXT_LABELS: Record<PendingLink["context"], string> = {
  chat: "Canlı Sohbet",
  match: "Eşleşme",
  comment: "Yorum",
  story: "Hikaye",
};

const CONTEXT_COLORS: Record<PendingLink["context"], string> = {
  chat: "text-red-400 bg-red-900/20 border-red-500/20",
  match: "text-blue-400 bg-blue-900/20 border-blue-500/20",
  comment: "text-green-400 bg-green-900/20 border-green-500/20",
  story: "text-purple-400 bg-purple-900/20 border-purple-500/20",
};

export default function AdminLinkModeration() {
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const reload = () => setLinks(getPendingLinks().reverse());

  useEffect(() => { reload(); }, []);

  const approve = (id: string) => { updateLinkStatus(id, "approved"); reload(); };
  const reject = (id: string) => { updateLinkStatus(id, "rejected"); reload(); };

  const filtered = filter === "all" ? links : links.filter(l => l.status === filter);
  const pendingCount = links.filter(l => l.status === "pending").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-400" /> Link Moderasyon
          </h1>
          <p className="text-[#666] text-sm mt-1">
            Kullanıcıların paylaştığı linkler admin onayına kadar gizlenir.
          </p>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] text-[#888] hover:text-white text-sm transition-all"
        >
          <RefreshCw className="h-4 w-4" /> Yenile
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Bekleyen", value: links.filter(l => l.status === "pending").length, color: "text-amber-400" },
          { label: "Onaylanan", value: links.filter(l => l.status === "approved").length, color: "text-green-400" },
          { label: "Reddedilen", value: links.filter(l => l.status === "rejected").length, color: "text-red-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 text-center">
            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
            <p className="text-xs text-[#666] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 p-1 bg-[#161616] border border-[#222] rounded-xl w-fit">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              filter === f ? "bg-primary text-white" : "text-[#777] hover:text-white"
            )}
          >
            {f === "all" ? "Tümü" : f === "pending" ? `Bekleyen${pendingCount > 0 ? ` (${pendingCount})` : ""}` : f === "approved" ? "Onaylı" : "Reddedildi"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-[#555]">
          <Link2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Gösterilecek link yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(link => (
            <div
              key={link.id}
              className={cn(
                "bg-[#1a1a1a] border rounded-xl p-4",
                link.status === "pending"
                  ? "border-amber-500/20"
                  : link.status === "approved"
                  ? "border-green-500/20"
                  : "border-red-500/20"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", CONTEXT_COLORS[link.context])}>
                      {CONTEXT_LABELS[link.context]}
                    </span>
                    <span className="text-xs text-[#555]">@{link.sender}</span>
                    <span className="text-[10px] text-[#444] flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(link.timestamp, { addSuffix: true })}
                    </span>
                    {link.status !== "pending" && (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        link.status === "approved" ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"
                      )}>
                        {link.status === "approved" ? "✓ Onaylandı" : "✕ Reddedildi"}
                      </span>
                    )}
                  </div>

                  <div className="bg-[#111] rounded-lg p-2 border border-[#222]">
                    <p className="text-xs text-[#888] mb-1">Orijinal mesaj:</p>
                    <p className="text-sm text-white break-all">{link.originalText}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs text-primary break-all line-clamp-1">{link.url}</span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[#555] hover:text-white transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {link.status === "pending" && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => approve(link.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 hover:bg-green-900/30 border border-green-500/20 text-green-400 text-xs font-medium transition-all"
                    >
                      <Check className="h-3.5 w-3.5" /> Onayla
                    </button>
                    <button
                      onClick={() => reject(link.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/30 border border-red-500/20 text-red-400 text-xs font-medium transition-all"
                    >
                      <X className="h-3.5 w-3.5" /> Reddet
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
