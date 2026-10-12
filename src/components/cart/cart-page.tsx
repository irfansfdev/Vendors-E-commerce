"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { useCart } from "@/components/providers/providers";
import { OrderPricingSummary } from "@/components/shared/order-pricing-summary";
import { useCartPricing } from "@/lib/pricing/use-cart-pricing";
import { formatCurrency } from "@/lib/utils";

export function CartPageContent() {
  const { lines, itemCount, removeItem, updateQuantity } = useCart();
  const pricingState = useCartPricing(lines);
  const groups = Object.values(lines.reduce<Record<string, typeof lines>>((result, line) => {
    (result[line.product.shop.id] ??= []).push(line);
    return result;
  }, {}));

  if (!lines.length) return <div className="surface mx-auto grid min-h-[460px] max-w-2xl place-items-center p-8 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10"><ShoppingBag className="size-7" /></span><h1 className="mt-6 text-3xl font-black tracking-[-.05em]">Your cart is waiting</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">Fill it with something special from one—or several—independent shops.</p><Link href="/search" className="button-primary mt-7">Explore products <ArrowRight className="size-4" /></Link></div></div>;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        {groups.map((group) => <section key={group[0].product.shop.id} className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3.5 dark:border-white/10 dark:bg-white/[.025]"><Link href={`/shop/${group[0].product.shop.slug}`} className="text-sm font-extrabold hover:text-orange-500">{group[0].product.shop.name}</Link><span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600"><Truck className="size-3.5" /> Ships from seller</span></div>
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {group.map((line) => <div key={line.lineId} className="grid grid-cols-[84px_1fr] gap-4 p-4 sm:grid-cols-[104px_1fr_auto] sm:p-5">
              <Link href={`/product/${line.product.slug}`} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100"><Image src={line.product.images[0]} alt={line.product.name} fill unoptimized={typeof line.product.images[0] === "string" && line.product.images[0].startsWith("data:")} sizes="110px" className="object-cover" /></Link>
              <div className="min-w-0">
                <Link href={`/product/${line.product.slug}`} className="line-clamp-2 text-sm font-extrabold hover:text-orange-500">{line.product.name}</Link>
                {line.variant && <p className="mt-1 text-xs text-slate-400">{line.variant.name}</p>}
                <p className="mt-2 font-black sm:hidden">{formatCurrency(line.variant?.price ?? line.product.price, line.product.currency)}</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-9 items-center rounded-lg border border-slate-200 dark:border-white/10"><button onClick={() => updateQuantity(line.lineId, line.quantity - 1)} className="grid h-full w-8 place-items-center" aria-label={`Decrease ${line.product.name} quantity`}><Minus className="size-3.5" /></button><span className="w-7 text-center text-xs font-bold">{line.quantity}</span><button onClick={() => updateQuantity(line.lineId, line.quantity + 1)} className="grid h-full w-8 place-items-center" aria-label={`Increase ${line.product.name} quantity`}><Plus className="size-3.5" /></button></div>
                  <button onClick={() => removeItem(line.lineId)} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-500"><Trash2 className="size-3.5" /> Remove</button>
                </div>
              </div>
              <div className="hidden text-right sm:block"><p className="font-black">{formatCurrency((line.variant?.price ?? line.product.price) * line.quantity, line.product.currency)}</p><p className="mt-1 text-[10px] text-slate-400">{formatCurrency(line.variant?.price ?? line.product.price)} each</p></div>
            </div>)}
          </div>
        </section>)}
      </div>
      <aside className="surface sticky top-36 p-5 sm:p-6">
        <h2 className="text-lg font-black">Order summary</h2>
        <p className="mt-1 text-xs text-slate-500">{itemCount} items from {groups.length} shops</p>
        <OrderPricingSummary
          pricing={pricingState.pricing}
          couponCode={pricingState.couponCode}
          loading={pricingState.loading}
          loadError={pricingState.loadError}
          couponError={pricingState.couponError}
          onApplyCoupon={pricingState.applyCoupon}
          onRemoveCoupon={pricingState.removeCoupon}
        />
        <Link href="/checkout" aria-disabled={!pricingState.pricing || pricingState.loading || Boolean(pricingState.loadError)} className={`button-primary mt-6 w-full bg-orange-500 hover:bg-orange-600 ${!pricingState.pricing || pricingState.loading || pricingState.loadError ? "pointer-events-none opacity-50" : ""}`}>Secure checkout <ArrowRight className="size-4" /></Link>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-400"><ShieldCheck className="size-3.5 text-emerald-500" /> Payments are encrypted and protected</p>
      </aside>
    </div>
  );
}
