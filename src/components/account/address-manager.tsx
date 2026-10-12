"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Address = { id: string; label: string; name: string; phone: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string; isDefault: boolean };

export function AddressManager({ userId, initialAddresses, next }: { userId: string; initialAddresses: Address[]; next?: string }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initialAddresses.slice(0, 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const address = addresses[0];

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const required = ["fullName", "phone", "line1", "city", "country"];
    if (required.some((field) => !String(form.get(field) ?? "").trim())) {
      setError("Please complete all required address fields.");
      setSaving(false);
      return;
    }
    const payload = { user_id: userId, label: String(form.get("label") ?? "Home"), full_name: String(form.get("fullName")), phone: String(form.get("phone")), address_line1: String(form.get("line1")), address_line2: String(form.get("line2") ?? ""), city: String(form.get("city")), state: String(form.get("state") ?? ""), postal_code: String(form.get("postalCode") ?? ""), country: String(form.get("country")), is_default: true };
    try {
      const supabase = createClient();
      const query = address ? supabase.from("addresses").update(payload).eq("id", address.id).eq("user_id", userId).select("*").single() : supabase.from("addresses").insert(payload).select("*").single();
      const { data, error: saveError } = await query;
      if (saveError) throw new Error(saveError.message);
      const row = data as Record<string, unknown>;
      setAddresses([{ id: String(row.id), label: String(row.label ?? payload.label), name: String(row.full_name ?? payload.full_name), phone: String(row.phone ?? payload.phone), line1: String(row.address_line1 ?? payload.address_line1), line2: String(row.address_line2 ?? payload.address_line2), city: String(row.city ?? payload.city), state: String(row.state ?? payload.state), postalCode: String(row.postal_code ?? payload.postal_code), country: String(row.country ?? payload.country), isDefault: true }]);
      toast.success(address ? "Address updated" : "Address saved");
      if (next?.startsWith("/") && !next.startsWith("//")) router.push(next); else router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this address.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[.9fr_1.1fr]"><section className="surface p-6 sm:p-8"><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Delivery address</p><h2 className="mt-2 text-2xl font-black">One address for your orders</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use one active shipping address. Update it anytime from this page.</p>{address ? <div className="mt-8 rounded-2xl bg-slate-50 p-5 dark:bg-white/5"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/10"><MapPin className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{address.label || "Home"}</h3><span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Active</span></div><p className="mt-3 text-sm font-bold">{address.name}</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{address.line1}{address.line2 && <><br />{address.line2}</>}<br />{address.city}{address.state && `, ${address.state}`} {address.postalCode}<br />{address.country}</p><p className="mt-3 text-xs text-slate-400">{address.phone}</p></div></div></div> : <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-white/15"><MapPin className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm font-bold">No address saved yet</p><p className="mt-1 text-xs text-slate-500">Complete the form to enable checkout.</p></div>}</section><section className="surface p-6 sm:p-8"><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">{address ? "Update details" : "Add details"}</p><h2 className="mt-2 text-2xl font-black">{address ? "Edit shipping address" : "Add shipping address"}</h2>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}<form onSubmit={saveAddress} className="mt-6 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label><span className="label-text">Label</span><input name="label" defaultValue={address?.label ?? "Home"} className="field" placeholder="Home" /></label><label><span className="label-text">Full name *</span><input required name="fullName" defaultValue={address?.name ?? ""} className="field" /></label><label><span className="label-text">Phone *</span><input required name="phone" defaultValue={address?.phone ?? ""} className="field" /></label><label><span className="label-text">Country *</span><input required name="country" defaultValue={address?.country ?? "Pakistan"} className="field" /></label></div><label><span className="label-text">Address line 1 *</span><input required name="line1" defaultValue={address?.line1 ?? ""} className="field" placeholder="House, street, area" /></label><label><span className="label-text">Address line 2</span><input name="line2" defaultValue={address?.line2 ?? ""} className="field" placeholder="Apartment, floor, landmark (optional)" /></label><div className="grid gap-4 sm:grid-cols-3"><label><span className="label-text">City *</span><input required name="city" defaultValue={address?.city ?? ""} className="field" /></label><label><span className="label-text">State</span><input name="state" defaultValue={address?.state ?? ""} className="field" /></label><label><span className="label-text">Postal code</span><input name="postalCode" defaultValue={address?.postalCode ?? ""} className="field" /></label></div><button disabled={saving} className="button-primary w-full bg-orange-500 hover:bg-orange-600">{saving ? <><LoaderCircle className="size-4 animate-spin" /> Saving...</> : <><Check className="size-4" /> {address ? "Update address" : "Save address"}</>}</button></form></section></div>;
}
