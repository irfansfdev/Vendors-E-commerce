import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CouponForm } from "@/components/shared/coupon-form";
import { CouponRowActions } from "@/components/shared/coupon-row-actions";
import { UrlPagination } from "@/components/ui/pagination";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { getCouponStatus } from "@/lib/pricing/coupon-status";
import { formatCurrency } from "@/lib/utils";
import { createPlatformCouponAction } from "@/app/admin/coupons/actions";

export const metadata: Metadata = { title: "Coupons | BabulShop Admin" };
export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;

export default async function AdminCouponsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const params = await searchParams;
  const pagination = parsePagination(params);
  const [{ data: couponData, error: couponError }, redemptionResult] = await Promise.all([
    supabase.from("coupons").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("coupon_redemptions").select("id,coupon_id,user_id,order_id,discount_amount,status,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(pagination.from, pagination.to),
  ]);
  if (couponError) return <div className="p-6 text-sm text-rose-600">Could not load coupons: {couponError.message}</div>;
  if (redemptionResult.error) return <div className="p-6 text-sm text-rose-600">Could not load coupon redemptions: {redemptionResult.error.message}</div>;
  const coupons = (couponData ?? []) as Row[];
  const redemptions = (redemptionResult.data ?? []) as Row[];
  const couponById = new Map(coupons.map((coupon) => [String(coupon.id), coupon]));
  const shopIds = [...new Set(coupons.map((coupon) => String(coupon.shop_id ?? "")).filter(Boolean))];
  const { data: shopRows, error: shopsError } = shopIds.length ? await supabase.from("shops").select("id,name").in("id", shopIds) : { data: [], error: null };
  if (shopsError) return <div className="p-6 text-sm text-rose-600">Could not load coupon shop names: {shopsError.message}</div>;
  const shopById = new Map(((shopRows ?? []) as Row[]).map((shop) => [String(shop.id), String(shop.name ?? "Shop")]));
  const meta = buildPaginationMeta(redemptionResult.count ?? 0, pagination.page, pagination.pageSize);

  return (
    <div className="mx-auto max-w-[1440px] p-5 sm:p-8 lg:p-10">
      <Link href="/admin" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ArrowLeft className="size-4" /> Overview</Link>
      <header className="mb-7 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Promotions</p><h1 className="page-title mt-2">Coupon management</h1><p className="mt-2 text-sm text-slate-500">Create platform-funded offers, moderate shop coupons, and review redemption history.</p></header>
      {params.error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{String(params.error)}</p>}
      {params.saved && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Coupon changes saved.</p>}
      <CouponForm action={createPlatformCouponAction} title="Create platform coupon" submitLabel="Create platform coupon" />
      <section className="surface mt-7 overflow-hidden">
        <div className="border-b border-slate-100 p-5 dark:border-white/10"><h2 className="text-lg font-black">All shop and platform coupons</h2><p className="mt-1 text-xs text-slate-500">Platform coupons are funded by BabulShop. Shop coupons only apply to their shop.</p></div>
        {coupons.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No coupons found.</p> : <div className="overflow-x-auto"><table className="data-table min-w-[850px]"><thead><tr><th>Code</th><th>Owner</th><th>Type / value</th><th>Minimum</th><th>Dates</th><th>Status</th><th className="text-right">Actions</th></tr></thead><tbody>{coupons.map((coupon) => {
          const id = String(coupon.id);
          const type = String(coupon.discount_type ?? "");
          const discount = type === "percentage" || type === "percent" ? `${Number(coupon.discount_value)}%` : type === "free_delivery" ? "Free delivery" : formatCurrency(Number(coupon.discount_value ?? 0));
          const state = getCouponStatus(coupon);
          return <tr key={id}><td className="font-black tracking-wide">{String(coupon.code)}</td><td>{coupon.scope === "platform" || !coupon.shop_id ? <span className="font-semibold text-violet-600">BabulShop</span> : shopById.get(String(coupon.shop_id)) ?? "Shop"}</td><td>{discount}</td><td>{formatCurrency(Number(coupon.min_order_value ?? 0))}</td><td className="text-xs">{coupon.start_date ? new Date(String(coupon.start_date)).toLocaleDateString() : "Now"} – {coupon.end_date ? new Date(String(coupon.end_date)).toLocaleDateString() : "No end"}</td><td><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${state === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>{state}</span></td><td className="text-right"><CouponRowActions id={id} code={String(coupon.code)} active={coupon.is_active === true} isSeller={false} /></td></tr>;
        })}</tbody></table></div>}
      </section>
      <section data-pagination-list className="surface mt-7 overflow-hidden">
        <div className="border-b border-slate-100 p-5 dark:border-white/10"><h2 className="text-lg font-black">Coupon redemptions</h2><p className="mt-1 text-xs text-slate-500">{redemptionResult.count ?? 0} recorded redemptions</p></div>
        {redemptions.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No redemptions yet.</p> : <div className="overflow-x-auto"><table className="data-table min-w-[850px]"><thead><tr><th>Coupon</th><th>Customer</th><th>Order</th><th>Discount</th><th>Status</th><th>Date</th></tr></thead><tbody>{redemptions.map((redemption) => {
          const coupon = couponById.get(String(redemption.coupon_id));
          const shopName = coupon?.shop_id ? ` · ${shopById.get(String(coupon.shop_id)) ?? "Shop"}` : "";
          return <tr key={String(redemption.id)}><td><b>{String(coupon?.code ?? "Deleted coupon")}</b><p className="mt-1 text-xs text-slate-500">{coupon?.scope === "platform" || !coupon?.shop_id ? "Platform" : `${shopName.slice(3)}`}</p></td><td className="font-mono text-xs">{String(redemption.user_id)}</td><td className="font-mono text-xs">{redemption.order_id ? String(redemption.order_id) : "—"}</td><td className="font-semibold">{formatCurrency(Number(redemption.discount_amount ?? 0))}</td><td><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${redemption.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{String(redemption.status)}</span></td><td>{redemption.created_at ? new Date(String(redemption.created_at)).toLocaleString() : "—"}</td></tr>;
        })}</tbody></table></div>}
        <div className="px-5 pb-4"><UrlPagination total={redemptionResult.count ?? 0} /></div>
      </section>
    </div>
  );
}
