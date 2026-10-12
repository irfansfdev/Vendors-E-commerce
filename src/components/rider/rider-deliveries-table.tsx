"use client";

import { Check, Eye, PackageCheck, Truck } from "lucide-react";
import Link from "next/link";
import { updateDeliveryAction } from "@/app/rider/actions";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";
import { ClickableRow } from "@/components/ui/clickable-row";
import { RowActions } from "@/components/ui/row-actions";

export type RiderDeliveryRow = { id: string; shopOrderId: string; shopName: string; status: string; amount: number; paymentMethod: string; assignedAt: string };
export function RiderDeliveriesTable({ rows, total }: { rows: RiderDeliveryRow[]; total?: number }) {
  const totalRows = total ?? rows.length;
  const pagination = useUrlPagination(totalRows);
  const visible = total === undefined ? rows.slice(pagination.from, pagination.to + 1) : rows;
  return <section data-pagination-list className={`surface w-full max-w-full overflow-hidden transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}><div className="hidden md:block"><table className="w-full table-fixed text-left text-sm"><colgroup><col className="w-[20%]" /><col className="w-[16%]" /><col className="w-[14%]" /><col className="w-[14%]" /><col className="w-[14%]" /><col className="w-[56px]" /></colgroup><thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-[.12em] text-slate-500 dark:border-white/10 dark:bg-white/5"><tr><th className="px-3 py-4">Shop order</th><th className="px-3 py-4">Shop</th><th className="px-3 py-4">Amount</th><th className="px-3 py-4">Assigned</th><th className="px-3 py-4">Status</th><th className="w-14 px-2 py-4 text-right"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{visible.map((row) => <DeliveryRow key={row.id} row={row} />)}</tbody></table></div><div className="grid gap-3 p-4 md:hidden">{visible.map((row) => <DeliveryCard key={row.id} row={row} />)}</div><div className="px-5 pb-4"><Pagination total={totalRows} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></div></section>;
}

function DeliveryRow({ row }: { row: RiderDeliveryRow }) {
  const next = nextStatus(row.status);
  const cells = <><td className="px-5 py-4">{next ? <span className="font-black">#{row.shopOrderId.slice(0, 8)}</span> : <Link href={`/rider/assignments/${row.id}`} className="font-black">#{row.shopOrderId.slice(0, 8)}</Link>}<p className="mt-1 text-xs text-slate-400">{row.paymentMethod.replaceAll("_", " ")}</p></td><td className="px-5 py-4 font-semibold">{row.shopName}</td><td className="px-5 py-4 font-black">Rs. {row.amount.toLocaleString()}</td><td className="px-5 py-4 text-xs text-slate-500">{row.assignedAt}</td><td className="px-5 py-4"><span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black capitalize text-orange-700">{row.status.replaceAll("_", " ")}</span></td><td className="w-14 px-2 py-4 text-right">{next ? <RowActions items={[{ id: "view", type: "link", label: "View delivery", icon: Eye, href: `/rider/assignments/${row.id}` }, { id: "next", type: "form", label: nextLabel(next), icon: nextIcon(next), action: updateDeliveryAction, hidden: { assignmentId: row.id, status: next, collectedAmount: String(next === "delivered" ? row.amount : 0) } }]} /> : null}</td></>;
  return next ? <tr className="transition hover:bg-orange-50/40 dark:hover:bg-white/5">{cells}</tr> : <ClickableRow href={`/rider/assignments/${row.id}`} className="transition hover:bg-orange-50/40 dark:hover:bg-white/5">{cells}</ClickableRow>;
}

function DeliveryCard({ row }: { row: RiderDeliveryRow }) {
  const next = nextStatus(row.status);
  const cardContent = <><div className="flex items-start justify-between gap-3"><div><p className="font-black">#{row.shopOrderId.slice(0, 8)}</p><p className="mt-1 text-xs text-slate-500">{row.shopName}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black capitalize text-orange-700">{row.status.replaceAll("_", " ")}</span>{next && <RowActions items={[{ id: "view", type: "link", label: "View delivery", icon: Eye, href: `/rider/assignments/${row.id}` }, { id: "next", type: "form", label: nextLabel(next), icon: nextIcon(next), action: updateDeliveryAction, hidden: { assignmentId: row.id, status: next, collectedAmount: String(next === "delivered" ? row.amount : 0) } }]} />}</div></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-slate-400">Amount</p><p className="mt-1 font-black">Rs. {row.amount.toLocaleString()}</p></div><div><p className="text-slate-400">Assigned</p><p className="mt-1 font-semibold">{row.assignedAt}</p></div></div></>;
  return next ? <article className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">{cardContent}</article> : <Link href={`/rider/assignments/${row.id}`} className="block rounded-2xl border border-slate-200 p-4 hover:bg-orange-50/40 dark:border-white/10 dark:hover:bg-white/5">{cardContent}</Link>;
}

function nextStatus(status: string) {
  return status === "assigned" ? "accepted" : status === "accepted" ? "picked_up" : status === "picked_up" ? "out_for_delivery" : status === "out_for_delivery" ? "delivered" : "";
}
function nextLabel(next: string) {
  return next === "accepted" ? "Accept" : next === "picked_up" ? "Mark picked up" : next === "out_for_delivery" ? "Start delivery" : "Mark delivered";
}
function nextIcon(next: string) {
  return next === "delivered" ? Check : next === "picked_up" ? PackageCheck : Truck;
}
