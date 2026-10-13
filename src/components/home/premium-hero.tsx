"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import type { Product } from "@/lib/types";

export function PremiumHero({ products }: { products: Product[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previousProduct, setPreviousProduct] = useState<Product | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const pausedRef = useRef(false);
  const pointerStart = useRef<number | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const previousIndex = useRef(0);
  const swipedRef = useRef(false);
  const product = products[selectedIndex] ?? products[0];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (products.length < 2 || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!pausedRef.current) setSelectedIndex((index) => (index + 1) % products.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [products.length, reducedMotion]);

  useEffect(() => {
    if (previousIndex.current === selectedIndex) return;
    if (!reducedMotion) {
      setPreviousProduct(products[previousIndex.current] ?? null);
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
      transitionTimer.current = window.setTimeout(() => setPreviousProduct(null), 320);
    }
    previousIndex.current = selectedIndex;
  }, [products, reducedMotion, selectedIndex]);

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    };
  }, []);

  function move(direction: number) {
    if (products.length < 2) return;
    setSelectedIndex((index) => (index + direction + products.length) % products.length);
  }

  function select(index: number) {
    if (index === selectedIndex) return;
    setSelectedIndex(index);
  }

  if (!product) {
    return (
      <section className="mt-4 grid min-h-[250px] place-items-center rounded-3xl border border-[var(--border)] bg-[#faf7f2] px-6 py-10 text-center dark:bg-slate-900 sm:min-h-[300px]">
        <div>
          <p className="text-xs font-medium text-[var(--accent)]">Independent marketplace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.02em] text-[var(--text)] sm:text-4xl">Good things are on the way.</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">Independent sellers are preparing their next collection.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="group/hero mt-4 overflow-hidden rounded-3xl border border-[var(--border)] bg-[#faf7f2] dark:bg-slate-900"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocusCapture={() => { pausedRef.current = true; }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) pausedRef.current = false;
      }}
    >
      <div className="grid lg:h-[460px] lg:grid-cols-[45fr_55fr]">
        <div className="order-2 flex flex-col justify-center px-5 py-7 sm:px-8 lg:order-1 lg:px-10 xl:px-12">
          <span className="w-fit rounded-full bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
            Independent marketplace
          </span>
          <h1 className="mt-4 max-w-xl text-[36px] font-semibold leading-[1.05] tracking-[-.02em] text-[var(--brand)] dark:text-white sm:text-5xl lg:text-[56px]">
            Find things<br /><span className="font-serif font-normal italic text-[var(--accent)]">worth keeping.</span>
          </h1>
          <p className="mt-4 max-w-[420px] text-base leading-6 text-slate-600 dark:text-slate-300">
            A considered edit of products from makers and shops with a point of view.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/product/${product.slug}`} className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white transition hover:bg-orange-600">
              Shop this edit
            </Link>
            <Link href="/search" className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-sm font-medium text-[var(--text)] transition hover:border-orange-500 hover:text-[var(--accent)]">
              Explore all
            </Link>
          </div>
        </div>
        <div
          className="relative order-1 h-[220px] min-w-0 p-3 sm:h-[300px] lg:order-2 lg:h-full lg:p-4"
          onPointerDown={(event) => {
            if (event.pointerType === "touch") pointerStart.current = event.clientX;
          }}
          onPointerUp={(event) => {
            if (pointerStart.current === null) return;
            const delta = event.clientX - pointerStart.current;
            pointerStart.current = null;
            if (Math.abs(delta) > 40) {
              swipedRef.current = true;
              move(delta < 0 ? 1 : -1);
            }
          }}
          onPointerCancel={() => { pointerStart.current = null; }}
        >
          <Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`} className="absolute inset-3 overflow-hidden rounded-2xl bg-slate-100 sm:inset-4">
            {previousProduct && !reducedMotion && (
              <Image
                key={`previous-${previousProduct.id}`}
                src={previousProduct.images[0]}
                alt=""
                fill
                unoptimized={previousProduct.images[0].startsWith("data:")}
                sizes="(max-width: 1023px) 100vw, 55vw"
                className="animate-[hero-fade-out_300ms_ease-out_forwards] object-cover"
                onError={(event) => { event.currentTarget.style.display = "none"; }}
              />
            )}
            <Image
              key={product.id}
              src={product.images[0]}
              alt={product.name}
              fill
              priority={selectedIndex === 0}
              unoptimized={product.images[0].startsWith("data:")}
              sizes="(max-width: 1023px) 100vw, 55vw"
              className={`${previousProduct && !reducedMotion ? "animate-[hero-fade-in_300ms_ease-out_both]" : ""} object-cover`}
              onError={(event) => { event.currentTarget.style.display = "none"; }}
              onClickCapture={(event) => {
                if (!swipedRef.current) return;
                event.preventDefault();
                event.stopPropagation();
                swipedRef.current = false;
              }}
            />
          </Link>
          {products.length > 1 && (
            <>
              <div className="absolute right-7 top-7 hidden gap-2 lg:flex lg:opacity-0 lg:transition-opacity lg:group-hover/hero:opacity-100 lg:group-focus-within/hero:opacity-100">
                <button type="button" onClick={() => move(-1)} className="grid size-9 place-items-center rounded-full bg-white/90 text-slate-800 transition hover:bg-white" aria-label="Previous featured product">
                  <ArrowLeft className="size-4" />
                </button>
                <button type="button" onClick={() => move(1)} className="grid size-9 place-items-center rounded-full bg-white/90 text-slate-800 transition hover:bg-white" aria-label="Next featured product">
                  <ArrowRight className="size-4" />
                </button>
              </div>
              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5" aria-label="Choose featured product">
                {products.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => select(index)}
                    className={`h-1.5 rounded-full transition-all ${index === selectedIndex ? "w-[18px] bg-white" : "w-1.5 bg-white/70"}`}
                    aria-label={`Show featured product ${index + 1}`}
                    aria-current={index === selectedIndex}
                  />
                ))}
              </div>
            </>
          )}
          <div className="pointer-events-none absolute bottom-8 left-8 max-w-[280px] rounded-xl border border-white/60 bg-white/85 p-3 text-slate-950 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/75 dark:text-white sm:bottom-9 sm:left-9">
            <p className="truncate text-sm font-semibold">{product.name}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <Star className="size-3 fill-orange-500 text-orange-500" />
              <span className="font-medium">{product.rating.toFixed(1)}</span>
              <span>({product.reviewsCount} reviews)</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
