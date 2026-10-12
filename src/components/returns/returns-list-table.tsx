"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ReturnStatusBadge } from "@/components/return-status-badge";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";
import { ClickableRow } from "@/components/ui/clickable-row";

export type ReturnsListRow = {
  id: string;
  orderId: string;
  href: string;
  status: string;
  shop?: string;
  customer?: string;
  items: string[];
  reason?: string;
  amount?: number;
  requestedAt: string;
  dueAt?: string | null;
  refundedAt?: string | null;
  pickupArea?: string;
  itemCount?: number;
  age?: string;
  flags?: string[];
};

type Role = "customer" | "seller" | "admin" | "rider";
const tabsByRole: Record<Role, Array<{ key: string; label: string; statuses?: string[] }>> = {
  customer: [
    { key: "all", label: "All" },
    { key: "requested", label: "Requested", statuses: ["requested"] },
    { key: "progress", label: "In progress", statuses: ["approved", "pickup_assigned", "picked_up", "returned_to_shop", "inspection_passed", "refund_pending"] },
    { key: "review", label: "Under review", statuses: ["rejected", "escalated", "inspection_failed"] },
    { key: "complete", label: "Completed", statuses: ["refunded", "cancelled"] },
  ],
  seller: [
    { key: "all", label: "All" },
    { key: "response", label: "Needs response", statuses: ["requested"] },
    { key: "progress", label: "In progress", statuses: ["approved", "escalated", "pickup_assigned", "picked_up", "inspection_failed", "inspection_passed", "refund_pending"] },
    { key: "inspect", label: "To inspect", statuses: ["returned_to_shop"] },
    { key: "complete", label: "Completed", statuses: ["rejected", "refunded", "cancelled"] },
  ],
  admin: [
    { key: "all", label: "All" },
    { key: "attention", label: "Needs attention" },
    { key: "rider", label: "Awaiting rider", statuses: ["approved", "pickup_assigned", "picked_up"] },
    { key: "refund", label: "Refunds to process", statuses: ["refund_pending"] },
  ],
  rider: [
    { key: "all", label: "All" },
    { key: "assigned", label: "Assigned", statuses: ["assigned"] },
    { key: "accepted", label: "Accepted", statuses: ["accepted"] },
    { key: "picked_up", label: "Picked up", statuses: ["picked_up", "out_for_delivery"] },
    { key: "done", label: "Completed", statuses: ["delivered", "failed", "cancelled"] },
  ],
};

