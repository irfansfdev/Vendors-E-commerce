import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Secure checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");
  let addresses: Array<{ id: string; label: string; line: string; city: string; isDefault: boolean }> = [];
  try {
    const supabase = await createClient();
    let result = await supabase.from("addresses").select("*").eq("user_id", user.id);
    if (result.error) result = await supabase.from("addresses").select("*").eq("profile_id", user.id);
    addresses = (result.data ?? []).map((value) => {
      const row = value as Record<string, unknown>;
      return { id: String(row.id), label: String(row.label ?? row.type ?? "Shipping address"), line: [row.address_line1 ?? row.address_line_1 ?? row.line1 ?? row.street, row.address_line2 ?? row.address_line_2 ?? row.line2].filter(Boolean).join(", "), city: [row.city, row.state, row.postal_code ?? row.zip_code, row.country].filter(Boolean).join(", "), isDefault: Boolean(row.is_default ?? row.default) };
    });
  } catch {
    addresses = [];
  }
  return <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><div className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Protected checkout</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Complete your order</h1><p className="mt-2 text-sm text-slate-500">One payment. Separate, trackable seller shipments.</p></div><CheckoutForm addresses={addresses} /></main>;
}
