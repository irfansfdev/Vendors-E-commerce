"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";

type Order = { id: string; customer: string; date: string; items: number; amount: number; payment: string; status: string };
const pageSize = 10;

function badgeTone(value: string) {
  if (["delivered", "completed", "paid"].includes(value)) return "bg-emerald-50 text-emerald-700";
  if (["cancelled", "failed", "refunded"].includes(value)) return "bg-rose-50 text-rose-700";
  return "bg-orange-50 text-orange-700";
}

export function SellerOrdersTable({ orders }: { orders: Order[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = useMemo(() => orders.slice((currentPage - 1) * pageSize, currentPage * pageSize), [orders, currentPage]);
  return <section className="surface overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-[.1em] text-slate-400 dark:border-white/10 dark:bg-white/5"><tr><th className="px-5 py-4">Order</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Items</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Payment</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Date</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{visible.map((order) => <tr key={order.id} className="transition hover:bg-orange-50/40 dark:hover:bg-white/5"><td className="px-5 py-4 font-semibold">#{order.id.slice(0, 8)}</td><td className="px-5 py-4">{order.customer}</td><td className="px-5 py-4">{order.items}</td><td className="px-5 py-4 font-semibold">{formatCurrency(order.amount)}</td><td className="px-5 py-4"><span className="capitalize text-slate-600">{order.payment.replaceAll("_", " ")}</span></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${badgeTone(order.status)}`}>{order.status.replaceAll("_", " ")}</span></td><td className="px-5 py-4 text-slate-500">{order.date}</td><td className="px-5 py-4"><div className="flex justify-end"><Link href={`/seller/orders/${order.id}`} className="button-secondary px-3 py-2"><Eye className="size-4" /> View</Link></div></td></tr>)}</tbody></table></div>{pageCount > 1 && <nav className="flex items-center justify-center gap-2 border-t border-slate-100 p-4 dark:border-white/10" aria-label="Order pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))} className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Previous page"><ChevronLeft className="size-4" /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button type="button" key={number} onClick={() => setPage(number)} className={`grid size-9 place-items-center rounded-lg text-xs font-black ${number === currentPage ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-orange-50 hover:text-orange-600"}`}>{number}</button>)}<button type="button" disabled={currentPage === pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))} className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Next page"><ChevronRight className="size-4" /></button></nav>}</section>;
}
