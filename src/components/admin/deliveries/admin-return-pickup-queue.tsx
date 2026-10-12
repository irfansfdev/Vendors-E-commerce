"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bike, Eye, LoaderCircle, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { assignReturnPickup } from "@/lib/returns/actions";
import { ReturnStatusBadge } from "@/components/return-status-badge";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";
import { RowActions } from "@/components/ui/row-actions";

type Rider = { id: string; name: string; phone: string; active: number; capacity: number };
type ReturnPickup = { id: string; orderId: string; status: string; shopName: string; requestedAt: string; items: string[]; riders: Rider[] };
export function AdminReturnPickupQueue({ returns }: { returns: ReturnPickup[] }) {
  const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assigningReturnId, setAssigningReturnId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const router = useRouter();
  const tabs = [{ key: "all", label: "All" }, { key: "approved", label: "Approved" }, { key: "reassign", label: "Reassign" }];
  const visible = useMemo(() => returns.filter((row) => tab === "all"
    || (tab === "approved" && row.status === "approved")
    || (tab === "reassign" && row.status === "pickup_assigned"))
    .filter((row) =>
    !query.trim() || [row.id, row.orderId, row.shopName].some((value) => value.toLowerCase().includes(query.trim().toLowerCase()))), [returns, query, tab]);
  const pagination = useUrlPagination(visible.length, 20);
  const pageRows = visible.slice(pagination.from, pagination.to + 1);

  function assign(returnId: string) {
    const riderId = selectedRiders[returnId];
    if (!riderId) {
      toast.error("Choose an available rider first.");
      return;
    }
    setBusyId(returnId);
    startTransition(async () => {
      const result = await assignReturnPickup(returnId, riderId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Return pickup assigned.");
        setAssigningReturnId(null);
        router.refresh();
      }
      setBusyId(null);
    });
  }

  return <section data-pagination-list className={`surface mt-7 overflow-hidden transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}>
    <div className="border-b border-slate-100 p-5 dark:border-white/10">
      <p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Separate return route</p>
      <h2 className="mt-1 text-xl font-black">Return pickups</h2>
      <p className="mt-1 text-sm text-slate-500">Assign approved pickups or reassign after failed attempts.</p>
      <div className="mt-4 flex gap-2 overflow-x-auto">{tabs.map((item) => <button key={item.key} type="button" onClick={() => { setTab(item.key); pagination.resetPage(); }} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${tab === item.key ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"}`}>{item.label} <span className="ml-1 opacity-70">{returns.filter((row) => item.key === "all" || (item.key === "approved" && row.status === "approved") || (item.key === "reassign" && row.status === "pickup_assigned")).length}</span></button>)}</div>
      <label className="relative mt-4 block sm:ml-auto sm:w-80"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className="field field-icon-left w-full" value={query} onChange={(event) => { setQuery(event.target.value); pagination.resetPage(); }} placeholder="Search return or order #" aria-label="Search pickup queue" /></label>
    </div>
    {pageRows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{query ? "No return pickups match your search." : "No returns in this queue."}</p> : <>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[.1em] text-slate-500 dark:bg-white/5"><tr><th className="px-4 py-3">Return #</th><th className="px-4 py-3">Shop</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Requested</th><th className="w-14 px-2 py-3 text-right"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{pageRows.map((request) => <tr key={request.id} className="hover:bg-orange-50/40 dark:hover:bg-white/5"><td className="px-4 py-4"><span className="font-black text-orange-600">Return #{request.id.slice(0, 8).toUpperCase()}</span><p className="mt-1 text-xs text-slate-500">Order #{request.orderId.slice(0, 8).toUpperCase()}</p></td><td className="px-4 py-4">{request.shopName}</td><td className="max-w-56 truncate px-4 py-4">{request.items[0] ?? "Return items"}{request.items.length > 1 ? ` +${request.items.length - 1} more` : ""}</td><td className="px-4 py-4"><ReturnStatusBadge status={request.status} /></td><td className="px-4 py-4 text-xs">{request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : "-"}</td><td className="w-14 px-2 py-4 text-right"><ReturnPickupActions request={request} selected={selectedRiders[request.id] ?? ""} setSelected={(riderId) => setSelectedRiders((state) => ({ ...state, [request.id]: riderId }))} busy={busy && busyId === request.id} onAssign={() => assign(request.id)} assigning={assigningReturnId === request.id} toggleAssign={() => setAssigningReturnId((current) => current === request.id ? null : request.id)} /></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 p-3 md:hidden">{pageRows.map((request) => <article key={request.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-orange-600">Return #{request.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-xs text-slate-500">Order #{request.orderId.slice(0, 8).toUpperCase()} · {request.shopName}</p></div><div className="flex items-center gap-2"><ReturnStatusBadge status={request.status} /><ReturnPickupActions request={request} selected={selectedRiders[request.id] ?? ""} setSelected={(riderId) => setSelectedRiders((state) => ({ ...state, [request.id]: riderId }))} busy={busy && busyId === request.id} onAssign={() => assign(request.id)} assigning={assigningReturnId === request.id} toggleAssign={() => setAssigningReturnId((current) => current === request.id ? null : request.id)} /></div></div><p className="mt-3 text-sm">{request.items[0] ?? "Return items"}{request.items.length > 1 ? ` +${request.items.length - 1} more` : ""}</p></article>)}</div>
      <div className="px-4 pb-4"><Pagination total={visible.length} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></div>
    </>}
  </section>;
}

function AssignControl({ request, selected, setSelected, busy, onAssign }: { request: ReturnPickup; selected: string; setSelected: (id: string) => void; busy: boolean; onAssign: () => void }) {
  return <div className="flex min-w-56 gap-2" onClick={(event) => event.stopPropagation()}><select className="field min-w-0 flex-1 text-xs" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Available rider"><option value="">{request.riders.length ? "Select rider" : "No available rider"}</option>{request.riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}{rider.phone ? ` · ${rider.phone}` : ""} · {rider.active}/{rider.capacity}</option>)}</select><button type="button" disabled={busy || !selected} onClick={onAssign} className="button-primary justify-center bg-orange-500 px-3 hover:bg-orange-600">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}</button></div>;
}

function ReturnPickupActions({ request, selected, setSelected, busy, onAssign, assigning, toggleAssign }: { request: ReturnPickup; selected: string; setSelected: (id: string) => void; busy: boolean; onAssign: () => void; assigning: boolean; toggleAssign: () => void }) {
  return <div className="flex flex-col items-end gap-2">
    <RowActions label="Return pickup actions" items={[
      { id: "view", type: "link", label: "View return", icon: Eye, href: `/admin/returns/${request.id}` },
      { id: "assign", type: "button", label: "Assign rider", icon: Bike, onSelect: toggleAssign },
    ]} />
    {assigning && <AssignControl request={request} selected={selected} setSelected={setSelected} busy={busy} onAssign={onAssign} />}
  </div>;
}
