import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { ReturnsListTable, type ReturnsListRow } from "@/components/returns-list-table";
import { getSellerContext } from "@/lib/seller";
import { getCurrentTimeMs } from "@/lib/returns/time";
import { RETURN_REASONS } from "@/lib/returns/config";

export const metadata: Metadata = { title: "Returns | Seller" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;

export default async function SellerReturnsPage() {
  const { supabase, shop } = await getSellerContext();
  const { data, error } = await supabase
    .from("return_requests")
    .select("id,shop_order_id,customer_id,status,reason,reason_code,requested_at,seller_response_due_at,refund_amount,shop_orders!inner(id,shop_id,order_status),return_items(quantity,order_items(product_variants(products(title))))")
    .eq("shop_orders.shop_id", String(shop.id))
    .order("requested_at", { ascending: false });
  const returnRows = (data ?? []) as Row[];
  const customerIds = [...new Set(returnRows.map((request) => String(request.customer_id ?? "")).filter(Boolean))];
  const { data: customers } = customerIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", customerIds)
    : { data: [] };
  const customerById = new Map((customers ?? []).map((customer) => [String(customer.id), String(customer.full_name ?? "Customer")]));
  const rows: ReturnsListRow[] = returnRows.map((request) => {
    const items = ((request.return_items ?? []) as Row[]).map((item) => {
      const nestedOrderItem = item.order_items;
      const orderItem = Array.isArray(nestedOrderItem) ? nestedOrderItem[0] : nestedOrderItem;
      const variant = orderItem?.product_variants;
      const product = Array.isArray(variant) ? variant[0]?.products : variant?.products;
      return `${String(product?.title ?? "Item")} × ${Number(item.quantity ?? 0)}`;
    });
    const reasonCode = String(request.reason_code ?? "");
    return {
      id: String(request.id),
      orderId: String(request.shop_order_id),
      href: `/seller/returns/${String(request.id)}`,
      status: String(request.status),
      reason: RETURN_REASONS[reasonCode as keyof typeof RETURN_REASONS] ?? String(request.reason ?? "Return"),
      requestedAt: String(request.requested_at),
      dueAt: request.seller_response_due_at ? String(request.seller_response_due_at) : null,
      customer: (customerById.get(String(request.customer_id)) ?? "Customer").split(/\s+/)[0],
      items,
    };
  });
  const needsResponse = rows.filter((row) => row.status === "requested").length;
  const toInspect = rows.filter((row) => row.status === "returned_to_shop").length;

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link>
      <div className="mb-7 mt-5">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Customer care</p>
        <h1 className="mt-2 flex items-center gap-3 text-4xl font-black tracking-[-.055em]"><RotateCcw className="size-8 text-orange-500" /> Returns</h1>
        <p className="mt-2 text-sm text-slate-500">Respond within 48 hours, receive return pickups, and inspect returned items.</p>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Needs response" value={needsResponse} detail="Respond within 48 hours" />
        <Metric label="To inspect" value={toInspect} detail="Items received at your shop" />
        <Metric label="Open returns" value={rows.filter((row) => !["refunded", "rejected", "cancelled"].includes(row.status)).length} detail="Across all stages" />
      </div>
      {error ? <section className="surface p-6 text-sm text-rose-600">Could not load returns: {error.message}</section> : <ReturnsListTable role="seller" rows={rows} now={getCurrentTimeMs()} emptyMessage="No returns in this section." />}
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <section className="surface p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></section>;
}
