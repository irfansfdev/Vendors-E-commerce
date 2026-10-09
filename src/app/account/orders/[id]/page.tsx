import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, CircleCheck, Package, RotateCcw, Truck } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getOrderStatus } from "@/lib/order-status";
import { formatReturnDate, getReturnDeadline, isReturnWindowOpen } from "@/lib/returns/eligibility";

export const metadata: Metadata = { title: "Track order" };
export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;
type Row = Record<string, any>;
const steps = ["pending", "processing", "shipped", "delivered"];
const activeReturnStatuses = [
  "requested", "approved", "escalated", "pickup_assigned", "picked_up",
  "returned_to_shop", "inspection_passed", "inspection_failed", "refund_pending", "received",
];

export default async function CustomerOrderPage({ params }: { params: Params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/orders");
  const { id } = await params;
  const supabase = await createClient();

  let { data: parent, error: parentError } = await supabase
    .from("orders")
    .select("*, shop_orders(*, shops(name,return_window_days))")
    .eq("customer_id", user.id)
    .eq("id", id)
    .maybeSingle();
  let selectedShopOrderId: string | null = null;
  if (!parent && !parentError) {
    const { data: child, error: childError } = await supabase
      .from("shop_orders")
      .select("id,parent_order_id")
      .eq("id", id)
      .maybeSingle();
    if (childError) parentError = childError;
    if (child) {
      selectedShopOrderId = String(child.id);
      const result = await supabase.from("orders")
        .select("*, shop_orders(*, shops(name,return_window_days))")
        .eq("customer_id", user.id)
        .eq("id", String(child.parent_order_id))
        .maybeSingle();
      parent = result.data;
      parentError = result.error;
    }
  }
  if (parentError) {
    return <main className="mx-auto max-w-[900px] px-4 py-10"><Link href="/account/orders" className="text-sm font-bold text-orange-500">Back to orders</Link><div className="surface mt-6 p-8 text-sm text-rose-600">{parentError.message}</div></main>;
  }
  if (!parent) return <main className="mx-auto max-w-[900px] px-4 py-10"><Link href="/account/orders" className="text-sm font-bold text-orange-500">Back to orders</Link><div className="surface mt-6 p-8 text-sm text-rose-600">Order not found.</div></main>;

  const allShopOrders = (parent.shop_orders ?? []) as Row[];
  const shopOrders = selectedShopOrderId
    ? allShopOrders.filter((row) => String(row.id) === selectedShopOrderId)
    : allShopOrders;
  const shopOrderIds = shopOrders.map((row) => String(row.id));
  const [{ data: items, error: itemsError }, { data: returnRows, error: returnError }] = shopOrderIds.length
    ? await Promise.all([
      supabase.from("order_items")
        .select("id,shop_order_id,quantity,returned_qty,price_at_checkout,product_variants(products(title,is_returnable))")
        .in("shop_order_id", shopOrderIds),
      supabase.from("return_requests")
        .select("id,shop_order_id,status")
        .in("shop_order_id", shopOrderIds)
        .eq("customer_id", user.id),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const { data: returnItemRows, error: returnItemError } = returnRows?.length
    ? await supabase.from("return_items")
      .select("order_item_id,quantity,return_requests(status)")
      .in("return_request_id", returnRows.map((row) => String(row.id)))
    : { data: [], error: null };

  if (itemsError || returnError || returnItemError) {
    const failure = itemsError ?? returnError ?? returnItemError;
    return <main className="mx-auto max-w-[900px] px-4 py-10"><Link href="/account/orders" className="text-sm font-bold text-orange-500">Back to orders</Link><div className="surface mt-6 p-8 text-sm text-rose-600">{failure?.message}</div></main>;
  }

  const itemRows = (items ?? []) as Row[];
  const activeReturns = (returnRows ?? []).filter((row) => activeReturnStatuses.includes(String(row.status)));
  const activeReturnByShop = new Map(activeReturns.map((row) => [String(row.shop_order_id), row]));
  const reservedByItem = new Map<string, number>();
  for (const row of (returnItemRows ?? []) as Row[]) {
    const statuses = row.return_requests;
    const status = Array.isArray(statuses) ? statuses[0]?.status : statuses?.status;
    if (activeReturnStatuses.includes(String(status))) {
      const key = String(row.order_item_id);
      reservedByItem.set(key, (reservedByItem.get(key) ?? 0) + Number(row.quantity ?? 0));
    }
  }

  const status = getOrderStatus(parent as Row);
  const activeStep = steps.indexOf(status);
  const orderItemsByShop = new Map<string, Row[]>();
  for (const item of itemRows) {
    const key = String(item.shop_order_id);
    orderItemsByShop.set(key, [...(orderItemsByShop.get(key) ?? []), item]);
  }

  return (
    <main className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> My orders</Link>
      <div className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Order tracking</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Order #{String(parent.id).slice(0, 8)}</h1>
          <p className="mt-2 text-sm text-slate-500">{parent.created_at ? new Date(String(parent.created_at)).toLocaleString() : ""}</p>
        </div>
        <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black uppercase text-orange-700">{status}</span>
      </div>
      {!selectedShopOrderId && (
        <section className="surface p-6 sm:p-8">
          <div className="flex items-center gap-3"><Truck className="size-5 text-orange-500" /><div><h2 className="font-black">Delivery progress</h2><p className="mt-1 text-xs text-slate-500">Your shop updates will appear here.</p></div></div>
          <div className="mt-8 grid gap-4 sm:grid-cols-4">{steps.map((step, index) => <div key={step} className={`rounded-xl border p-4 ${index <= activeStep ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300" : "border-slate-200 text-slate-400 dark:border-white/10"}`}><CircleCheck className={`size-5 ${index <= activeStep ? "" : "opacity-30"}`} /><p className="mt-3 text-xs font-black capitalize">{step}</p></div>)}</div>
        </section>
      )}
      <section className="surface mt-6 overflow-hidden">
        <div className="border-b border-slate-200 p-5 dark:border-white/10">
          <div className="flex items-center gap-3"><Package className="size-5 text-orange-500" /><h2 className="font-black">Items and return eligibility</h2></div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {shopOrders.map((shopOrder) => {
            const shopValue = shopOrder.shops ?? {};
            const shop = (Array.isArray(shopValue) ? shopValue[0] : shopValue) as Row;
            const shopItems = orderItemsByShop.get(String(shopOrder.id)) ?? [];
            const deadline = getReturnDeadline(shopOrder.delivered_at, Number(shop.return_window_days ?? 7));
            const delivered = ["delivered", "completed"].includes(String(shopOrder.order_status ?? "").toLowerCase());
            const openReturn = activeReturnByShop.get(String(shopOrder.id));
            const availableItems = shopItems.filter((item) => {
              const product = item.product_variants?.products ?? {};
              return product.is_returnable !== false
                && Number(item.quantity ?? 0) - Number(item.returned_qty ?? 0) - (reservedByItem.get(String(item.id)) ?? 0) > 0;
            });
            const canRequest = delivered && isReturnWindowOpen(deadline) && availableItems.length > 0 && !openReturn;
            return (
              <article key={String(shopOrder.id)} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-black">{String(shop.name ?? "Shop")}</h3><p className="mt-1 text-xs capitalize text-slate-500">{String(shopOrder.order_status ?? "pending").replaceAll("_", " ")}</p></div>
                  {delivered && deadline && <span className={`rounded-full px-3 py-1 text-xs font-bold ${isReturnWindowOpen(deadline) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}>{isReturnWindowOpen(deadline) ? `Return by ${formatReturnDate(deadline)}` : `Return window ended ${formatReturnDate(deadline)}`}</span>}
                </div>
                <div className="mt-4 space-y-2">
                  {shopItems.map((item) => {
                    const product = item.product_variants?.products ?? {};
                    const remaining = Number(item.quantity ?? 0) - Number(item.returned_qty ?? 0) - (reservedByItem.get(String(item.id)) ?? 0);
                    return <div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-white/5"><span>{String(product.title ?? "Product")} × {Number(item.quantity ?? 0)}</span><span className={`text-xs font-semibold ${product.is_returnable === false || remaining <= 0 ? "text-slate-400" : "text-emerald-700 dark:text-emerald-400"}`}>{product.is_returnable === false ? "Not returnable" : remaining <= 0 ? "No returnable quantity left" : `${remaining} returnable`}</span></div>;
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  {openReturn ? <Link href={`/account/returns/${String(openReturn.id)}`} className="inline-flex items-center gap-2 text-sm font-black text-orange-600"><RotateCcw className="size-4" /> View return request</Link> : canRequest ? <Link href={`/account/orders/${String(shopOrder.id)}/return`} className="button-primary bg-orange-500 hover:bg-orange-600"><RotateCcw className="size-4" /> Return items</Link> : <span className="text-xs text-slate-500">{delivered ? "No eligible items to return." : "Return options appear after delivery."}</span>}
                </div>
              </article>
            );
          })}
          {shopOrders.length === 0 && <p className="p-6 text-sm text-slate-500">No shop shipments found for this order.</p>}
        </div>
      </section>
      {!selectedShopOrderId && (
        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="surface p-6"><h2 className="font-black">Order summary</h2><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Total</dt><dd className="font-black">{formatCurrency(Number(parent.total_amount ?? parent.subtotal ?? parent.total ?? 0))}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Payment</dt><dd className="font-bold capitalize">{String(parent.payment_status ?? parent.payment_method ?? "pending")}</dd></div></dl></div>
          <div className="surface p-6"><h2 className="font-black">Shipping information</h2><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{String(parent.shipping_address ?? parent.address ?? "Your saved delivery address")}</p></div>
        </section>
      )}
    </main>
  );
}
