"use client";

import { useMemo, useState } from "react";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";
import { assignAdminRiderAction } from "@/app/actions/admin";

export type DeliveryQueueRow = {
  shopOrderId: string;
  parentOrderId: string;
  shopName: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  riderAddress: string;
  availability: string;
  active: number;
  capacity: number;
  pickupDistance: string;
  customerDistance: string;
  location: string;
  recommended: boolean;
};

export function AdminDeliveryQueueTable({ rows, total, error, success }: { rows: DeliveryQueueRow[]; total?: number; error?: string; success?: string }) {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const orders = useMemo(() => Array.from(new Map(rows.map((row) => [row.shopOrderId, row])).values()), [rows]);
  const totalOrders = total ?? orders.length;
  const pagination = useUrlPagination(totalOrders);
  const visibleOrders = total === undefined ? orders.slice(pagination.from, pagination.to + 1) : orders;
  const selectedRows = rows.filter((row) => row.shopOrderId === selectedOrder).sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.active - b.active);

  return <div data-pagination-list className={`surface overflow-hidden transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}>
    {error && <p className="border-b border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">{error}</p>}{success && <p className="border-b border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">{success}</p>}
    {rows.length === 0 ? <div className="p-12 text-center"><p className="font-black">No eligible riders are available.</p><p className="mt-2 text-sm text-slate-500">Check rider approval, availability, and active delivery capacity.</p></div> : selectedOrder ? <RiderSelection rows={selectedRows} onBack={() => setSelectedOrder(null)} /> : <>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-[.12em] text-slate-500 dark:border-white/10 dark:bg-white/5"><tr><th className="px-5 py-4">Shop order</th><th className="px-5 py-4">Shop</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Available riders</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{visibleOrders.map((row) => <tr key={row.shopOrderId}><td className="px-5 py-4"><p className="font-black">#{row.shopOrderId.slice(0, 8)}</p><p className="mt-1 text-xs text-slate-400">Parent #{row.parentOrderId.slice(0, 8)}</p></td><td className="px-5 py-4 font-semibold">{row.shopName}</td><td className="px-5 py-4">{row.customerName}</td><td className="px-5 py-4"><p className="font-black">{row.amount.toLocaleString()}</p><p className="mt-1 text-xs capitalize text-slate-400">{row.paymentMethod.replaceAll("_", " ")}</p></td><td className="px-5 py-4 font-black">{rows.filter((candidate) => candidate.shopOrderId === row.shopOrderId).length}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelectedOrder(row.shopOrderId)} className="button-primary whitespace-nowrap bg-slate-950 px-4 py-2.5 text-xs hover:bg-orange-500 dark:bg-white dark:text-slate-950">Assign rider</button></td></tr>)}</tbody></table></div>
      <div className="px-5 pb-4"><Pagination total={totalOrders} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></div>
    </>}
  </div>;
}

function RiderSelection({ rows, onBack }: { rows: DeliveryQueueRow[]; onBack: () => void }) {
  const first = rows[0];
  return <><div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 dark:border-white/10"><div><p className="text-xs font-black uppercase tracking-widest text-orange-500">Assign rider</p><h2 className="mt-1 text-xl font-black">Shop Order #{first.shopOrderId.slice(0, 8)}</h2><p className="mt-1 text-sm text-slate-500">{first.shopName} · {first.customerName} · {first.amount.toLocaleString()}</p></div><button type="button" onClick={onBack} className="button-secondary px-4 py-2 text-xs">Back to ready orders</button></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-[.12em] text-slate-500 dark:border-white/10 dark:bg-white/5"><tr><th className="px-5 py-4">Rider</th><th className="px-5 py-4">Availability</th><th className="px-5 py-4">Pickup distance</th><th className="px-5 py-4">Customer distance</th><th className="px-5 py-4">Active deliveries</th><th className="px-5 py-4">Location</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{rows.map((row) => <tr key={row.riderId} className={row.recommended ? "bg-orange-50/50 dark:bg-orange-500/5" : ""}><td className="px-5 py-4"><p className="font-black">{row.riderName}</p>{row.riderPhone && <p className="mt-1 text-xs text-slate-400">{row.riderPhone}</p>}{row.riderAddress && <p className="mt-1 max-w-[190px] truncate text-xs text-slate-400" title={row.riderAddress}>{row.riderAddress}</p>}</td><td className="px-5 py-4"><p className="font-bold capitalize text-emerald-600">{row.recommended ? "Recommended · " : ""}{row.availability}</p></td><td className="px-5 py-4 font-semibold">{row.pickupDistance}</td><td className="px-5 py-4 font-semibold">{row.customerDistance}</td><td className="px-5 py-4 font-black">{row.active} / {row.capacity}</td><td className="px-5 py-4 text-xs font-semibold">{row.location}</td><td className="px-5 py-4 text-right"><form action={assignAdminRiderAction}><input type="hidden" name="shopOrderId" value={row.shopOrderId} /><input type="hidden" name="riderId" value={row.riderId} /><button className="button-primary whitespace-nowrap bg-orange-500 px-4 py-2.5 text-xs hover:bg-orange-600">Assign</button></form></td></tr>)}</tbody></table></div>{rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No eligible riders are available for this shop order.</p>}</>;
}
