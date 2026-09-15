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
   return <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8"><Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Finance</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Payouts</h1><p className="mt-2 text-sm text-slate-500">Track earnings and payout status for your shop.</p></div><section className="surface overflow-hidden">{payouts.length === 0 ? <div className="p-12 text-center"><BadgeDollarSign className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No payouts yet</p><p className="mt-1 text-sm text-slate-500">Completed earnings will appear here.</p></div> : <div className="divide-y divide-slate-100 dark:divide-white/10">{payouts.map((payout) => <div key={String(payout.id)} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h3 className="font-extrabold">Payout #{String(payout.id).slice(0, 8)}</h3><p className="mt-1 text-xs capitalize text-slate-500">{String(payout.status ?? "pending")}</p></div><div className="flex items-center gap-4"><p className="font-black">{formatCurrency(Number(payout.net_amount ?? payout.amount ?? 0))}</p>{String(payout.status).toLowerCase() === "available" && <form action={requestPayoutAction}><input type="hidden" name="payoutId" value={String(payout.id)} /><button className="button-secondary text-orange-600">Request payout</button></form>}</div></div>)}</div>}</section></main>;
}
