import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import { getSellerContext } from "@/lib/seller";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders | Seller" };
export const dynamic = "force-dynamic";

export default async function SellerOrdersPage() {
  const { supabase } = await getSellerContext();
  const { data } = await supabase.from("shop_orders").select("*").order("created_at", { ascending: false });
  const orders = (data ?? []) as Record<string, unknown>[];
  return <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8"><Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Fulfillment</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Orders</h1><p className="mt-2 text-sm text-slate-500">Review and process orders from your shop.</p></div><section className="surface overflow-hidden">{orders.length === 0 ? <div className="p-12 text-center"><ShoppingBag className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No orders yet</p><p className="mt-1 text-sm text-slate-500">New orders will appear here automatically.</p></div> : <div className="divide-y divide-slate-100 dark:divide-white/10">{orders.map((order) => <div key={String(order.id)} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h3 className="font-extrabold">Order #{String(order.id).slice(0, 8)}</h3><p className="mt-1 text-xs text-slate-500">{order.created_at ? new Date(String(order.created_at)).toLocaleDateString() : ""}</p></div><div className="text-right"><p className="font-black">{formatCurrency(Number(order.total_amount ?? order.subtotal ?? order.total ?? 0))}</p><span className="text-xs font-bold capitalize text-orange-600">{String(order.status ?? "pending")}</span></div></div>)}</div>}</section></main>;
}
