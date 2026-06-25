import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

const CONFIG_KEY = "prnhbbbb_site_config";

export interface NavItemConfig {
  label: string;
  enabled: boolean;
}

export interface MaintenanceSection {
  enabled: boolean;
  message: string;
}

export interface SiteConfig {
  nav: Record<string, NavItemConfig>;
  sections: Record<string, NavItemConfig>;
  maintenance: Record<string, MaintenanceSection>;
}

export const NAV_DEFAULTS: Record<string, { label: string; group: string }> = {
  "videos":          { label: "Öne Çıkan Videolar",       group: "Ana Menü" },
  "shorts":          { label: "Kısa Videolar",             group: "Ana Menü" },
  "recommended":     { label: "Önerilen Videolar",         group: "Ana Menü" },
  "trending":        { label: "Trend — Türkiye",           group: "Ana Menü" },
  "models":          { label: "Modeller & Starlar",        group: "Ana Menü" },
  "channels":        { label: "Kanallar",                  group: "Ana Menü" },
  "top-cats":        { label: "En İyi Kategoriler",        group: "Ana Menü" },
  "all-categories":  { label: "Tüm Kategoriler",           group: "Ana Menü" },
  "playlists":       { label: "Oynatma Listeleri",         group: "Ana Menü" },
  "stories":         { label: "Hikayeler",                 group: "Ana Menü" },
  "photos":          { label: "Fotoğraflar",               group: "Ana Menü" },
  "community":       { label: "Topluluk",                  group: "Ana Menü" },
  "pwa-banner":      { label: "Uygulama Yükle Banner",     group: "Ekstralar" },
  "personalized":    { label: "Kişisel Öneriler Toggle",   group: "Ekstralar" },
  "history":         { label: "İzleme Geçmişi",            group: "Hesabım" },
  "bookmarks":       { label: "Kaydedilenler",             group: "Hesabım" },
  "notifications":   { label: "Bildirimler",               group: "Hesabım" },
  "upload":          { label: "Video Yükle",               group: "İçerik Oluşturucu" },
  "creator-dash":    { label: "İçerik Paneli",             group: "İçerik Oluşturucu" },
  "admin-panel":     { label: "Admin Paneli",              group: "Yönetim" },
};

export const SECTION_DEFAULTS: Record<string, string> = {
  "section-account":   "Hesabım",
  "section-creator":   "İçerik Oluşturucu",
  "section-admin":     "Yönetim",
  "section-categories":"Kategoriler",
};

export const MAINTENANCE_DEFAULTS: Record<string, string> = {
  "global":    "Site şu anda bakımda. Yakında geri döneceğiz.",
  "videos":    "Video bölümü bakımda.",
  "shorts":    "Kısa videolar bölümü bakımda.",
  "upload":    "Video yükleme geçici olarak kapalı.",
  "payment":   "Ödeme sistemi bakımda.",
  "register":  "Yeni kayıtlar geçici olarak kapalı.",
};

function buildDefault(): SiteConfig {
  const nav: Record<string, NavItemConfig> = {};
  for (const [id, { label }] of Object.entries(NAV_DEFAULTS)) {
    nav[id] = { label, enabled: true };
  }
  const sections: Record<string, NavItemConfig> = {};
  for (const [id, label] of Object.entries(SECTION_DEFAULTS)) {
    sections[id] = { label, enabled: true };
  }
  const maintenance: Record<string, MaintenanceSection> = {};
  for (const [id, message] of Object.entries(MAINTENANCE_DEFAULTS)) {
    maintenance[id] = { enabled: false, message };
  }
  return { nav, sections, maintenance };
}

function loadConfig(): SiteConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return buildDefault();
    const parsed = JSON.parse(raw) as Partial<SiteConfig>;
    const def = buildDefault();
    return {
      nav: { ...def.nav, ...(parsed.nav || {}) },
      sections: { ...def.sections, ...(parsed.sections || {}) },
      maintenance: { ...def.maintenance, ...(parsed.maintenance || {}) },
    };
  } catch {
    return buildDefault();
  }
}

interface SiteConfigContextType {
  config: SiteConfig;
  setNavItem: (id: string, patch: Partial<NavItemConfig>) => void;
  setSection: (id: string, patch: Partial<NavItemConfig>) => void;
  setMaintenance: (id: string, patch: Partial<MaintenanceSection>) => void;
  resetAll: () => void;
  isInMaintenance: (id: string) => boolean;
}

const SiteConfigContext = createContext<SiteConfigContextType | undefined>(undefined);

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(loadConfig);

  const save = useCallback((next: SiteConfig) => {
    setConfig(next);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage", { key: CONFIG_KEY, newValue: JSON.stringify(next) }));
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === CONFIG_KEY && e.newValue) {
        try { setConfig(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setNavItem = (id: string, patch: Partial<NavItemConfig>) =>
    save({ ...config, nav: { ...config.nav, [id]: { ...config.nav[id], ...patch } } });

  const setSection = (id: string, patch: Partial<NavItemConfig>) =>
    save({ ...config, sections: { ...config.sections, [id]: { ...config.sections[id], ...patch } } });

  const setMaintenance = (id: string, patch: Partial<MaintenanceSection>) =>
    save({ ...config, maintenance: { ...config.maintenance, [id]: { ...config.maintenance[id], ...patch } } });

  const resetAll = () => save(buildDefault());

  const isInMaintenance = (id: string) => {
    if (config.maintenance["global"]?.enabled) return true;
    return config.maintenance[id]?.enabled ?? false;
  };

  return (
    <SiteConfigContext.Provider value={{ config, setNavItem, setSection, setMaintenance, resetAll, isInMaintenance }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error("useSiteConfig must be used within SiteConfigProvider");
  return ctx;
}
