"use client";

import Link from "next/link";
import { BadgeDollarSign, Box, CircleDollarSign, ExternalLink, Plus, ShoppingBag, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Props = { shop: Row; products: Row[]; orders: Row[]; payouts: Row[]; role: string };

function orderAmount(order: Row) {
  return Number(order.total_amount ?? order.subtotal ?? order.total ?? 0);
}

function getDailySales(orders: Row[]) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      amount: orders.filter((order) => String(order.created_at ?? "").slice(0, 10) === key).reduce((sum, order) => sum + orderAmount(order), 0),
    };
  });
}

export function SellerDashboard({ shop, products, orders, payouts, role }: Props) {
  const sales = orders.reduce((total, order) => total + orderAmount(order), 0);
  const dailySales = getDailySales(orders);
  const maxDailySales = Math.max(...dailySales.map((day) => day.amount), 1);
  const pendingPayout = payouts.filter((payout) => String(payout.status) === "pending").reduce((total, payout) => total + Number(payout.net_amount ?? payout.amount ?? 0), 0);
  const shopSlug = String(shop.slug ?? "");
  const shopName = String(shop.name ?? "Your shop");
  const metrics: Array<{ icon: LucideIcon; value: string | number; label: string; detail: string }> = [
    { icon: CircleDollarSign, value: formatCurrency(sales), label: "Gross sales", detail: `${orders.length} orders` },
    { icon: ShoppingBag, value: orders.length, label: "Seller orders", detail: `${orders.filter((order) => String(order.status) === "processing").length} processing` },
    { icon: Box, value: products.length, label: "Active products", detail: "Live inventory" },
    { icon: BadgeDollarSign, value: formatCurrency(pendingPayout), label: "Pending payout", detail: "After fees" },
  ];

  return <main className="mx-auto max-w-[1100px] px-4 py-2 sm:px-6 lg:px-8">
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Seller command center</p><div className="mt-2 flex items-center gap-2"><h1 className="text-3xl font-black tracking-[-.05em] sm:text-4xl">{shopName}</h1><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{role}</span></div></div><div className="flex gap-2">{shopSlug && <Link href={`/shop/${shopSlug}`} className="button-secondary">View shop <ExternalLink className="size-4" /></Link>}<Link href="/seller/products/new" className="button-primary bg-orange-500 hover:bg-orange-600"><Plus className="size-4" /> Add product</Link></div></div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ icon: Icon, value, label, detail }) => <div key={label} className="surface p-5"><span className="grid size-11 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Icon className="size-5" /></span><p className="mt-5 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>)}</section>
    <section className="surface mt-6 p-6 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Sales activity</p><h2 className="mt-1 text-xl font-black">Last 7 days</h2></div><span className="text-xs font-bold text-slate-400">Live orders</span></div><div className="mt-8 flex h-56 items-end gap-2 border-b border-slate-200 sm:gap-4 dark:border-white/10">{dailySales.map((day) => <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t-xl bg-orange-400 transition hover:bg-orange-500" style={{ height: `${Math.max((day.amount / maxDailySales) * 100, day.amount ? 8 : 2)}%` }} title={formatCurrency(day.amount)} /><span className="text-[10px] font-bold text-slate-400">{day.label}</span></div>)}</div><div className="mt-4 flex justify-between text-[10px] font-bold uppercase tracking-[.12em] text-slate-400"><span>Daily gross volume</span><span>{formatCurrency(dailySales.reduce((sum, day) => sum + day.amount, 0))}</span></div></section>
    <section className="surface mt-6 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-white/10"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Latest activity</p><h2 className="mt-1 text-xl font-black">Recent orders</h2></div><Link href="/seller/orders" className="text-xs font-bold text-orange-500">View all</Link></div>{orders.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No orders yet. New orders will appear here.</p> : <div className="divide-y divide-slate-100 dark:divide-white/10">{orders.slice(0, 5).map((order) => <div key={String(order.id)} className="flex items-center justify-between gap-4 p-5"><div><p className="font-extrabold">Order #{String(order.id).slice(0, 8)}</p><p className="mt-1 text-xs capitalize text-slate-500">{String(order.status ?? "pending")}</p></div><p className="font-black">{formatCurrency(orderAmount(order))}</p></div>)}</div>}</section>
  </main>;
}
