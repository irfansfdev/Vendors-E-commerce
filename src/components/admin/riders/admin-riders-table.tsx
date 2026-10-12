"use client";

import { useMemo, useState } from "react";
import { Bike, Check, Mail, Pause, Phone, Play, Plus, Trash2, X } from "lucide-react";
import { createRiderFormAction, deleteRiderFormAction, updateRiderStatusFormAction } from "@/app/actions/admin";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";
import { RowActions, type RowActionItem } from "@/components/ui/row-actions";

export type Rider = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  status: string;
  user_id?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  license_number?: string | null;
  created_at?: string | null;
  assignment_count: number;
};
type Tab = "all" | "pending" | "approved" | "suspended" | "rejected" | "new";
export function AdminRidersTable({ riders }: { riders: Rider[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const filtered = useMemo(() => riders.filter((rider) => tab === "all" || tab === "new" || rider.status === tab), [riders, tab]);
  const pagination = useUrlPagination(filtered.length);
  const visible = filtered.slice(pagination.from, pagination.to + 1);
  const counts = { all: riders.length, pending: riders.filter((rider) => rider.status === "pending").length, approved: riders.filter((rider) => rider.status === "approved").length, suspended: riders.filter((rider) => rider.status === "suspended").length, rejected: riders.filter((rider) => rider.status === "rejected").length };
  function selectTab(nextTab: Tab) { setTab(nextTab); pagination.resetPage(); }

  return <div data-pagination-list className={`overflow-hidden transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}><div className="flex flex-wrap gap-2 border-b border-slate-100 p-4 dark:border-white/10">{(["all", "pending", "approved", "suspended", "rejected"] as const).map((item) => <TabButton key={item} active={tab === item} onClick={() => selectTab(item)}>{item === "all" ? "All riders" : item === "pending" ? "Requests" : item} <span className="ml-1 opacity-60">{counts[item]}</span></TabButton>)}<TabButton active={tab === "new"} onClick={() => selectTab("new")}><Plus className="size-3.5" /> New rider</TabButton></div>{tab === "new" ? <NewRiderForm /> : visible.length === 0 ? <p className="p-12 text-center text-sm text-slate-500">No riders in this tab.</p> : <><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-[.12em] text-slate-500 dark:border-white/10 dark:bg-white/5"><tr><th className="px-5 py-4">Rider</th><th className="px-5 py-4">Vehicle</th><th className="px-5 py-4">Account</th><th className="px-5 py-4">Jobs</th><th className="px-5 py-4">Status</th><th className="w-14 px-2 py-4 text-right"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{visible.map((rider) => <DesktopRow key={rider.id} rider={rider} />)}</tbody></table></div><div className="grid gap-3 p-4 md:hidden">{visible.map((rider) => <MobileCard key={rider.id} rider={rider} />)}</div><Pagination total={filtered.length} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></>}</div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`inline-flex items-center rounded-xl px-3.5 py-2 text-xs font-black capitalize transition ${active ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-50 text-slate-500 hover:text-orange-600 dark:bg-white/5"}`}>{children}</button>; }
function DesktopRow({ rider }: { rider: Rider }) { return <tr className="align-middle"><td className="px-5 py-4"><p className="font-black">{rider.full_name}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Mail className="size-3.5" />{rider.email}</p>{rider.phone && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Phone className="size-3.5" />{rider.phone}</p>}</td><td className="px-5 py-4"><p className="font-semibold capitalize">{rider.vehicle_type || "-"}</p><p className="mt-1 text-xs text-slate-500">{rider.vehicle_number || "No number"}</p><p className="mt-1 text-xs text-slate-400">License: {rider.license_number || "-"}</p></td><td className="px-5 py-4"><span className={rider.user_id ? "text-emerald-600" : "text-orange-600"}>{rider.user_id ? "Linked" : "Signup pending"}</span></td><td className="px-5 py-4 font-black">{rider.assignment_count}</td><td className="px-5 py-4"><Status status={rider.status} /></td><td className="w-14 px-2 py-4 text-right"><Actions rider={rider} /></td></tr>; }
function MobileCard({ rider }: { rider: Rider }) { return <article className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{rider.full_name}</p><p className="mt-1 text-xs text-slate-500">{rider.email}</p></div><Status status={rider.status} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><Info label="Vehicle" value={`${rider.vehicle_type || "-"} ${rider.vehicle_number || ""}`} /><Info label="Assignments" value={rider.assignment_count} /><Info label="Account" value={rider.user_id ? "Linked" : "Signup pending"} /><Info label="Phone" value={rider.phone || "-"} /></div><div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/10"><Actions rider={rider} /></div></article>; }
function Actions({ rider }: { rider: Rider }) {
  const fields = (status: string, rejectionReason?: string) => ({ riderId: rider.id, status, ...(rejectionReason ? { rejectionReason } : {}) });
  const items: RowActionItem[] = [];
  if (rider.status === "pending") {
    items.push({ id: "approve", type: "form", label: "Approve rider", icon: Check, action: updateRiderStatusFormAction, hidden: fields("approved") });
    items.push({ id: "reject", type: "form", label: "Reject rider", icon: X, tone: "danger", action: updateRiderStatusFormAction, hidden: fields("rejected", "Application did not meet current delivery requirements."), confirm: { title: "Reject rider application?", message: "This rider will not be approved to deliver.", confirmLabel: "Reject rider" } });
  }
  if (rider.status === "approved") items.push({ id: "suspend", type: "form", label: "Suspend rider", icon: Pause, action: updateRiderStatusFormAction, hidden: fields("suspended"), confirm: { title: `Suspend ${rider.full_name}?`, message: "This rider will no longer be able to accept deliveries.", confirmLabel: "Suspend rider" } });
  if (rider.status === "suspended") items.push({ id: "reactivate", type: "form", label: "Reactivate rider", icon: Play, action: updateRiderStatusFormAction, hidden: fields("approved") });
  if (rider.assignment_count === 0) items.push({ id: "delete", type: "form", label: "Delete rider", icon: Trash2, tone: "danger", action: deleteRiderFormAction, hidden: { riderId: rider.id }, confirm: { title: `Delete ${rider.full_name}?`, message: "This action cannot be undone.", confirmLabel: "Delete rider" } });
  return items.length ? <RowActions label="Rider actions" items={items} /> : null;
}
function NewRiderForm() { return <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1fr_1fr]"><div><span className="grid size-12 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Bike className="size-6" /></span><h3 className="mt-5 text-2xl font-black">Create a new rider</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Create the approved profile first. Then share the signup link so the rider can create their own password.</p><p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">Signup link: <span className="text-orange-600">/signup?next=/rider</span></p></div><form action={createRiderFormAction} className="grid gap-3 sm:grid-cols-2"><Field label="Full name" name="fullName" required /><Field label="Email" name="email" type="email" required /><Field label="Phone" name="phone" required /><Field label="CNIC / ID" name="cnic" /><Field label="Vehicle type" name="vehicleType" placeholder="Bike, car, van" /><Field label="Vehicle number" name="vehicleNumber" /><Field label="License number" name="licenseNumber" /><button className="button-primary mt-2 bg-orange-500 sm:col-span-2"><Plus className="size-4" /> Create rider</button></form></div>; }
function Field({ label, name, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200"><span>{label}</span><input {...props} name={name} type={type} className="field" /></label>; }
function Status({ status }: { status: string }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black capitalize ${status === "approved" ? "bg-emerald-50 text-emerald-700" : status === "rejected" || status === "suspended" ? "bg-rose-50 text-rose-700" : "bg-orange-50 text-orange-700"}`}>{status}</span>; }
function Info({ label, value }: { label: string; value: string | number }) { return <div><p className="text-[10px] font-black uppercase tracking-[.1em] text-slate-400">{label}</p><p className="mt-1 font-bold capitalize text-slate-700 dark:text-slate-200">{value}</p></div>; }
