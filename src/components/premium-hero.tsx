"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Star, Truck } from "lucide-react";
import type { Product } from "@/lib/types";

export function PremiumHero({ products }: { products: Product[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const product = products[selectedIndex] ?? products[0];

  useEffect(() => {
    if (products.length < 2) return;
    const timer = window.setInterval(() => setSelectedIndex((index) => (index + 1) % products.length), 6500);
    return () => window.clearInterval(timer);
  }, [products.length]);

  function move(direction: number) {
    setSelectedIndex((index) => (index + direction + products.length) % products.length);
  }

  if (!product) {
    return <section className="mx-auto grid min-h-[520px] max-w-[1440px] place-items-center bg-[#f1ede5] px-6 py-20 text-center dark:bg-white/5"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-orange-500">BabulShop</p><h1 className="mt-3 text-4xl font-black tracking-[-.06em]">Good things are on the way.</h1><p className="mt-4 text-sm text-slate-500">Independent sellers are preparing their next collection.</p></div></section>;
  }

  return <section className="overflow-hidden border-b border-slate-200 dark:border-white/10"><div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:px-12 lg:py-20"><div className="max-w-xl"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.2em] text-orange-600"><span className="size-2 rounded-full bg-orange-500" /> Independent marketplace</div><h1 className="mt-6 text-[clamp(3.25rem,6.5vw,6.7rem)] font-black leading-[.88] tracking-[-.075em] text-[#102a2a] dark:text-white">Find things<br /><span className="font-serif font-normal italic text-orange-600">worth keeping.</span></h1><p className="mt-7 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">A considered edit of products from makers and shops with a point of view.</p><div className="mt-8 flex flex-wrap gap-3"><Link href={`/product/${product.slug}`} className="button-primary bg-[#102a2a] hover:bg-orange-500">Shop this edit <ArrowRight className="size-4" /></Link><Link href="/search" className="button-secondary border-[#cfc7b8] bg-transparent">Explore all</Link></div><div className="mt-10 flex flex-wrap items-center gap-5 border-t border-[#d8d0c2] pt-5 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"><span className="flex items-center gap-2"><BadgeCheck className="size-4 text-orange-600" /> Independent sellers</span><span className="flex items-center gap-2"><Truck className="size-4 text-orange-600" /> Tracked delivery</span></div></div><div className="relative min-h-[390px] sm:min-h-[500px]"><Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`} className="absolute inset-0 overflow-hidden rounded-[1.6rem]"><Image key={product.id} src={product.images[0]} alt={product.name} fill priority sizes="(max-width: 1024px) 100vw, 55vw" unoptimized={product.images[0].startsWith("data:")} className="object-cover transition duration-700 hover:scale-[1.02]" /></Link><div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 sm:bottom-8 sm:left-8 sm:right-8"><div className="max-w-[220px] rounded-xl bg-white/95 p-4 shadow-xl backdrop-blur dark:bg-slate-950/90"><p className="text-[10px] font-black uppercase tracking-[.16em] text-orange-600">Now featuring</p><p className="mt-1 line-clamp-2 text-sm font-black text-slate-950 dark:text-white">{product.name}</p><div className="mt-2 flex items-center gap-1 text-xs text-slate-500"><Star className="size-3.5 fill-amber-400 text-amber-400" /><b>{product.rating}</b><span>({product.reviewsCount})</span></div></div>{products.length > 1 && <div className="flex items-center gap-2"><button type="button" onClick={() => move(-1)} className="grid size-10 place-items-center rounded-full border border-white/70 bg-white/90 text-[#102a2a] shadow-lg transition hover:bg-orange-500 hover:text-white" aria-label="Previous featured product"><ArrowLeft className="size-4" /></button><button type="button" onClick={() => move(1)} className="grid size-10 place-items-center rounded-full border border-white/70 bg-white/90 text-[#102a2a] shadow-lg transition hover:bg-orange-500 hover:text-white" aria-label="Next featured product"><ArrowRight className="size-4" /></button></div>}</div>{products.length > 1 && <div className="absolute right-8 top-8 flex gap-1.5">{products.map((item, index) => <button key={item.id} type="button" onClick={() => setSelectedIndex(index)} className={`h-1.5 rounded-full transition-all ${index === selectedIndex ? "w-8 bg-orange-500" : "w-1.5 bg-white/80"}`} aria-label={`Show featured product ${index + 1}`} />)}</div>}</div></div></section>;
}
