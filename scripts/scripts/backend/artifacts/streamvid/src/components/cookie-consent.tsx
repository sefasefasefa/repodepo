import { useState, useEffect } from "react";
import { Cookie, ChevronDown, ChevronUp, X, Check, Settings2 } from "lucide-react";
import { t } from "@/lib/use-lang";

const CONSENT_KEY = "prnhbbbb_cookie_consent";
const CONSENT_VERSION = "1";

export type ConsentState = {
  version: string;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  timestamp: number;
};

export function getConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(state: Omit<ConsentState, "version" | "timestamp" | "necessary">) {
  const full: ConsentState = {
    ...state,
    necessary: true,
    version: CONSENT_VERSION,
    timestamp: Date.now(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(full));
  window.dispatchEvent(new CustomEvent("cookie-consent-updated", { detail: full }));
  return full;
}

const TX = {
  title: { tr: "Çerez Ayarları", de: "Cookie-Einstellungen", en: "Cookie Settings" },
  desc: {
    tr: "Bu site; temel işlevler için zorunlu çerezler ve opsiyonel analitik/pazarlama çerezleri kullanmaktadır. GDPR/KVKK kapsamında tercihlerinizi belirleyebilirsiniz.",
    de: "Diese Website verwendet notwendige Cookies für grundlegende Funktionen sowie optionale Analyse- und Marketing-Cookies. Gemäß DSGVO können Sie Ihre Einstellungen festlegen.",
    en: "This site uses necessary cookies for basic functionality and optional analytics/marketing cookies. Under GDPR you can set your preferences.",
  },
  necessary: { tr: "Zorunlu Çerezler", de: "Notwendige Cookies", en: "Necessary Cookies" },
  necessaryDesc: {
    tr: "Oturum, güvenlik ve temel site işlevleri için gereklidir. Devre dışı bırakılamaz.",
    de: "Für Sitzung, Sicherheit und grundlegende Websitfunktionen erforderlich. Kann nicht deaktiviert werden.",
    en: "Required for session, security and core site functions. Cannot be disabled.",
  },
  analytics: { tr: "Analitik Çerezler", de: "Analyse-Cookies", en: "Analytics Cookies" },
  analyticsDesc: {
    tr: "Ziyaretçi istatistikleri ve site performansını ölçmek için kullanılır.",
    de: "Wird verwendet, um Besucherstatistiken und die Website-Leistung zu messen.",
    en: "Used to measure visitor statistics and site performance.",
  },
  marketing: { tr: "Pazarlama Çerezleri", de: "Marketing-Cookies", en: "Marketing Cookies" },
  marketingDesc: {
    tr: "Kişiselleştirilmiş içerik ve reklamlar için kullanılır.",
    de: "Wird für personalisierte Inhalte und Werbung verwendet.",
    en: "Used for personalised content and advertisements.",
  },
  preferences: { tr: "Tercih Çerezleri", de: "Präferenz-Cookies", en: "Preference Cookies" },
  preferencesDesc: {
    tr: "Dil, tema ve kullanıcı arayüzü tercihlerini hatırlar.",
    de: "Speichert Spracheinstellungen, Thema und UI-Präferenzen.",
    en: "Remembers language, theme and UI preferences.",
  },
  acceptAll: { tr: "Tümünü Kabul Et", de: "Alle akzeptieren", en: "Accept All" },
  rejectAll: { tr: "Yalnızca Zorunlu", de: "Nur Notwendige", en: "Necessary Only" },
  save: { tr: "Tercihleri Kaydet", de: "Einstellungen speichern", en: "Save Preferences" },
  customize: { tr: "Özelleştir", de: "Anpassen", en: "Customize" },
  alwaysOn: { tr: "Her zaman açık", de: "Immer aktiv", en: "Always on" },
  privacyPolicy: { tr: "Gizlilik Politikası", de: "Datenschutzerklärung", en: "Privacy Policy" },
  impressum: { tr: "Künye", de: "Impressum", en: "Legal Notice" },
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-primary" : "bg-[#333]"}`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 my-0.5 ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function CategoryRow({
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#222] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-[#666] mt-0.5 leading-relaxed">{desc}</p>
      </div>
      {disabled ? (
        <span className="text-xs text-[#555] mt-1 shrink-0">{t(TX.alwaysOn)}</span>
      ) : (
        <Toggle checked={checked} onChange={onChange} />
      )}
    </div>
  );
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: false, marketing: false, preferences: true });

  useEffect(() => {
    const existing = getConsent();
    if (!existing) {
      // Small delay so it doesn't fight with age-gate
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => {
    saveConsent({ analytics: true, marketing: true, preferences: true });
    setVisible(false);
  };

  const handleRejectAll = () => {
    saveConsent({ analytics: false, marketing: false, preferences: false });
    setVisible(false);
  };

  const handleSave = () => {
    saveConsent(prefs);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9990] p-3 sm:p-4 pointer-events-none">
      <div className="mx-auto max-w-2xl bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl shadow-black/60 pointer-events-auto">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-3">
          <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">{t(TX.title)}</h3>
            <p className="text-xs text-[#888] mt-1 leading-relaxed">{t(TX.desc)}</p>
          </div>
        </div>

        {/* Expanded categories */}
        {expanded && (
          <div className="px-4 pb-1">
            <CategoryRow
              label={t(TX.necessary)}
              desc={t(TX.necessaryDesc)}
              checked={true}
              onChange={() => {}}
              disabled
            />
            <CategoryRow
              label={t(TX.preferences)}
              desc={t(TX.preferencesDesc)}
              checked={prefs.preferences}
              onChange={(v) => setPrefs((p) => ({ ...p, preferences: v }))}
            />
            <CategoryRow
              label={t(TX.analytics)}
              desc={t(TX.analyticsDesc)}
              checked={prefs.analytics}
              onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
            />
            <CategoryRow
              label={t(TX.marketing)}
              desc={t(TX.marketingDesc)}
              checked={prefs.marketing}
              onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 p-3 pt-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs text-[#666] hover:text-[#aaa] transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t(TX.customize)}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <div className="flex-1" />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRejectAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#252525] border border-[#333] text-[#aaa] hover:text-white transition-all"
            >
              {t(TX.rejectAll)}
            </button>
            {expanded ? (
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-all"
              >
                <Check className="h-3.5 w-3.5" />
                {t(TX.save)}
              </button>
            ) : (
              <button
                onClick={handleAcceptAll}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-all"
              >
                <Check className="h-3.5 w-3.5" />
                {t(TX.acceptAll)}
              </button>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="px-4 pb-3 flex gap-3">
          <a href="/privacy-policy" className="text-[10px] text-[#444] hover:text-[#777] transition-colors underline">
            {t(TX.privacyPolicy)}
          </a>
          <a href="/impressum" className="text-[10px] text-[#444] hover:text-[#777] transition-colors underline">
            {t(TX.impressum)}
          </a>
        </div>
      </div>
    </div>
  );
}
