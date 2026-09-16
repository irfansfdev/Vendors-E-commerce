import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ClipboardList } from "lucide-react";
import { getRiderContext } from "@/lib/rider";
import { PaginatedList } from "@/components/paginated-list";

export const metadata: Metadata = { title: "Deliveries | Rider" };
export const dynamic = "force-dynamic";
export default async function RiderAssignmentsPage() {
  const { supabase, rider } = await getRiderContext();
  const { data } = await supabase.from("delivery_assignments").select("*").eq("rider_id", String(rider.id)).order("assigned_at", { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];
  return <main><Link href="/rider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Route queue</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Deliveries</h1><p className="mt-2 text-sm text-slate-500">Open an assignment to update its delivery progress.</p></div>{rows.length === 0 ? <section className="surface p-12 text-center"><ClipboardList className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No assignments yet</p></section> : <section className="surface divide-y divide-slate-100 overflow-hidden dark:divide-white/10"><PaginatedList pageSize={8} items={rows.map((row) => <Link key={String(row.id)} href={`/rider/assignments/${String(row.id)}`} className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-orange-50/50 dark:hover:bg-white/5"><div><p className="font-black">Order #{String(row.shop_order_id).slice(0, 8)}</p><p className="mt-1 text-xs capitalize text-slate-500">{String(row.status).replaceAll("_", " ")}</p></div><p className="text-sm font-black">COD {Number(row.cod_expected_amount ?? 0).toLocaleString()}</p></Link>)}/></section>}</main>;
}
