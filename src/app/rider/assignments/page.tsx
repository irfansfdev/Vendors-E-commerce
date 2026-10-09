import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ClipboardList } from "lucide-react";
import { RiderDeliveriesTable, type RiderDeliveryRow } from "@/components/rider-deliveries-table";
import { ReturnsListTable, type ReturnsListRow } from "@/components/returns-list-table";
import { getRiderContext } from "@/lib/rider";
import { getCurrentTimeMs } from "@/lib/returns/time";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";

export const metadata: Metadata = { title: "Assignments | Rider" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;

export default async function RiderAssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requestedType = typeof params.type === "string" ? params.type : undefined;
  const filter = ["delivery", "return_pickup"].includes(requestedType ?? "") ? requestedType : "all";
  const pagination = parsePagination(params);
  const { supabase, rider } = await getRiderContext();
  const [{ data, error, count: deliveryCount }, { data: pickupData, error: pickupError }] = await Promise.all([
    supabase.from("delivery_assignments").select("*", { count: "exact" }).eq("rider_id", String(rider.id)).eq("assignment_type", "delivery").order("assigned_at", { ascending: false }).range(pagination.from, pagination.to),
    supabase.rpc("get_rider_return_assignments"),
  ]);
  const deliveryMeta = buildPaginationMeta(deliveryCount ?? 0, pagination.page, pagination.pageSize);
  const correctedDeliveryRows = (deliveryCount ?? 0) > 0 && deliveryMeta.page !== pagination.page
    ? await supabase.from("delivery_assignments").select("*", { count: "exact" }).eq("rider_id", String(rider.id)).eq("assignment_type", "delivery").order("assigned_at", { ascending: false }).range(deliveryMeta.from, deliveryMeta.to)
    : null;
  const assignments = (correctedDeliveryRows?.data ?? data ?? []) as Row[];
  const orderIds = assignments.map((row) => String(row.shop_order_id));
  const [{ data: orders }, { data: items }] = await Promise.all([
    orderIds.length ? supabase.from("shop_orders").select("id,shop_id,payment_method,gross_amount,total_amount,subtotal").in("id", orderIds) : Promise.resolve({ data: [] }),
    orderIds.length ? supabase.from("order_items").select("shop_order_id,quantity,product_variants(price,products(price))").in("shop_order_id", orderIds) : Promise.resolve({ data: [] }),
  ]);
  const shopIds = [...new Set((orders ?? []).map((order) => String(order.shop_id)).filter(Boolean))];
  const { data: shops } = shopIds.length ? await supabase.from("shops").select("id,name").in("id", shopIds) : { data: [] };
  const orderById = new Map((orders ?? []).map((order) => [String(order.id), order as Row]));
  const shopById = new Map((shops ?? []).map((shop) => [String(shop.id), String(shop.name ?? "Shop")]));
  const itemTotalByOrder = new Map<string, number>();
  for (const item of (items ?? []) as Row[]) {
    const variant = item.product_variants ?? {};
    const product = variant.products ?? {};
    const total = Number(item.quantity ?? 0) * Number(variant.price ?? product.price ?? 0);
    itemTotalByOrder.set(String(item.shop_order_id), (itemTotalByOrder.get(String(item.shop_order_id)) ?? 0) + total);
  }
  const deliveryRows: RiderDeliveryRow[] = assignments.map((assignment) => {
    const order = orderById.get(String(assignment.shop_order_id)) ?? {};
    const amount = Number(assignment.cod_expected_amount ?? 0) || Number(order.gross_amount ?? order.total_amount ?? order.subtotal ?? 0) || itemTotalByOrder.get(String(assignment.shop_order_id)) || 0;
    return { id: String(assignment.id), shopOrderId: String(assignment.shop_order_id), shopName: shopById.get(String(order.shop_id)) ?? "Shop", status: String(assignment.status), amount, paymentMethod: String(order.payment_method ?? "cash_on_delivery"), assignedAt: assignment.assigned_at ? new Date(String(assignment.assigned_at)).toLocaleDateString() : "-" };
  });
  const pickups = (Array.isArray(pickupData) ? pickupData : []) as Row[];
  const returnRows: ReturnsListRow[] = pickups.map((row) => ({
    id: String(row.return_request_id),
    orderId: String(row.shop_order_id ?? row.return_request_id),
    href: `/rider/assignments/${String(row.assignment_id)}`,
    status: String(row.status),
    shop: String(row.shop_name ?? "Shop"),
    items: [`${Number(row.item_count ?? 0)} items`],
    itemCount: Number(row.item_count ?? 0),
    pickupArea: String(row.pickup_area ?? ""),
    requestedAt: String(row.assigned_at ?? ""),
  }));
  const tabs = [
    { key: "all", label: "All", count: deliveryRows.length + returnRows.length },
    { key: "delivery", label: "Deliveries", count: deliveryRows.length },
    { key: "return_pickup", label: "Return pickups", count: returnRows.length },
  ];
  const showDeliveries = filter !== "return_pickup";
  const showPickups = filter !== "delivery";

  return <main>
    <Link href="/rider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link>
    <div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Route queue</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Assignments</h1><p className="mt-2 text-sm text-slate-500">Delivery and return-pickup tasks for your route.</p></div>
    <nav className="mb-5 flex gap-2 overflow-x-auto" aria-label="Assignment type">
      {tabs.map((tab) => <Link key={tab.key} href={tab.key === "all" ? "/rider/assignments" : `/rider/assignments?type=${tab.key}`} aria-current={filter === tab.key ? "page" : undefined} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black ${filter === tab.key ? "bg-orange-500 text-white" : "surface text-slate-500"}`}>{tab.label} <span className="ml-1 opacity-75">{tab.count}</span></Link>)}
    </nav>
    {error && <p className="surface mb-5 p-5 text-sm text-rose-600">Could not load deliveries: {error.message}</p>}
    {pickupError && <p className="surface mb-5 p-5 text-sm text-rose-600">Could not load return pickups: {pickupError.message}</p>}
    {showDeliveries && <section className="mb-6"><h2 className="mb-3 text-xl font-black">Deliveries</h2>{deliveryRows.length ? <RiderDeliveriesTable rows={deliveryRows} total={deliveryCount ?? 0} /> : <Empty text="No delivery assignments." />}</section>}
    {showPickups && <section><div className="mb-3 flex items-center gap-2"><h2 className="text-xl font-black">Return pickups</h2><span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Return pickup</span></div>{returnRows.length ? <ReturnsListTable role="rider" rows={returnRows} now={getCurrentTimeMs()} emptyMessage="No return pickups." /> : <Empty text="No return pickups assigned." />}</section>}
  </main>;
}

function Empty({ text }: { text: string }) {
  return <section className="surface p-8 text-center"><ClipboardList className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">{text}</p></section>;
}
