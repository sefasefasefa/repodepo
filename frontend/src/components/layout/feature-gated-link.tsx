import { Link } from "wouter";
import { useFeatureState } from "@/lib/feature-flags";
import { toast } from "sonner";

export function FeatureGatedLink({ feature, href, children, className }: { feature: string; href: string; children: React.ReactNode; className?: string }) {
  const state = useFeatureState(feature);
  if (state === "enabled") return <Link href={href} className={className}>{children}</Link>;
  if (state === "maintenance") {
    return <button className={className} onClick={() => toast("Bu özellik bakımdadır")}>{children}</button>;
  }
  return null;
}
