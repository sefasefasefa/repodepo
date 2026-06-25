import { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink,
  Loader2, FileText, GripVertical,
  Type, Image, Columns2, Megaphone, Minus, ChevronUp, ChevronDown,
  AlignLeft, LayoutTemplate, Save, ArrowLeft, Settings,
  Lock, Unlock, LogIn, Crown
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Kilit arayüzü ─────────────────────────────────────────────────────────────
interface BlockLock {
  enabled:  boolean;
  type:     "login" | "subscription";
  message?: string;
}

// ── Blok tipleri ─────────────────────────────────────────────────────────────
type BlockType = "hero" | "text" | "image" | "two-col" | "cta" | "divider" | "video" | "html";

interface HeroBlock    { type: "hero";    id: string; lock?: BlockLock; title: string; subtitle: string; bgColor: string; bgImage: string; btnText: string; btnUrl: string; textColor: string; align: "left"|"center"|"right"; }
interface TextBlock    { type: "text";    id: string; lock?: BlockLock; content: string; align: "left"|"center"|"right"; fontSize: "sm"|"base"|"lg"|"xl"; }
interface ImageBlock   { type: "image";   id: string; lock?: BlockLock; url: string; alt: string; caption: string; width: "full"|"wide"|"medium"|"small"; }
interface TwoColBlock  { type: "two-col"; id: string; lock?: BlockLock; leftContent: string; rightContent: string; }
interface CtaBlock     { type: "cta";     id: string; lock?: BlockLock; title: string; subtitle: string; btnText: string; btnUrl: string; bgColor: string; }
interface DividerBlock { type: "divider"; id: string; lock?: BlockLock; style: "solid"|"dashed"|"dotted"|"none"; color: string; }
interface VideoBlock   { type: "video";   id: string; lock?: BlockLock; url: string; caption: string; }
interface HtmlBlock    { type: "html";    id: string; lock?: BlockLock; code: string; }

type Block = HeroBlock | TextBlock | ImageBlock | TwoColBlock | CtaBlock | DividerBlock | VideoBlock | HtmlBlock;

interface Page { id: number; slug: string; title: string; isPublished: boolean; showInNav: boolean; navLabel?: string; blocks?: Block[]; metaTitle?: string; metaDescription?: string; updatedAt: string; }

function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultBlock(type: BlockType): Block {
  switch (type) {
    case "hero":    return { type, id: uid(), title: "Başlık", subtitle: "Alt başlık metni buraya gelir.", bgColor: "#111111", bgImage: "", btnText: "Keşfet", btnUrl: "/", textColor: "#ffffff", align: "center" };
    case "text":    return { type, id: uid(), content: "Buraya metin içeriğinizi yazın...", align: "left", fontSize: "base" };
    case "image":   return { type, id: uid(), url: "", alt: "", caption: "", width: "full" };
    case "two-col": return { type, id: uid(), leftContent: "Sol sütun içeriği...", rightContent: "Sağ sütun içeriği..." };
    case "cta":     return { type, id: uid(), title: "Harekete Geçin", subtitle: "Açıklama metni.", btnText: "Başla", btnUrl: "/", bgColor: "#7c3aed" };
    case "divider": return { type, id: uid(), style: "solid", color: "#2a2a2a" };
    case "video":   return { type, id: uid(), url: "", caption: "" };
    case "html":    return { type, id: uid(), code: "<div>Özel HTML içeriği</div>" };
  }
}

// ── Blok Editörleri ──────────────────────────────────────────────────────────
function HeroEditor({ block, onChange }: { block: HeroBlock; onChange: (b: Block) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Başlık</label><input className="field-input" value={block.title} onChange={e => onChange({...block, title: e.target.value})} /></div>
        <div><label className="field-label">Arka Plan Rengi</label><input type="color" className="h-9 w-full rounded-lg cursor-pointer bg-[#1a1a1a] border border-[#2a2a2a]" value={block.bgColor} onChange={e => onChange({...block, bgColor: e.target.value})} /></div>
      </div>
      <div><label className="field-label">Alt Başlık</label><textarea className="field-input" rows={2} value={block.subtitle} onChange={e => onChange({...block, subtitle: e.target.value})} /></div>
      <div><label className="field-label">Arka Plan Görseli URL (opsiyonel)</label><input className="field-input" placeholder="https://..." value={block.bgImage} onChange={e => onChange({...block, bgImage: e.target.value})} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="field-label">Buton Metni</label><input className="field-input" value={block.btnText} onChange={e => onChange({...block, btnText: e.target.value})} /></div>
        <div><label className="field-label">Buton URL</label><input className="field-input" value={block.btnUrl} onChange={e => onChange({...block, btnUrl: e.target.value})} /></div>
        <div><label className="field-label">Hizalama</label>
          <select className="field-input" value={block.align} onChange={e => onChange({...block, align: e.target.value as any})}>
            <option value="left">Sol</option><option value="center">Orta</option><option value="right">Sağ</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function TextEditor({ block, onChange }: { block: TextBlock; onChange: (b: Block) => void }) {
  return (
    <div className="space-y-3">
      <div><label className="field-label">Metin</label><textarea className="field-input font-mono text-xs" rows={6} value={block.content} onChange={e => onChange({...block, content: e.target.value})} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Hizalama</label>
          <select className="field-input" value={block.align} onChange={e => onChange({...block, align: e.target.value as any})}>
            <option value="left">Sol</option><option value="center">Orta</option><option value="right">Sağ</option>
          </select>
        </div>
        <div><label className="field-label">Yazı Boyutu</label>
          <select className="field-input" value={block.fontSize} onChange={e => onChange({...block, fontSize: e.target.value as any})}>
            <option value="sm">Küçük</option><option value="base">Normal</option><option value="lg">Büyük</option><option value="xl">Çok Büyük</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ImageEditor({ block, onChange }: { block: ImageBlock; onChange: (b: Block) => void }) {
  return (
    <div className="space-y-3">
      <div><label className="field-label">Görsel URL</label><input className="field-input" placeholder="https://..." value={block.url} onChange={e => onChange({...block, url: e.target.value})} /></div>
      {block.url && <img src={block.url} alt="" className="h-24 object-cover rounded-lg w-full" onError={e => (e.currentTarget.style.display = "none")} />}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Alt Metin</label><input className="field-input" value={block.alt} onChange={e => onChange({...block, alt: e.target.value})} /></div>
        <div><label className="field-label">Genişlik</label>
          <select className="field-input" value={block.width} onChange={e => onChange({...block, width: e.target.value as any})}>
            <option value="small">Küçük</option><option value="medium">Orta</option><option value="wide">Geniş</option><option value="full">Tam</option>
          </select>
        </div>
      </div>
      <div><label className="field-label">Açıklama</label><input className="field-input" value={block.caption} onChange={e => onChange({...block, caption: e.target.value})} /></div>
    </div>
  );
}

function TwoColEditor({ block, onChange }: { block: TwoColBlock; onChange: (b: Block) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div><label className="field-label">Sol Sütun</label><textarea className="field-input" rows={5} value={block.leftContent} onChange={e => onChange({...block, leftContent: e.target.value})} /></div>
      <div><label className="field-label">Sağ Sütun</label><textarea className="field-input" rows={5} value={block.rightContent} onChange={e => onChange({...block, rightContent: e.target.value})} /></div>
    </div>
  );
}

function CtaEditor({ block, onChange }: { block: CtaBlock; onChange: (b: Block) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Başlık</label><input className="field-input" value={block.title} onChange={e => onChange({...block, title: e.target.value})} /></div>
        <div><label className="field-label">Arka Plan Rengi</label><input type="color" className="h-9 w-full rounded-lg cursor-pointer bg-[#1a1a1a] border border-[#2a2a2a]" value={block.bgColor} onChange={e => onChange({...block, bgColor: e.target.value})} /></div>
      </div>
      <div><label className="field-label">Açıklama</label><input className="field-input" value={block.subtitle} onChange={e => onChange({...block, subtitle: e.target.value})} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Buton Metni</label><input className="field-input" value={block.btnText} onChange={e => onChange({...block, btnText: e.target.value})} /></div>
        <div><label className="field-label">Buton URL</label><input className="field-input" value={block.btnUrl} onChange={e => onChange({...block, btnUrl: e.target.value})} /></div>
      </div>
    </div>
  );
}

function DividerEditor({ block, onChange }: { block: DividerBlock; onChange: (b: Block) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div><label className="field-label">Stil</label>
        <select className="field-input" value={block.style} onChange={e => onChange({...block, style: e.target.value as any})}>
          <option value="solid">Düz</option><option value="dashed">Kesik</option><option value="dotted">Noktalı</option><option value="none">Yok</option>
        </select>
      </div>
      <div><label className="field-label">Renk</label><input type="color" className="h-9 w-full rounded-lg cursor-pointer bg-[#1a1a1a] border border-[#2a2a2a]" value={block.color} onChange={e => onChange({...block, color: e.target.value})} /></div>
    </div>
  );
}

function VideoEditor({ block, onChange }: { block: VideoBlock; onChange: (b: Block) => void }) {
  return (
    <div className="space-y-3">
      <div><label className="field-label">Video URL (YouTube/Vimeo embed)</label><input className="field-input" placeholder="https://www.youtube.com/embed/..." value={block.url} onChange={e => onChange({...block, url: e.target.value})} /></div>
      <div><label className="field-label">Başlık/Açıklama</label><input className="field-input" value={block.caption} onChange={e => onChange({...block, caption: e.target.value})} /></div>
    </div>
  );
}

function HtmlEditor({ block, onChange }: { block: HtmlBlock; onChange: (b: Block) => void }) {
  return (
    <div><label className="field-label">HTML Kodu</label><textarea className="field-input font-mono text-xs" rows={8} value={block.code} onChange={e => onChange({...block, code: e.target.value})} /></div>
  );
}

// ── Kilit Editörü ─────────────────────────────────────────────────────────────
function LockEditor({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const lock = block.lock ?? { enabled: false, type: "login" as const, message: "" };
  const isOn = lock.enabled;

  const setLock = (patch: Partial<BlockLock>) =>
    onChange({ ...block, lock: { ...lock, ...patch } });

  return (
    <div className={cn(
      "rounded-xl border transition-all mt-3",
      isOn ? "border-amber-500/40 bg-amber-900/10" : "border-[#222] bg-[#0f0f0f]"
    )}>
      {/* toggle satırı */}
      <button
        type="button"
        onClick={() => setLock({ enabled: !isOn })}
        className="w-full flex items-center gap-3 px-3 py-2.5"
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          isOn ? "bg-amber-500/20 text-amber-400" : "bg-[#1e1e1e] text-[#555]"
        )}>
          {isOn ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </div>
        <div className="flex-1 text-left">
          <p className={cn("text-xs font-semibold", isOn ? "text-amber-300" : "text-[#888]")}>
            İçerik Kilidi
          </p>
          <p className="text-[10px] text-[#555] mt-0.5">
            {isOn
              ? lock.type === "login" ? "Giriş yapmayanlar bu bloğu göremez" : "Aboneler bu bloğu görebilir"
              : "Herkese açık"}
          </p>
        </div>
        {/* pill toggle */}
        <div className={cn("w-9 h-5 rounded-full transition-colors relative shrink-0", isOn ? "bg-amber-500" : "bg-[#333]")}>
          <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform", isOn && "translate-x-4")} />
        </div>
      </button>

      {/* kilit ayarları */}
      {isOn && (
        <div className="px-3 pb-3 space-y-3 border-t border-amber-500/20 pt-3">
          {/* tür seçimi */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLock({ type: "login" })}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                lock.type === "login"
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                  : "border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a] hover:text-[#aaa]"
              )}
            >
              <LogIn className="h-3.5 w-3.5 shrink-0" />
              <div className="text-left">
                <div>Giriş Gerekli</div>
                <div className="text-[10px] font-normal opacity-70 mt-0.5">Ücretsiz üye</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setLock({ type: "subscription" })}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                lock.type === "subscription"
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                  : "border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a] hover:text-[#aaa]"
              )}
            >
              <Crown className="h-3.5 w-3.5 shrink-0" />
              <div className="text-left">
                <div>Abonelik Gerekli</div>
                <div className="text-[10px] font-normal opacity-70 mt-0.5">Premium üye</div>
              </div>
            </button>
          </div>

          {/* özel mesaj */}
          <div>
            <label className="field-label">Kilit Mesajı (opsiyonel)</label>
            <input
              className="field-input"
              placeholder={
                lock.type === "login"
                  ? "Bu içeriği görmek için giriş yapın"
                  : "Bu içeriği görmek için abone olun"
              }
              value={lock.message ?? ""}
              onChange={e => setLock({ message: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const BLOCK_TYPES: { type: BlockType; label: string; icon: any; desc: string }[] = [
  { type: "hero",    label: "Hero Banner",   icon: LayoutTemplate, desc: "Büyük başlık + arka plan" },
  { type: "text",    label: "Metin",         icon: Type,           desc: "Düz metin paragrafı" },
  { type: "image",   label: "Görsel",        icon: Image,          desc: "Tek resim bloğu" },
  { type: "two-col", label: "İki Sütun",     icon: Columns2,       desc: "Yan yana iki içerik" },
  { type: "cta",     label: "CTA Butonu",    icon: Megaphone,      desc: "Aksiyon çağrısı" },
  { type: "divider", label: "Ayırıcı",       icon: Minus,          desc: "Yatay çizgi" },
  { type: "video",   label: "Video Embed",   icon: FileText,       desc: "YouTube/Vimeo gömme" },
  { type: "html",    label: "Özel HTML",     icon: AlignLeft,      desc: "Ham HTML kodu" },
];

const BLOCK_LABELS: Record<BlockType, string> = {
  "hero": "Hero Banner", "text": "Metin", "image": "Görsel",
  "two-col": "İki Sütun", "cta": "CTA", "divider": "Ayırıcı",
  "video": "Video", "html": "HTML",
};

// ── Blok Editör ──────────────────────────────────────────────────────────────
function BlockEditor({ block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  block: Block; onChange: (b: Block) => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void; isFirst: boolean; isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isLocked = block.lock?.enabled;

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-all",
      isLocked ? "border-amber-500/30" : open ? "border-[#3a3a3a]" : "border-[#222]"
    )}>
      {/* Başlık satırı */}
      <div
        className={cn("flex items-center gap-2 px-3 py-2.5 cursor-pointer", isLocked ? "bg-amber-900/10" : "bg-[#1a1a1a]")}
        onClick={() => setOpen(p => !p)}
      >
        <GripVertical className="h-3.5 w-3.5 text-[#444] shrink-0" />
        <span className="text-xs font-semibold text-[#aaa] flex-1">{BLOCK_LABELS[block.type]}</span>
        {isLocked && (
          <span className={cn(
            "flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded",
            block.lock?.type === "subscription"
              ? "bg-amber-900/40 text-amber-400"
              : "bg-amber-900/30 text-amber-500"
          )}>
            <Lock className="h-2.5 w-2.5" />
            {block.lock?.type === "subscription" ? "Abonelik" : "Giriş"}
          </span>
        )}
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} className="p-1 text-[#555] hover:text-white disabled:opacity-30 transition-colors"><ChevronUp className="h-3 w-3" /></button>
          <button onClick={e => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} className="p-1 text-[#555] hover:text-white disabled:opacity-30 transition-colors"><ChevronDown className="h-3 w-3" /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 text-[#555] hover:text-red-400 transition-colors"><Trash2 className="h-3 w-3" /></button>
          <ChevronDown className={cn("h-3 w-3 text-[#555] transition-transform ml-1", open && "rotate-180")} />
        </div>
      </div>

      {/* İçerik alanı */}
      {open && (
        <div className="p-4 bg-[#141414] space-y-2">
          {block.type === "hero"    && <HeroEditor    block={block} onChange={onChange} />}
          {block.type === "text"    && <TextEditor    block={block} onChange={onChange} />}
          {block.type === "image"   && <ImageEditor   block={block} onChange={onChange} />}
          {block.type === "two-col" && <TwoColEditor  block={block} onChange={onChange} />}
          {block.type === "cta"     && <CtaEditor     block={block} onChange={onChange} />}
          {block.type === "divider" && <DividerEditor block={block} onChange={onChange} />}
          {block.type === "video"   && <VideoEditor   block={block} onChange={onChange} />}
          {block.type === "html"    && <HtmlEditor    block={block} onChange={onChange} />}

          {/* Kilit editörü — her blokta */}
          <LockEditor block={block} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// ── Sayfa Önizleme ────────────────────────────────────────────────────────────
function PagePreview({ blocks }: { blocks: Block[] }) {
  const fontSizeClass: Record<string, string> = { sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl" };
  const widthClass:    Record<string, string> = { small: "max-w-xs mx-auto", medium: "max-w-md mx-auto", wide: "max-w-2xl mx-auto", full: "w-full" };

  return (
    <div className="bg-[#0a0a0a] rounded-xl border border-[#222] overflow-hidden">
      <div className="px-4 py-3 bg-[#161616] border-b border-[#222] flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
        </div>
        <div className="flex-1 bg-[#1a1a1a] rounded px-2 py-0.5 text-[10px] text-[#555] text-center font-mono">/page/…</div>
      </div>
      <div className="max-h-[460px] overflow-y-auto">
        {blocks.length === 0 ? (
          <div className="py-16 text-center text-[#444] text-sm">Henüz blok yok — sol panelden ekleyin</div>
        ) : blocks.map(block => (
          <div key={block.id} className="relative">
            {/* Kilit overlay — önizlemede */}
            {block.lock?.enabled && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-[3px] gap-1.5 rounded">
                <div className={cn("p-2 rounded-lg", block.lock.type === "subscription" ? "bg-amber-500/20" : "bg-blue-500/20")}>
                  {block.lock.type === "subscription" ? <Crown className="h-4 w-4 text-amber-400" /> : <LogIn className="h-4 w-4 text-blue-400" />}
                </div>
                <span className="text-[10px] font-bold text-white">
                  {block.lock.type === "subscription" ? "Abonelik Gerekli" : "Giriş Gerekli"}
                </span>
              </div>
            )}

            {block.type === "hero" && (
              <div className="relative py-16 px-8 text-center" style={{ backgroundColor: block.bgColor, backgroundImage: block.bgImage ? `url(${block.bgImage})` : undefined, backgroundSize: "cover", backgroundPosition: "center", textAlign: block.align }}>
                {block.bgImage && <div className="absolute inset-0 bg-black/50" />}
                <div className="relative z-10">
                  <h1 className="text-3xl font-bold mb-3" style={{ color: block.textColor }}>{block.title}</h1>
                  <p className="text-base mb-6 opacity-80" style={{ color: block.textColor }}>{block.subtitle}</p>
                  {block.btnText && <a href={block.btnUrl} className="inline-block bg-violet-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold">{block.btnText}</a>}
                </div>
              </div>
            )}
            {block.type === "text" && (
              <div className={cn("px-8 py-6 text-[#ccc] whitespace-pre-wrap", fontSizeClass[block.fontSize])} style={{ textAlign: block.align }}>{block.content}</div>
            )}
            {block.type === "image" && (
              <div className="px-8 py-4">
                <div className={widthClass[block.width]}>
                  {block.url ? <img src={block.url} alt={block.alt} className="w-full rounded-lg" /> : <div className="aspect-video bg-[#1a1a1a] rounded-lg flex items-center justify-center text-[#555] text-sm">Görsel URL girilmedi</div>}
                  {block.caption && <p className="text-xs text-[#666] mt-2 text-center">{block.caption}</p>}
                </div>
              </div>
            )}
            {block.type === "two-col" && (
              <div className="grid grid-cols-2 gap-6 px-8 py-6">
                <div className="text-sm text-[#ccc] whitespace-pre-wrap">{block.leftContent}</div>
                <div className="text-sm text-[#ccc] whitespace-pre-wrap">{block.rightContent}</div>
              </div>
            )}
            {block.type === "cta" && (
              <div className="py-12 px-8 text-center" style={{ backgroundColor: block.bgColor }}>
                <h2 className="text-xl font-bold text-white mb-2">{block.title}</h2>
                <p className="text-sm text-white/70 mb-5">{block.subtitle}</p>
                {block.btnText && <a href={block.btnUrl} className="inline-block bg-white text-black px-6 py-2.5 rounded-lg text-sm font-semibold">{block.btnText}</a>}
              </div>
            )}
            {block.type === "divider" && (
              <div className="px-8 py-3"><hr style={{ borderStyle: block.style === "none" ? "hidden" : block.style, borderColor: block.color }} /></div>
            )}
            {block.type === "video" && (
              <div className="px-8 py-4">
                {block.url ? (
                  <iframe src={block.url} className="w-full aspect-video rounded-lg" allow="autoplay; fullscreen" />
                ) : <div className="aspect-video bg-[#1a1a1a] rounded-lg flex items-center justify-center text-[#555] text-sm">Video URL girilmedi</div>}
                {block.caption && <p className="text-xs text-[#666] mt-2 text-center">{block.caption}</p>}
              </div>
            )}
            {block.type === "html" && (
              <div className="px-8 py-4 text-xs text-[#888] bg-[#111] border-y border-[#1e1e1e]">
                <span className="text-[#555]">HTML: </span><code className="text-[#aaa]">{block.code.slice(0, 80)}{block.code.length > 80 ? "…" : ""}</code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function AdminCustomPages() {
  const token = localStorage.getItem("token") ?? "";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [pages, setPages]     = useState<Page[]>([]);
  const [view, setView]       = useState<"list" | "edit">("list");
  const [editing, setEditing] = useState<Page | null>(null);
  const [saving, setSaving]   = useState(false);
  const [showPreview, setShowPreview]   = useState(true);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [deleteId, setDeleteId]         = useState<number | null>(null);

  const [title, setTitle]       = useState("");
  const [slug, setSlug]         = useState("");
  const [blocks, setBlocks]     = useState<Block[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [showInNav, setShowInNav]     = useState(false);
  const [navLabel, setNavLabel]       = useState("");
  const [metaTitle, setMetaTitle]     = useState("");
  const [metaDesc, setMetaDesc]       = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [slugError, setSlugError]       = useState("");

  const loadPages = () => {
    fetch("/api/pages", { headers }).then(r => r.json()).then(d => setPages(d.pages ?? []));
  };

  useEffect(() => { loadPages(); }, []);

  const openNew = () => {
    setEditing(null); setTitle(""); setSlug(""); setBlocks([]); setIsPublished(false);
    setShowInNav(false); setNavLabel(""); setMetaTitle(""); setMetaDesc(""); setSlugError(""); setView("edit");
  };

  const openEdit = (p: Page) => {
    setEditing(p); setTitle(p.title); setSlug(p.slug);
    setBlocks((p.blocks as Block[]) ?? []); setIsPublished(p.isPublished);
    setShowInNav(p.showInNav); setNavLabel(p.navLabel ?? "");
    setMetaTitle(p.metaTitle ?? ""); setMetaDesc(p.metaDescription ?? "");
    setSlugError(""); setView("edit");
  };

  const autoSlug = (t: string) => t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").slice(0, 50);

  const handleTitleChange = (v: string) => { setTitle(v); if (!editing) setSlug(autoSlug(v)); };

  const handleSlugChange = (v: string) => {
    const cleaned = v.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(cleaned);
    setSlugError(/^[a-z0-9-]+$/.test(cleaned) || cleaned === "" ? "" : "Yalnızca küçük harf, rakam ve tire");
  };

  const save = async () => {
    if (!title.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      const body = JSON.stringify({ slug, title, blocks, isPublished, showInNav, navLabel: navLabel || null, metaTitle: metaTitle || null, metaDescription: metaDesc || null });
      const res = editing
        ? await fetch(`/api/pages/${editing.id}`, { method: "PUT",  headers, body })
        : await fetch("/api/pages",               { method: "POST", headers, body });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      loadPages(); setView("list");
    } finally { setSaving(false); }
  };

  const deletePage = async (id: number) => {
    await fetch(`/api/pages/${id}`, { method: "DELETE", headers });
    setDeleteId(null); loadPages();
  };

  const togglePublish = async (p: Page) => {
    await fetch(`/api/pages/${p.id}`, { method: "PUT", headers, body: JSON.stringify({ isPublished: !p.isPublished }) });
    loadPages();
  };

  const addBlock    = (type: BlockType) => { setBlocks(b => [...b, defaultBlock(type)]); setShowAddBlock(false); };
  const updateBlock = (idx: number, b: Block) => setBlocks(bs => bs.map((x, i) => i === idx ? b : x));
  const deleteBlock = (idx: number) => setBlocks(bs => bs.filter((_, i) => i !== idx));
  const moveBlock   = (idx: number, dir: -1 | 1) => {
    const nb = [...blocks]; const target = idx + dir;
    if (target < 0 || target >= nb.length) return;
    [nb[idx], nb[target]] = [nb[target], nb[idx]]; setBlocks(nb);
  };

  const lockedCount = blocks.filter(b => b.lock?.enabled).length;

  // ── Sayfa Listesi ──────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="max-w-4xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Özel Sayfalar</h2>
            <p className="text-sm text-[#666] mt-0.5">Blok tabanlı editörle özel içerik sayfaları oluşturun</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Yeni Sayfa
          </button>
        </div>

        {pages.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-[#222] rounded-xl">
            <LayoutTemplate className="h-10 w-10 mx-auto text-[#333] mb-3" />
            <p className="text-[#666] text-sm mb-4">Henüz özel sayfa yok</p>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold mx-auto hover:bg-primary/90">
              <Plus className="h-4 w-4" /> İlk Sayfayı Oluştur
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map(p => (
              <div key={p.id} className="flex items-center gap-4 bg-[#1a1a1a] border border-[#222] rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{p.title}</span>
                    {p.isPublished
                      ? <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded font-bold">YAYINDA</span>
                      : <span className="text-[10px] bg-[#222] text-[#666] px-1.5 py-0.5 rounded font-bold">TASLAK</span>}
                    {p.showInNav && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-bold">NAV</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-[11px] text-[#666] font-mono">/page/{p.slug}</code>
                    {p.isPublished && (
                      <a href={`/page/${p.slug}`} target="_blank" rel="noopener noreferrer" className="text-[#555] hover:text-primary">
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => togglePublish(p)} title={p.isPublished ? "Yayından kaldır" : "Yayınla"}
                    className={cn("p-2 rounded-lg transition-colors", p.isPublished ? "text-green-400 hover:bg-green-900/20" : "text-[#555] hover:text-white hover:bg-[#222]")}>
                    {p.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(p)} className="p-2 rounded-lg text-[#555] hover:text-white hover:bg-[#222] transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteId(p.id)} className="p-2 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {deleteId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <h3 className="font-bold text-lg mb-2">Sayfayı Sil</h3>
              <p className="text-sm text-[#888] mb-5">Bu sayfa kalıcı olarak silinecek. Geri alınamaz.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-lg border border-[#333] text-sm text-[#aaa] hover:bg-[#222]">İptal</button>
                <button onClick={() => deletePage(deleteId)} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Sil</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Sayfa Editörü ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Araç çubuğu */}
      <div className="flex items-center gap-3 bg-[#161616] border border-[#222] rounded-xl px-4 py-3">
        <button onClick={() => setView("list")} className="flex items-center gap-1.5 text-sm text-[#888] hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Geri
        </button>
        <div className="w-px h-5 bg-[#2a2a2a]" />
        <input
          value={title} onChange={e => handleTitleChange(e.target.value)}
          placeholder="Sayfa başlığı..."
          className="flex-1 bg-transparent text-white font-semibold text-base placeholder:text-[#444] focus:outline-none"
        />
        <div className="flex items-center gap-2 shrink-0">
          {lockedCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-900/20 px-2 py-1 rounded-lg font-semibold">
              <Lock className="h-3 w-3" /> {lockedCount} kilitli blok
            </span>
          )}
          <button onClick={() => setShowSettings(p => !p)} className={cn("p-2 rounded-lg transition-colors", showSettings ? "text-primary bg-primary/10" : "text-[#555] hover:text-white hover:bg-[#222]")}>
            <Settings className="h-4 w-4" />
          </button>
          <button onClick={() => setShowPreview(p => !p)} className={cn("p-2 rounded-lg transition-colors hidden lg:block", showPreview ? "text-primary bg-primary/10" : "text-[#555] hover:text-white hover:bg-[#222]")}>
            <Eye className="h-4 w-4" />
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-[#666]">{isPublished ? "Yayında" : "Taslak"}</span>
            <div onClick={() => setIsPublished(p => !p)} className={cn("w-9 h-5 rounded-full transition-all relative", isPublished ? "bg-primary" : "bg-[#333]")}>
              <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all", isPublished && "translate-x-4")} />
            </div>
          </label>
          <button onClick={save} disabled={saving || !title.trim() || !slug.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Kaydet
          </button>
        </div>
      </div>

      {/* Sayfa Ayarları */}
      {showSettings && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-[#aaa]">Sayfa Ayarları</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="field-label">URL Slug</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[#555] shrink-0">/page/</span>
                <input className={cn("field-input flex-1", slugError && "border-red-500")} value={slug} onChange={e => handleSlugChange(e.target.value)} placeholder="sayfa-slug" />
              </div>
              {slugError && <p className="text-xs text-red-400 mt-1">{slugError}</p>}
            </div>
            <div>
              <label className="field-label">Meta Başlık (SEO)</label>
              <input className="field-input" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder={title} />
            </div>
            <div>
              <label className="field-label">Meta Açıklama (SEO)</label>
              <input className="field-input" value={metaDesc} onChange={e => setMetaDesc(e.target.value)} placeholder="Sayfa açıklaması..." />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setShowInNav(p => !p)} className={cn("w-9 h-5 rounded-full transition-all relative", showInNav ? "bg-primary" : "bg-[#333]")}>
                <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all", showInNav && "translate-x-4")} />
              </div>
              <span className="text-sm text-[#aaa]">Navigasyonda göster</span>
            </label>
            {showInNav && (
              <input className="field-input w-40" value={navLabel} onChange={e => setNavLabel(e.target.value)} placeholder={title} />
            )}
          </div>
        </div>
      )}

      <div className={cn("grid gap-6", showPreview ? "lg:grid-cols-2" : "")}>
        {/* Sol: Blok Listesi */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#888]">Bloklar ({blocks.length})</span>
            <button onClick={() => setShowAddBlock(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/30 text-primary rounded-lg text-xs font-semibold hover:bg-primary/25 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Blok Ekle
            </button>
          </div>

          {showAddBlock && (
            <div className="grid grid-cols-2 gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
              {BLOCK_TYPES.map(({ type, label, icon: Icon, desc }) => (
                <button key={type} onClick={() => addBlock(type)}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#252525] transition-colors text-left">
                  <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div><div className="text-xs font-semibold text-white">{label}</div><div className="text-[10px] text-[#555]">{desc}</div></div>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {blocks.map((b, i) => (
              <BlockEditor key={b.id} block={b}
                onChange={nb => updateBlock(i, nb)}
                onDelete={() => deleteBlock(i)}
                onMoveUp={() => moveBlock(i, -1)}
                onMoveDown={() => moveBlock(i, 1)}
                isFirst={i === 0} isLast={i === blocks.length - 1}
              />
            ))}
            {blocks.length === 0 && !showAddBlock && (
              <div className="py-10 border-2 border-dashed border-[#222] rounded-xl text-center text-[#555] text-sm cursor-pointer hover:border-[#333] transition-colors" onClick={() => setShowAddBlock(true)}>
                + Blok eklemek için tıklayın
              </div>
            )}
          </div>
        </div>

        {/* Sağ: Canlı Önizleme */}
        {showPreview && (
          <div className="space-y-2 hidden lg:block">
            <span className="text-sm font-bold text-[#888]">Canlı Önizleme</span>
            <PagePreview blocks={blocks} />
          </div>
        )}
      </div>
    </div>
  );
}
