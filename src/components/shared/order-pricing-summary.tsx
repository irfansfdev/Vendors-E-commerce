"use client";

import { LoaderCircle, X } from "lucide-react";
import type { CartPricing } from "@/lib/pricing/types";
import { formatCurrency } from "@/lib/utils";

type Props = {
  pricing: CartPricing | null;
  couponCode: string;
  loading: boolean;
  loadError: string;
  couponError: string;
  readOnly?: boolean;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
};

export function OrderPricingSummary({
  pricing,
  couponCode,
  loading,
  loadError,
  couponError,
  readOnly = false,
  onApplyCoupon,
  onRemoveCoupon,
}: Props) {
  const appliedCode = pricing?.applied_coupon?.code ?? "";

  return (
    <>
      <div className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10">
        <p className="text-xs font-bold">Have a coupon?</p>
        {appliedCode ? (
          <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <span className="font-black text-emerald-700 dark:text-emerald-300">{appliedCode} applied</span>
            {!readOnly && <button type="button" onClick={onRemoveCoupon} disabled={loading} aria-label="Remove coupon" className="text-emerald-700 hover:text-rose-600 disabled:opacity-50 dark:text-emerald-300"><X className="size-4" /></button>}
          </div>
        ) : readOnly ? null : (
          <form className="mt-2 flex gap-2" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onApplyCoupon(String(form.get("coupon_code") ?? ""));
          }}>
            <input
              className="field min-w-0"
              name="coupon_code"
              defaultValue={couponCode}
              placeholder="Coupon code"
              autoComplete="off"
              aria-label="Coupon code"
            />
            <button type="submit" className="button-secondary shrink-0" disabled={loading}>
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : "Apply"}
            </button>
          </form>
        )}
        {couponError && <p role="status" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">{couponError}</p>}
        {!couponError && appliedCode && <p role="status" className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Coupon discount is included below.</p>}
      </div>

      <div className="my-5 h-px bg-slate-200 dark:bg-white/10" />
      {loadError ? (
        <p role="alert" className="text-sm font-semibold text-rose-600">{loadError}</p>
      ) : loading || !pricing ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Calculating live order total…</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><b className="text-slate-950 dark:text-white">{formatCurrency(pricing.subtotal)}</b></div>
          {pricing.discount_amount > 0 && <div className="flex justify-between text-emerald-700 dark:text-emerald-300"><span>Coupon discount</span><b>− {formatCurrency(pricing.discount_amount)}</b></div>}
          <details>
            <summary className="flex cursor-pointer list-none justify-between text-slate-500"><span>Delivery ({pricing.shops.length} shops)</span><b className="text-slate-950 dark:text-white">{pricing.delivery_fee ? formatCurrency(pricing.delivery_fee) : "Free"}</b></summary>
            <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3 text-xs dark:border-white/10">
              {pricing.shops.map((shop) => (
                <div key={shop.shop_id}>
                  <p className="flex justify-between gap-3"><span>{shop.shop_name || `Shop ${shop.shop_id.slice(0, 8)}`}</span><b>{shop.delivery_fee ? formatCurrency(shop.delivery_fee) : "Free"}</b></p>
                  {shop.free_delivery_remaining > 0 && <p className="mt-1 text-slate-400">Add {formatCurrency(shop.free_delivery_remaining)} more for free delivery from this shop.</p>}
                </div>
              ))}
            </div>
          </details>
          {pricing.delivery_discount > 0 && <div className="flex justify-between text-emerald-700 dark:text-emerald-300"><span>Free-delivery coupon</span><b>− {formatCurrency(pricing.delivery_discount)}</b></div>}
          <div className="flex justify-between border-t border-slate-200 pt-3 text-base dark:border-white/10"><b>Total payable on delivery</b><b className="text-xl">{formatCurrency(pricing.payable_total)}</b></div>
        </div>
      )}
    </>
  );
}
