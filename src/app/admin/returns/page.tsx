import type { Metadata } from "next";
import { AlertTriangle, Check, CircleDollarSign, RotateCcw, type LucideIcon } from "lucide-react";
import { ReturnsListTable, type ReturnsListRow } from "@/components/returns-list-table";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTimeMs } from "@/lib/returns/time";
import { formatCurrency } from "@/lib/utils";
import { RETURN_REASONS } from "@/lib/returns/config";

export const metadata: Metadata = { title: "Returns | BabulShop Admin" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
function text(row: Row, ...keys: string[]) { return String(keys.map((key) => row[key]).find((value) => value !== null && value !== undefined && value !== "") ?? ""); }

export default async function AdminReturnsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("return_requests")
    .select("id,shop_order_id,customer_id,status,reason,reason_code,requested_at,seller_response_due_at,refund_amount,refunded_at,shop_orders!inner(id,shop_id),return_items(quantity,order_items(product_variants(products(title))))")
    .order("requested_at", { ascending: false })
    .limit(2000);
  const rawReturns = (data ?? []) as Row[];
  const customerIds = [...new Set(rawReturns.map((row) => text(row, "customer_id")).filter(Boolean))];
  const shopIds = [...new Set(rawReturns.map((row) => text(row.shop_orders as Row, "shop_id")).filter(Boolean))];
  const [{ data: profiles, error: profilesError }, { data: shops, error: shopsError }] = await Promise.all([
    customerIds.length ? supabase.from("profiles").select("id,full_name").in("id", customerIds) : Promise.resolve({ data: [], error: null }),
    shopIds.length ? supabase.from("shops").select("id,name").in("id", shopIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const profileById = new Map((profiles ?? []).map((row) => [String(row.id), row as Row]));
  const shopById = new Map((shops ?? []).map((row) => [String(row.id), row as Row]));
  const now = getCurrentTimeMs();
  const rows: ReturnsListRow[] = rawReturns.map((request) => {
    const shopId = text(request.shop_orders as Row, "shop_id");
    const profile = profileById.get(text(request, "customer_id")) ?? {};
    const customerName = text(profile, "full_name") || "Customer";
    const items = ((request.return_items ?? []) as Row[]).map((item) => {
      const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
      const variant = orderItem?.product_variants;
      const product = Array.isArray(variant) ? variant[0]?.products : variant?.products;
      return `${String(product?.title ?? "Item")} × ${Number(item.quantity ?? 0)}`;
    });
    const reasonCode = text(request, "reason_code");
    const requestAge = Math.max(0, Math.floor((now - new Date(text(request, "requested_at")).getTime()) / 86_400_000));
    const overdue = request.status === "requested" && !!request.seller_response_due_at
      && new Date(String(request.seller_response_due_at)).getTime() <= now;
    const flags = [
      overdue ? "Overdue" : "",
      ["escalated", "inspection_failed"].includes(String(request.status)) ? "Needs review" : "",
      request.status === "refund_pending" ? "Refund due" : "",
    ].filter(Boolean);
    return {
      id: text(request, "id"),
      orderId: text(request, "shop_order_id"),
      href: `/admin/returns/${text(request, "id")}`,
      items,
      customer: customerName,
      shop: text(shopById.get(shopId) ?? {}, "name") || "Shop",
      status: text(request, "status"),
      reason: RETURN_REASONS[reasonCode as keyof typeof RETURN_REASONS] ?? (text(request, "reason") || "Return"),
      requestedAt: text(request, "requested_at"),
      dueAt: text(request, "seller_response_due_at") || null,
      refundedAt: text(request, "refunded_at") || null,
      amount: Number(request.refund_amount ?? 0),
      age: `${requestAge}d`,
      flags,
    };
  });
  const needsAttention = rows.filter((row) => row.status === "escalated" || row.status === "inspection_failed"
    || (row.status === "requested" && !!row.dueAt && new Date(row.dueAt).getTime() <= now)).length;
  const refundQueue = rows.filter((row) => row.status === "refund_pending");
  const refundedThisMonth = rows.filter((row) => row.status === "refunded" && row.refundedAt
    && new Date(row.refundedAt).getMonth() === new Date(now).getMonth()
    && new Date(row.refundedAt).getFullYear() === new Date(now).getFullYear()
    && new Date(row.refundedAt).getTime() <= now)
    .reduce((sum, row) => sum + (row.amount ?? 0), 0);

  return <main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-10">
    <header className="mb-7"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Finance and customer care</p><h1 className="page-title mt-2">Returns &amp; refunds</h1><p className="mt-2 text-sm text-slate-500">Review escalations, track return pickups, and reconcile refunds.</p></header>
    {error ? <section className="surface p-5 text-sm text-rose-600">Could not load returns: {error.message}</section> : <>
      {(profilesError || shopsError) && <p className="surface mb-4 p-4 text-sm text-amber-700 dark:text-amber-300">Some customer or shop names could not be loaded: {[profilesError?.message, shopsError?.message].filter(Boolean).join(" · ")}</p>}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={RotateCcw} label="Open returns" value={rows.filter((row) => !["refunded", "rejected", "cancelled"].includes(row.status)).length} detail="All active stages" />
        <Metric icon={AlertTriangle} label="Needs attention" value={needsAttention} detail="Overdue, escalated, or failed inspection" />
        <Metric icon={CircleDollarSign} label="Refunds pending" value={formatCurrency(refundQueue.reduce((sum, row) => sum + (row.amount ?? 0), 0))} detail={`${refundQueue.length} refunds to process`} />
        <Metric icon={Check} label="Refunded this month" value={formatCurrency(refundedThisMonth)} detail="Completed customer refunds" />
      </section>
      <ReturnsListTable role="admin" rows={rows} now={now} emptyMessage="No returns in this section." />
    </>}
  </main>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string | number; detail: string }) {
  return <section className="surface p-4 sm:p-5"><span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Icon className="size-5" /></span><p className="mt-4 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></section>;
}
