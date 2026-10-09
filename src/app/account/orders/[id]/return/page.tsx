import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ReturnRequestForm } from "@/components/return-request-form";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Return items" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
const activeStatuses = [
  "requested", "approved", "escalated", "pickup_assigned", "picked_up",
  "returned_to_shop", "inspection_passed", "inspection_failed", "refund_pending", "received",
];

export default async function NewReturnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/orders");
  const { id } = await params;
  const supabase = await createClient();
  const { data: shopOrder, error: shopOrderError } = await supabase
    .from("shop_orders")
    .select("id,parent_order_id,shop_id,order_status,delivered_at,shops(name,return_window_days)")
    .eq("id", id)
    .maybeSingle();
  if (shopOrderError) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><div className="surface p-6 text-sm text-rose-600">{shopOrderError.message}</div></main>;
  }
  if (!shopOrder) notFound();
  const { data: parent, error: parentError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", String(shopOrder.parent_order_id))
    .eq("customer_id", user.id)
    .maybeSingle();
  if (parentError) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><div className="surface p-6 text-sm text-rose-600">{parentError.message}</div></main>;
  }
  if (!parent) notFound();

  const { data: existingReturns, error: returnError } = await supabase
    .from("return_requests")
    .select("id,status")
    .eq("shop_order_id", id)
    .eq("customer_id", user.id);
  if (returnError) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><div className="surface p-6 text-sm text-rose-600">{returnError.message}</div></main>;
  }
  const existing = (existingReturns ?? []).find((row) => activeStatuses.includes(String(row.status)));
  if (existing) redirect(`/account/returns/${String(existing.id)}`);

  const [{ data: rows, error: itemError }, { data: reservations, error: reservationError }] = await Promise.all([
    supabase.from("order_items")
      .select("id,quantity,returned_qty,price_at_checkout,product_variants(products(title,is_returnable))")
      .eq("shop_order_id", id),
    existingReturns?.length
      ? supabase.from("return_items")
        .select("order_item_id,quantity,return_requests(status)")
        .in("return_request_id", existingReturns.map((row) => String(row.id)))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemError || reservationError) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><div className="surface p-6 text-sm text-rose-600">{itemError?.message ?? reservationError?.message}</div></main>;
  }
  const reservedByItem = new Map<string, number>();
  for (const reservation of (reservations ?? []) as Row[]) {
    const nested = reservation.return_requests;
    const status = Array.isArray(nested) ? nested[0]?.status : nested?.status;
    if (activeStatuses.includes(String(status))) {
      const key = String(reservation.order_item_id);
      reservedByItem.set(key, (reservedByItem.get(key) ?? 0) + Number(reservation.quantity ?? 0));
    }
  }
  const itemInputs = ((rows ?? []) as Row[]).map((row) => {
    const product = row.product_variants?.products ?? {};
    return {
      id: String(row.id),
      title: String(product.title ?? "Product"),
      quantity: Number(row.quantity ?? 0),
      returnedQty: Number(row.returned_qty ?? 0),
      reservedQty: reservedByItem.get(String(row.id)) ?? 0,
      price: Number(row.price_at_checkout ?? 0),
      returnable: product.is_returnable !== false,
    };
  });
  const shopValue = shopOrder.shops ?? {};
  const shop = (Array.isArray(shopValue) ? shopValue[0] : shopValue) as Row;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href={`/account/orders/${String(parent.id)}`} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Order details</Link>
      <div className="mb-6 mt-5">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Return request</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Return items</h1>
        <p className="mt-2 text-sm text-slate-500">Order #{String(shopOrder.id).slice(0, 8)} · {String(shop.name ?? "Shop")}</p>
      </div>
      <ReturnRequestForm
        shopOrderId={String(shopOrder.id)}
        shopName={String(shop.name ?? "Shop")}
        deliveredAt={shopOrder.delivered_at ? String(shopOrder.delivered_at) : null}
        returnWindowDays={Number(shop.return_window_days ?? 7)}
        orderStatus={String(shopOrder.order_status ?? "")}
        items={itemInputs}
      />
    </main>
  );
}
