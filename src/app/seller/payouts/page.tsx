import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign, ChevronLeft } from "lucide-react";
import { getSellerContext } from "@/lib/seller";
import { formatCurrency } from "@/lib/utils";
import { requestPayoutAction } from "@/app/seller/payouts/actions";

export const metadata: Metadata = { title: "Payouts | Seller" };
export const dynamic = "force-dynamic";

export default async function SellerPayoutsPage() {
  const { supabase } = await getSellerContext();
  await supabase.rpc("refresh_payout_availability");
  const { data } = await supabase.from("payouts").select("*").order("created_at", { ascending: false });
  const payouts = (data ?? []) as Record<string, unknown>[];
  return <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8"><Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Finance</p><h1 className="page-title mt-2">Payouts</h1><p className="mt-2 text-sm text-slate-500">Track earnings and payout status for your shop.</p></div><section className="surface overflow-hidden">{payouts.length === 0 ? <div className="p-12 text-center"><BadgeDollarSign className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No payouts yet</p><p className="mt-1 text-sm text-slate-500">Completed earnings will appear here.</p></div> : <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Payout</th><th>Date</th><th>Amount</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody>{payouts.map((payout) => { const status = String(payout.status ?? "pending").toLowerCase(); return <tr key={String(payout.id)}><td><p className="font-bold text-slate-900 dark:text-white">Payout #{String(payout.id).slice(0, 8)}</p><p className="mt-1 text-xs text-slate-500">Net seller earnings</p></td><td className="whitespace-nowrap">{payout.created_at ? new Date(String(payout.created_at)).toLocaleDateString() : "-"}</td><td className="whitespace-nowrap font-black text-slate-900 dark:text-white">{formatCurrency(Number(payout.net_amount ?? payout.amount ?? 0))}</td><td><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${status === "paid" ? "bg-emerald-100 text-emerald-700" : status === "available" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>{status}</span></td><td className="text-right">{status === "available" ? <form action={requestPayoutAction}><input type="hidden" name="payoutId" value={String(payout.id)} /><button className="button-secondary text-orange-600">Request payout</button></form> : <span className="text-xs font-bold text-slate-400">No action</span>}</td></tr>; })}</tbody></table></div>}</section></main>;
}
