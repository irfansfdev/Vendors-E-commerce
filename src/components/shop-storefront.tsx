"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";
import {
  ArrowDownUp,
  BadgeCheck,
  Bell,
  CalendarDays,
  Grid2X2,
  Heart,
  LayoutList,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
  Store,
  X,
} from "lucide-react";
import { ProductGrid } from "@/components/storefront-sections";
import type { Product, Shop } from "@/lib/types";
import { initials } from "@/lib/utils";
import { MediaPreview } from "@/components/media-preview";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type SortMode = "featured" | "price-low" | "price-high" | "rating";

export function ShopStorefront({
  shop,
  products,
}: {
  shop: Shop;
  products: Product[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All products");
  const [sort, setSort] = useState<SortMode>("featured");
  const [compact, setCompact] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [followed, setFollowed] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      JSON.parse(
        localStorage.getItem("vendra-followed-shops") ?? "[]",
      ) as string[]
    ).includes(shop.id);
  });
  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          products
            .flatMap((product) => [
              product.category,
              ...(product.categories ?? []),
            ])
            .map((item) => [item.id, item]),
        ).values(),
      ),
    [products],
  );
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = products.filter((product) => {
      const matchesQuery =
        !normalized ||
        `${product.name} ${product.description}`
          .toLowerCase()
          .includes(normalized);
      const matchesCategory =
        category === "All products" ||
        [product.category, ...(product.categories ?? [])].some(
          (item) => item.id === category,
        );
      const matchesMin = !minPrice || product.price >= Number(minPrice);
      const matchesMax = !maxPrice || product.price <= Number(maxPrice);
      return matchesQuery && matchesCategory && matchesMin && matchesMax;
    });
    return [...result].sort((a, b) =>
      sort === "price-low"
        ? a.price - b.price
        : sort === "price-high"
          ? b.price - a.price
          : sort === "rating"
            ? b.rating - a.rating
            : Number(Boolean(b.badge)) - Number(Boolean(a.badge)),
    );
  }, [category, maxPrice, minPrice, products, query, sort]);
  const pagination = useUrlPagination(visibleProducts.length, 15);
  const pagedProducts = visibleProducts.slice(pagination.from, pagination.to + 1);
  const reviewCount = products.reduce(
    (total, product) => total + Math.max(0, product.reviewsCount),
    0,
  );
  const ratingPoints = products.reduce(
    (total, product) =>
      total + product.rating * Math.max(0, product.reviewsCount),
    0,
  );
  const productRating = reviewCount ? ratingPoints / reviewCount : 0;
  async function toggleFollow() {
    const followedShops = new Set(
      JSON.parse(
        localStorage.getItem("vendra-followed-shops") ?? "[]",
      ) as string[],
    );
    const nextFollowed = !followedShops.has(shop.id);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      toast.error("Please sign in to follow a shop.");
      return;
    }
    const result = nextFollowed
      ? await supabase
          .from("shop_followers")
          .upsert(
            { shop_id: shop.id, user_id: auth.user.id },
            { onConflict: "shop_id,user_id" },
          )
      : await supabase
          .from("shop_followers")
          .delete()
          .eq("shop_id", shop.id)
          .eq("user_id", auth.user.id);
    if (result.error) {
      toast.error("Could not update shop follow status.");
      return;
    }
    if (nextFollowed) followedShops.add(shop.id);
    else followedShops.delete(shop.id);
    localStorage.setItem(
      "vendra-followed-shops",
      JSON.stringify([...followedShops]),
    );
    setFollowed(followedShops.has(shop.id));
    toast.success(
      nextFollowed
        ? "Shop followed. You will receive product updates."
        : "Shop unfollowed.",
    );
  }
  function changeQuery(value: string) {
    pagination.resetPage();
    setQuery(value);
  }
  function changeCategory(value: string) {
    pagination.resetPage();
    setCategory(value);
  }
  function changeMinPrice(value: string) {
    pagination.resetPage();
    setMinPrice(value);
  }
  function changeMaxPrice(value: string) {
    pagination.resetPage();
    setMaxPrice(value);
  }
  function changeSort(value: SortMode) {
    pagination.resetPage();
    setSort(value);
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-[#080d18]">
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgba(249,115,22,.32),transparent_32%),radial-gradient(circle_at_15%_90%,rgba(14,165,166,.22),transparent_34%)]" />
        {shop.bannerUrl && (
          <MediaPreview
            src={shop.bannerUrl}
            alt={`${shop.name} banner`}
            className="absolute inset-0 size-full object-cover opacity-35"
            fallbackClassName="absolute inset-0 bg-slate-950"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/25" />
        <div className="relative mx-auto flex min-h-[360px] max-w-[1440px] items-end px-5 pb-12 pt-28 sm:px-8 lg:min-h-[430px] lg:px-12">
          <div className="max-w-3xl">
            <Link
              href="/"
              className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-white/65 transition hover:text-orange-300"
            >
              <Store className="size-4" /> BabulShop marketplace
            </Link>
            <div className="flex items-end gap-5">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/25 bg-orange-500 text-2xl font-black shadow-2xl sm:size-24">
                {shop.logoUrl ? (
                  <MediaPreview
                    src={shop.logoUrl}
                    alt={shop.name}
                    className="size-full object-cover"
                    fallbackClassName="grid size-full place-items-center bg-orange-500"
                  />
                ) : (
                  initials(shop.name)
                )}
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-orange-300">
                  <span>Independent shop</span>
                  {shop.verified && (
                    <BadgeCheck className="size-4 fill-sky-400 text-white" />
                  )}
                </div>
                <h1 className="text-4xl font-black tracking-[-.06em] sm:text-6xl">
                  {shop.name}
                </h1>
              </div>
            </div>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
              {shop.description ||
                "A carefully selected collection from an independent seller on BabulShop."}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold text-white/70">
              <span className="flex items-center gap-2">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <b className="text-white">
                  {shop.rating > 0 ? shop.rating.toFixed(1) : "New shop"}
                </b>
                {shop.rating > 0 ? " seller rating" : " no reviews yet"}
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-300" /> Buyer
                protected
              </span>
              <span className="flex items-center gap-2">
                <CalendarDays className="size-4" /> Member since 2022
              </span>
            </div>
          </div>
          <div className="absolute right-5 top-28 flex gap-2 sm:right-8 lg:right-12">
            <button
              type="button"
              onClick={toggleFollow}
              className={`button-secondary border-white/20 text-white ${followed ? "bg-orange-500 hover:bg-orange-600" : "bg-white/10 hover:bg-white/20"}`}
            >
              <Heart className={`size-4 ${followed ? "fill-current" : ""}`} />{" "}
              {followed ? "Following" : "Follow shop"}
            </button>
            <button
              type="button"
              className="button-secondary hidden border-white/20 bg-white/10 text-white hover:bg-white/20 sm:inline-flex"
            >
              <MessageCircle className="size-4" /> Message
            </button>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <section className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm dark:border-white/10 dark:bg-white/10 sm:grid-cols-3">
          <Stat label="Products" value={products.length} />
          <Stat
            label="Seller rating"
            value={
              shop.rating > 0 ? `${shop.rating.toFixed(1)} / 5` : "New shop"
            }
          />
          <Stat label="Buyer protection" value="Included" />
        </section>
        <section id="products" className="scroll-mt-8 py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">
                The collection
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-.055em] sm:text-4xl">
                Find your next favorite
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {visibleProducts.length}{" "}
                {visibleProducts.length === 1 ? "item" : "items"} from{" "}
                {shop.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompact(false)}
                className={`grid size-10 place-items-center rounded-xl ${!compact ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10"}`}
                aria-label="Grid view"
              >
                <Grid2X2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCompact(true)}
                className={`grid size-10 place-items-center rounded-xl ${compact ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10"}`}
                aria-label="Compact view"
              >
                <LayoutList className="size-4" />
              </button>
            </div>
          </div>
          <div className="mt-7 rounded-2xl p-3 shadow-sm dark:border-white/10 dark:bg-white/[.03]">
            <div className="flex flex-col gap-3 lg:flex-row">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search products in ${shop.name}`}
                  className="field h-11 pl-10 pr-10"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </label>
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                className="button-secondary h-11 shrink-0"
              >
                {filtersOpen ? "Hide filters" : "Filter & sort"}
              </button>
            </div>
            {filtersOpen && (
              <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <span className="text-slate-400">Category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent outline-none"
                  >
                    <option value="All products">All products</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <span className="text-slate-400">Min Rs</span>
                  <input
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                    placeholder="0"
                    className="min-w-0 flex-1 bg-transparent outline-none"
                  />
                </label>
                <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <span className="text-slate-400">Max Rs</span>
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    placeholder="Any"
                    className="min-w-0 flex-1 bg-transparent outline-none"
                  />
                </label>
                <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <ArrowDownUp className="size-4" />
                  <select
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as SortMode)
                    }
                    className="bg-transparent outline-none"
                  >
                    <option value="featured">Featured</option>
                    <option value="price-low">Price: low to high</option>
                    <option value="price-high">Price: high to low</option>
                    <option value="rating">Top rated</option>
                  </select>
                </label>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {category !== "All products" && (
                <button
                  type="button"
                  onClick={() => setCategory("All products")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                >
                  {categories.find((item) => item.id === category)?.name}
                  <X className="size-3" />
                </button>
              )}
              {(minPrice || maxPrice) && (
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                >
                  Price range
                  <X className="size-3" />
                </button>
              )}
              {query && (
                <span className="text-xs text-slate-500">
                  Results for “{query}”
                </span>
              )}
            </div>
          </div>
          {visibleProducts.length ? (
            <>
              <div
                data-pagination-list
                className={`mt-10 ${compact ? "[&>div]:gap-y-5 [&_article]:flex [&_article]:gap-4 [&_article>div:first-child]:w-32 [&_article>div:first-child]:shrink-0 [&_article>div:first-child]:rounded-2xl [&_article>div:last-child]:px-0 [&_article>div:last-child]:pt-1" : ""}`}
              >
                <ProductGrid products={pagedProducts} columns={4} />
              </div>
              <Pagination total={visibleProducts.length} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
            </>
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center dark:border-white/15 dark:bg-white/[.03]">
              <Search className="mx-auto size-8 text-slate-300" />
              <h3 className="mt-4 font-black">No products found</h3>
              <p className="mt-2 text-sm text-slate-500">
                Try another search or clear the filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("All products");
                  setMinPrice("");
                  setMaxPrice("");
                }}
                className="button-secondary mt-5"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
        {reviewCount > 0 && (
          <section className="mb-10 grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[.03] sm:grid-cols-[1fr_auto] sm:p-10">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">
                Shop reviews
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                <h2 className="text-3xl font-black tracking-[-.05em]">
                  {productRating.toFixed(1)}{" "}
                  <span className="text-base font-bold text-slate-400">
                    / 5
                  </span>
                </h2>
                <div>
                  <div className="flex text-amber-400">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <Star
                        key={item}
                        className={`size-4 ${item <= Math.round(productRating) ? "fill-current" : ""}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Based on {reviewCount} verified product{" "}
                    {reviewCount === 1 ? "review" : "reviews"}
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
                Average rating across all reviewed products from {shop.name}.
              </p>
            </div>
            <div className="flex items-center gap-3 self-center rounded-2xl bg-orange-50 p-4 text-sm font-bold text-orange-800 dark:bg-orange-500/10 dark:text-orange-200">
              <Bell className="size-5" />
              {followed ? "Shop updates enabled" : "Follow for shop updates"}
            </div>
          </section>
        )}
        <section
          id="about"
          className="mb-16 grid gap-6 rounded-3xl bg-orange-50 p-6 dark:bg-orange-500/10 sm:grid-cols-[1fr_auto] sm:p-10"
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-600">
              About the shop
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.04em]">
              Shop with confidence
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Every order from {shop.name} is covered by BabulShop buyer
              protection, with tracked delivery and support when you need it.
            </p>
          </div>
          <div className="flex items-center gap-3 self-center text-sm font-bold">
            <ShieldCheck className="size-8 text-orange-500" /> Verified seller
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white p-5 dark:bg-slate-900 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-[-.04em]">{value}</p>
    </div>
  );
}