function matchesTab(row: ReturnsListRow, key: string, role: Role, now: number) {
  if (key === "all") return true;
  if (role === "admin" && key === "attention") {
    return ["escalated", "inspection_failed"].includes(row.status)
      || (row.status === "requested" && !!row.dueAt && new Date(row.dueAt).getTime() <= now);
  }
  const tab = tabsByRole[role].find((item) => item.key === key);
  return !!tab?.statuses?.includes(row.status);
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function itemSummary(items: string[]) {
  if (!items.length) return "Return items";
  return `${items[0]}${items.length > 1 ? ` +${items.length - 1} more` : ""}`;
}

function formatAge(requestedAt: string, now: number) {
  const days = Math.max(0, Math.floor((now - new Date(requestedAt).getTime()) / 86_400_000));
  return days === 0 ? "Today" : `${days}d`;
}

export function ReturnsListTable({ role, rows, emptyMessage, now }: {
  role: Role;
  rows: ReturnsListRow[];
  emptyMessage: string;
  now: number;
}) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const tabs = tabsByRole[role];
  const filtered = useMemo(() => rows
    .filter((row) => matchesTab(row, tab, role, now))
    .filter((row) => !query.trim() || [row.id, row.orderId].some((value) => value.toLowerCase().includes(query.trim().toLowerCase()))),
  [rows, tab, role, now, query]);
  const pagination = useUrlPagination(filtered.length, 20);
  const visible = filtered.slice(pagination.from, pagination.to + 1);
  const changeTab = (next: string) => { setTab(next); pagination.resetPage(); };
  const header = role === "customer"
    ? ["Return #", "Order #", "Items", "Reason", "Refund", "Status", "Requested"]
    : role === "seller"
      ? ["Return #", "Order #", "Customer", "Items", "Reason", "Time to respond", "Status"]
      : role === "rider"
        ? ["Return #", "Pickup area", "Shop", "Items", "Status"]
        : ["Return #", "Shop", "Customer", "Items", "Reason", "Amount", "Status", "Age", "Flags"];

  return <section data-pagination-list className={`surface overflow-hidden transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}>
    <div className="border-b border-slate-100 p-4 dark:border-white/10 sm:p-5">
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((item) => {
          const count = rows.filter((row) => matchesTab(row, item.key, role, now)).length;
          return <button key={item.key} type="button" onClick={() => changeTab(item.key)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${tab === item.key ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"}`}>{item.label} <span className="ml-1 opacity-70">{count}</span></button>;
        })}
      </div>
      <label className="relative mt-4 block sm:ml-auto sm:w-80">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input className="field field-icon-left w-full" value={query} onChange={(event) => { setQuery(event.target.value); pagination.resetPage(); }} placeholder="Search return or order #" aria-label="Search by return or order number" />
      </label>
    </div>
    {visible.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">{query ? "No returns match your search." : emptyMessage}</div> : <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[.1em] text-slate-500 dark:bg-white/5"><tr>{header.map((cell) => <th key={cell} className="px-4 py-3">{cell}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">{visible.map((row) => <ClickableRow key={row.id} href={row.href} className="hover:bg-orange-50/40 dark:hover:bg-white/5">
            {role === "customer" && <><td className="px-4 py-4"><Link href={row.href} className="font-black">Return #{shortId(row.id)}</Link></td><td className="px-4 py-4">#{shortId(row.orderId)}</td><td className="max-w-48 truncate px-4 py-4">{itemSummary(row.items)}</td><td className="px-4 py-4">{row.reason}</td><td className="px-4 py-4 font-bold">{formatCurrency(row.amount ?? 0)}</td><td className="px-4 py-4"><ReturnStatusBadge status={row.status} /></td><td className="px-4 py-4">{new Date(row.requestedAt).toLocaleDateString()}</td></>}
            {role === "seller" && <><td className="px-4 py-4"><Link href={row.href} className="font-black">Return #{shortId(row.id)}</Link></td><td className="px-4 py-4">#{shortId(row.orderId)}</td><td className="px-4 py-4">{row.customer}</td><td className="max-w-48 truncate px-4 py-4">{itemSummary(row.items)}</td><td className="px-4 py-4">{row.reason}</td><td className="px-4 py-4">{row.status === "requested" ? remainingTime(row.dueAt, now) : "—"}</td><td className="px-4 py-4"><ReturnStatusBadge status={row.status} overdue={row.status === "requested" && !!row.dueAt && new Date(row.dueAt).getTime() <= now} /></td></>}
            {role === "rider" && <><td className="px-4 py-4"><Link href={row.href} className="font-black">Return #{shortId(row.id)}</Link></td><td className="px-4 py-4">{row.pickupArea || "Area unavailable"}</td><td className="px-4 py-4">{row.shop}</td><td className="px-4 py-4">{row.itemCount ?? row.items.length} items</td><td className="px-4 py-4"><ReturnStatusBadge status={row.status} /></td></>}
            {role === "admin" && <><td className="px-4 py-4"><Link href={row.href} className="font-black">Return #{shortId(row.id)}</Link></td><td className="px-4 py-4">{row.shop}</td><td className="px-4 py-4">{row.customer}</td><td className="max-w-48 truncate px-4 py-4">{itemSummary(row.items)}</td><td className="px-4 py-4">{row.reason}</td><td className="px-4 py-4 font-bold">{formatCurrency(row.amount ?? 0)}</td><td className="px-4 py-4"><ReturnStatusBadge status={row.status} /></td><td className="px-4 py-4">{row.age ?? formatAge(row.requestedAt, now)}</td><td className="px-4 py-4">{row.flags?.join(", ") || "—"}</td></>}
          </ClickableRow>)}</tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 md:hidden">{visible.map((row) => <Link key={row.id} href={row.href} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-2"><div><p className="font-black">Return #{shortId(row.id)}</p><p className="mt-1 text-xs text-slate-500">Order #{shortId(row.orderId)}</p></div><ReturnStatusBadge status={row.status} /></div>
        <p className="mt-3 text-sm">{itemSummary(row.items)}</p>
        <p className="mt-2 text-xs text-slate-500">
          {role === "rider"
            ? `${row.pickupArea || "Area unavailable"} · ${row.shop} · ${row.itemCount ?? row.items.length} items`
            : role === "admin"
              ? `${row.shop} · ${row.customer} · ${row.reason} · ${row.age ?? formatAge(row.requestedAt, now)} · ${row.flags?.join(", ") || "No flags"}`
              : role === "seller"
                ? `${row.customer} · ${row.reason} · ${row.status === "requested" ? remainingTime(row.dueAt, now) : "No response due"}`
                : `${row.reason} · ${new Date(row.requestedAt).toLocaleDateString()}`}
        </p>
        {(role === "customer" || role === "admin") && <p className="mt-2 text-sm font-bold">{formatCurrency(row.amount ?? 0)}</p>}
      </Link>)}</div>
      <div className="px-4 pb-4"><Pagination total={filtered.length} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></div>
    </>}
  </section>;
}

function remainingTime(dueAt: string | null | undefined, now: number) {
  if (!dueAt) return "Deadline unavailable";
  const minutes = Math.ceil((new Date(dueAt).getTime() - now) / 60_000);
  if (minutes <= 0) return "Overdue";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
