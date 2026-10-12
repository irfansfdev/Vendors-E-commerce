import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { savePricingSettingsAction } from "@/app/admin/settings/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pricing settings | BabulShop Admin" };
export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;

function settingNumber(settings: Map<string, Row>, key: string, fallback: number) {
  const raw = settings.get(key)?.value;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : fallback;
}

export default async function AdminPricingSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("key,value,updated_at").in("key", ["pricing.delivery_base_fee", "pricing.free_delivery_threshold", "pricing.shop_coupon_max_percent"]);
  const params = await searchParams;
  if (error) return <div className="p-6 text-sm text-rose-600">Could not load pricing settings: {error.message}. Apply the pricing settings access migration if this table is not yet available.</div>;
  const settings = new Map(((data ?? []) as Row[]).map((item) => [String(item.key), item]));
  const deliveryFee = settingNumber(settings, "pricing.delivery_base_fee", 200);
  const freeThreshold = settingNumber(settings, "pricing.free_delivery_threshold", 3000);
  const maxPercent = settingNumber(settings, "pricing.shop_coupon_max_percent", 50);
  const updatedAt = [...settings.values()].map((setting) => setting.updated_at).filter(Boolean).sort().at(-1);

  return <div className="mx-auto max-w-[1000px] p-5 sm:p-8 lg:p-10">
    <Link href="/admin" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ArrowLeft className="size-4" /> Overview</Link>
    <header className="mb-7 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Platform controls</p><h1 className="page-title mt-2">Pricing settings</h1><p className="mt-2 text-sm text-slate-500">These server-side values control delivery pricing and shop coupon limits.</p></header>
    {params.error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{params.error}</p>}
    {params.saved && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Pricing settings saved.</p>}
    <form action={savePricingSettingsAction} className="surface space-y-6 p-5 sm:p-7">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5 dark:border-white/10"><span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Settings2 className="size-5" /></span><div><h2 className="font-black">Checkout pricing defaults</h2><p className="mt-1 text-xs text-slate-500">Delivery is calculated independently for each shop order.</p></div></div>
      <label className="block"><span className="mb-2 block text-sm font-bold">Base delivery fee (PKR)</span><input className="field max-w-sm" name="delivery_base_fee" type="number" min="0" step="0.01" required defaultValue={deliveryFee} /><span className="mt-1 block text-xs text-slate-500">Charged once per shop below the free-delivery threshold.</span></label>
      <label className="block"><span className="mb-2 block text-sm font-bold">Free delivery threshold (PKR)</span><input className="field max-w-sm" name="free_delivery_threshold" type="number" min="0" step="0.01" required defaultValue={freeThreshold} /><span className="mt-1 block text-xs text-slate-500">Based on each shop’s item subtotal before coupon discount.</span></label>
      <label className="block"><span className="mb-2 block text-sm font-bold">Maximum shop coupon discount (%)</span><input className="field max-w-sm" name="shop_coupon_max_percent" type="number" min="0" max="100" step="0.01" required defaultValue={maxPercent} /><span className="mt-1 block text-xs text-slate-500">This cap is for seller-funded percentage coupons only.</span></label>
      {updatedAt != null && <p className="text-xs text-slate-400">Last updated {new Date(String(updatedAt)).toLocaleString()}</p>}
      <div className="flex justify-end"><button className="button-primary bg-orange-500 hover:bg-orange-600">Save pricing settings</button></div>
    </form>
  </div>;
}
