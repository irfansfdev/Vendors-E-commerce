import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, UsersRound } from "lucide-react";
import { getSellerContext } from "@/lib/seller";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { UrlPagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Staff | Seller" };
export const dynamic = "force-dynamic";

export default async function SellerStaffPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, shop } = await getSellerContext();
  const pagination = parsePagination(await searchParams);
  let { data, count } = await supabase.from("shop_members").select("user_id, role, created_at", { count: "exact" }).eq("shop_id", shop.id).order("created_at", { ascending: true }).range(pagination.from, pagination.to);
  const meta = buildPaginationMeta(count ?? 0, pagination.page, pagination.pageSize);
  if ((count ?? 0) > 0 && meta.page !== pagination.page) {
    ({ data, count } = await supabase.from("shop_members").select("user_id, role, created_at", { count: "exact" }).eq("shop_id", shop.id).order("created_at", { ascending: true }).range(meta.from, meta.to));
  }
  const members = (data ?? []) as Record<string, unknown>[];
  return <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8"><Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Team access</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Staff</h1><p className="mt-2 text-sm text-slate-500">People with access to this shop.</p></div><section data-pagination-list className="surface overflow-hidden">{members.length === 0 ? <div className="p-12 text-center"><UsersRound className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No additional staff members</p><p className="mt-1 text-sm text-slate-500">The shop owner currently has exclusive access.</p></div> : <div className="divide-y divide-slate-100 dark:divide-white/10">{members.map((member) => <div key={String(member.user_id)} className="flex items-center justify-between p-5"><div><h3 className="font-extrabold">User {String(member.user_id).slice(0, 8)}</h3><p className="text-xs text-slate-500">Added {member.created_at ? new Date(String(member.created_at)).toLocaleDateString() : "recently"}</p></div><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold capitalize text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">{String(member.role ?? "member")}</span></div>)}</div>}<div className="px-5 pb-4"><UrlPagination total={count ?? 0} /></div></section></main>;
}
