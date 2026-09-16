"use client";

import Link from "next/link";
import { BadgeDollarSign, Box, CircleDollarSign, ExternalLink, Plus, ShoppingBag, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Props = { shop: Row; products: Row[]; orders: Row[]; payouts: Row[]; earnings: Row[]; orderItems: Row[]; role: string };

function orderAmount(order: Row) {
  const direct = Number(order.gross_amount ?? order.calculated_total ?? order.total_amount ?? order.subtotal ?? order.total ?? order.amount ?? order.order_total ?? order.grand_total ?? order.total_price ?? 0);
  return direct > 0 ? direct : Number(order.seller_earnings ?? 0) + Number(order.platform_commission ?? 0);
}

function orderStatus(order: Row) {
  return String(order.order_status ?? order.status ?? "pending").toLowerCase();
}

function isPaid(order: Row) {
  const paymentStatus = String(order.payment_status ?? "").toLowerCase();
  return ["paid", "partially_refunded"].includes(paymentStatus);
}

function isDelivered(order: Row) {
  return ["delivered", "completed"].includes(orderStatus(order));
}

function getDailySales(orders: Row[]) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toLocaleDateString("en-CA");
    return {
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      amount: orders.filter((order) => isDelivered(order) && String(order.delivered_at ?? order.updated_at ?? order.created_at ?? "").slice(0, 10) === key).reduce((sum, order) => sum + orderAmount(order), 0),
    };
  });
}

