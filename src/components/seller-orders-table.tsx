"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";

type Order = { id: string; customer: string; date: string; items: number; amount: number; payment: string; status: string; returnUrl?: string; returnStatus?: string; refundAmount?: number };
function badgeTone(value: string) {
  if (["delivered", "completed", "paid"].includes(value)) return "bg-emerald-50 text-emerald-700";
  if (["cancelled", "failed", "refunded"].includes(value)) return "bg-rose-50 text-rose-700";
  return "bg-orange-50 text-orange-700";
}

export function SellerOrdersTable({ orders, total }: { orders: Order[]; total?: number }) {
  const pagination = useUrlPagination(total ?? orders.length);
  const visible = total === undefined ? orders.slice(pagination.from, pagination.to + 1) : orders;
  const totalRows = total ?? orders.length;
  return <section data-pagination-list className={`surface overflow-hidden transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-[.1em] text-slate-400 dark:border-white/10 dark:bg-white/5"><tr><th className="px-5 py-4">Order</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Items</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Payment</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Return</th><th className="px-5 py-4">Date</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{visible.map((order) => <tr key={order.id} className="transition hover:bg-orange-50/40 dark:hover:bg-white/5"><td className="px-5 py-4 font-semibold">#{order.id.slice(0, 8)}</td><td className="px-5 py-4">{order.customer}</td><td className="px-5 py-4">{order.items}</td><td className="px-5 py-4 font-semibold">{formatCurrency(order.amount)}</td><td className="px-5 py-4"><span className="capitalize text-slate-600">{order.payment.replaceAll("_", " ")}</span></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${badgeTone(order.status)}`}>{order.status.replaceAll("_", " ")}</span></td><td className="px-5 py-4">{order.returnUrl ? <Link href={order.returnUrl} className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black capitalize text-orange-700 hover:bg-orange-100 dark:bg-orange-500/10 dark:text-orange-300">{order.returnStatus?.replaceAll("_", " ")}{Number(order.refundAmount) > 0 ? ` · ${formatCurrency(Number(order.refundAmount))}` : ""}</Link> : <span className="text-slate-400">—</span>}</td><td className="px-5 py-4 text-slate-500">{order.date}</td><td className="px-5 py-4"><div className="flex justify-end"><Link href={`/seller/orders/${order.id}`} className="button-secondary px-3 py-2"><Eye className="size-4" /> View</Link></div></td></tr>)}</tbody></table></div><Pagination total={totalRows} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></section>;
}
