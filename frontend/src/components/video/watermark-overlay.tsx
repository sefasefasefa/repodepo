import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface WatermarkConfig {
  isEnabled: boolean;
  imageUrl?: string | null;
  text?: string | null;
  useImage: boolean;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  size: "small" | "medium" | "large";
  opacity: number;
}

let cachedConfig: WatermarkConfig | null = null;
let fetchPromise: Promise<WatermarkConfig | null> | null = null;

async function fetchWatermarkConfig(): Promise<WatermarkConfig | null> {
  if (cachedConfig !== null) return cachedConfig;
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/watermark/config")
    .then(r => r.json())
    .then(d => { cachedConfig = d.config; return d.config; })
    .catch(() => null);
  return fetchPromise;
}

const POSITION_CLASSES: Record<string, string> = {
  "top-left":     "top-3 left-3 items-start",
  "top-right":    "top-3 right-3 items-end",
  "bottom-left":  "bottom-3 left-3 items-start",
  "bottom-right": "bottom-3 right-3 items-end",
  "center":       "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center",
};

const SIZE_MAP = {
  small:  { img: "h-5", text: "text-[10px] px-1.5 py-0.5" },
  medium: { img: "h-7", text: "text-xs px-2 py-1" },
  large:  { img: "h-10", text: "text-sm px-3 py-1.5" },
};

interface WatermarkOverlayProps {
  videoWatermarkEnabled: boolean;
  className?: string;
}

export function WatermarkOverlay({ videoWatermarkEnabled, className }: WatermarkOverlayProps) {
  const [config, setConfig] = useState<WatermarkConfig | null>(null);

  useEffect(() => {
    fetchWatermarkConfig().then(setConfig);
  }, []);

  if (!config || !config.isEnabled || !videoWatermarkEnabled) return null;

  const posClass = POSITION_CLASSES[config.position] || POSITION_CLASSES["bottom-right"];
  const sz = SIZE_MAP[config.size] || SIZE_MAP.medium;

  return (
    <div
      className={cn("absolute pointer-events-none z-20 flex flex-col", posClass, className)}
      style={{ opacity: config.opacity }}
    >
      {config.useImage && config.imageUrl ? (
        <img
          src={config.imageUrl}
          alt="watermark"
          className={cn("object-contain", sz.img)}
          draggable={false}
        />
      ) : (
        <span
          className={cn(
            "rounded font-bold text-white bg-black/30 backdrop-blur-sm select-none tracking-wide",
            sz.text
          )}
        >
          {config.text || "Prnhbbbb"}
        </span>
      )}
    </div>
  );
}
