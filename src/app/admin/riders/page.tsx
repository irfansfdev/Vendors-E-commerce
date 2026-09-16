import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Bike, Check, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminRidersTable, type Rider } from "@/components/admin-riders-table";

export const metadata: Metadata = { title: "Riders | BabulShop Admin" };
export const dynamic = "force-dynamic";

type Row = Record<string, any>;
export default async function AdminRidersPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: assignmentRows }] = await Promise.all([
    supabase.from("delivery_profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("delivery_assignments").select("rider_id"),
  ]);
  const assignments = new Map<string, number>();
  for (const row of assignmentRows ?? []) assignments.set(String(row.rider_id), (assignments.get(String(row.rider_id)) ?? 0) + 1);
  const riders: Rider[] = ((data ?? []) as Row[]).map((rider) => ({ id: String(rider.id), full_name: String(rider.full_name ?? "Unnamed rider"), email: String(rider.email ?? ""), phone: rider.phone ? String(rider.phone) : null, status: String(rider.status ?? "pending"), user_id: rider.user_id ? String(rider.user_id) : null, vehicle_type: rider.vehicle_type ? String(rider.vehicle_type) : null, vehicle_number: rider.vehicle_number ? String(rider.vehicle_number) : null, license_number: rider.license_number ? String(rider.license_number) : null, created_at: rider.created_at ? String(rider.created_at) : null, assignment_count: assignments.get(String(rider.id)) ?? 0 }));
  const pending = riders.filter((rider) => rider.status === "pending").length;
  const active = riders.filter((rider) => rider.status === "approved").length;
  return <div className="mx-auto max-w-[1440px] p-5 sm:p-8 lg:p-10"><header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Delivery network</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Rider operations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Approve applicants, provision rider access, and keep delivery history auditable.</p></div><Link href="/admin" className="button-secondary"><ArrowUpRight className="size-4" /> Back to overview</Link></header><section className="grid gap-4 sm:grid-cols-3"><Metric icon={Bike} label="Total riders" value={riders.length} /><Metric icon={Clock3} label="Pending requests" value={pending} /><Metric icon={Check} label="Approved riders" value={active} /></section><section className="surface mt-8 overflow-hidden"><div className="border-b border-slate-100 p-6 dark:border-white/10"><h2 className="font-black">Rider directory</h2><p className="mt-1 text-xs text-slate-500">Review requests, active riders, suspended accounts, and create new rider access from the tabs.</p></div>{error ? <p className="p-6 text-sm text-rose-600">Could not load riders: {error.message}</p> : <AdminRidersTable riders={riders} />}</section></div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Bike; label: string; value: number }) { return <div className="surface p-5"><span className="grid size-11 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Icon className="size-5" /></span><p className="mt-5 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>; }
