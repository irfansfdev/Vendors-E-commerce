"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Tab = "all" | "pending" | "processing" | "shipped" | "delivered" | "completed" | "cancelled";
const pageSize = 10;
const tabs: Tab[] = ["all", "pending", "processing", "shipped", "delivered", "completed", "cancelled"];

function value(row: Row, ...keys: string[]) {
  return keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && item !== "");
}

function statusOf(order: Row) {
  const shopOrders = Array.isArray(order.shop_orders) ? order.shop_orders as Row[] : [];
  const statuses = shopOrders.map((shopOrder) => String(value(shopOrder, "order_status", "status") ?? "pending").toLowerCase());
  if (statuses.length > 1 && new Set(statuses).size > 1) return "mixed";
  return (statuses[0] ?? String(value(order, "status", "payment_status") ?? "pending").toLowerCase()) as Tab;
}

function badgeTone(status: string) {
  if (["completed", "delivered", "paid"].includes(status)) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (status === "cancelled") return "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  if (["mixed", "partially_delivered", "partially_shipped"].includes(status)) return "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300";
  return "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300";
}

export function AdminOrdersTable({ orders }: { orders: Row[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const counts = Object.fromEntries(tabs.map((item) => [item, item === "all" ? orders.length : orders.filter((order) => statusOf(order) === item).length])) as Record<Tab, number>;
  const filtered = useMemo(() => orders.filter((order) => {
    const search = query.trim().toLowerCase();
    const matchesTab = tab === "all" || statusOf(order) === tab;
    const shopOrders = Array.isArray(order.shop_orders) ? order.shop_orders as Row[] : [];
    const shopNames = shopOrders.map((shopOrder) => value(shopOrder, "shop_name", "shop_id")).join(" ");
    const matchesQuery = !search || [order.id, value(order, "customer_name", "customer_email", "customer_id"), shopNames].join(" ").toLowerCase().includes(search);
    return matchesTab && matchesQuery;
  }), [orders, query, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const shopLabel = (order: Row) => {
    const shopOrders = Array.isArray(order.shop_orders) ? order.shop_orders as Row[] : [];
    const names = [...new Set(shopOrders.map((shopOrder) => String(value(shopOrder, "shop_name", "shop_id") ?? "")).filter(Boolean))];
    return names.length ? names.join(", ") : "Multiple shops";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => <button key={item} type="button" onClick={() => { setTab(item); setPage(1); }} className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-black capitalize transition ${tab === item ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-orange-500 dark:bg-white/5 dark:ring-white/10"}`}>{item === "all" ? "All orders" : item.replaceAll("_", " ")} <span className="ml-1 opacity-60">{counts[item]}</span></button>)}
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search order, customer or shop" aria-label="Search orders" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-white/5" />
          {query && <button type="button" onClick={() => { setQuery(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500" aria-label="Clear search"><X className="size-4" /></button>}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500"><span>Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} orders</span>{query && <span>Filtered results</span>}</div>
      <section className="surface overflow-hidden">
        {visible.length === 0 ? <p className="p-12 text-center text-sm text-slate-500">No orders match this filter.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[.12em] text-slate-400 dark:border-white/10 dark:bg-white/5"><tr><th className="px-5 py-4">Order</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Shop</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Date</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{visible.map((order) => { const status = statusOf(order); return <tr key={String(order.id)} className="transition hover:bg-orange-50/40 dark:hover:bg-white/5"><td className="px-5 py-4 font-semibold">#{String(order.id).slice(0, 10)}</td><td className="px-5 py-4">{String(value(order, "customer_name", "customer_email", "customer_id") ?? "Unknown")}</td><td className="max-w-[240px] px-5 py-4 text-sm text-slate-600">{shopLabel(order)}</td><td className="px-5 py-4 font-semibold">{formatCurrency(Number(value(order, "total_amount", "total", "subtotal") ?? 0), String(order.currency ?? "USD"))}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] ${badgeTone(status)}`}>{["mixed", "partially_delivered", "partially_shipped"].includes(status) ? "Multiple statuses" : status.replaceAll("_", " ")}</span></td><td className="px-5 py-4 text-slate-500">{order.created_at ? new Date(String(order.created_at)).toLocaleDateString() : "-"}</td></tr>; })}</tbody></table></div>}
      </section>
      {pageCount > 1 && <nav className="flex items-center justify-center gap-2" aria-label="Order pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Previous page"><ChevronLeft className="size-4" /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button type="button" key={number} onClick={() => setPage(number)} className={`grid size-9 place-items-center rounded-lg text-xs font-black ${number === currentPage ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-orange-50 hover:text-orange-600"}`}>{number}</button>)}<button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Next page"><ChevronRight className="size-4" /></button></nav>}
    </div>
  );
}
