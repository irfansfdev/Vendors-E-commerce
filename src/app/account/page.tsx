import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, LogOut, MapPin, ShoppingBag } from "lucide-react";
import { AccountSidebar } from "@/components/account-sidebar";
import { signoutAction } from "@/app/auth/actions";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getOrderStatus } from "@/lib/order-status";

export const metadata: Metadata = { title: "My account" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  if ((await searchParams).tab === "orders") redirect("/account/orders");
  let orders: Row[] = [];
  let addressCount = 0;
  try {
    const supabase = await createClient();
    const [orderResult, addressResult] = await Promise.all([
      supabase.from("orders").select("*, shop_orders(*)").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(2),
      supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    orders = (orderResult.data ?? []) as Row[];
    orders.forEach((order) => { order.status = getOrderStatus(order); });
    addressCount = addressResult.count ?? 0;
  } catch {}
  const fullName = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Shopper");
  return <main className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Your BabulShop</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Hello, {fullName}</h1><p className="mt-2 text-sm text-slate-500">Manage your orders, addresses, and saved finds.</p></div><form action={signoutAction}><button className="button-secondary"><LogOut className="size-4" /> Sign out</button></form></div><div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]"><AccountSidebar active="Overview" /><div className="space-y-6"><section className="grid gap-4 sm:grid-cols-3"><div className="surface p-5"><ShoppingBag className="size-5 text-orange-500" /><p className="mt-4 text-2xl font-black">{orders.length}</p><p className="mt-1 text-xs text-slate-500">Latest orders</p></div><div className="surface p-5"><MapPin className="size-5 text-orange-500" /><p className="mt-4 text-2xl font-black">{addressCount}</p><p className="mt-1 text-xs text-slate-500">Saved addresses</p></div><div className="surface p-5"><Heart className="size-5 text-orange-500" /><p className="mt-4 text-2xl font-black">0</p><p className="mt-1 text-xs text-slate-500">Saved items</p></div></section><section className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-white/10"><div><h2 className="font-black">Latest orders</h2><p className="mt-1 text-xs text-slate-500">Your two most recent orders.</p></div><Link href="/account/orders" className="text-xs font-black text-orange-500">See all</Link></div>{orders.length === 0 ? <p className="p-8 text-sm text-slate-500">Your orders will appear here.</p> : <div className="divide-y divide-slate-100 dark:divide-white/10">{orders.map((order) => <Link key={String(order.id)} href={`/account/orders/${String(order.id)}`} className="flex items-center justify-between gap-4 p-5 hover:bg-orange-50/50 dark:hover:bg-white/5"><div><p className="font-extrabold">Order #{String(order.id).slice(0, 8)}</p><p className="mt-1 text-xs text-slate-500">{order.created_at ? new Date(String(order.created_at)).toLocaleDateString() : ""}</p></div><div className="text-right"><p className="font-black">{formatCurrency(Number(order.total_amount ?? order.subtotal ?? order.total ?? 0))}</p><p className="mt-1 text-xs font-bold capitalize text-orange-600">{String(order.status ?? order.order_status ?? "pending")}</p></div></Link>)}</div>}</section></div></div></main>;
}
