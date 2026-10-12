import type { Metadata } from "next";
import { Check, CircleDollarSign } from "lucide-react";
import { updatePayoutStatusAction } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { UrlPagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Payouts | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
function value(row: Row, ...keys: string[]) { return keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && item !== ""); }
function statusClass(status: string) { return status === "paid" ? "bg-emerald-100 text-emerald-700" : status === "approved" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"; }

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const pagination = parsePagination(await searchParams);
  await supabase.rpc("refresh_payout_availability");
  let { data, error, count } = await supabase.from("payouts").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(pagination.from, pagination.to);
  let usingTransactions = false;
  if (error) {
    const fallback = await supabase.from("transactions").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(pagination.from, pagination.to);
    data = fallback.data;
    error = fallback.error;
    count = fallback.count;
    usingTransactions = true;
  }
  const meta = buildPaginationMeta(count ?? 0, pagination.page, pagination.pageSize);
  if ((count ?? 0) > 0 && meta.page !== pagination.page) {
    const corrected = usingTransactions
      ? await supabase.from("transactions").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(meta.from, meta.to)
      : await supabase.from("payouts").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(meta.from, meta.to);
    data = corrected.data;
    error = corrected.error;
    count = corrected.count;
  }
  const payouts = (data ?? []) as Row[];
  const loadError = error;
  const sourceOrderIds = payouts.map((payout) => String(payout.source_shop_order_id ?? "")).filter(Boolean);
  const { data: shopOrderRows, error: shopOrderError } = sourceOrderIds.length
    ? await supabase.from("shop_orders").select("id,sub_total,discount_amount,delivery_fee,delivery_discount,discount_funded_by,platform_discount_cost,gross_amount,seller_earnings").in("id", [...new Set(sourceOrderIds)])
    : { data: [], error: null };
  const shopOrderById = new Map(((shopOrderRows ?? []) as Row[]).map((shopOrder) => [String(shopOrder.id), shopOrder]));
  return <main className="mx-auto max-w-[1440px] p-5 sm:p-8 lg:p-10">
    <div className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Finance operations</p><h1 className="page-title mt-2">Seller payouts</h1><p className="mt-2 text-sm text-slate-500">Review vendor earnings and mark approved requests as paid. Delivery charges never enter seller earnings.</p></div>
    {shopOrderError && <p className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Could not load payout order breakdowns: {shopOrderError.message}</p>}
    <section data-pagination-list className="surface overflow-hidden">
      {loadError ? <p className="p-6 text-sm text-rose-600">Could not load payouts: {loadError.message}</p> : payouts.length === 0 ? <div className="p-12 text-center"><CircleDollarSign className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No payout requests found</p><p className="mt-1 text-sm text-slate-500">Payout requests will appear here once sellers become eligible.</p></div> : <div className="overflow-x-auto"><table className="data-table min-w-[1150px]"><thead><tr><th>Seller / shop</th><th>Requested</th><th>Items gross</th><th>Platform discount cost</th><th>Delivery (platform)</th><th>Refunds</th><th>Adjustment</th><th>Net payout</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody>{payouts.map((payout) => { const payoutStatus = String(payout.status ?? "pending").toLowerCase(); const amount = Number(value(payout, "amount", "total", "gross_amount") ?? 0); const refund = Number(value(payout, "refund_amount") ?? 0); const adjustment = Number(value(payout, "adjustment_amount") ?? 0); const net = Number(value(payout, "net_amount", "amount", "total") ?? 0); const sourceOrder = shopOrderById.get(String(payout.source_shop_order_id ?? "")); return <tr key={String(payout.id)}><td><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><CircleDollarSign className="size-4" /></span><div><p className="font-bold text-slate-900 dark:text-white">{String(value(payout, "shop_name", "shop_id", "vendor_id") ?? "Vendor payout")}</p><p className="mt-1 text-xs text-slate-500">{String(value(payout, "seller_email", "user_id", "owner_id") ?? "Unknown seller")}</p></div></div></td><td className="whitespace-nowrap">{payout.created_at ? new Date(String(payout.created_at)).toLocaleDateString() : "-"}</td><td className="whitespace-nowrap">{formatCurrency(Number(sourceOrder?.gross_amount ?? amount), String(payout.currency ?? "PKR"))}<p className="mt-1 text-[10px] text-slate-500">before commission</p></td><td className="whitespace-nowrap">{formatCurrency(Number(sourceOrder?.platform_discount_cost ?? 0), String(payout.currency ?? "PKR"))}</td><td className="whitespace-nowrap">{formatCurrency(Math.max(0, Number(sourceOrder?.delivery_fee ?? 0) - Number(sourceOrder?.delivery_discount ?? 0)), String(payout.currency ?? "PKR"))}</td><td className="whitespace-nowrap">{formatCurrency(refund, String(payout.currency ?? "PKR"))}</td><td className="whitespace-nowrap">{formatCurrency(adjustment, String(payout.currency ?? "PKR"))}</td><td className="whitespace-nowrap font-black text-slate-900 dark:text-white">{formatCurrency(Number(sourceOrder?.seller_earnings ?? net), String(payout.currency ?? "PKR"))}</td><td><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(payoutStatus)}`}>{payoutStatus}</span></td><td className="text-right">{["pending", "requested"].includes(payoutStatus) ? <form action={async () => { "use server"; await updatePayoutStatusAction(String(payout.id), "approved"); }}><button className="button-secondary text-blue-700"><Check className="size-4" /> Approve</button></form> : payoutStatus === "approved" ? <form action={async () => { "use server"; await updatePayoutStatusAction(String(payout.id), "paid"); }}><button className="button-primary bg-emerald-600 hover:bg-emerald-700"><Check className="size-4" /> Mark paid</button></form> : <span className="text-xs font-bold text-slate-400">Complete</span>}</td></tr>; })}</tbody></table></div>}
      <div className="px-5 pb-4"><UrlPagination total={count ?? 0} /></div>
    </section>
  </main>;
}
