import type { Metadata } from "next";
import { Check, CircleDollarSign } from "lucide-react";
import { updatePayoutStatusAction } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Payouts | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
function value(row: Row, ...keys: string[]) { return keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && item !== ""); }
function statusClass(status: string) { return status === "paid" ? "bg-emerald-100 text-emerald-700" : status === "approved" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"; }

export default async function AdminPayoutsPage() {
  const supabase = await createClient();
  await supabase.rpc("refresh_payout_availability");
  let { data, error } = await supabase.from("payouts").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) {
    const fallback = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(200);
    data = fallback.data;
    error = fallback.error;
  }
  const payouts = (data ?? []) as Row[];
  const loadError = error;
  return <main className="mx-auto max-w-[1440px] p-5 sm:p-8 lg:p-10"><div className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Finance operations</p><h1 className="page-title mt-2">Seller payouts</h1><p className="mt-2 text-sm text-slate-500">Review vendor earnings and mark approved requests as paid.</p></div><section className="surface overflow-hidden">{loadError ? <p className="p-6 text-sm text-rose-600">Could not load payouts: {loadError.message}</p> : payouts.length === 0 ? <div className="p-12 text-center"><CircleDollarSign className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No payout requests found</p><p className="mt-1 text-sm text-slate-500">Payout requests will appear here once sellers become eligible.</p></div> : <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Seller / shop</th><th>Requested</th><th>Gross amount</th><th>Net payout</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody>{payouts.map((payout) => { const payoutStatus = String(payout.status ?? "pending").toLowerCase(); const amount = Number(value(payout, "amount", "total", "gross_amount") ?? 0); const net = Number(value(payout, "net_amount", "amount", "total") ?? 0); return <tr key={String(payout.id)}><td><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><CircleDollarSign className="size-4" /></span><div><p className="font-bold text-slate-900 dark:text-white">{String(value(payout, "shop_name", "shop_id", "vendor_id") ?? "Vendor payout")}</p><p className="mt-1 text-xs text-slate-500">{String(value(payout, "seller_email", "user_id", "owner_id") ?? "Unknown seller")}</p></div></div></td><td className="whitespace-nowrap">{payout.created_at ? new Date(String(payout.created_at)).toLocaleDateString() : "-"}</td><td className="whitespace-nowrap">{formatCurrency(amount, String(payout.currency ?? "USD"))}</td><td className="whitespace-nowrap font-black text-slate-900 dark:text-white">{formatCurrency(net, String(payout.currency ?? "USD"))}</td><td><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(payoutStatus)}`}>{payoutStatus}</span></td><td className="text-right">{payoutStatus === "pending" ? <form action={async () => { "use server"; await updatePayoutStatusAction(String(payout.id), "approved"); }}><button className="button-secondary text-blue-700"><Check className="size-4" /> Approve</button></form> : payoutStatus === "approved" ? <form action={async () => { "use server"; await updatePayoutStatusAction(String(payout.id), "paid"); }}><button className="button-primary bg-emerald-600 hover:bg-emerald-700"><Check className="size-4" /> Mark paid</button></form> : <span className="text-xs font-bold text-slate-400">Complete</span>}</td></tr>; })}</tbody></table></div>}</section></main>;
}
