import { useState } from "react";
import { Mail, Plus, Send, FileText, Trash2, Eye, Users, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const TEMPLATES = [
  {
    id: "welcome",
    name: "Hoş Geldiniz",
    subject: "{{site_name}} platformuna hoş geldiniz!",
    body: `Merhaba {{username}},\n\n{{site_name}} ailesine katıldığın için teşekkür ederiz! 🎉\n\nSeninle birlikte harika içerikler keşfetmek için sabırsızlanıyoruz.\n\nHemen başlamak için: {{site_url}}\n\nSevgilerle,\n{{site_name}} Ekibi`,
  },
  {
    id: "promo",
    name: "Promosyon / İndirim",
    subject: "🔥 Özel fırsat: %{{discount}} indirim seni bekliyor!",
    body: `Merhaba {{username}},\n\nSınırlı süreliğine tüm premium planlarda %{{discount}} indirim!\n\nKupon kodu: {{coupon_code}}\nGeçerlilik: {{expiry_date}}\n\nŞimdi yararlan: {{site_url}}/pricing\n\n{{site_name}} Ekibi`,
  },
  {
    id: "new_content",
    name: "Yeni İçerik Bildirimi",
    subject: "Takip ettiğin creator yeni video yükledi!",
    body: `Merhaba {{username}},\n\nTakip ettiğin {{creator_name}} yeni bir video yükledi:\n\n"{{video_title}}"\n\nİzlemek için: {{video_url}}\n\n{{site_name}}`,
  },
  {
    id: "reactivation",
    name: "Geri Dönme Daveti",
    subject: "Seni özledik {{username}} 💜",
    body: `Merhaba {{username}},\n\n{{last_visit}} tarihinden bu yana sizi göremedik.\n\nGeri döndüğünüzde sizi bekleyen harika içerikler var!\n\nPlatforma dön: {{site_url}}\n\n{{site_name}} Ekibi`,
  },
  {
    id: "announcement",
    name: "Duyuru",
    subject: "📢 {{site_name}} önemli duyuru",
    body: `Merhaba {{username}},\n\n{{announcement_text}}\n\nDaha fazla bilgi için: {{site_url}}\n\n{{site_name}} Ekibi`,
  },
];

const AUDIENCE_OPTIONS = [
  { id: "all",      label: "Tüm Kullanıcılar" },
  { id: "premium",  label: "Premium Üyeler" },
  { id: "free",     label: "Ücretsiz Kullanıcılar" },
  { id: "inactive", label: "Pasif Kullanıcılar (30+ gün)" },
  { id: "creators", label: "Yükleyiciler / Creatorlar" },
  { id: "new",      label: "Son 7 Günde Katılanlar" },
];

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
});

