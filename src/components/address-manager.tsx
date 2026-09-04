"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, MapPin, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Address = { id: string; label: string; name: string; phone: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string; isDefault: boolean };

export function AddressManager({ userId, initialAddresses, next }: { userId: string; initialAddresses: Address[]; next?: string }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [adding, setAdding] = useState(initialAddresses.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function addAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      user_id: userId,
      label: String(form.get("label")),
      full_name: String(form.get("fullName")),
      phone: String(form.get("phone")),
      address_line_1: String(form.get("line1")),
      address_line_2: String(form.get("line2")),
      city: String(form.get("city")),
      state: String(form.get("state")),
      postal_code: String(form.get("postalCode")),
      country: String(form.get("country")),
      is_default: form.get("isDefault") === "on" || addresses.length === 0,
    };
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase.from("addresses").insert(payload).select("*").single();
      if (insertError) throw insertError;
      const row = data as Record<string, unknown>;
      setAddresses((current) => [...current, { id: String(row.id), label: String(row.label), name: String(row.full_name), phone: String(row.phone ?? ""), line1: String(row.address_line_1), line2: String(row.address_line_2 ?? ""), city: String(row.city), state: String(row.state ?? ""), postalCode: String(row.postal_code ?? ""), country: String(row.country), isDefault: Boolean(row.is_default) }]);
      setAdding(false);
      toast.success("Address saved");
      if (next?.startsWith("/") && !next.startsWith("//")) router.push(next);
      else router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save this address."); }
    finally { setSaving(false); }
  }

  async function removeAddress(id: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", userId);
    if (deleteError) { toast.error("Could not remove address", { description: deleteError.message }); return; }
    setAddresses((current) => current.filter((address) => address.id !== id));
    toast.success("Address removed");
  }

  return <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]"><section className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Saved addresses</h2><p className="mt-1 text-xs text-slate-400">Choose from these at checkout.</p></div><button onClick={() => setAdding(true)} className="button-secondary"><Plus className="size-4" /> Add address</button></div>{addresses.length ? <div className="grid gap-4 sm:grid-cols-2">{addresses.map((address) => <article key={address.id} className="surface relative p-5"><div className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10"><MapPin className="size-4" /></span>{address.isDefault && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="size-3" /> Default</span>}</div><h3 className="mt-4 text-sm font-black">{address.label}</h3><p className="mt-1 text-xs font-semibold">{address.name}</p><p className="mt-2 text-xs leading-5 text-slate-500">{address.line1}{address.line2 && <><br />{address.line2}</>}<br />{address.city}, {address.state} {address.postalCode}<br />{address.country}</p><p className="mt-2 text-xs text-slate-400">{address.phone}</p><button onClick={() => removeAddress(address.id)} className="mt-4 flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-rose-500"><Trash2 className="size-3.5" /> Remove</button></article>)}</div> : !adding && <div className="surface p-10 text-center"><MapPin className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm font-bold">No saved addresses</p></div>}</section><aside className={`surface p-5 sm:p-6 ${adding ? "block" : "hidden lg:block"}`}><div className="flex items-center justify-between"><div><h2 className="font-black">New shipping address</h2><p className="mt-1 text-xs text-slate-400">Required fields are marked below.</p></div>{adding && <button onClick={() => setAdding(false)} className="icon-button lg:hidden"><X className="size-4" /></button>}</div><form onSubmit={addAddress} className="mt-5 space-y-4"><div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 block text-[10px] font-bold">Label *</span><input required name="label" className="field" placeholder="Home" /></label><label><span className="mb-1.5 block text-[10px] font-bold">Full name *</span><input required name="fullName" className="field" /></label></div><label className="block"><span className="mb-1.5 block text-[10px] font-bold">Phone *</span><input required name="phone" type="tel" className="field" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-bold">Address line 1 *</span><input required name="line1" className="field" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-bold">Address line 2</span><input name="line2" className="field" /></label><div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 block text-[10px] font-bold">City *</span><input required name="city" className="field" /></label><label><span className="mb-1.5 block text-[10px] font-bold">State</span><input name="state" className="field" /></label></div><div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 block text-[10px] font-bold">Postal code *</span><input required name="postalCode" className="field" /></label><label><span className="mb-1.5 block text-[10px] font-bold">Country *</span><input required name="country" className="field" defaultValue="United States" /></label></div><label className="flex items-center gap-2 text-xs font-semibold"><input name="isDefault" type="checkbox" className="accent-orange-500" /> Make this my default address</label>{error && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}<button disabled={saving} className="button-primary w-full bg-orange-500 hover:bg-orange-600">{saving && <LoaderCircle className="size-4 animate-spin" />}{saving ? "Saving…" : "Save address"}</button></form></aside></div>;
}
