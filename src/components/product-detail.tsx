"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Check, ChevronDown, Heart, Minus, PackageCheck, Plus, RotateCcw, ShieldCheck, ShoppingBag, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/providers";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [image, setImage] = useState(product.images[0]);
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [saved, setSaved] = useState(false);
  const variant = useMemo(() => product.variants.find((item) => item.id === variantId) ?? product.variants[0], [product.variants, variantId]);
  const stock = variant?.stock ?? product.stock;
  const price = variant?.price ?? product.price;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] xl:gap-14">
      <div className="grid gap-3 sm:grid-cols-[76px_1fr]">
        <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col">{product.images.map((item, index) => <button key={item} onClick={() => setImage(item)} className={`relative aspect-square w-[68px] shrink-0 overflow-hidden rounded-xl border-2 transition sm:w-full ${image === item ? "border-orange-500" : "border-transparent"}`}><Image src={item} alt={`${product.name} view ${index + 1}`} fill unoptimized={typeof item === "string" && item.startsWith("data:")} sizes="80px" className="object-cover" /></button>)}</div>
        <div className="relative order-1 aspect-square overflow-hidden rounded-3xl bg-slate-100 sm:order-2 dark:bg-white/5"><Image src={image} alt={product.name} fill priority unoptimized={typeof image === "string" && image.startsWith("data:")} sizes="(max-width: 1024px) 100vw, 52vw" className="object-cover" />{product.badge && <span className="absolute left-4 top-4 rounded-lg bg-white px-3 py-2 text-[10px] font-black tracking-[.1em] text-slate-950 shadow-md">{product.badge}</span>}</div>
      </div>
      <div className="lg:py-3">
        <Link href={`/shop/${product.shop.slug}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-orange-500">Sold by {product.shop.name}<BadgeCheck className="size-4 fill-sky-500 text-white" /></Link>
        <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-.05em] sm:text-4xl xl:text-[2.8rem]">{product.name}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs"><span className="flex items-center gap-1 font-bold"><Star className="size-4 fill-amber-400 text-amber-400" /> {product.rating}</span><a href="#reviews" className="text-slate-500 underline-offset-2 hover:underline">{product.reviewsCount} verified reviews</a><span className="h-3 w-px bg-slate-200 dark:bg-white/10" /><span className={stock > 0 ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{stock > 0 ? `${stock} in stock` : "Out of stock"}</span></div>
        <div className="mt-6 flex items-baseline gap-3"><span className="text-3xl font-black">{formatCurrency(price, product.currency)}</span>{product.compareAtPrice && <span className="text-base text-slate-400 line-through">{formatCurrency(product.compareAtPrice, product.currency)}</span>}</div>
        <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-300">{product.description}</p>

        {product.variants.length > 1 && <fieldset className="mt-7"><div className="flex items-center justify-between"><legend className="text-sm font-extrabold">Choose an option</legend><button className="text-xs text-slate-500 underline underline-offset-4">Size guide</button></div><div className="mt-3 flex flex-wrap gap-2">{product.variants.map((item) => <button key={item.id} onClick={() => { setVariantId(item.id); setQuantity(1); }} disabled={item.stock < 1} className={`relative rounded-xl border px-4 py-3 text-xs font-bold transition ${variantId === item.id ? "border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-500/10 dark:bg-orange-500/10 dark:text-orange-300" : "border-slate-200 bg-white hover:border-slate-400 dark:border-white/10 dark:bg-white/5"} disabled:opacity-40`}>{item.name}{variantId === item.id && <Check className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-orange-500 p-0.5 text-white" />}</button>)}</div></fieldset>}

        <div className="mt-7 flex gap-3"><div className="flex h-12 items-center rounded-xl border border-slate-200 dark:border-white/10"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid h-full w-10 place-items-center" aria-label="Decrease quantity"><Minus className="size-4" /></button><span className="w-8 text-center text-sm font-bold">{quantity}</span><button onClick={() => setQuantity((value) => Math.min(stock, value + 1))} className="grid h-full w-10 place-items-center" aria-label="Increase quantity"><Plus className="size-4" /></button></div><button onClick={() => addItem(product, variant, quantity)} disabled={stock < 1} className="button-primary flex-1 bg-orange-500 hover:bg-orange-600"><ShoppingBag className="size-[18px]" /> Add to cart</button><button onClick={() => { setSaved((value) => !value); toast.success(saved ? "Removed from wishlist" : "Saved to wishlist"); }} className={`icon-button h-12 w-12 border border-slate-200 dark:border-white/10 ${saved ? "text-rose-500" : ""}`} aria-label="Save to wishlist"><Heart className={`size-5 ${saved ? "fill-current" : ""}`} /></button></div>

        <div className="mt-7 grid gap-3 rounded-2xl bg-slate-100 p-4 text-xs dark:bg-white/5 sm:grid-cols-3">{[{ icon: Truck, title: "Free delivery", text: "Orders over Rs 5,000" }, { icon: RotateCcw, title: "Easy returns", text: "Within 30 days" }, { icon: ShieldCheck, title: "Buyer protection", text: "Secure checkout" }].map(({ icon: Icon, title, text }) => <div className="flex items-center gap-2.5" key={title}><Icon className="size-5 shrink-0 text-orange-500" /><span><b className="block">{title}</b><small className="text-slate-500">{text}</small></span></div>)}</div>
        <details className="mt-6 border-t border-slate-200 py-4 dark:border-white/10" open><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-extrabold">Product details <ChevronDown className="size-4" /></summary><ul className="mt-3 space-y-2 text-sm text-slate-500"><li className="flex items-center gap-2"><PackageCheck className="size-4 text-emerald-500" /> Ships directly from {product.shop.name}</li><li>SKU: {variant?.sku}</li><li>Category: {product.category.name}</li></ul></details>
      </div>
    </div>
  );
}
