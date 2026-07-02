import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock3, Play } from "lucide-react";

export function ResumeBanner({
  title,
  progress,
  onContinue,
  onDismiss,
}: {
  title: string;
  progress: number;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <div className={cn("rounded-xl border border-primary/20 bg-primary/10 p-4 flex items-center justify-between gap-4") }>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-primary text-sm font-semibold mb-1">
          <Clock3 className="h-4 w-4" />
          İzlemeye devam et
        </div>
        <p className="text-sm text-white/90 truncate">{title}</p>
        <p className="text-xs text-white/60 mt-1">{percent}% tamamlandı</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={onContinue} className="gap-2">
          <Play className="h-3.5 w-3.5" /> Devam Et
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="text-white/70 hover:text-white">
          Kapat
        </Button>
      </div>
    </div>
  );
}
