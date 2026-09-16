import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import { getSellerContext } from "@/lib/seller";
import { SellerOrdersTable } from "@/components/seller-orders-table";

export const metadata: Metadata = { title: "Orders | Seller" };
export const dynamic = "force-dynamic";

export default async function SellerOrdersPage() {
  const { supabase, shop } = await getSellerContext();
  const { data } = await supabase.from("shop_orders").select("*").eq("shop_id", String(shop.id)).order("created_at", { ascending: false });
  const orders = (data ?? []) as Record<string, unknown>[];
  const orderIds = orders.map((order) => String(order.id));
  const { data: items } = orderIds.length
    ? await supabase.from("order_items").select("shop_order_id, quantity, product_variants(price, products(title, price))").in("shop_order_id", orderIds)
    : { data: [] };
  const summaryByOrder = new Map<string, { total: number; names: string[] }>();
  for (const item of (items ?? []) as Record<string, any>[]) {
    const variant = item.product_variants ?? {};
    const product = variant.products ?? {};
    const summary = summaryByOrder.get(String(item.shop_order_id)) ?? { total: 0, names: [] };
    summary.total += Number(item.quantity ?? 0) * Number(variant.price ?? product.price ?? 0);
    if (product.title) summary.names.push(String(product.title));
    summaryByOrder.set(String(item.shop_order_id), summary);
  }
  const rows = orders.map((order) => { const summary = summaryByOrder.get(String(order.id)); return { id: String(order.id), customer: String(order.customer_name ?? order.customer_email ?? order.customer_id ?? "Customer"), date: order.created_at ? new Date(String(order.created_at)).toLocaleDateString() : "-", items: summary?.names.length ?? 0, amount: summary?.total ?? Number(order.gross_amount ?? order.total_amount ?? order.subtotal ?? order.total ?? 0), payment: String(order.payment_method ?? "cash_on_delivery"), status: String(order.order_status ?? order.status ?? "pending").toLowerCase() }; });
  return <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8"><Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Fulfillment</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Orders</h1><p className="mt-2 text-sm text-slate-500">Review customer orders and update delivery status.</p></div>{rows.length === 0 ? <section className="surface p-12 text-center"><ShoppingBag className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No orders yet</p><p className="mt-1 text-sm text-slate-500">New orders will appear here automatically.</p></section> : <SellerOrdersTable orders={rows} />}</main>;
}
