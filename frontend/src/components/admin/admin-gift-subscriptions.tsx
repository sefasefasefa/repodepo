import { useState } from "react";
import { Gift, Search, Send, Check, Users, TrendingUp, DollarSign, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_GIFTS = [
  { id: 1, senderUsername: "ali_44", recipientUsername: "zeynep_k", plan: "Premium", duration: 1, sentAt: "2026-05-01", status: "active" },
  { id: 2, senderUsername: "mert_92", recipientUsername: "ayse_m", plan: "Basic", duration: 3, sentAt: "2026-04-20", status: "active" },
  { id: 3, senderUsername: "selin_d", recipientUsername: "hasan_y", plan: "Premium", duration: 12, sentAt: "2026-04-15", status: "expired" },
];

const PLANS = [
  { id: "basic", label: "Basic", price: 4.99, color: "text-blue-400" },
  { id: "premium", label: "Premium", price: 9.99, color: "text-purple-400" },
  { id: "vip", label: "VIP", price: 19.99, color: "text-amber-400" },
];

export default function AdminGiftSubscriptions() {
  const [gifts] = useState(MOCK_GIFTS);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"list" | "send">("list");
  const [form, setForm] = useState({ recipient: "", plan: "premium", duration: 1, note: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const filtered = gifts.filter(g =>
    g.senderUsername.includes(search) ||
    g.recipientUsername.includes(search)
  );

  const sendGift = async () => {
    if (!form.recipient.trim()) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    setSent(true);
    setTimeout(() => { setSent(false); setTab("list"); setForm({ recipient: "", plan: "premium", duration: 1, note: "" }); }, 1800);
  };

  const totalActive = gifts.filter(g => g.status === "active").length;
  const totalRevenue = gifts.reduce((acc, g) => {
    const plan = PLANS.find(p => p.label.toLowerCase() === g.plan.toLowerCase());
    return acc + (plan?.price ?? 0) * g.duration;
  }, 0);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Gift className="h-5 w-5 text-pink-400" /> Hediye Abonelik</h2>
          <p className="text-[#666] text-sm mt-1">Kullanıcıların birbirine üyelik hediye etmesini yönet.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Toplam Hediye", value: gifts.length, icon: Gift, color: "text-pink-400" },
          { label: "Aktif Abonelik", value: totalActive, icon: Users, color: "text-green-400" },
          { label: "Toplam Gelir", value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1a1a] border border-[#222] rounded-xl p-4 flex items-center gap-3">
            <s.icon className={cn("h-5 w-5", s.color)} />
            <div>
              <p className="text-[11px] text-[#666]">{s.label}</p>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 p-1 bg-[#161616] border border-[#222] rounded-xl w-fit">
        {[{ id: "list", label: "Geçmiş" }, { id: "send", label: "Hediye Gönder" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn("px-4 py-1.5 rounded-lg text-sm transition-all font-medium", tab === t.id ? "bg-primary text-white" : "text-[#777] hover:text-white")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kullanıcı ara..."
              className="w-full pl-9 bg-[#1a1a1a] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
          </div>
          <div className="bg-[#1a1a1a] border border-[#222] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222]">
                  {["Gönderen", "Alan", "Plan", "Süre", "Tarih", "Durum"].map(h => (
                    <th key={h} className="text-left text-[11px] text-[#555] font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {filtered.map(g => (
                  <tr key={g.id} className="hover:bg-[#1e1e1e] transition-colors">
                    <td className="px-4 py-3 text-[#ccc] font-mono text-xs">@{g.senderUsername}</td>
                    <td className="px-4 py-3 text-[#ccc] font-mono text-xs">@{g.recipientUsername}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-semibold", PLANS.find(p => p.label.toLowerCase() === g.plan.toLowerCase())?.color ?? "text-[#aaa]")}>
                        {g.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#aaa]">{g.duration} ay</td>
                    <td className="px-4 py-3 text-xs text-[#666] flex items-center gap-1"><Clock className="h-3 w-3" />{g.sentAt}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                        g.status === "active" ? "bg-green-900/20 text-green-400" : "bg-[#222] text-[#555]")}>
                        {g.status === "active" ? "Aktif" : "Sona Erdi"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-10 text-[#555] text-sm">Sonuç bulunamadı.</div>
            )}
          </div>
        </div>
      )}

      {tab === "send" && (
        <div className="max-w-md space-y-4">
          <div className="bg-[#111] border border-pink-500/20 rounded-xl px-4 py-3 text-xs text-pink-300/70">
            Admin olarak herhangi bir kullanıcıya ücretsiz hediye abonelik tanımlayabilirsin.
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">Alıcı Kullanıcı Adı</label>
            <input value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))}
              placeholder="@kullanici_adi"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {PLANS.map(p => (
                <button key={p.id} onClick={() => setForm(f => ({ ...f, plan: p.id }))}
                  className={cn("py-3 rounded-xl border text-sm font-semibold transition-all",
                    form.plan === p.id ? "border-primary/40 bg-primary/10 text-white" : "border-[#222] bg-[#111] text-[#666] hover:border-[#333]")}>
                  <span className={p.color}>{p.label}</span>
                  <p className="text-[11px] text-[#555] font-normal mt-0.5">${p.price}/ay</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">Süre (ay)</label>
            <div className="flex gap-2">
              {[1, 3, 6, 12].map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, duration: n }))}
                  className={cn("flex-1 py-2 rounded-xl border text-sm font-semibold transition-all",
                    form.duration === n ? "border-primary/40 bg-primary/10 text-primary" : "border-[#222] bg-[#111] text-[#666] hover:border-[#333]")}>
                  {n} ay
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block font-medium uppercase tracking-wide">Not (isteğe bağlı)</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Tebrikler! Sana hediye..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
          </div>
          <button onClick={sendGift} disabled={sending || !form.recipient.trim() || sent}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-sm disabled:opacity-50 transition-all">
            {sent ? <><Check className="h-4 w-4" /> Gönderildi!</> : sending ? "Gönderiliyor..." : <><Gift className="h-4 w-4" /> Hediye Gönder</>}
          </button>
        </div>
      )}
    </div>
  );
}
