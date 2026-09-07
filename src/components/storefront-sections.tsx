"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Clock3, RotateCcw, ShieldCheck, Star, Truck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { Category, Product, Shop } from "@/lib/types";
import { initials } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, href = "/search", linkLabel = "View all" }: { eyebrow?: string; title: string; href?: string; linkLabel?: string }) {
  return <div className="mb-6 flex items-end justify-between gap-4"><div>{eyebrow && <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-orange-500">{eyebrow}</p>}<h2 className="text-2xl font-extrabold tracking-[-.045em] text-slate-950 dark:text-white sm:text-3xl">{title}</h2></div><Link href={href} className="group flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-orange-500 dark:text-slate-300 sm:text-sm">{linkLabel}<ArrowRight className="size-4 transition group-hover:translate-x-1" /></Link></div>;
}

export function Hero({ products }: { products: Product[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const product = products[selectedIndex] ?? products[0];

  useEffect(() => {
    if (products.length < 2) return;
    const timer = window.setInterval(() => {
      setSelectedIndex((index) => (index + 1) % products.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [products.length]);

  function selectProduct(index: number) {
    setSelectedIndex((index + products.length) % products.length);
  }

  return (
    <section className="relative overflow-hidden bg-[#102a2a] text-white">
      <div className="absolute -left-32 -top-44 size-[420px] rounded-full bg-orange-400/20 blur-3xl" />
      <div className="absolute bottom-[-35%] right-[25%] size-[420px] rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="grid min-h-[510px] items-center md:grid-cols-[1.05fr_.95fr] lg:min-h-[560px]">
        <div className="relative z-10 px-7 py-12 sm:px-12 lg:px-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.15em] text-orange-200 backdrop-blur"> Curated marketplace</span>
          <h1 className="mt-6 max-w-2xl text-[clamp(2.65rem,7vw,5.1rem)] font-black leading-[.94] tracking-[-.065em]">Good finds.<br /><span className="font-serif font-normal italic text-orange-300">Great stories.</span></h1>
          <p className="mt-6 max-w-lg text-sm leading-6 text-slate-200 sm:text-base sm:leading-7">Discover thoughtful products from independent makers and trusted shops—all in one beautifully simple marketplace.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/search" className="button-primary bg-orange-500 hover:bg-orange-600">Explore the marketplace <ArrowRight className="size-4" /></Link><Link href="/seller" className="button-secondary border-white/20 bg-white/10 text-white hover:bg-white/15">Start selling</Link></div>
          <div className="mt-9 flex items-center gap-5 text-[11px] font-semibold text-slate-300 sm:gap-8 sm:text-xs"><span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-emerald-300" /> Buyer protection</span><span className="flex items-center gap-1.5"><Truck className="size-4 text-emerald-300" /> Tracked delivery</span></div>
        </div>
        <div className="relative h-[380px] min-h-[380px] md:h-full md:min-h-[510px]">
          {products.length > 1 && <div className="absolute right-5 top-5 z-10 flex gap-1.5 lg:right-8">
            <button type="button" onClick={() => selectProduct(selectedIndex - 1)} className="grid size-9 place-items-center rounded-full border border-white/25 bg-slate-950/35 text-white backdrop-blur transition hover:border-orange-300 hover:bg-orange-500" aria-label="Previous featured product"><ArrowLeft className="size-4" /></button>
            <button type="button" onClick={() => selectProduct(selectedIndex + 1)} className="grid size-9 place-items-center rounded-full border border-white/25 bg-slate-950/35 text-white backdrop-blur transition hover:border-orange-300 hover:bg-orange-500" aria-label="Next featured product"><ArrowRight className="size-4" /></button>
          </div>}
          <div className="absolute inset-x-8 bottom-0 top-8 overflow-hidden rounded-t-[12rem] bg-[#d9b98b]">
            {product ? <Image src={product.images[0]} alt={product.name} fill priority unoptimized={typeof product.images[0] === "string" && product.images[0].startsWith("data:")} sizes="50vw" className="object-cover" /> : <div className="size-full bg-orange-100" />}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-white/5" />
          </div>
          <div className="absolute bottom-8 left-5 right-5 rounded-2xl border border-white/20 bg-white/95 p-4 text-slate-950 shadow-2xl backdrop-blur dark:bg-slate-900/95 dark:text-white lg:bottom-10 lg:left-0 lg:right-auto">
            {product && <><p className="text-[10px] font-bold uppercase tracking-[.15em] text-orange-500">Featured product</p><p className="mt-1 max-w-[150px] text-sm font-extrabold">{product.name}</p><div className="mt-2 flex items-center gap-1 text-xs"><Star className="size-3.5 fill-amber-400 text-amber-400" /> <b>{product.rating}</b><span className="text-slate-400">({product.reviewsCount})</span></div></>}
          </div>
          {products.length > 1 && <div className="absolute bottom-5 left-5 right-5 flex max-w-[calc(100%-2.5rem)] gap-2 lg:bottom-10 lg:left-auto lg:right-8">
            {products.map((item, index) => <Link key={item.id} href={`/product/${item.slug}`} onMouseEnter={() => setSelectedIndex(index)} onFocus={() => setSelectedIndex(index)} className={`group flex w-24 items-center gap-2 rounded-xl border p-1.5 text-left backdrop-blur transition sm:w-32 ${index === selectedIndex ? "border-orange-300 bg-white text-slate-950" : "border-white/25 bg-slate-950/35 text-white hover:border-orange-300"}`} aria-label={`View ${item.name}`}>
              <Image src={item.images[0]} alt="" width={42} height={42} unoptimized={typeof item.images[0] === "string" && item.images[0].startsWith("data:")} className="size-10 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0"><span className="block truncate text-[10px] font-extrabold sm:text-xs">{item.name}</span><span className="mt-0.5 block text-[10px] opacity-70">View product</span></span>
            </Link>)}
          </div>}
        </div>
      </div>
    </section>
  );
}

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:gap-5">{categories.slice(0, 6).map((category) => <Link key={category.id} href={`/search?category=${category.slug}`} className="group text-center"><div className="relative mx-auto aspect-square overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70 transition duration-300 group-hover:-translate-y-1 group-hover:ring-orange-300 dark:bg-white/5 dark:ring-white/10"><Image src={category.imageUrl} alt="" fill unoptimized={typeof category.imageUrl === "string" && category.imageUrl.startsWith("data:")} sizes="160px" className="object-cover transition duration-500 group-hover:scale-105" /></div><h3 className="mt-3 text-xs font-bold sm:text-sm">{category.name}</h3><p className="mt-0.5 hidden text-[11px] text-slate-400 sm:block">{category.productCount} {category.productCount === 1 ? "product" : "products"}</p></Link>)}</div>;
}

export function ProductGrid({ products }: { products: Product[] }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}

export function ShopGrid({ shops }: { shops: Shop[] }) {
  const colors = ["bg-[#e6efe7] text-[#2d5a3e]", "bg-[#f5e9db] text-[#8a542d]", "bg-[#e7e8f5] text-[#4d508f]", "bg-[#f4e5e9] text-[#8d465b]"];
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{shops.slice(0, 4).map((shop, index) => <Link href={`/shop/${shop.slug}`} key={shop.id} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-slate-200/50 dark:border-white/10 dark:bg-white/[.035] dark:hover:border-orange-500/30 dark:hover:shadow-none"><div className={`grid size-12 place-items-center rounded-xl text-sm font-black ${colors[index % colors.length]}`}>{shop.logoUrl ? <Image src={shop.logoUrl} alt="" width={48} height={48} unoptimized={typeof shop.logoUrl === "string" && shop.logoUrl.startsWith("data:")} className="size-12 rounded-xl object-cover" /> : initials(shop.name)}</div><div className="mt-4 flex items-center gap-1.5"><h3 className="font-extrabold">{shop.name}</h3>{shop.verified && <BadgeCheck className="size-4 fill-sky-500 text-white" />}</div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{shop.description}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs dark:border-white/10"><span className="flex items-center gap-1 font-bold"><Star className="size-3.5 fill-amber-400 text-amber-400" />{shop.rating}</span><span className="text-slate-400">{shop.productCount} {shop.productCount === 1 ? "product" : "products"}</span></div></Link>)}</div>;
}

export function Benefits() {
  const items = [{ icon: Truck, title: "Free shipping", text: "On orders over Rs 5,000" }, { icon: RotateCcw, title: "Easy returns", text: "30-day return window" }, { icon: ShieldCheck, title: "Secure payments", text: "Protected transactions" }, { icon: Clock3, title: "Here to help", text: "Support, 7 days a week" }];
  return <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[.03] lg:grid-cols-4">{items.map(({ icon: Icon, title, text }) => <div key={title} className="flex items-center gap-3 border-slate-200 p-4 even:border-l dark:border-white/10 sm:p-6 lg:border-l lg:first:border-l-0"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Icon className="size-[18px]" /></span><div><p className="text-xs font-extrabold sm:text-sm">{title}</p><p className="mt-0.5 text-[10px] text-slate-400 sm:text-xs">{text}</p></div></div>)}</div>;
}
