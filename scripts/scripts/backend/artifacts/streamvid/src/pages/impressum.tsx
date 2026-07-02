import { useState } from "react";
import { usePublicSiteSettings } from "@/lib/use-public-site-settings";
import { detectLang } from "@/lib/use-lang";
import { FileText, AlertCircle } from "lucide-react";

type Lang = "tr" | "de" | "en";

const LANGS: { code: Lang; label: string }[] = [
  { code: "tr", label: "Türkçe" },
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
];

// ⚠️ OPERATOR: Replace placeholder values below with your actual details.
// Fields marked [FILL IN] must be completed before going live.
const OPERATOR = {
  name: "[FILL IN: Company / Person Name]",
  address: "[FILL IN: Street, No]",
  city: "[FILL IN: Postal Code, City]",
  country: "[FILL IN: Country]",
  email: "[FILL IN: contact@yourdomain.com]",
  phone: "[FILL IN or REMOVE]",
  vatId: "[FILL IN or REMOVE: VAT / USt-IdNr.]",
  supervisoryAuthority: "[FILL IN if applicable]",
};

const TX: Record<Lang, {
  title: string;
  subtitle: string;
  notice: string;
  operatorHeading: string;
  contactHeading: string;
  vatHeading: string;
  contentHeading: string;
  contentBody: string[];
  liabilityHeading: string;
  liabilityBody: string[];
  copyrightHeading: string;
  copyrightBody: string[];
  privacyLink: string;
  backLink: string;
}> = {
  tr: {
    title: "Yasal Künye",
    subtitle: "Elektronik Ticaret ve Yayıncılık Bilgileri",
    notice: "⚠️ Aşağıdaki [FILL IN] alanlarını yayına geçmeden gerçek bilgilerle doldurun.",
    operatorHeading: "Platform İşleticisi",
    contactHeading: "İletişim",
    vatHeading: "Vergi / Kayıt Bilgileri",
    contentHeading: "İçerikten Sorumlu",
    contentBody: [
      "Platform içeriğinden sorumlu kişi: yukarıda belirtilen platform işleticisidir.",
    ],
    liabilityHeading: "Sorumluluk Sınırlaması",
    liabilityBody: [
      "Platform, kullanıcıların yüklediği içeriklerden doğrudan sorumlu tutulamaz; ancak bildirim alındığında yasal olmayan içerikleri kaldırma yükümlülüğü bulunmaktadır.",
      "Harici bağlantılar; bağlantı kurulduğu andaki hukuka uygunlukları kontrol edilmiş olmakla birlikte, üçüncü taraf içerikleri üzerinde sürekli bir denetim yükümlülüğümüz bulunmamaktadır.",
    ],
    copyrightHeading: "Telif Hakkı",
    copyrightBody: [
      "Bu platformda yayımlanan içeriklerin telif hakkı ilgili içerik sahiplerine aittir.",
      "Kullanıcılar, yükledikleri içeriklerin telif hakkını taşıdıklarını beyan eder.",
    ],
    privacyLink: "Gizlilik Politikası",
    backLink: "Siteye dön",
  },
  de: {
    title: "Impressum",
    subtitle: "Angaben gemäß § 5 TMG / § 55 RStV",
    notice: "⚠️ Ersetzen Sie [FILL IN]-Felder durch Ihre tatsächlichen Angaben vor dem Livegang.",
    operatorHeading: "Verantwortlicher Betreiber",
    contactHeading: "Kontakt",
    vatHeading: "Steuer- / Registrierungsangaben",
    contentHeading: "Verantwortlich für den Inhalt",
    contentBody: [
      "Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV ist der oben genannte Betreiber.",
    ],
    liabilityHeading: "Haftungsausschluss",
    liabilityBody: [
      "Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.",
      "Für Inhalte, die von Nutzern hochgeladen werden, haften wir gemäß §§ 8–10 TMG nicht, sind jedoch verpflichtet, rechtswidrige Inhalte nach Kenntnis zu entfernen.",
      "Links zu externen Websites: Zum Zeitpunkt der Verlinkung wurden keine rechtswidrigen Inhalte festgestellt. Auf aktuelle und zukünftige Inhalte verlinkter Seiten haben wir keinen Einfluss.",
    ],
    copyrightHeading: "Urheberrecht",
    copyrightBody: [
      "Die auf dieser Plattform veröffentlichten Inhalte unterliegen dem Urheberrecht der jeweiligen Rechteinhaber.",
      "Nutzer versichern, dass sie über die notwendigen Rechte an hochgeladenem Material verfügen.",
    ],
    privacyLink: "Datenschutzerklärung",
    backLink: "Zurück zur Website",
  },
  en: {
    title: "Legal Notice",
    subtitle: "Information pursuant to legal disclosure requirements",
    notice: "⚠️ Replace [FILL IN] fields with your actual details before going live.",
    operatorHeading: "Platform Operator",
    contactHeading: "Contact",
    vatHeading: "Tax / Registration Details",
    contentHeading: "Editorial Responsibility",
    contentBody: [
      "Editorially responsible for the content of this platform: the operator named above.",
    ],
    liabilityHeading: "Liability Disclaimer",
    liabilityBody: [
      "The platform operator is not directly liable for user-uploaded content but is obligated to remove unlawful content upon notice.",
      "External links were checked for legality at the time of linking; ongoing monitoring of third-party content is not feasible.",
    ],
    copyrightHeading: "Copyright",
    copyrightBody: [
      "Content published on this platform is protected by the copyright of the respective owners.",
      "Users warrant that they hold the necessary rights to any content they upload.",
    ],
    privacyLink: "Privacy Policy",
    backLink: "Back to site",
  },
};

