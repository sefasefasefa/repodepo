import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";

export interface PublicSiteSettings {
  siteName: string;
  siteDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  registrationEnabled: boolean;
}

const DEFAULT: PublicSiteSettings = {
  siteName: "Prnhbbbb",
  siteDescription: "",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#7c3aed",
  registrationEnabled: true,
};

const CACHE_KEY = "pub_site_settings_v2";
const CACHE_TTL = 5 * 60 * 1000;

interface Ctx {
  settings: PublicSiteSettings;
  reload: () => Promise<void>;
}

const Context = createContext<Ctx>({ settings: DEFAULT, reload: async () => {} });

function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0;
  const h6 = hex.replace("#", "");
  if (h6.length === 3) {
    r = parseInt(h6[0] + h6[0], 16);
    g = parseInt(h6[1] + h6[1], 16);
    b = parseInt(h6[2] + h6[2], 16);
  } else {
    r = parseInt(h6.slice(0, 2), 16);
    g = parseInt(h6.slice(2, 4), 16);
    b = parseInt(h6.slice(4, 6), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lum = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      case b: hue = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(lum * 100)}%`;
}

function applyPrimaryColor(hex: string) {
  try {
    if (!hex || !hex.startsWith("#")) return;
    const hsl = hexToHsl(hex);
    document.documentElement.style.setProperty("--primary", hsl);
    document.documentElement.style.setProperty("--ring", hsl);
  } catch {}
}

function loadCache(): PublicSiteSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data as PublicSiteSettings;
  } catch {}
  return null;
}

export function PublicSiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSiteSettings>(() => loadCache() ?? DEFAULT);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/site-config");
      if (!r.ok) return;
      const data: PublicSiteSettings = await r.json();
      setSettings(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
      if (data.primaryColor) applyPrimaryColor(data.primaryColor);
    } catch {}
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (settings.primaryColor) applyPrimaryColor(settings.primaryColor);
    if (settings.siteName) document.title = settings.siteName;
  }, [settings.primaryColor, settings.siteName]);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.siteName,
    description: settings.siteDescription || undefined,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <Context.Provider value={{ settings, reload }}>
      <JsonLd id="schema-website" schema={websiteSchema} />
      {children}
    </Context.Provider>
  );
}

export function usePublicSiteSettings() {
  return useContext(Context);
}
