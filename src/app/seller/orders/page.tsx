import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { getSellerContext } from "@/lib/seller";
import { formatCurrency } from "@/lib/utils";

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
  return <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8"><Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Fulfillment</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Orders</h1><p className="mt-2 text-sm text-slate-500">Open an order to review details and update its delivery status.</p></div><section className="surface overflow-hidden">{orders.length === 0 ? <div className="p-12 text-center"><ShoppingBag className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No orders yet</p><p className="mt-1 text-sm text-slate-500">New orders will appear here automatically.</p></div> : <div className="divide-y divide-slate-100 dark:divide-white/10">{orders.map((order) => { const summary = summaryByOrder.get(String(order.id)); return <Link href={`/seller/orders/${String(order.id)}`} key={String(order.id)} className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-orange-50/50 dark:hover:bg-white/5"><div><h3 className="font-extrabold">Order #{String(order.id).slice(0, 8)}</h3><p className="mt-1 max-w-64 truncate text-xs text-slate-500">{summary?.names.join(", ") || "Order items"}</p><p className="mt-1 text-xs text-slate-400">{order.created_at ? new Date(String(order.created_at)).toLocaleDateString() : ""}</p></div><div className="flex items-center gap-5"><div className="text-right"><p className="font-black">{formatCurrency(summary?.total ?? Number(order.total_amount ?? order.subtotal ?? order.total ?? 0))}</p><span className="text-xs font-bold capitalize text-orange-600">{String(order.order_status ?? order.status ?? "pending")}</span></div><ChevronRight className="size-4 text-slate-400" /></div></Link>; })}</div>}</section></main>;
}
