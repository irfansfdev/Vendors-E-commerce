"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, Star } from "lucide-react";
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
      <div className="relative aspect-[.86] overflow-hidden rounded-[1.35rem] bg-slate-100 shadow-sm ring-1 ring-slate-200/70 transition duration-300 group-hover:shadow-xl group-hover:shadow-slate-900/10 dark:bg-white/5 dark:ring-white/10">
        <Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`} className="absolute inset-0">
          <Image src={product.images[0]} alt={product.name} fill unoptimized={typeof product.images[0] === "string" && product.images[0].startsWith("data:")} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover transition duration-700 ease-out group-hover:scale-[1.045]" />
        </Link>
        {product.badge && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1.5 text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white">{product.badge}</span>}
        <button type="button" onClick={toggleWishlist} className={`absolute right-3 top-3 grid size-10 translate-y-1 place-items-center rounded-full bg-white/90 text-slate-600 opacity-0 shadow-md backdrop-blur transition duration-300 hover:scale-105 hover:text-rose-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:bg-slate-950/85 dark:text-slate-300 ${liked ? "text-rose-500" : ""}`} aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}><Heart className={`size-[17px] ${liked ? "fill-current" : ""}`} /></button>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
        <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <button type="button" onClick={() => addItem(product, product.variants[0])} disabled={product.stock < 1} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950/95 px-3 text-xs font-black text-white shadow-lg backdrop-blur transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-slate-500" aria-label={`Add ${product.name} to cart`}><ShoppingBag className="size-4" /> {product.stock > 0 ? "Add to cart" : "Out of stock"}</button>
        </div>
      </div>
      <div className="px-1 pt-4">
        <Link href={`/shop/${product.shop.slug}`} className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400 transition hover:text-orange-500">{product.shop.name}</Link>
        <Link href={`/product/${product.slug}`}><h3 className="mt-1.5 truncate text-[15px] font-extrabold tracking-[-.02em] text-slate-900 transition hover:text-orange-500 dark:text-white">{product.name}</h3></Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2"><span className="text-base font-black text-slate-950 dark:text-white">{formatCurrency(product.price, product.currency)}</span>{product.compareAtPrice && <span className="text-xs text-slate-400 line-through">{formatCurrency(product.compareAtPrice, product.currency)}</span>}</div>
          <span className="hidden items-center gap-1 text-[11px] font-bold text-slate-500 sm:flex"><Star className="size-3 fill-amber-400 text-amber-400" />{product.rating.toFixed(1)}</span>
        </div>
      </div>
    </article>
  );
}
