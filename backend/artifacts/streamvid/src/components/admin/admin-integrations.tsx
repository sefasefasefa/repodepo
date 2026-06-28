import { useState, useEffect } from "react";
import {
  Plus, Trash2, RefreshCw, Link2, Upload,
  ToggleLeft, ToggleRight, Search, Pencil, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface FieldConfig {
  loginLabel?: string;
  loginPlaceholder?: string;
  keyLabel?: string;
  keyPlaceholder?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  apiKeyLabel?: string;
  apiKeyPlaceholder?: string;
  hint?: string;
}

interface Platform {
  id: string;
  name: string;
  color: string;
  bg: string;
  logo: string;
  fields: string[];
  docs: string;
  cat: string;
  fieldConfig: FieldConfig;
}

const PLATFORMS: Platform[] = [
  {
    id: "streamtape", name: "Streamtape", color: "text-orange-400", bg: "bg-orange-900/20", logo: "ST", cat: "adult",
    fields: ["login", "key"],
    docs: "https://streamtape.com/account",
    fieldConfig: {
      loginLabel: "API/FTP Kullanıcı Adı",
      loginPlaceholder: "931488ed284d0afcaf7f (hesap sayfasından al)",
      keyLabel: "API/FTP Şifre",
      keyPlaceholder: "API şifreni gir",
      hint: "streamtape.com/account → Account Infos bölümünden API/FTP Username ve Password al",
    },
  },
  {
    id: "doodstream", name: "Doodstream", color: "text-blue-400", bg: "bg-blue-900/20", logo: "DS", cat: "adult",
    fields: ["apiKey"],
    docs: "https://doodapi.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "doodstream api anahtarın",
      hint: "doodapi.com → My Account → API Key bölümünden al",
    },
  },
  {
    id: "mixdrop", name: "Mixdrop", color: "text-purple-400", bg: "bg-purple-900/20", logo: "MX", cat: "adult",
    fields: ["email", "apiKey"],
    docs: "https://mixdrop.ag/api",
    fieldConfig: {
      emailLabel: "Hesap E-postası",
      emailPlaceholder: "mixdrop hesabına kayıtlı e-posta",
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "mixdrop api anahtarın",
      hint: "mixdrop.ag → Hesabım → API bölümünden e-posta ve API anahtarını al",
    },
  },
  {
    id: "streamlare", name: "Streamlare", color: "text-green-400", bg: "bg-green-900/20", logo: "SL", cat: "adult",
    fields: ["apiKey"],
    docs: "https://streamlare.com",
    fieldConfig: {
      apiKeyLabel: "API Token",
      apiKeyPlaceholder: "streamlare api token'ın",
      hint: "streamlare.com → Hesap Ayarları → API Token bölümünden al",
    },
  },
  {
    id: "vidoza", name: "Vidoza", color: "text-red-400", bg: "bg-red-900/20", logo: "VZ", cat: "adult",
    fields: ["apiKey"],
    docs: "https://vidoza.net",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "vidoza api anahtarın",
      hint: "vidoza.net hesabından API anahtarını al",
    },
  },
  {
    id: "filemoon", name: "Filemoon", color: "text-yellow-400", bg: "bg-yellow-900/20", logo: "FM", cat: "adult",
    fields: ["apiKey"],
    docs: "https://filemoon.sx",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "filemoon api anahtarın",
      hint: "filemoon.sx → Hesabım → API Key bölümünden al",
    },
  },
  {
    id: "streamwish", name: "StreamWish", color: "text-violet-400", bg: "bg-violet-900/20", logo: "SW", cat: "adult",
    fields: ["apiKey"],
    docs: "https://streamwish.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "streamwish api anahtarın",
      hint: "streamwish.com → Tools → API bölümünden al",
    },
  },
  {
    id: "vidhide", name: "VidHide", color: "text-cyan-400", bg: "bg-cyan-900/20", logo: "VH", cat: "adult",
    fields: ["apiKey"],
    docs: "https://vidhide.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "vidhide api anahtarın",
      hint: "vidhide.com hesabından API anahtarını al",
    },
  },
  {
    id: "voe", name: "Voe.sx", color: "text-teal-400", bg: "bg-teal-900/20", logo: "VO", cat: "adult",
    fields: ["apiKey"],
    docs: "https://voe.sx",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "voe.sx api anahtarın",
      hint: "voe.sx → Hesap Ayarları → API Key bölümünden al",
    },
  },
  {
    id: "upstream", name: "Upstream", color: "text-sky-400", bg: "bg-sky-900/20", logo: "US", cat: "adult",
    fields: ["apiKey"],
    docs: "https://upstream.to",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "upstream.to api anahtarın",
      hint: "upstream.to hesabından API anahtarını al",
    },
  },
  {
    id: "luluvdo", name: "Luluvdo", color: "text-pink-400", bg: "bg-pink-900/20", logo: "LL", cat: "adult",
    fields: ["apiKey"],
    docs: "https://luluvdo.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "luluvdo api anahtarın",
      hint: "luluvdo.com hesabından API anahtarını al",
    },
  },
  {
    id: "uqload", name: "Uqload", color: "text-rose-400", bg: "bg-rose-900/20", logo: "UQ", cat: "adult",
    fields: ["email", "apiKey"],
    docs: "https://uqload.io",
    fieldConfig: {
      emailLabel: "Hesap E-postası",
      emailPlaceholder: "uqload hesabına kayıtlı e-posta",
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "uqload api anahtarın",
      hint: "uqload.io → Hesabım → API bölümünden e-posta ve API anahtarını al",
    },
  },
  {
    id: "streamhide", name: "StreamHide", color: "text-slate-400", bg: "bg-slate-900/20", logo: "SH", cat: "adult",
    fields: ["apiKey"],
    docs: "https://streamhide.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "streamhide api anahtarın",
      hint: "streamhide.com hesabından API anahtarını al",
    },
  },
  {
    id: "supervideo", name: "SuperVideo", color: "text-amber-400", bg: "bg-amber-900/20", logo: "SV", cat: "adult",
    fields: ["apiKey"],
    docs: "https://supervideo.tv",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "supervideo.tv api anahtarın",
      hint: "supervideo.tv → Hesabım → API Key bölümünden al",
    },
  },
  {
    id: "dropload", name: "Dropload", color: "text-indigo-400", bg: "bg-indigo-900/20", logo: "DL", cat: "adult",
    fields: ["apiKey"],
    docs: "https://dropload.io",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "dropload.io api anahtarın",
      hint: "dropload.io hesabından API anahtarını al",
    },
  },
  {
    id: "embedsito", name: "Embedsito", color: "text-lime-400", bg: "bg-lime-900/20", logo: "ES", cat: "adult",
    fields: ["apiKey"],
    docs: "https://embedsito.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "embedsito api anahtarın",
      hint: "embedsito.com hesabından API anahtarını al",
    },
  },
  {
    id: "vidlox", name: "Vidlox", color: "text-red-300", bg: "bg-red-950/30", logo: "VL", cat: "adult",
    fields: ["apiKey"],
    docs: "https://vidlox.me",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "vidlox.me api anahtarın",
      hint: "vidlox.me hesabından API anahtarını al",
    },
  },
  {
    id: "clipwatching", name: "ClipWatching", color: "text-orange-300", bg: "bg-orange-950/30", logo: "CW", cat: "adult",
    fields: ["apiKey"],
    docs: "https://clipwatching.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "clipwatching api anahtarın",
      hint: "clipwatching.com hesabından API anahtarını al",
    },
  },
  {
    id: "streamsb", name: "StreamSB", color: "text-blue-300", bg: "bg-blue-950/30", logo: "SB", cat: "adult",
    fields: ["apiKey"],
    docs: "https://streamsb.net",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "streamsb api anahtarın",
      hint: "streamsb.net hesabından API anahtarını al",
    },
  },
  {
    id: "hxfile", name: "HXFile", color: "text-yellow-300", bg: "bg-yellow-950/30", logo: "HX", cat: "adult",
    fields: ["apiKey"],
    docs: "https://hxfile.ch",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "hxfile api anahtarın",
      hint: "hxfile.ch hesabından API anahtarını al",
    },
  },
  {
    id: "vidplay", name: "VidPlay", color: "text-green-300", bg: "bg-green-950/30", logo: "VP", cat: "adult",
    fields: ["apiKey"],
    docs: "https://vidplay.online",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "vidplay api anahtarın",
      hint: "vidplay.online hesabından API anahtarını al",
    },
  },
  {
    id: "nxbex", name: "Nxbex", color: "text-purple-300", bg: "bg-purple-950/30", logo: "NX", cat: "adult",
    fields: ["apiKey"],
    docs: "https://nxbex.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "nxbex api anahtarın",
      hint: "nxbex.com hesabından API anahtarını al",
    },
  },
  {
    id: "dropgalaxy", name: "DropGalaxy", color: "text-cyan-300", bg: "bg-cyan-950/30", logo: "DG", cat: "adult",
    fields: ["apiKey"],
    docs: "https://dropgalaxy.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "dropgalaxy api anahtarın",
      hint: "dropgalaxy.com hesabından API anahtarını al",
    },
  },
  {
    id: "evoload", name: "Evoload", color: "text-emerald-400", bg: "bg-emerald-900/20", logo: "EV", cat: "adult",
    fields: ["apiKey"],
    docs: "https://evoload.io",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "evoload api anahtarın",
      hint: "evoload.io hesabından API anahtarını al",
    },
  },
  {
    id: "fembed", name: "Fembed", color: "text-red-500", bg: "bg-red-900/20", logo: "FB", cat: "adult",
    fields: ["apiKey"],
    docs: "https://www.fembed.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "fembed api anahtarın",
      hint: "fembed.com hesabından API anahtarını al",
    },
  },
  {
    id: "hotlinking", name: "Hotlinking", color: "text-green-500", bg: "bg-green-900/20", logo: "HL", cat: "adult",
    fields: ["apiKey"],
    docs: "https://hotlinking.co",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "hotlinking api anahtarın",
      hint: "hotlinking.co hesabından API anahtarını al",
    },
  },
  // ── Ek +18 video/dosya hosting platformları ──────────────────────────────
  {
    id: "sendvid", name: "Sendvid", color: "text-blue-400", bg: "bg-blue-900/20", logo: "SV", cat: "adult",
    fields: ["apiKey"],
    docs: "https://sendvid.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "sendvid api anahtarın",
      hint: "sendvid.com → Hesabım → API bölümünden anahtarı al",
    },
  },
  {
    id: "pixeldrain", name: "Pixeldrain", color: "text-gray-400", bg: "bg-gray-900/20", logo: "PD", cat: "adult",
    fields: ["apiKey"],
    docs: "https://pixeldrain.com/api",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "pixeldrain api anahtarın",
      hint: "pixeldrain.com → Hesabım → API Keys → Yeni anahtar oluştur",
    },
  },
  {
    id: "streamff", name: "Streamff", color: "text-indigo-400", bg: "bg-indigo-900/20", logo: "SF", cat: "adult",
    fields: ["apiKey"],
    docs: "https://streamff.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "streamff api anahtarın",
      hint: "streamff.com hesabından API anahtarını al",
    },
  },
  {
    id: "vudeo", name: "Vudeo", color: "text-violet-400", bg: "bg-violet-900/20", logo: "VD", cat: "adult",
    fields: ["apiKey"],
    docs: "https://vudeo.net",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "vudeo api anahtarın",
      hint: "vudeo.net → Hesabım → API bölümünden anahtarı al",
    },
  },
  {
    id: "vidmoly", name: "VidMoly", color: "text-cyan-400", bg: "bg-cyan-900/20", logo: "VM", cat: "adult",
    fields: ["apiKey"],
    docs: "https://vidmoly.to",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "vidmoly api anahtarın",
      hint: "vidmoly.to → Hesabım → API Key bölümünden al",
    },
  },
  {
    id: "gofile", name: "Gofile", color: "text-blue-300", bg: "bg-blue-950/30", logo: "GF", cat: "adult",
    fields: ["apiKey"],
    docs: "https://gofile.io/api",
    fieldConfig: {
      apiKeyLabel: "API Token",
      apiKeyPlaceholder: "gofile hesap token'ın",
      hint: "gofile.io → Profil → API Token bölümünden al",
    },
  },
  {
    id: "krakenfiles", name: "KrakenFiles", color: "text-red-400", bg: "bg-red-900/20", logo: "KF", cat: "adult",
    fields: ["apiKey"],
    docs: "https://krakenfiles.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "krakenfiles api anahtarın",
      hint: "krakenfiles.com → Hesabım → API bölümünden anahtarı al",
    },
  },
  {
    id: "rapidgator", name: "Rapidgator", color: "text-green-400", bg: "bg-green-900/20", logo: "RG", cat: "adult",
    fields: ["login", "key"],
    docs: "https://rapidgator.net/article/api",
    fieldConfig: {
      loginLabel: "E-posta (Hesap)",
      loginPlaceholder: "rapidgator hesabına kayıtlı e-posta",
      keyLabel: "Şifre",
      keyPlaceholder: "hesap şifreni gir",
      hint: "rapidgator.net API'si e-posta + şifre ile çalışır — hesap sayfasından alabilirsin",
    },
  },
  {
    id: "turbobit", name: "Turbobit", color: "text-orange-400", bg: "bg-orange-900/20", logo: "TB", cat: "adult",
    fields: ["login", "key"],
    docs: "https://turbobit.net/api",
    fieldConfig: {
      loginLabel: "E-posta (Hesap)",
      loginPlaceholder: "turbobit hesabına kayıtlı e-posta",
      keyLabel: "Şifre",
      keyPlaceholder: "hesap şifreni gir",
      hint: "turbobit.net → API sayfası → e-posta + şifre ile bağlan",
    },
  },
  {
    id: "1fichier", name: "1Fichier", color: "text-yellow-400", bg: "bg-yellow-900/20", logo: "1F", cat: "adult",
    fields: ["apiKey"],
    docs: "https://1fichier.com/api.html",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "1fichier api anahtarın",
      hint: "1fichier.com → Hesabım → API bölümünden anahtarı al",
    },
  },
  {
    id: "nitroflare", name: "Nitroflare", color: "text-blue-500", bg: "bg-blue-900/20", logo: "NF", cat: "adult",
    fields: ["login", "key"],
    docs: "https://nitroflare.com/api",
    fieldConfig: {
      loginLabel: "E-posta (Hesap)",
      loginPlaceholder: "nitroflare hesabına kayıtlı e-posta",
      keyLabel: "Şifre",
      keyPlaceholder: "hesap şifreni gir",
      hint: "nitroflare.com → Hesap Ayarları → API bölümünden e-posta + şifre ile bağlan",
    },
  },
  {
    id: "katfile", name: "Katfile", color: "text-purple-400", bg: "bg-purple-900/20", logo: "KT", cat: "adult",
    fields: ["login", "key"],
    docs: "https://katfile.com/api",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı",
      loginPlaceholder: "katfile kullanıcı adın",
      keyLabel: "API Anahtarı",
      keyPlaceholder: "katfile api anahtarın",
      hint: "katfile.com → Hesabım → API Keys bölümünden kullanıcı adı ve anahtarı al",
    },
  },
  {
    id: "filedot", name: "Filedot", color: "text-pink-400", bg: "bg-pink-900/20", logo: "FD", cat: "adult",
    fields: ["login", "key"],
    docs: "https://filedot.xyz/api",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı",
      loginPlaceholder: "filedot kullanıcı adın",
      keyLabel: "API Anahtarı",
      keyPlaceholder: "filedot api anahtarın",
      hint: "filedot.xyz → Hesabım → API bölümünden kullanıcı adı ve anahtarı al",
    },
  },
  {
    id: "uploaded", name: "Uploaded.net", color: "text-teal-400", bg: "bg-teal-900/20", logo: "UL", cat: "adult",
    fields: ["login", "key"],
    docs: "https://uploaded.net/api",
    fieldConfig: {
      loginLabel: "E-posta (Hesap)",
      loginPlaceholder: "uploaded.net hesabına kayıtlı e-posta",
      keyLabel: "Şifre",
      keyPlaceholder: "hesap şifreni gir",
      hint: "uploaded.net → API belgelerine göre e-posta + şifre ile kimlik doğrulaması yapılır",
    },
  },
  {
    id: "dailyuploads", name: "DailyUploads", color: "text-amber-400", bg: "bg-amber-900/20", logo: "DU", cat: "adult",
    fields: ["login", "key"],
    docs: "https://dailyuploads.net/api",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı",
      loginPlaceholder: "dailyuploads kullanıcı adın",
      keyLabel: "API Anahtarı",
      keyPlaceholder: "dailyuploads api anahtarın",
      hint: "dailyuploads.net → Hesabım → API bölümünden al",
    },
  },
  {
    id: "hexupload", name: "HexUpload", color: "text-lime-400", bg: "bg-lime-900/20", logo: "HU", cat: "adult",
    fields: ["apiKey"],
    docs: "https://hexupload.net/api",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "hexupload api anahtarın",
      hint: "hexupload.net → Hesabım → API Key bölümünden al",
    },
  },
  {
    id: "wdupload", name: "WDUpload", color: "text-sky-400", bg: "bg-sky-900/20", logo: "WD", cat: "adult",
    fields: ["login", "key"],
    docs: "https://wdupload.com",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı",
      loginPlaceholder: "wdupload kullanıcı adın",
      keyLabel: "Şifre",
      keyPlaceholder: "hesap şifreni gir",
      hint: "wdupload.com → Hesap bilgilerinle bağlan",
    },
  },
  {
    id: "streamwo", name: "Streamwo", color: "text-violet-300", bg: "bg-violet-950/30", logo: "WO", cat: "adult",
    fields: ["apiKey"],
    docs: "https://streamwo.com",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "streamwo api anahtarın",
      hint: "streamwo.com → Hesabım → API bölümünden al",
    },
  },
  {
    id: "embedv", name: "EmbedV", color: "text-rose-400", bg: "bg-rose-900/20", logo: "EV2", cat: "adult",
    fields: ["apiKey"],
    docs: "https://embedv.net",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "embedv api anahtarın",
      hint: "embedv.net hesabından API anahtarını al",
    },
  },
  {
    id: "cloudvideo", name: "CloudVideo", color: "text-cyan-300", bg: "bg-cyan-950/30", logo: "CV", cat: "adult",
    fields: ["login", "apiKey"],
    docs: "https://cloudvideo.tv",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı",
      loginPlaceholder: "cloudvideo kullanıcı adın",
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "cloudvideo api anahtarın",
      hint: "cloudvideo.tv → Hesabım → API bölümünden kullanıcı adı ve anahtarı al",
    },
  },
  {
    id: "videobin", name: "Videobin", color: "text-orange-300", bg: "bg-orange-950/30", logo: "VB", cat: "adult",
    fields: ["apiKey"],
    docs: "https://videobin.co",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "videobin api anahtarın",
      hint: "videobin.co hesabından API anahtarını al",
    },
  },
  {
    id: "gounlimited", name: "GoUnlimited", color: "text-green-300", bg: "bg-green-950/30", logo: "GU", cat: "adult",
    fields: ["apiKey"],
    docs: "https://gounlimited.to",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "gounlimited api anahtarın",
      hint: "gounlimited.to → Hesabım → API bölümünden al",
    },
  },
  {
    id: "mexa", name: "Mexa.sh", color: "text-yellow-300", bg: "bg-yellow-950/30", logo: "MX2", cat: "adult",
    fields: ["apiKey"],
    docs: "https://mexa.sh",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "mexa.sh api anahtarın",
      hint: "mexa.sh → Hesabım → API Key bölümünden al",
    },
  },
  {
    id: "filerio", name: "Filerio", color: "text-purple-300", bg: "bg-purple-950/30", logo: "FR", cat: "adult",
    fields: ["login", "key"],
    docs: "https://filerio.in",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı",
      loginPlaceholder: "filerio kullanıcı adın",
      keyLabel: "Şifre",
      keyPlaceholder: "hesap şifreni gir",
      hint: "filerio.in → Hesabım bölümünden kullanıcı adı ve şifreyi kullan",
    },
  },
  {
    id: "uploadee", name: "Uploadee", color: "text-blue-200", bg: "bg-blue-950/30", logo: "UE", cat: "adult",
    fields: ["apiKey"],
    docs: "https://upload.ee",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "upload.ee api anahtarın",
      hint: "upload.ee → Hesabım → API bölümünden anahtarı al",
    },
  },
  {
    id: "bowfile", name: "Bowfile", color: "text-emerald-300", bg: "bg-emerald-950/30", logo: "BW", cat: "adult",
    fields: ["login", "key"],
    docs: "https://bowfile.com",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı",
      loginPlaceholder: "bowfile kullanıcı adın",
      keyLabel: "API Anahtarı",
      keyPlaceholder: "bowfile api anahtarın",
      hint: "bowfile.com → Hesabım → API Keys bölümünden al",
    },
  },
  {
    id: "sendspace", name: "SendSpace", color: "text-sky-300", bg: "bg-sky-950/30", logo: "SS", cat: "adult",
    fields: ["login", "apiKey"],
    docs: "https://www.sendspace.com/dev/api.html",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı",
      loginPlaceholder: "sendspace kullanıcı adın",
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "sendspace api anahtarın",
      hint: "sendspace.com → Hesabım → API bölümünden kullanıcı adı ve anahtarı al",
    },
  },
  {
    id: "anonfile", name: "AnonFiles (Alt)", color: "text-slate-300", bg: "bg-slate-950/30", logo: "AF", cat: "adult",
    fields: ["apiKey"],
    docs: "https://anonfiles.com/docs/api",
    fieldConfig: {
      apiKeyLabel: "API Anahtarı",
      apiKeyPlaceholder: "api anahtarın",
      hint: "Hesabından API anahtarını al",
    },
  },
  {
    id: "verystream", name: "Verystream", color: "text-red-300", bg: "bg-red-950/30", logo: "VS", cat: "adult",
    fields: ["login", "key"],
    docs: "https://verystream.com",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı (Login)",
      loginPlaceholder: "verystream kullanıcı adın",
      keyLabel: "API Anahtarı (Key)",
      keyPlaceholder: "verystream api anahtarın",
      hint: "verystream.com → Account → API bölümünden kullanıcı adı ve anahtarı al",
    },
  },
  {
    id: "mp4upload", name: "MP4Upload", color: "text-indigo-300", bg: "bg-indigo-950/30", logo: "M4", cat: "adult",
    fields: ["login", "key"],
    docs: "https://www.mp4upload.com",
    fieldConfig: {
      loginLabel: "Kullanıcı Adı",
      loginPlaceholder: "mp4upload kullanıcı adın",
      keyLabel: "API Anahtarı",
      keyPlaceholder: "mp4upload api anahtarın",
      hint: "mp4upload.com → Hesabım → API bölümünden kullanıcı adı ve anahtarı al",
    },
  },
];

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

