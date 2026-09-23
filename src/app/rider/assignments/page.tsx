import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ClipboardList } from "lucide-react";
import { RiderDeliveriesTable, type RiderDeliveryRow } from "@/components/rider-deliveries-table";
import { getRiderContext } from "@/lib/rider";

export const metadata: Metadata = { title: "Deliveries | Rider" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;

export default async function RiderAssignmentsPage() {
  const { supabase, rider } = await getRiderContext();
  const { data } = await supabase.from("delivery_assignments").select("*").eq("rider_id", String(rider.id)).order("assigned_at", { ascending: false }).limit(500);
  const assignments = (data ?? []) as Row[];
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
  const rows: RiderDeliveryRow[] = assignments.map((assignment) => {
    const order = orderById.get(String(assignment.shop_order_id)) ?? {};
    const amount = Number(assignment.cod_expected_amount ?? 0) || Number(order.gross_amount ?? order.total_amount ?? order.subtotal ?? 0) || itemTotalByOrder.get(String(assignment.shop_order_id)) || 0;
    return { id: String(assignment.id), shopOrderId: String(assignment.shop_order_id), shopName: shopById.get(String(order.shop_id)) ?? "Shop", status: String(assignment.status), amount, paymentMethod: String(order.payment_method ?? "cash_on_delivery"), assignedAt: assignment.assigned_at ? new Date(String(assignment.assigned_at)).toLocaleDateString() : "-" };
  });
  return <main><Link href="/rider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Route queue</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Deliveries</h1><p className="mt-2 text-sm text-slate-500">Update the next valid status directly from the delivery list.</p></div>{rows.length === 0 ? <section className="surface p-12 text-center"><ClipboardList className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No assignments yet</p></section> : <RiderDeliveriesTable rows={rows} />}</main>;
}
