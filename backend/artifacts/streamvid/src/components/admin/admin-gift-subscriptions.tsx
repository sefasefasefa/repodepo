import { useState } from "react";
import { Gift, Search, Send, Check, Users, TrendingUp, DollarSign, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const PLANS = [
  { id: 1, label: "Basic",   price: 4.99,  color: "text-blue-400" },
  { id: 2, label: "Premium", price: 9.99,  color: "text-purple-400" },
  { id: 3, label: "VIP",     price: 19.99, color: "text-amber-400" },
];

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
});

export default function AdminGiftSubscriptions() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState("");
  const [tab, setTab]         = useState<"list" | "send">("list");
  const [form, setForm]       = useState({ recipient: "", planId: PLANS[1].id, duration: 1, note: "" });
  const [sent, setSent]       = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-gift-subs", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const r = await fetch(`/api/admin/gift-subscriptions?${params}`, { headers: getHeaders() });
      if (!r.ok) throw new Error("Veriler alınamadı");
      return r.json();
    },
  });

  const gifts: any[]  = data?.gifts  ?? [];
  const apiStats      = data?.stats  ?? { total: 0, active: 0, revenue: 0 };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/gift-subscriptions", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          recipient: form.recipient,
          planId: form.planId,
          duration: form.duration,
          note: form.note,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Gönderme başarısız");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gift-subs"] });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setTab("list");
        setForm({ recipient: "", planId: PLANS[1].id, duration: 1, note: "" });
      }, 1800);
    },
  });

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
          { label: "Toplam Hediye",   value: apiStats.total,                    icon: Gift,        color: "text-pink-400" },
          { label: "Aktif Abonelik",  value: apiStats.active,                   icon: Users,       color: "text-green-400" },
          { label: "Toplam Gelir",    value: `$${Number(apiStats.revenue).toFixed(2)}`, icon: DollarSign, color: "text-primary" },
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
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
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
                  {gifts.map(g => (
                    <tr key={g.id} className="hover:bg-[#1e1e1e] transition-colors">
                      <td className="px-4 py-3 text-[#ccc] font-mono text-xs">@{g.senderUsername}</td>
                      <td className="px-4 py-3 text-[#ccc] font-mono text-xs">@{g.recipientUsername}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-purple-400">{g.plan}</td>
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
              {gifts.length === 0 && (
                <div className="text-center py-10 text-[#555] text-sm">Henüz hediye abonelik yok.</div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "send" && (
        <div className="max-w-md space-y-4">
          {sendMutation.isError && (
            <div className="bg-red-900/20 border border-red-800/30 text-red-400 text-xs px-4 py-3 rounded-xl">
              {(sendMutation.error as any)?.message ?? "Bir hata oluştu"}
            </div>
          )}
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
                <button key={p.id} onClick={() => setForm(f => ({ ...f, planId: p.id }))}
                  className={cn("py-3 rounded-xl border text-sm font-semibold transition-all",
                    form.planId === p.id ? "border-primary/40 bg-primary/10 text-white" : "border-[#222] bg-[#111] text-[#666] hover:border-[#333]")}>
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
          <button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !form.recipient.trim() || sent}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-sm disabled:opacity-50 transition-all">
            {sent ? <><Check className="h-4 w-4" /> Gönderildi!</> :
             sendMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</> :
             <><Gift className="h-4 w-4" /> Hediye Gönder</>}
          </button>
        </div>
      )}
    </div>
  );
}
