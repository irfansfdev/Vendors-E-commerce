import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut, ShoppingBag } from "lucide-react";
import { AccountSidebar } from "@/components/account-sidebar";
import { signoutAction } from "@/app/auth/actions";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getOrderStatus } from "@/lib/order-status";

export const metadata: Metadata = { title: "My orders" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;

export default async function AccountOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/orders");
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("*, shop_orders(*)").eq("customer_id", user.id).order("created_at", { ascending: false });
  const orders = (data ?? []) as Row[];
    orders.forEach((order) => { order.status = getOrderStatus(order); });
  const fullName = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Shopper");
  return <main className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Your BabulShop</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Hello, {fullName}</h1><p className="mt-2 text-sm text-slate-500">Track all of your orders and shop deliveries.</p></div><form action={signoutAction}><button className="button-secondary"><LogOut className="size-4" /> Sign out</button></form></div><div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]"><AccountSidebar active="Orders" /><section className="surface overflow-hidden"><div className="border-b border-slate-200 p-5 dark:border-white/10"><h2 className="font-black">All orders</h2><p className="mt-1 text-xs text-slate-500">{orders.length} order{orders.length === 1 ? "" : "s"} in your account.</p></div>{orders.length === 0 ? <div className="p-12 text-center"><ShoppingBag className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No orders yet</p><p className="mt-1 text-sm text-slate-500">Your completed purchases will appear here.</p></div> : <div className="divide-y divide-slate-100 dark:divide-white/10">{orders.map((order) => <a href={`/account/orders/${String(order.id)}`} key={String(order.id)} className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-orange-50/50 dark:hover:bg-white/5"><div><h3 className="font-extrabold">Order #{String(order.id).slice(0, 8)}</h3><p className="mt-1 text-xs text-slate-500">{order.created_at ? new Date(String(order.created_at)).toLocaleString() : ""}</p></div><div className="text-right"><p className="font-black">{formatCurrency(Number(order.total_amount ?? order.subtotal ?? order.total ?? 0))}</p><span className="text-xs font-bold capitalize text-orange-600">{String(order.status ?? order.order_status ?? "pending")}</span></div></a>)}</div>}</section></div></main>;
}
