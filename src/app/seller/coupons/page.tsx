import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, TicketPercent } from "lucide-react";
import { CouponForm } from "@/components/shared/coupon-form";
import { CouponRowActions } from "@/components/shared/coupon-row-actions";
import { UrlPagination } from "@/components/ui/pagination";
import { saveSellerCouponAction } from "@/app/seller/coupons/actions";
import { getSellerContext } from "@/lib/seller";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { getCouponStatus } from "@/lib/pricing/coupon-status";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Coupons | Seller" };
export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;
type CouponStatus = "all" | "active" | "scheduled" | "expired" | "paused";
const tabs: CouponStatus[] = ["all", "active", "scheduled", "expired", "paused"];

function dateLabel(value: unknown) {
  return value ? new Date(String(value)).toLocaleDateString() : "No end date";
}

export default async function SellerCouponsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, shop } = await getSellerContext();
  const params = await searchParams;
  const status = String(params.status ?? "all") as CouponStatus;
  const selectedStatus: CouponStatus = tabs.includes(status) ? status : "all";
  const editId = String(params.edit ?? "");
  const { data, error } = await supabase.from("coupons").select("*").eq("shop_id", String(shop.id)).order("created_at", { ascending: false }).limit(500);
  if (error) return <section className="surface p-6 text-sm text-rose-600">Could not load coupons: {error.message}</section>;
  const coupons = (data ?? []) as Row[];
  const selectedCoupon = editId ? coupons.find((coupon) => String(coupon.id) === editId) ?? null : null;
  const filtered = selectedStatus === "all" ? coupons : coupons.filter((coupon) => getCouponStatus(coupon) === selectedStatus);
  const couponIds = coupons.map((coupon) => String(coupon.id));
  const { data: redemptionRows, error: redemptionError } = couponIds.length
    ? await supabase.from("coupon_redemptions").select("coupon_id,status").in("coupon_id", couponIds)
    : { data: [], error: null };
  if (redemptionError) return <section className="surface p-6 text-sm text-rose-600">Could not load coupon usage: {redemptionError.message}</section>;
  const usedByCoupon = new Map<string, number>();
  for (const redemption of (redemptionRows ?? []) as Row[]) {
    if (redemption.status === "active") {
      const id = String(redemption.coupon_id);
      usedByCoupon.set(id, (usedByCoupon.get(id) ?? 0) + 1);
    }
  }
  const pagination = parsePagination(params);
  const meta = buildPaginationMeta(filtered.length, pagination.page, pagination.pageSize);
  const visible = filtered.slice(meta.from, meta.to + 1);
  const pageError = params.error ? String(params.error) : "";

  return (
    <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ArrowLeft className="size-4" /> Dashboard</Link>
      <header className="mb-7 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Shop promotions</p><h1 className="page-title mt-2">Coupons</h1><p className="mt-2 text-sm text-slate-500">Create discounts for customers shopping in {String(shop.name ?? "your shop")}.</p></header>
      {pageError && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{pageError}</p>}
      {params.saved && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Coupon changes saved.</p>}
      <CouponForm action={saveSellerCouponAction} coupon={selectedCoupon} title={selectedCoupon ? "Edit shop coupon" : "Create shop coupon"} submitLabel={selectedCoupon ? "Save coupon" : "Create coupon"} />
      {selectedCoupon && <Link href="/seller/coupons" className="mt-3 inline-block text-xs font-bold text-slate-500 hover:text-orange-500">Cancel editing</Link>}

      <section className="surface mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-white/10"><div><h2 className="text-lg font-black">Your coupons</h2><p className="mt-1 text-xs text-slate-500">Shop coupons apply only to products from your shop.</p></div><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600">{coupons.length} total</span></div>
        <nav aria-label="Coupon status" className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3 dark:border-white/10">
          {tabs.map((tab) => <Link key={tab} href={`/seller/coupons?status=${tab}`} aria-current={selectedStatus === tab ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold capitalize ${selectedStatus === tab ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"}`}>{tab === "all" ? "All first" : tab}</Link>)}
        </nav>
        {visible.length === 0 ? <div className="p-10 text-center"><TicketPercent className="mx-auto size-9 text-slate-300" /><p className="mt-3 font-bold">No coupons in this view</p><p className="mt-1 text-sm text-slate-500">Create a coupon above to offer a shop discount.</p></div> : <div className="overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>Code</th><th>Type / value</th><th>Minimum order</th><th>Dates</th><th>Used</th><th>Status</th><th className="text-right">Actions</th></tr></thead><tbody>{visible.map((coupon) => {
          const id = String(coupon.id);
          const state = getCouponStatus(coupon);
          const type = String(coupon.discount_type ?? "");
          const discount = type === "percentage" || type === "percent" ? `${Number(coupon.discount_value)}%` : type === "free_delivery" ? "Free delivery" : formatCurrency(Number(coupon.discount_value ?? 0));
          return <tr key={id}><td><p className="font-black tracking-wide">{String(coupon.code)}</p><p className="mt-1 text-[10px] text-slate-400">Shop-funded discount</p></td><td className="font-semibold">{discount}</td><td>{formatCurrency(Number(coupon.min_order_value ?? 0))}</td><td><p>From {dateLabel(coupon.start_date)}</p><p className="mt-1 text-xs text-slate-500">Until {dateLabel(coupon.end_date)}</p></td><td>{usedByCoupon.get(id) ?? 0}{coupon.usage_limit_total != null ? ` / ${String(coupon.usage_limit_total)}` : ""}</td><td><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${state === "active" ? "bg-emerald-50 text-emerald-700" : state === "scheduled" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>{state}</span></td><td className="text-right"><CouponRowActions id={id} code={String(coupon.code)} active={coupon.is_active === true} isSeller /></td></tr>;
        })}</tbody></table></div>}
        <div className="px-5 pb-4"><UrlPagination total={filtered.length} /></div>
      </section>
    </main>
  );
}