const EMPTY_FORM = {
  platform: "streamtape", name: "", login: "", key: "", apiKey: "", email: "", autoUpload: true,
};

type CatFilter = "all" | "adult";

export function AdminIntegrations() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [showAdd, setShowAdd]           = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [testing, setTesting]           = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [search, setSearch]             = useState("");
  const [catFilter, setCatFilter]       = useState<CatFilter>("all");
  const [showKey, setShowKey]           = useState(false);
  const [showApiKey, setShowApiKey]     = useState(false);
  const [editingInt, setEditingInt]     = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/integrations");
      setIntegrations(d.integrations || []);
    } catch (e: any) {
      toast({ title: "Yüklenemedi", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = (platformId?: string, platformName?: string) => {
    setEditId(null);
    setConfirmDelete(false);
    setForm({ ...EMPTY_FORM, platform: platformId ?? "streamtape", name: platformName ?? "" });
    setShowKey(false);
    setShowApiKey(false);
    setShowAdd(true);
  };

  const openEdit = (int: any) => {
    setEditId(int.id);
    setEditingInt(int);
    setConfirmDelete(false);
    setForm({
      platform: int.platform,
      name: int.name,
      login: int.login ?? "",
      key: "",
      apiKey: "",
      email: int.email ?? "",
      autoUpload: int.autoUpload ?? true,
    });
    setShowKey(false);
    setShowApiKey(false);
    setShowAdd(true);
  };

  const closeModal = () => {
    setShowAdd(false);
    setEditId(null);
    setEditingInt(null);
    setConfirmDelete(false);
  };

  const save = async () => {
    if (!form.name || !form.platform) return;
    setSaving(true);
    try {
      if (editId) {
        const d = await apiFetch(`/admin/integrations/${editId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            login: form.login || undefined,
            key: form.key || undefined,
            apiKey: form.apiKey || undefined,
            email: form.email || undefined,
            autoUpload: form.autoUpload,
          }),
        });
        setIntegrations((p) => p.map((i) => (i.id === editId ? { ...i, ...d.integration } : i)));
        toast({ title: "Güncellendi", description: `${form.name} entegrasyonu güncellendi.` });
        apiFetch("/admin/integrations").then(r => setIntegrations(r.integrations || [])).catch(() => {});
      } else {
        const d = await apiFetch("/admin/integrations", { method: "POST", body: JSON.stringify(form) });
        setIntegrations((p) => [...p, d.integration]);
        toast({ title: "Eklendi", description: `${form.name} entegrasyonu eklendi.` });
      }
      setShowAdd(false);
      setEditId(null);
      setEditingInt(null);
      setForm({ ...EMPTY_FORM });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch(`/admin/integrations/${id}`, { method: "DELETE" });
      setIntegrations((p) => p.filter((i) => i.id !== id));
      toast({ title: "Silindi" });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const test = async (id: string) => {
    setTesting(id);
    try {
      const d = await apiFetch(`/admin/integrations/${id}/test`, { method: "POST" });
      toast({
        title: d.ok ? "Bağlantı başarılı ✓" : "Bağlantı başarısız",
        description: d.ok ? JSON.stringify(d.info) : d.error,
        variant: d.ok ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const toggle = async (id: string, field: "autoUpload" | "isActive", val: boolean) => {
    try {
      await apiFetch(`/admin/integrations/${id}`, { method: "PATCH", body: JSON.stringify({ [field]: val }) });
      setIntegrations((p) => p.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
    } catch {}
  };

  const selectedPlatform = PLATFORMS.find((p) => p.id === form.platform);

  const visiblePlatforms = PLATFORMS.filter(p => {
    const matchCat = catFilter === "all" || p.cat === catFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Video Platform Entegrasyonları</h2>
          <p className="text-[#666] text-sm mt-1">
            Videolar yüklendiğinde otomatik olarak bu platformlara gönderilir — {PLATFORMS.length} platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg bg-[#2a2a2a] text-[#888] hover:bg-[#333] transition-colors">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button onClick={() => openAdd()}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="h-4 w-4" /> Platform Ekle
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Platform ara..."
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-primary/50"
          />
        </div>
        {(["all","adult"] as CatFilter[]).map(f => (
          <button key={f} onClick={() => setCatFilter(f)}
            className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all",
              catFilter === f ? "border-primary bg-primary/15 text-white font-semibold" : "border-[#2a2a2a] bg-[#1a1a1a] text-[#666] hover:border-[#444]")}>
            {f === "all" ? `Tümü (${PLATFORMS.length})` : `+18 Platformlar (${PLATFORMS.filter(p => p.cat === "adult").length})`}
          </button>
        ))}
      </div>

      {/* Platform kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {visiblePlatforms.map((p) => {
          const added = integrations.find((i) => i.platform === p.id);
          return (
            <div key={p.id}
              className={cn("border rounded-xl p-3 transition-all",
                added ? `${p.bg} border-current/20` : "bg-[#1a1a1a] border-[#2a2a2a]")}>
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0", p.bg, p.color)}>
                  {p.logo}
                </div>
                <div className="min-w-0">
                  <p className={cn("font-semibold text-xs truncate", added ? p.color : "text-[#aaa]")}>{p.name}</p>
                  <p className="text-[9px] text-[#555]">{added ? `${added.uploadCount || 0} yükleme` : "+18"}</p>
                </div>
              </div>
              {added ? (
                <div className="flex gap-1 mt-1">
                  <button onClick={() => openEdit(added)}
                    className="flex-1 text-[9px] py-1 rounded bg-[#222] hover:bg-primary/20 text-[#aaa] hover:text-primary transition-colors flex items-center justify-center gap-1">
                    <Pencil className="h-2.5 w-2.5" /> Düzenle
                  </button>
                  <button onClick={() => test(added.id)} disabled={testing === added.id}
                    className="p-1 rounded bg-[#222] hover:bg-[#333] text-[#888] transition-colors">
                    {testing === added.id ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Link2 className="h-2.5 w-2.5" />}
                  </button>
                  <button onClick={() => remove(added.id)}
                    className="p-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openAdd(p.id, p.name)}
                  className="w-full text-[9px] py-1 rounded bg-[#222] hover:bg-[#2a2a2a] text-[#666] hover:text-white transition-colors mt-1">
                  + Ekle
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Eklenmiş entegrasyonlar listesi */}
      {integrations.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#aaa]">Aktif Entegrasyonlar</h3>
            <span className="text-xs text-primary font-bold">{integrations.length} bağlı</span>
          </div>
          <div className="divide-y divide-[#222]">
            {integrations.map((int) => {
              const p = PLATFORMS.find((x) => x.id === int.platform);
              return (
                <div key={int.id} className="flex items-center gap-4 px-4 py-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0", p?.bg, p?.color)}>
                    {p?.logo ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{int.name}</p>
                    <p className="text-[11px] text-[#555]">{int.platform} • {int.uploadCount || 0} yükleme</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#666]">
                      <span>Otomatik</span>
                      <button onClick={() => toggle(int.id, "autoUpload", !int.autoUpload)}>
                        {int.autoUpload
                          ? <ToggleRight className="h-4 w-4 text-primary" />
                          : <ToggleLeft className="h-4 w-4 text-[#444]" />}
                      </button>
                    </div>
                    <button onClick={() => openEdit(int)}
                      className="text-[11px] px-2 py-1 rounded bg-[#222] hover:bg-primary/20 hover:text-primary text-[#888] transition-colors flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> Düzenle
                    </button>
                    <button onClick={() => test(int.id)} disabled={testing === int.id}
                      className="text-[11px] px-2 py-1 rounded bg-[#222] hover:bg-[#2a2a2a] text-[#888] transition-colors flex items-center gap-1">
                      {testing === int.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <><Link2 className="h-3 w-3" /> Test</>}
                    </button>
                    <button onClick={() => remove(int.id)}
                      className="p-1.5 rounded hover:bg-red-900/30 text-[#555] hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && integrations.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-[#1a1a1a] rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Bilgi */}
      <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4">
        <div className="flex gap-3">
          <Upload className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-200">Otomatik Dağıtım Nasıl Çalışır?</p>
            <p className="text-xs text-blue-200/60 mt-1 leading-relaxed">
              Kullanıcı video yüklediğinde, "Otomatik Yükleme" açık entegrasyonlara dosya otomatik gönderilir.
              Yükleme arka planda gerçekleşir. 500 MB üzeri dosyalar otomatik dağıtımdan hariç tutulur.
            </p>
          </div>
        </div>
      </div>

      {/* Modal — Ekle / Düzenle */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">

            {/* Başlık */}
            <div className="flex items-center gap-3 mb-5">
              {selectedPlatform && (
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 ${selectedPlatform.bg} ${selectedPlatform.color}`}>
                  {selectedPlatform.logo}
                </div>
              )}
              <div>
                <h3 className="font-bold text-base leading-tight">
                  {editId ? `${selectedPlatform?.name ?? "Entegrasyon"} Düzenle` : "Platform Ekle"}
                </h3>
                <p className="text-[11px] text-[#555] mt-0.5">
                  {editId ? "Sadece değiştirmek istediğin alanları doldur" : "Platform kimlik bilgilerini gir"}
                </p>
              </div>
            </div>

            {/* Düzenleme modunda: mevcut kayıtlı değerler özeti */}
            {editId && editingInt && (
              <div className="mb-4 bg-[#111] border border-[#2a2a2a] rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-2">Mevcut Kayıtlı Değerler</p>
                {editingInt.login && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#666] w-24 shrink-0">{selectedPlatform?.fieldConfig.loginLabel ?? "Kullanıcı Adı"}</span>
                    <span className="text-[11px] text-white font-mono bg-[#1e1e1e] px-2 py-0.5 rounded flex-1 truncate">{editingInt.login}</span>
                  </div>
                )}
                {editingInt.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#666] w-24 shrink-0">{selectedPlatform?.fieldConfig.emailLabel ?? "E-posta"}</span>
                    <span className="text-[11px] text-white font-mono bg-[#1e1e1e] px-2 py-0.5 rounded flex-1 truncate">{editingInt.email}</span>
                  </div>
                )}
                {(editingInt.key && editingInt.key !== "") && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#666] w-24 shrink-0">{selectedPlatform?.fieldConfig.keyLabel ?? "Şifre"}</span>
                    <span className="text-[11px] text-green-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span> Kayıtlı
                    </span>
                  </div>
                )}
                {(editingInt.apiKey && editingInt.apiKey !== "") && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#666] w-24 shrink-0">{selectedPlatform?.fieldConfig.apiKeyLabel ?? "API Anahtarı"}</span>
                    <span className="text-[11px] text-green-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span> Kayıtlı
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {/* Platform seçimi (sadece yeni eklemede) */}
              {!editId && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">Platform</label>
                  <select value={form.platform}
                    onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white">
                    <optgroup label="+18 Video / Dosya Hosting">
                      {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-[#888] mb-1 block">Görünen Ad</label>
                <input value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={`Örn: ${selectedPlatform?.name} Ana`}
                  className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555]" />
              </div>

              {/* Platform ipucu */}
              {selectedPlatform?.fieldConfig.hint && (
                <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                  <span className="text-primary mt-0.5 shrink-0">💡</span>
                  <p className="text-xs text-primary/80 leading-relaxed">{selectedPlatform.fieldConfig.hint}</p>
                </div>
              )}

              {/* Login alanı */}
              {selectedPlatform?.fields.includes("login") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">
                    {selectedPlatform.fieldConfig.loginLabel ?? "Kullanıcı Adı"}
                    {editId && <span className="text-[#444] ml-1">— güncelle veya boş bırak</span>}
                  </label>
                  <input value={form.login}
                    onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
                    autoComplete="off"
                    placeholder={editId ? (editingInt?.login ?? selectedPlatform.fieldConfig.loginPlaceholder ?? "") : (selectedPlatform.fieldConfig.loginPlaceholder ?? "")}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444]" />
                </div>
              )}

              {/* Key alanı */}
              {selectedPlatform?.fields.includes("key") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 flex items-center justify-between">
                    <span>
                      {selectedPlatform.fieldConfig.keyLabel ?? "Şifre / Gizli Anahtar"}
                      {editId && <span className="text-[#444] ml-1">— yeni değer gir veya boş bırak</span>}
                    </span>
                    <button type="button" onClick={() => setShowKey(v => !v)}
                      className="text-[#555] hover:text-[#aaa] transition-colors">
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </label>
                  <input type={showKey ? "text" : "password"} value={form.key}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                    autoComplete="new-password"
                    placeholder={editId ? "Değiştirmek için yeni değer gir..." : (selectedPlatform.fieldConfig.keyPlaceholder ?? "")}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444]" />
                </div>
              )}

              {/* Email alanı */}
              {selectedPlatform?.fields.includes("email") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 block">
                    {selectedPlatform.fieldConfig.emailLabel ?? "E-posta"}
                    {editId && <span className="text-[#444] ml-1">— güncelle veya boş bırak</span>}
                  </label>
                  <input type="email" value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    autoComplete="off"
                    placeholder={editId ? (editingInt?.email ?? selectedPlatform.fieldConfig.emailPlaceholder ?? "") : (selectedPlatform.fieldConfig.emailPlaceholder ?? "")}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444]" />
                </div>
              )}

              {/* API Key alanı */}
              {selectedPlatform?.fields.includes("apiKey") && (
                <div>
                  <label className="text-xs text-[#888] mb-1 flex items-center justify-between">
                    <span>
                      {selectedPlatform.fieldConfig.apiKeyLabel ?? "API Anahtarı"}
                      {editId && <span className="text-[#444] ml-1">— yeni değer gir veya boş bırak</span>}
                    </span>
                    <button type="button" onClick={() => setShowApiKey(v => !v)}
                      className="text-[#555] hover:text-[#aaa] transition-colors">
                      {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </label>
                  <input type={showApiKey ? "text" : "password"} value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    autoComplete="new-password"
                    placeholder={editId ? "Değiştirmek için yeni API anahtarı gir..." : (selectedPlatform.fieldConfig.apiKeyPlaceholder ?? "")}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444]" />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="autoUpload" checked={form.autoUpload}
                  onChange={(e) => setForm((f) => ({ ...f, autoUpload: e.target.checked }))}
                  className="accent-primary" />
                <label htmlFor="autoUpload" className="text-sm text-[#aaa] cursor-pointer select-none">
                  Otomatik yüklemeyi etkinleştir
                </label>
              </div>

              {selectedPlatform && (
                <a href={selectedPlatform.docs} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  {selectedPlatform.name} API belgeleri →
                </a>
              )}
            </div>

            {/* Silme onayı */}
            {confirmDelete && editId && (
              <div className="mt-4 bg-red-950/40 border border-red-800/50 rounded-xl p-3">
                <p className="text-sm text-red-300 font-medium mb-3">
                  Bu entegrasyonu silmek istediğine emin misin?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await remove(editId);
                      closeModal();
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                    Evet, Sil
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 bg-[#222] hover:bg-[#2a2a2a] text-[#aaa] font-medium py-2 rounded-lg text-sm transition-colors">
                    Vazgeç
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {editId && !confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button onClick={save} disabled={!form.name || saving}
                className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                {saving ? "Kaydediliyor..." : editId ? "Güncelle" : "Kaydet"}
              </button>
              <button onClick={closeModal}
                className="flex-1 bg-[#222] hover:bg-[#2a2a2a] text-[#aaa] font-medium py-2.5 rounded-lg text-sm transition-colors">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
