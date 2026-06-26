import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Crown, Clock, CheckCircle2, XCircle, Loader2,
  RefreshCw, ExternalLink, ChevronDown, Search, User,
  Calendar, Globe, AtSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type AppStatus = "pending" | "approved" | "rejected" | "all";

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/10  text-green-400  border-green-500/30",
  rejected: "bg-red-500/10   text-red-400    border-red-500/30",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor", approved: "Onaylandı", rejected: "Reddedildi",
};

interface Application {
  id: number;
  applicant: { id: number; username: string; email: string; avatarUrl?: string; displayName?: string };
  reason: string;
  motivation?: string;
  portfolioUrl?: string;
  socialLinks?: string;
  status: string;
  reviewNote?: string;
  adminNote?: string;
  createdAt: string;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4 flex items-center gap-4">
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-[#666]">{label}</p>
      </div>
    </div>
  );
}

function AppCard({ app, onProcess }: { app: Application; onProcess: () => void }) {
  const { token } = useAuth() as any;
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(app.reviewNote ?? app.adminNote ?? "");
  const [processing, setProcessing] = useState(false);

  const process = async (action: "approved" | "rejected") => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/creator-applications/${app.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: action, adminNote: note }),
      });
      if (!res.ok) throw new Error();
      toast({
        title: action === "approved" ? "Onaylandı ✓" : "Reddedildi",
        description: `${app.applicant.username} başvurusu ${action === "approved" ? "onaylandı" : "reddedildi"}.`,
      });
      onProcess();
    } catch {
      toast({ title: "Hata", description: "İşlem başarısız.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={cn(
      "bg-[#111] border rounded-xl overflow-hidden transition-colors",
      app.status === "pending" ? "border-yellow-500/20" : "border-[#222]"
    )}>
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02]"
        onClick={() => setExpanded(v => !v)}
      >
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={app.applicant.avatarUrl ?? ""} />
          <AvatarFallback className="text-xs bg-[#222]">
            {app.applicant.username.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">@{app.applicant.username}</span>
            {app.applicant.displayName && (
              <span className="text-xs text-[#555]">{app.applicant.displayName}</span>
            )}
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
              STATUS_STYLES[app.status]
            )}>
              {STATUS_LABELS[app.status]}
            </span>
          </div>
          <p className="text-xs text-[#555] mt-0.5 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(app.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <ChevronDown className={cn("h-4 w-4 text-[#555] transition-transform shrink-0", expanded && "rotate-180")} />
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#1d1d1d] space-y-4 pt-4">
          <div>
            <p className="text-xs text-[#555] uppercase tracking-wider mb-1.5">Başvuru Nedeni</p>
            <p className="text-sm text-[#ccc] leading-relaxed bg-[#0d0d0d] rounded-lg p-3">{app.motivation ?? app.reason}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {app.portfolioUrl && (
              <a href={app.portfolioUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline truncate">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                {app.portfolioUrl}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
            {app.socialLinks && (
              <span className="flex items-center gap-2 text-xs text-[#888]">
                <AtSign className="h-3.5 w-3.5 shrink-0" />
                {app.socialLinks}
              </span>
            )}
          </div>

          {app.status === "pending" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#555] uppercase tracking-wider mb-1.5">Yönetici Notu (opsiyonel)</p>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Red durumunda açıklama yaz..."
                  rows={2}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-white placeholder:text-[#444] text-sm resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => process("approved")}
                  disabled={processing}
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white h-9 text-sm gap-1.5"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Onayla
                </Button>
                <Button
                  onClick={() => process("rejected")}
                  disabled={processing}
                  variant="destructive"
                  className="flex-1 h-9 text-sm gap-1.5"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Reddet
                </Button>
              </div>
            </div>
          )}

          {app.status !== "pending" && (app.reviewNote ?? app.adminNote) && (
            <div className="bg-[#0d0d0d] rounded-lg p-3">
              <p className="text-xs text-[#555] mb-1">Yönetici Notu</p>
              <p className="text-sm text-[#999]">{app.reviewNote ?? app.adminNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminCreatorApplications() {
  const { token } = useAuth() as any;
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AppStatus>("pending");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/creator-applications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setApps(data.applications ?? []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const pending  = apps.filter(a => a.status === "pending");
  const approved = apps.filter(a => a.status === "approved");
  const rejected = apps.filter(a => a.status === "rejected");

  const filtered = apps.filter(a => {
    const matchStatus = filter === "all" || a.status === filter;
    const matchSearch = !search ||
      a.user.username.toLowerCase().includes(search.toLowerCase()) ||
      a.user.email.toLowerCase().includes(search.toLowerCase()) ||
      a.reason.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const FILTER_TABS: { id: AppStatus; label: string; count: number }[] = [
    { id: "pending",  label: "Bekleyenler", count: pending.length },
    { id: "approved", label: "Onaylananlar", count: approved.length },
    { id: "rejected", label: "Reddedilenler", count: rejected.length },
    { id: "all",      label: "Tümü",         count: apps.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" /> Creator Başvuruları
          </h2>
          <p className="text-sm text-[#555] mt-0.5">Kullanıcıların creator başvurularını incele ve işle</p>
        </div>
        <Button
          onClick={load}
          variant="ghost"
          className="text-[#666] hover:text-white gap-2"
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Yenile
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Bekleyen"    value={pending.length}  icon={Clock}        color="bg-yellow-500/10 text-yellow-400" />
        <StatCard label="Onaylanan"   value={approved.length} icon={CheckCircle2} color="bg-green-500/10 text-green-400" />
        <StatCard label="Reddedilen"  value={rejected.length} icon={XCircle}      color="bg-red-500/10 text-red-400" />
        <StatCard label="Toplam"      value={apps.length}     icon={User}         color="bg-primary/10 text-primary" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-[#111] border border-[#222] rounded-lg p-1 flex-wrap">
          {FILTER_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5",
                filter === t.id
                  ? "bg-primary text-white"
                  : "text-[#666] hover:text-white"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  filter === t.id ? "bg-white/20" : "bg-[#222] text-[#888]"
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Kullanıcı ara..."
            className="pl-9 bg-[#111] border-[#222] text-white placeholder:text-[#444] h-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#555]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Crown className="h-10 w-10 text-[#333]" />
          <p className="text-[#555]">
            {filter === "pending" ? "Bekleyen başvuru yok" : "Başvuru bulunamadı"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => (
            <AppCard key={app.id} app={app} onProcess={load} />
          ))}
        </div>
      )}
    </div>
  );
}