function InfoRow({ label, value }: { label: string; value: string }) {
  const isFillIn = value.startsWith("[FILL IN");
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-2 border-b border-[#1a1a1a] last:border-0">
      <span className="text-xs text-[#555] shrink-0 w-32">{label}</span>
      <span className={`text-sm ${isFillIn ? "text-amber-500 font-mono text-xs" : "text-[#ccc]"}`}>
        {value}
      </span>
    </div>
  );
}

export default function Impressum() {
  const { settings } = usePublicSiteSettings();
  const siteName = settings.siteName || "Hotpulse";

  const [lang, setLang] = useState<Lang>(() => {
    const d = detectLang();
    return (["tr", "de", "en"].includes(d) ? d : "de") as Lang; // default DE for GDPR context
  });

  const tx = TX[lang];
  const hasFillIns = Object.values(OPERATOR).some(v => v.startsWith("[FILL IN"));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{tx.title}</h1>
            <p className="text-xs text-[#555]">{siteName} · {tx.subtitle}</p>
          </div>
        </div>

        {/* Language picker */}
        <div className="flex gap-2 mb-6">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                lang === l.code
                  ? "bg-primary text-white font-medium"
                  : "bg-[#1a1a1a] text-[#777] hover:text-white border border-[#222]"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Fill-in warning */}
        {hasFillIns && (
          <div className="flex gap-3 bg-amber-900/20 border border-amber-800/40 rounded-xl p-4 mb-6">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-200/80 text-xs leading-relaxed">{tx.notice}</p>
          </div>
        )}

        {/* Operator info */}
        <div className="bg-[#141414] border border-[#222] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">{tx.operatorHeading}</h2>
          <InfoRow label={lang === "de" ? "Name" : lang === "tr" ? "Ad / Ünvan" : "Name"} value={OPERATOR.name} />
          <InfoRow label={lang === "de" ? "Straße" : lang === "tr" ? "Adres" : "Address"} value={OPERATOR.address} />
          <InfoRow label={lang === "de" ? "Ort" : lang === "tr" ? "Şehir" : "City"} value={OPERATOR.city} />
          <InfoRow label={lang === "de" ? "Land" : lang === "tr" ? "Ülke" : "Country"} value={OPERATOR.country} />
        </div>

        {/* Contact */}
        <div className="bg-[#141414] border border-[#222] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">{tx.contactHeading}</h2>
          <InfoRow label="E-Mail" value={OPERATOR.email} />
          {OPERATOR.phone && <InfoRow label={lang === "de" ? "Telefon" : lang === "tr" ? "Telefon" : "Phone"} value={OPERATOR.phone} />}
        </div>

        {/* VAT / Tax */}
        <div className="bg-[#141414] border border-[#222] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">{tx.vatHeading}</h2>
          <InfoRow label={lang === "de" ? "USt-IdNr." : lang === "tr" ? "Vergi No" : "VAT ID"} value={OPERATOR.vatId} />
        </div>

        {/* Content responsibility */}
        <div className="bg-[#141414] border border-[#222] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">{tx.contentHeading}</h2>
          {tx.contentBody.map((line, i) => (
            <p key={i} className="text-sm text-[#aaa] leading-relaxed mb-1">{line}</p>
          ))}
        </div>

        {/* Liability */}
        <div className="bg-[#141414] border border-[#222] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">{tx.liabilityHeading}</h2>
          {tx.liabilityBody.map((line, i) => (
            <p key={i} className="text-sm text-[#aaa] leading-relaxed mb-2">{line}</p>
          ))}
        </div>

        {/* Copyright */}
        <div className="bg-[#141414] border border-[#222] rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-white mb-3">{tx.copyrightHeading}</h2>
          {tx.copyrightBody.map((line, i) => (
            <p key={i} className="text-sm text-[#aaa] leading-relaxed mb-1">{line}</p>
          ))}
        </div>

        {/* Footer links */}
        <div className="flex gap-4 text-xs text-[#555]">
          <a href="/privacy-policy" className="hover:text-[#888] underline transition-colors">
            {tx.privacyLink}
          </a>
          <a href="/" className="hover:text-[#888] transition-colors">
            ← {tx.backLink}
          </a>
        </div>
      </div>
    </div>
  );
}
