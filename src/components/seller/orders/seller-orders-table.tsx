"use client";

import Link from "next/link";
import { Eye, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";
import { ClickableRow } from "@/components/ui/clickable-row";
import { RowActions } from "@/components/ui/row-actions";

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
  return <section data-pagination-list className={`surface overflow-hidden transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-[.1em] text-slate-400 dark:border-white/10 dark:bg-white/5"><tr><th className="px-5 py-4">Order</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Items</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Payment</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Return</th><th className="px-5 py-4">Date</th><th className="w-14 px-2 py-4 text-right"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{visible.map((order) => {
    const href = `/seller/orders/${order.id}`;
    const cells = <><td className="px-5 py-4 font-semibold"><Link href={href}>{order.id.slice(0, 8)}</Link></td><td className="px-5 py-4">{order.customer}</td><td className="px-5 py-4">{order.items}</td><td className="px-5 py-4 font-semibold">{formatCurrency(order.amount)}</td><td className="px-5 py-4"><span className="capitalize text-slate-600">{order.payment.replaceAll("_", " ")}</span></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${badgeTone(order.status)}`}>{order.status.replaceAll("_", " ")}</span></td><td className="px-5 py-4">{order.returnStatus ? <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black capitalize text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{order.returnStatus.replaceAll("_", " ")}{Number(order.refundAmount) > 0 ? ` · ${formatCurrency(Number(order.refundAmount))}` : ""}</span> : <span className="text-slate-400">—</span>}</td><td className="px-5 py-4 text-slate-500">{order.date}</td></>;
    return order.returnUrl
      ? <tr key={order.id} className="transition hover:bg-orange-50/40 dark:hover:bg-white/5">{cells}<td className="w-14 px-2 py-4 text-right"><RowActions label="Order actions" items={[{ id: "view-order", type: "link", label: "View order", icon: Eye, href }, { id: "view-return", type: "link", label: "View return", icon: RotateCcw, href: order.returnUrl }]} /></td></tr>
      : <ClickableRow key={order.id} href={href} className="transition hover:bg-orange-50/40 dark:hover:bg-white/5">{cells}<td className="w-14 px-2 py-4 text-right" /></ClickableRow>;
  })}</tbody></table></div><Pagination total={totalRows} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></section>;
}
