import type { Metadata } from "next";
import Link from "next/link";
import { Bike, Store } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getAvailablePortals } from "@/lib/portal";

export const metadata: Metadata = { title: "Choose your workspace" };
export const dynamic = "force-dynamic";

export default async function ChooseRolePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/choose-role");
  if (user.app_metadata?.is_admin === true) redirect("/admin");
  const portals = await getAvailablePortals(user.id);
  if (!portals.isSeller && !portals.isRider) redirect("/account");
  if (portals.isSeller && !portals.isRider) redirect("/seller");
  if (!portals.isRider && portals.isSeller) redirect("/seller");
  return <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><div className="text-center"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Welcome back</p><h1 className="mt-3 text-4xl font-black tracking-[-.055em]">Choose your workspace</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">This account has more than one BabulShop role. Choose where you want to work right now.</p></div><div className="mt-10 grid gap-5 sm:grid-cols-2"><Link href="/seller" className="surface group p-7 transition hover:-translate-y-1 hover:border-orange-300"><span className="grid size-12 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Store className="size-6" /></span><h2 className="mt-6 text-xl font-black">Shop dashboard</h2><p className="mt-2 text-sm leading-6 text-slate-500">Manage products, orders, shop settings, and payouts.</p><span className="mt-6 inline-flex text-sm font-black text-orange-600">Open shop workspace</span></Link><Link href="/rider" className="surface group p-7 transition hover:-translate-y-1 hover:border-orange-300"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Bike className="size-6" /></span><h2 className="mt-6 text-xl font-black">Rider dashboard</h2><p className="mt-2 text-sm leading-6 text-slate-500">View assigned deliveries, update progress, and record COD collection.</p><span className="mt-6 inline-flex text-sm font-black text-emerald-600">Open delivery workspace</span></Link></div></main>;
}
