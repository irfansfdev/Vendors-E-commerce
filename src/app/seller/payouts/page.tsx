import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign, ChevronLeft } from "lucide-react";
import { getSellerContext } from "@/lib/seller";
import { formatCurrency } from "@/lib/utils";
import { requestPayoutAction } from "@/app/seller/payouts/actions";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { UrlPagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Payouts | Seller" };
export const dynamic = "force-dynamic";

export default async function SellerPayoutsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await getSellerContext();
  const pagination = parsePagination(await searchParams);
  await supabase.rpc("refresh_payout_availability");
  let { data, count } = await supabase.from("payouts").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(pagination.from, pagination.to);
  const meta = buildPaginationMeta(count ?? 0, pagination.page, pagination.pageSize);
  if ((count ?? 0) > 0 && meta.page !== pagination.page) {
    ({ data, count } = await supabase.from("payouts").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(meta.from, meta.to));
  }
  const payouts = (data ?? []) as Record<string, unknown>[];
  const sourceOrderIds = payouts.map((payout) => String(payout.source_shop_order_id ?? "")).filter(Boolean);
  const { data: shopOrderRows, error: shopOrderError } = sourceOrderIds.length
    ? await supabase.from("shop_orders").select("id,sub_total,discount_amount,delivery_fee,delivery_discount,discount_funded_by,platform_discount_cost,gross_amount,seller_earnings").in("id", [...new Set(sourceOrderIds)])
    : { data: [], error: null };
  if (shopOrderError) return <main className="mx-auto max-w-[1220px] px-4 py-8"><p className="text-sm text-rose-600">Could not load payout breakdowns: {shopOrderError.message}</p></main>;
  const orderById = new Map((shopOrderRows ?? []).map((order) => [String(order.id), order as Record<string, unknown>]));
  return <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8"><Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Finance</p><h1 className="page-title mt-2">Payouts</h1><p className="mt-2 text-sm text-slate-500">Track earnings and payout status for your shop. Delivery fees are collected by BabulShop and never enter your earnings.</p></div><section data-pagination-list className="surface overflow-hidden">{payouts.length === 0 ? <div className="p-12 text-center"><BadgeDollarSign className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No payouts yet</p><p className="mt-1 text-sm text-slate-500">Completed earnings will appear here.</p></div> : <div className="overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>Payout</th><th>Date</th><th>Earnings breakdown</th><th>Amount</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody>{payouts.map((payout) => { const status = String(payout.status ?? "pending").toLowerCase(); const sourceOrder = orderById.get(String(payout.source_shop_order_id ?? "")); return <tr key={String(payout.id)}><td><p className="font-bold text-slate-900 dark:text-white">Payout #{String(payout.id).slice(0, 8)}</p><p className="mt-1 text-xs text-slate-500">Net seller earnings</p></td><td className="whitespace-nowrap">{payout.created_at ? new Date(String(payout.created_at)).toLocaleDateString() : "-"}</td><td><p className="text-xs text-slate-600 dark:text-slate-300">Item gross {formatCurrency(Number(sourceOrder?.gross_amount ?? payout.gross_amount ?? 0))} · your earnings {formatCurrency(Number(sourceOrder?.seller_earnings ?? payout.net_amount ?? 0))}</p>{sourceOrder && <p className="mt-1 text-[11px] text-slate-500">Delivery {formatCurrency(Number(sourceOrder.delivery_fee ?? 0))} (platform) · platform coupon cost {formatCurrency(Number(sourceOrder.platform_discount_cost ?? 0))} (no seller deduction)</p>}</td><td className="whitespace-nowrap font-black text-slate-900 dark:text-white">{formatCurrency(Number(payout.net_amount ?? payout.amount ?? 0))}</td><td><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${status === "paid" ? "bg-emerald-100 text-emerald-700" : status === "available" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>{status}</span></td><td className="text-right">{status === "available" ? <form action={requestPayoutAction}><input type="hidden" name="payoutId" value={String(payout.id)} /><button className="button-secondary text-orange-600">Request payout</button></form> : <span className="text-xs font-bold text-slate-400">No action</span>}</td></tr>; })}</tbody></table></div>}<div className="px-5 pb-4"><UrlPagination total={count ?? 0} /></div></section></main>;
}
