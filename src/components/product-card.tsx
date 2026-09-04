"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/providers";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [liked, setLiked] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = JSON.parse(localStorage.getItem("vendra-wishlist") ?? "[]") as string[];
    return saved.includes(product.id);
  });

  function toggleWishlist() {
    const saved = new Set(JSON.parse(localStorage.getItem("vendra-wishlist") ?? "[]") as string[]);
    if (saved.has(product.id)) saved.delete(product.id); else saved.add(product.id);
    localStorage.setItem("vendra-wishlist", JSON.stringify([...saved]));
    setLiked(saved.has(product.id));
    window.dispatchEvent(new Event("vendra-wishlist-updated"));
    toast.success(saved.has(product.id) ? "Saved to wishlist" : "Removed from wishlist");
  }

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[.88] overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/5">
        <Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`} className="absolute inset-0">
          <Image src={product.images[0]} alt={product.name} fill unoptimized={typeof product.images[0] === "string" && product.images[0].startsWith("data:")} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover transition duration-500 group-hover:scale-[1.045]" />
        </Link>
        {product.badge && <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2 py-1 text-[9px] font-extrabold tracking-[.08em] text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white">{product.badge}</span>}
        <button onClick={toggleWishlist} className={`absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105 ${liked ? "text-rose-500" : "text-slate-600"}`} aria-label="Toggle wishlist"><Heart className={`size-[17px] ${liked ? "fill-current" : ""}`} /></button>
        <button onClick={() => addItem(product, product.variants[0])} disabled={product.stock < 1} className="absolute bottom-3 right-3 grid size-10 translate-y-2 place-items-center rounded-full bg-slate-950 text-white opacity-0 shadow-lg transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-slate-400 group-hover:translate-y-0 group-hover:opacity-100 sm:size-11" aria-label="Quick add to cart"><Plus className="size-5" /></button>
      </div>
      <div className="pt-3">
        <Link href={`/shop/${product.shop.slug}`} className="text-[11px] font-semibold uppercase tracking-[.1em] text-slate-400 hover:text-orange-500">{product.shop.name}</Link>
        <Link href={`/product/${product.slug}`}><h3 className="mt-1 truncate text-sm font-bold tracking-[-.01em] text-slate-900 transition hover:text-orange-500 dark:text-white sm:text-[15px]">{product.name}</h3></Link>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2"><span className="text-sm font-extrabold text-slate-950 dark:text-white sm:text-base">{formatCurrency(product.price, product.currency)}</span>{product.compareAtPrice && <span className="text-xs text-slate-400 line-through">{formatCurrency(product.compareAtPrice, product.currency)}</span>}</div>
          <span className="hidden items-center gap-1 text-xs font-semibold text-slate-500 sm:flex"><Star className="size-3 fill-amber-400 text-amber-400" />{product.rating.toFixed(1)}</span>
        </div>
      </div>
    </article>
  );
}
