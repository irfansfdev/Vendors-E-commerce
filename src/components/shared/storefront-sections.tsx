"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Clock3, RotateCcw, ShieldCheck, Star, Truck } from "lucide-react";
import { ProductCard } from "@/components/catalog/product-card";
import type { Category, Product, Shop } from "@/lib/types";
import { initials } from "@/lib/utils";

export function SectionHeading({
  title,
  href = "/search",
  linkLabel = "View all",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-.035em] text-[var(--text)] sm:text-[26px]">{title}</h2>
      <Link href={href} className="shrink-0 text-[13px] font-medium text-[var(--accent)] hover:underline">
        {linkLabel} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 hide-scrollbar sm:mx-0 sm:px-0">
      <div className="grid w-max grid-flow-col snap-x snap-mandatory gap-4 lg:w-full lg:grid-flow-row lg:grid-cols-8 lg:gap-3">
        {categories.slice(0, 8).map((category) => (
          <Link
            key={category.id}
            href={`/search?category=${category.slug}`}
            className="group flex w-[76px] snap-start flex-col items-center text-center focus-visible:outline-none lg:w-auto"
          >
            <span className="relative size-[68px] overflow-hidden rounded-full border border-[var(--border)] bg-slate-100 transition group-hover:ring-2 group-hover:ring-orange-500 group-focus-visible:ring-2 group-focus-visible:ring-orange-500 dark:bg-slate-800 lg:size-20">
              <Image
                src={category.imageUrl}
                alt=""
                fill
                unoptimized={category.imageUrl.startsWith("data:")}
                sizes="80px"
                className="object-cover"
                onError={(event) => { event.currentTarget.style.display = "none"; }}
              />
            </span>
            <span className="mt-2 w-full truncate text-[13px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">{category.name}</span>
            <span className="mt-0.5 w-full truncate text-[11px] text-[var(--text-muted)]">
              {category.productCount} {category.productCount === 1 ? "product" : "products"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  columns = 5,
  onDark = false,
  home = false,
  fillRows = false,
}: {
  products: Product[];
  columns?: 3 | 4 | 5 | 6;
  onDark?: boolean;
  home?: boolean;
  fillRows?: boolean;
}) {
  const gridColumns = home
    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    : columns === 3
      ? "grid-cols-2 md:grid-cols-3"
      : columns === 4
        ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  const gridGaps = home ? "gap-x-3 gap-y-6 sm:gap-x-5" : "gap-x-3 gap-y-8 sm:gap-x-5";

  return (
    <div className={`grid ${gridGaps} ${gridColumns}`}>
      {products.map((product) => <ProductCard key={product.id} product={product} onDark={onDark} />)}
      {home && fillRows && Array.from({ length: Math.max(0, 12 - products.length) }, (_, index) => (
        <div key={`empty-product-slot-${index}`} aria-hidden="true" className="invisible min-w-0">
          <div className="aspect-square rounded-xl" />
          <div className="space-y-1.5 pt-2.5">
            <div className="h-3" />
            <div className="h-10" />
            <div className="h-4" />
            <div className="h-5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShopGrid({ shops, compact = false }: { shops: Shop[]; compact?: boolean }) {
  if (!compact) {
    const colors = ["bg-[#e6efe7] text-[#2d5a3e]", "bg-[#f5e9db] text-[#8a542d]", "bg-[#e7e8f5] text-[#4d508f]", "bg-[#f4e5e9] text-[#8d465b]"];
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shops.slice(0, 4).map((shop, index) => (
          <Link href={`/shop/${shop.slug}`} key={shop.id} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-slate-200/50 dark:border-white/10 dark:bg-white/[.035] dark:hover:border-orange-500/30 dark:hover:shadow-none">
            <div className="flex items-center gap-3">
              <div className={`grid size-11 shrink-0 place-items-center rounded-xl text-sm font-black ${colors[index % colors.length]}`}>
                {shop.logoUrl ? <Image src={shop.logoUrl} alt="" width={44} height={44} unoptimized={shop.logoUrl.startsWith("data:")} className="size-11 rounded-xl object-cover" /> : initials(shop.name)}
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <h3 className="truncate text-sm font-extrabold">{shop.name}</h3>
                {shop.verified && <BadgeCheck className="size-4 shrink-0 fill-sky-500 text-white" />}
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{shop.description}</p>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] dark:border-white/10">
              <span className="flex items-center gap-1 font-bold"><Star className="size-3.5 fill-amber-400 text-amber-400" />{shop.rating}</span>
              <span className="text-slate-400">{shop.productCount} {shop.productCount === 1 ? "product" : "products"}</span>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 hide-scrollbar sm:mx-0 sm:px-0">
      <div className="grid w-max grid-flow-col snap-x snap-mandatory gap-3 sm:w-full sm:grid-flow-row sm:grid-cols-2 lg:grid-cols-4">
        {shops.slice(0, 4).map((shop, index) => (
          <Link
            href={`/shop/${shop.slug}`}
            key={shop.id}
            className="group flex h-[72px] w-[260px] snap-start items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:border-orange-500/30 sm:w-auto"
          >
            <span className={`grid size-12 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-semibold ${["bg-emerald-50 text-emerald-800", "bg-orange-50 text-orange-800", "bg-indigo-50 text-indigo-800", "bg-rose-50 text-rose-800"][index % 4]}`}>
              {shop.logoUrl
                ? <Image src={shop.logoUrl} alt="" width={48} height={48} unoptimized={shop.logoUrl.startsWith("data:")} className="size-full object-cover" />
                : initials(shop.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate text-sm font-semibold text-[var(--text)]">{shop.name}</span>
                {shop.verified && <BadgeCheck className="size-4 shrink-0 fill-sky-500 text-white" aria-label="Verified shop" />}
              </span>
              <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">
                {shop.rating.toFixed(1)} ★ · {shop.productCount} {shop.productCount === 1 ? "product" : "products"}
              </span>
            </span>
            <span className="text-sm text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BenefitsBar({
  freeDeliveryThreshold,
  returnWindowDays,
}: {
  freeDeliveryThreshold: number;
  returnWindowDays: number;
}) {
  const benefits = [
    { icon: Truck, title: "Free delivery", detail: `On orders over Rs ${freeDeliveryThreshold.toLocaleString("en-US")} per shop` },
    { icon: RotateCcw, title: "Easy returns", detail: `${returnWindowDays}-day return window` },
    { icon: ShieldCheck, title: "Secure payments", detail: "Cash on delivery available" },
    { icon: Clock3, title: "Support", detail: "Here to help, 7 days a week" },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:px-4 lg:grid-cols-4 lg:gap-0">
      {benefits.map(({ icon: Icon, title, detail }, index) => (
        <div key={title} className={`flex min-w-0 items-center gap-2.5 lg:px-4 ${index > 0 ? "lg:border-l lg:border-[var(--border)]" : ""}`}>
          <Icon className="size-5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <p className="min-w-0 text-[12px] leading-4 sm:text-[13px] lg:truncate lg:leading-5">
            <span className="font-semibold text-[var(--text)]">{title}: </span>
            <span className="text-[var(--text-muted)]">{detail}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
