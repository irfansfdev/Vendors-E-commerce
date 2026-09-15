import type { Metadata } from "next";
import { Check, CircleDollarSign } from "lucide-react";
import { updatePayoutStatusAction } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Payouts | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
function value(row: Row, ...keys: string[]) { return keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && item !== ""); }

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
  return <div className="p-8"><div className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Finance operations</p><h1 className="mt-2 text-3xl font-black">Seller payouts</h1><p className="mt-1 text-slate-500">Review vendor earnings and mark approved requests as paid.</p></div><section className="overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">{error ? <p className="p-6 text-sm text-rose-600">Could not load payouts: {error.message}</p> : payouts.length === 0 ? <p className="p-12 text-center text-slate-500">No payout requests found.</p> : <div className="divide-y dark:divide-slate-800">{payouts.map((payout) => { const status = String(payout.status ?? "pending").toLowerCase(); return <div key={String(payout.id)} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><CircleDollarSign className="size-5" /></span><div><h2 className="font-bold">{String(value(payout, "shop_name", "shop_id", "vendor_id") ?? "Vendor payout")}</h2><p className="text-sm text-slate-500">{String(value(payout, "seller_email", "user_id", "owner_id") ?? "Unknown seller")} · {String(payout.created_at ?? "-")}</p></div></div><div className="flex items-center gap-4"><span className="font-black">{formatCurrency(Number(value(payout, "net_amount", "amount", "total") ?? 0), String(payout.currency ?? "USD"))}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${status === "paid" ? "bg-emerald-100 text-emerald-700" : status === "approved" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>{status}</span>{status === "pending" && <form action={async () => { "use server"; await updatePayoutStatusAction(String(payout.id), "approved"); }}><button className="button-secondary text-blue-700"><Check className="size-4" /> Approve</button></form>}{status === "approved" && <form action={async () => { "use server"; await updatePayoutStatusAction(String(payout.id), "paid"); }}><button className="button-primary bg-orange-500 hover:bg-orange-600"><Check className="size-4" /> Mark paid</button></form>}</div></div>; })}</div>}</section></div>;
}