export default function AdminEmailCampaigns() {
  const qc = useQueryClient();
  const [tab, setTab]                   = useState<"list" | "create" | "templates">("list");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [previewOpen, setPreviewOpen]   = useState<number | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [form, setForm]                 = useState({
    name: "",
    subject: TEMPLATES[0].subject,
    body: TEMPLATES[0].body,
    audience: "all",
    scheduledAt: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-email-campaigns"],
    queryFn: async () => {
      const r = await fetch("/api/admin/email-campaigns", { headers: getHeaders() });
      if (!r.ok) throw new Error("Kampanyalar alınamadı");
      return r.json();
    },
  });

  const campaigns: any[] = data?.campaigns ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          name: form.name,
          template: selectedTemplate.id,
          subject: form.subject,
          body: form.body,
          audience: form.audience,
          scheduledAt: form.scheduledAt || null,
        }),
      });
      if (!r.ok) throw new Error("Oluşturma başarısız");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-email-campaigns"] });
      setSaved(true);
      setTab("list");
      setTimeout(() => setSaved(false), 2000);
      setForm({ name: "", subject: selectedTemplate.subject, body: selectedTemplate.body, audience: "all", scheduledAt: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/email-campaigns/${id}`, { method: "DELETE", headers: getHeaders() });
      if (!r.ok) throw new Error("Silme başarısız");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-email-campaigns"] }),
  });

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setSelectedTemplate(t);
    setForm(f => ({ ...f, subject: t.subject, body: t.body }));
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> E-posta Kampanyaları</h2>
          <p className="text-[#666] text-sm mt-1">Duyuru, promosyon ve bildirim e-postaları oluştur ve gönder.</p>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] bg-yellow-900/20 border border-yellow-800/30 text-yellow-400 px-2.5 py-1 rounded-full font-medium">Pasif — SMTP bağlantısı gerekli</span>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-[#161616] border border-[#222] rounded-xl w-fit">
        {[
          { id: "list",      label: "Kampanyalar" },
          { id: "create",    label: "Yeni Kampanya" },
          { id: "templates", label: "Şablonlar" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn("px-4 py-1.5 rounded-lg text-sm transition-all font-medium", tab === t.id ? "bg-primary text-white" : "text-[#777] hover:text-white")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-[#555] text-sm">Henüz kampanya yok.</div>
          ) : (
            campaigns.map(c => (
              <div key={c.id} className="bg-[#1a1a1a] border border-[#222] rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                        c.status === "sent"      ? "bg-green-900/20 text-green-400" :
                        c.status === "scheduled" ? "bg-blue-900/20 text-blue-400" :
                        "bg-[#222] text-[#666]")}>
                        {c.status === "sent" ? "Gönderildi" : c.status === "scheduled" ? "Planlandı" : "Taslak"}
                      </span>
                      <span className="text-[10px] text-[#555]">{AUDIENCE_OPTIONS.find(a => a.id === c.audience)?.label}</span>
                    </div>
                    {c.status === "sent" && (
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-[11px] text-[#666]">Açılma: <span className="text-[#aaa] font-medium">{c.opens.toLocaleString()}</span></span>
                        <span className="text-[11px] text-[#666]">Tıklama: <span className="text-[#aaa] font-medium">{c.clicks.toLocaleString()}</span></span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setPreviewOpen(previewOpen === c.id ? null : c.id)}
                      className="p-2 rounded-lg text-[#555] hover:text-white hover:bg-[#222] transition-all">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(c.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/10 transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {previewOpen === c.id && (
                  <div className="border-t border-[#222] bg-[#111] p-4">
                    <p className="text-xs text-[#555] mb-1">Konu: <span className="text-[#888]">{c.subject}</span></p>
                    <p className="text-xs text-[#555] mb-1">Şablon: <span className="text-[#888]">{TEMPLATES.find(t => t.id === c.template)?.name ?? c.template}</span></p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "create" && (
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">Kampanya Adı</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Mayıs Promosyonu..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">Şablon Seç</label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)}
                  className={cn("text-left px-3 py-2.5 rounded-xl border text-sm transition-all",
                    selectedTemplate.id === t.id ? "border-primary/40 bg-primary/10 text-white" : "border-[#222] bg-[#111] text-[#777] hover:border-[#333]")}>
                  <FileText className="h-3.5 w-3.5 mb-1" />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">Konu</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">İçerik</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={10}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40 font-mono resize-none" />
            <p className="text-[11px] text-[#555] mt-1">Değişkenler: {`{{username}}`}, {`{{site_name}}`}, {`{{site_url}}`}</p>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">Hedef Kitle</label>
            <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40">
              {AUDIENCE_OPTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">Planlama (isteğe bağlı)</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all">
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Kaydediliyor...</> :
               saved ? <><Check className="h-4 w-4" /> Kaydedildi</> :
               <><Send className="h-4 w-4" /> Kampanya Oluştur</>}
            </button>
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-3">
          {TEMPLATES.map(t => (
            <div key={t.id} className="bg-[#1a1a1a] border border-[#222] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-[11px] text-[#555] mt-0.5">{t.subject}</p>
                </div>
                <button onClick={() => { applyTemplate(t); setTab("create"); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-all">
                  <Plus className="h-3.5 w-3.5" /> Kullan
                </button>
              </div>
              <div className="border-t border-[#1e1e1e] bg-[#111] px-4 py-3">
                <pre className="text-[11px] text-[#666] whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">{t.body}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