export function SellerDashboard({ shop, products, orders, payouts, earnings, orderItems, role }: Props) {
  const totalsByOrder = new Map<string, number>();
  for (const item of orderItems) {
    const variant = item.product_variants as Row | null;
    const product = variant?.products as Row | null;
    const itemTotal = Number(item.quantity ?? 0) * Number(variant?.price ?? product?.price ?? 0);
    totalsByOrder.set(String(item.shop_order_id), (totalsByOrder.get(String(item.shop_order_id)) ?? 0) + itemTotal);
  }
  const ordersWithTotals: Row[] = orders.map((order) => ({ ...order, calculated_total: totalsByOrder.get(String(order.id)) ?? order.calculated_total }));
  const paidOrders = ordersWithTotals.filter(isPaid);
  const deliveredOrders = ordersWithTotals.filter(isDelivered);
  const sales = ordersWithTotals.reduce((total, order) => total + orderAmount(order), 0);
  const deliveredSales = deliveredOrders.reduce((total, order) => total + orderAmount(order), 0);
  const dailySales = getDailySales(ordersWithTotals);
  const maxDailySales = Math.max(...dailySales.map((day) => day.amount), 1);
  const earningAmount = (earning: Row) => Number(earning.net_amount ?? 0);
  const payoutAmount = (payout: Row) => Number(payout.net_amount ?? payout.amount ?? 0);
  const pendingPayout = earnings.filter((earning) => ["pending", "held"].includes(String(earning.status).toLowerCase())).reduce((total, earning) => total + earningAmount(earning), 0);
  const availableBalance = earnings.filter((earning) => String(earning.status).toLowerCase() === "available").reduce((total, earning) => total + earningAmount(earning), 0);
  const paidPayout = payouts.filter((payout) => String(payout.status).toLowerCase() === "paid").reduce((total, payout) => total + payoutAmount(payout), 0);
  const refunds = orders.reduce((total, order) => total + Number(order.refund_amount ?? 0), 0);
  const productsSold = orderItems.reduce((total, item) => total + Number(item.quantity ?? 0), 0);
  const shopSlug = String(shop.slug ?? "");
  const shopName = String(shop.name ?? "Your shop");
  const metrics: Array<{ icon: LucideIcon; value: string | number; label: string; detail: string }> = [
    { icon: CircleDollarSign, value: formatCurrency(sales), label: "Gross sales", detail: `${ordersWithTotals.length} shop orders` },
    { icon: CircleDollarSign, value: formatCurrency(deliveredSales), label: "Delivered sales", detail: `${deliveredOrders.length} delivered orders` },
    { icon: ShoppingBag, value: orders.length, label: "Seller orders", detail: `${orders.filter((order) => orderStatus(order) === "processing").length} processing` },
    { icon: Box, value: productsSold, label: "Products sold", detail: `${products.length} active products` },
    { icon: BadgeDollarSign, value: formatCurrency(pendingPayout), label: "Pending payout", detail: "After fees" },
    { icon: BadgeDollarSign, value: formatCurrency(availableBalance), label: "Available balance", detail: `${formatCurrency(paidPayout)} paid out` },
  ];

  return <main className="mx-auto max-w-[1100px] px-4 py-2 sm:px-6 lg:px-8">
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Seller command center</p><div className="mt-2 flex items-center gap-2"><h1 className="text-3xl font-black tracking-[-.05em] sm:text-4xl">{shopName}</h1><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{role}</span></div></div><div className="flex gap-2">{shopSlug && <Link href={`/shop/${shopSlug}`} className="button-secondary">View shop <ExternalLink className="size-4" /></Link>}<Link href="/seller/products/new" className="button-primary bg-orange-500 hover:bg-orange-600"><Plus className="size-4" /> Add product</Link></div></div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.slice(0, 4).map(({ icon: Icon, value, label, detail }) => <div key={label} className="surface p-5"><span className="grid size-11 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Icon className="size-5" /></span><p className="mt-5 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>)}</section>
    <section className="surface mt-4 grid gap-4 p-5 sm:grid-cols-3"><div><p className="text-xs font-bold text-slate-500">Pending payout</p><p className="mt-1 text-lg font-black">{formatCurrency(pendingPayout)}</p><p className="text-[11px] text-slate-400">After fees</p></div><div><p className="text-xs font-bold text-slate-500">Available balance</p><p className="mt-1 text-lg font-black text-emerald-600">{formatCurrency(availableBalance)}</p><p className="text-[11px] text-slate-400">{formatCurrency(paidPayout)} paid out</p></div><div><p className="text-xs font-bold text-slate-500">Refunds</p><p className="mt-1 text-lg font-black">{formatCurrency(refunds)}</p><p className="text-[11px] text-slate-400">Returns and refunds</p></div></section>
    <section className="surface mt-6 p-6 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Sales activity</p><h2 className="mt-1 text-xl font-black">Last 7 days</h2></div><span className="text-xs font-bold text-slate-400">Live orders</span></div><div className="mt-8 flex h-56 items-end gap-2 border-b border-slate-200 sm:gap-4 dark:border-white/10">{dailySales.map((day) => <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t-xl bg-orange-400 transition hover:bg-orange-500" style={{ height: `${Math.max((day.amount / maxDailySales) * 100, day.amount ? 8 : 2)}%` }} title={formatCurrency(day.amount)} /><span className="text-[10px] font-bold text-slate-400">{day.label}</span></div>)}</div><div className="mt-4 flex justify-between text-[10px] font-bold uppercase tracking-[.12em] text-slate-400"><span>Daily gross volume</span><span>{formatCurrency(dailySales.reduce((sum, day) => sum + day.amount, 0))}</span></div></section>
    <section className="surface mt-6 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-white/10"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Latest activity</p><h2 className="mt-1 text-xl font-black">Recent orders</h2></div><Link href="/seller/orders" className="text-xs font-bold text-orange-500">See all</Link></div>{ordersWithTotals.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No orders yet. New orders will appear here.</p> : <div className="divide-y divide-slate-100 dark:divide-white/10">{ordersWithTotals.slice(0, 2).map((order) => <Link href={`/seller/orders/${String(order.id)}`} key={String(order.id)} className="flex items-center justify-between gap-4 p-5 transition hover:bg-orange-50/50 dark:hover:bg-white/5"><div><p className="font-extrabold">Order #{String(order.id).slice(0, 8)}</p><p className="mt-1 text-xs capitalize text-slate-500">{orderStatus(order)}</p></div><p className="font-black">{formatCurrency(orderAmount(order))}</p></Link>)}</div>}</section>
  </main>;
}
