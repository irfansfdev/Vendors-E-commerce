"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Plus, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/providers/providers";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

function readWishlist() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("vendra-wishlist") ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function ProductCard({ product, onDark = false }: { product: Product; onDark?: boolean }) {
  const { addItem } = useCart();
  const [liked, setLiked] = useState(false);
  const discount = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : 0;
  const outOfStock = product.stock < 1;

  useEffect(() => {
    const update = () => setLiked(readWishlist().includes(product.id));
    const initialRead = window.setTimeout(update, 0);
    window.addEventListener("vendra-wishlist-updated", update);
    return () => {
      window.clearTimeout(initialRead);
      window.removeEventListener("vendra-wishlist-updated", update);
    };
  }, [product.id]);

  function toggleWishlist() {
    try {
      const saved = new Set(readWishlist());
      if (saved.has(product.id)) saved.delete(product.id);
      else saved.add(product.id);
      localStorage.setItem("vendra-wishlist", JSON.stringify([...saved]));
      setLiked(saved.has(product.id));
      window.dispatchEvent(new Event("vendra-wishlist-updated"));
      toast.success(saved.has(product.id) ? "Saved to wishlist" : "Removed from wishlist");
    } catch {
      toast.error("Could not update your wishlist. Check your browser storage settings.");
    }
  }

  return (
    <article className={`product-card group min-w-0 ${onDark ? "rounded-xl bg-white p-2 text-slate-950" : ""}`}>
      <div className="product-card-image relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        <Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`} className="absolute inset-0">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            unoptimized={product.images[0].startsWith("data:")}
            sizes="(max-width: 639px) 160px, (max-width: 767px) 30vw, (max-width: 1023px) 23vw, (max-width: 1279px) 18vw, 15vw"
            className={`object-cover transition-transform duration-300 group-hover:scale-[1.03] ${outOfStock ? "opacity-50" : ""}`}
            onError={(event) => { event.currentTarget.style.display = "none"; }}
          />
        </Link>
        {(discount > 0 || product.badge) && (
          <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-semibold leading-none ${discount > 0 ? "bg-orange-500 text-white" : "bg-slate-900/90 text-white"}`}>
            {discount > 0 ? `-${discount}%` : product.badge}
          </span>
        )}
        <button
          type="button"
          onClick={toggleWishlist}
          className={`product-card-wishlist absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-slate-600 transition hover:text-rose-500 focus-visible:opacity-100 ${liked ? "text-rose-500" : ""}`}
          aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`size-4 ${liked ? "fill-current" : ""}`} />
        </button>
        {outOfStock ? (
          <span className="absolute inset-x-2 bottom-2 rounded-lg bg-slate-900/75 px-2 py-2 text-center text-xs font-semibold text-white">
            Out of stock
          </span>
        ) : (
          <div className="product-card-action absolute bottom-2 right-2">
            <button
              type="button"
              onClick={() => addItem(product, product.variants[0])}
              className="grid size-9 place-items-center rounded-full bg-white text-slate-900 transition hover:bg-orange-500 hover:text-white"
              aria-label={`Add ${product.name} to cart`}
            >
              <Plus className="product-card-plus size-4" />
              <span className="product-card-label hidden items-center gap-2"><ShoppingBag className="size-4" /> Add to cart</span>
            </button>
          </div>
        )}
      </div>
      <div className={`pt-2.5 ${onDark ? "px-1 pb-1" : ""}`}>
        <Link href={`/shop/${product.shop.slug}`} className={`block truncate text-[11px] hover:text-orange-600 ${onDark ? "text-slate-500" : "text-slate-500 dark:text-slate-400"}`}>
          {product.shop.name}
        </Link>
        <Link href={`/product/${product.slug}`}>
          <h3 className={`mt-0.5 line-clamp-2 min-h-10 text-sm font-medium leading-5 hover:text-orange-600 ${onDark ? "text-slate-900" : "text-slate-900 dark:text-white"}`}>
            {product.name}
          </h3>
        </Link>
        {product.reviewsCount > 0 && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            <Star className="size-3 fill-orange-500 text-orange-500" />
            <span className={`font-medium ${onDark ? "text-slate-700" : "text-slate-700 dark:text-slate-200"}`}>{product.rating.toFixed(1)}</span>
            <span className="text-slate-500">({product.reviewsCount})</span>
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className={`text-[15px] font-semibold ${onDark ? "text-slate-950" : "text-slate-950 dark:text-white"}`}>{formatCurrency(product.price, product.currency)}</span>
          {discount > 0 && product.compareAtPrice && (
            <span className="text-xs text-slate-500 line-through">{formatCurrency(product.compareAtPrice, product.currency)}</span>
          )}
        </div>
      </div>
    </article>
  );
}
