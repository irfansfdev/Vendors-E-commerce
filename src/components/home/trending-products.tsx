"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductGrid } from "@/components/shared/storefront-sections";
import type { Product } from "@/lib/types";

export function TrendingProducts({
  popularProducts,
  topRatedProducts,
}: {
  popularProducts: Product[];
  topRatedProducts: Product[];
}) {
  const [tab, setTab] = useState<"popular" | "top-rated">("popular");
  const products = tab === "popular" ? popularProducts : topRatedProducts;

  function handleTabKey(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextTab = event.key === "Home"
      ? "popular"
      : event.key === "End"
        ? "top-rated"
        : tab === "popular" ? "top-rated" : "popular";
    setTab(nextTab);
    document.getElementById(`${nextTab}-tab`)?.focus();
  }

  return (
    <section className="py-10 lg:py-14">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-[22px] font-semibold leading-tight tracking-[-.035em] text-[var(--text)] sm:text-[26px]">Trending now</h2>
          <div role="tablist" aria-label="Trending product sort" className="flex items-center gap-1 rounded-full bg-[var(--surface-muted)] p-1">
            <button
              type="button"
              role="tab"
              id="popular-tab"
              aria-selected={tab === "popular"}
              aria-controls="trending-products"
              tabIndex={tab === "popular" ? 0 : -1}
              onClick={() => setTab("popular")}
              onKeyDown={handleTabKey}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${tab === "popular" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
            >
              Popular
            </button>
            <button
              type="button"
              role="tab"
              id="top-rated-tab"
              aria-selected={tab === "top-rated"}
              aria-controls="trending-products"
              tabIndex={tab === "top-rated" ? 0 : -1}
              onClick={() => setTab("top-rated")}
              onKeyDown={handleTabKey}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${tab === "top-rated" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
            >
              Top rated
            </button>
          </div>
        </div>
        <Link href="/search" className="shrink-0 text-[13px] font-medium text-[var(--accent)] hover:underline">
          View all <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div
        id="trending-products"
        role="tabpanel"
        aria-labelledby={tab === "popular" ? "popular-tab" : "top-rated-tab"}
        className="min-h-[420px] sm:min-h-[520px] xl:min-h-[570px]"
      >
        {products.length === 0 && <p className="text-sm text-[var(--text-muted)]">No products to show yet.</p>}
        <ProductGrid products={products.slice(0, 12)} columns={6} home fillRows />
      </div>
    </section>
  );
}
