import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AddressManager } from "@/components/address-manager";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Shipping addresses" };
export const dynamic = "force-dynamic";
type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function AddressesPage({ searchParams }: { searchParams: Params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/addresses");
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") : "";
  const supabase = await createClient();
  const result = await supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false });
  const addresses = (result.data ?? []).map((value) => { const row = value as Record<string, unknown>; return { id: String(row.id), label: String(row.label ?? row.type ?? "Address"), name: String(row.full_name ?? row.name ?? ""), phone: String(row.phone ?? ""), line1: String(row.address_line1 ?? row.address_line_1 ?? row.line1 ?? row.street ?? ""), line2: String(row.address_line2 ?? row.address_line_2 ?? row.line2 ?? ""), city: String(row.city ?? ""), state: String(row.state ?? ""), postalCode: String(row.postal_code ?? row.zip_code ?? ""), country: String(row.country ?? ""), isDefault: Boolean(row.is_default ?? row.default) }; });
  return <main className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><Link href="/account" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Back to account</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Account details</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Shipping addresses</h1></div><AddressManager userId={user.id} initialAddresses={addresses} next={next} /></main>;
}
