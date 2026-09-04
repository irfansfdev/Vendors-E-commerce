"use client";

import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { ProductGrid, ShopGrid } from "@/components/storefront-sections";
import type { Category, Product, Shop } from "@/lib/types";

type Props = {
  products: Product[];
  categories: Category[];
  shops: Shop[];
  initialQuery?: string;
  initialCategory?: string;
  initialShop?: string;
  searchType?: string;
  dealsOnly?: boolean;
};

export function CatalogBrowser({ products, categories, shops, initialQuery = "", initialCategory = "", initialShop = "", searchType = "all", dealsOnly = false }: Props) {
  const highestPrice = Math.ceil(Math.max(...products.map((product) => product.price), 500));
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [shop, setShop] = useState(initialShop);
  const [maxPrice, setMaxPrice] = useState(highestPrice);
  const [sort, setSort] = useState("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const lowered = query.toLowerCase().trim();
    const next = products.filter((product) => {
      const searchable = searchType === "product" ? `${product.name} ${product.description}` : searchType === "shop" ? product.shop.name : searchType === "category" ? product.category.name : `${product.name} ${product.description} ${product.shop.name} ${product.category.name}`;
      const matchesQuery = !lowered || searchable.toLowerCase().includes(lowered);
      return matchesQuery && (!category || product.category.slug === category) && (!shop || product.shop.slug === shop) && product.price <= maxPrice && (!dealsOnly || Boolean(product.compareAtPrice));
    });
    return [...next].sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating;
      return Number(Boolean(b.badge)) - Number(Boolean(a.badge));
    });
  }, [products, query, searchType, category, shop, maxPrice, sort, dealsOnly]);

  const matchingShops = useMemo(() => {
    const lowered = query.toLowerCase().trim();
    return shops.filter((item) => !lowered || `${item.name} ${item.description}`.toLowerCase().includes(lowered));
  }, [shops, query]);

  const matchingCategories = useMemo(() => {
    const lowered = query.toLowerCase().trim();
    return categories.filter((item) => !lowered || `${item.name} ${item.slug}`.toLowerCase().includes(lowered));
  }, [categories, query]);

  const everythingHasResults = filtered.length > 0 || matchingShops.length > 0 || matchingCategories.length > 0;

  const filters = (
    <div className="space-y-7">
      <div><label className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Search</label><input value={query} onChange={(event) => setQuery(event.target.value)} className="field mt-3" placeholder="What are you looking for?" /></div>
      <fieldset><legend className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Category</legend><div className="mt-3 space-y-2.5"><label className="flex cursor-pointer items-center gap-2.5 text-sm"><input type="radio" checked={!category} onChange={() => setCategory("")} className="accent-orange-500" /> All categories</label>{categories.map((item) => <label key={item.id} className="flex cursor-pointer items-center justify-between gap-2.5 text-sm"><span className="flex items-center gap-2.5"><input type="radio" checked={category === item.slug} onChange={() => setCategory(item.slug)} className="accent-orange-500" />{item.name}</span><small className="text-slate-400">{products.filter((product) => product.category.slug === item.slug).length}</small></label>)}</div></fieldset>
      <fieldset><legend className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Shop</legend><select value={shop} onChange={(event) => setShop(event.target.value)} className="field mt-3"><option value="">All shops</option>{shops.map((item) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select></fieldset>
      <div><div className="flex items-center justify-between"><label htmlFor="price" className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Max price</label><span className="text-sm font-bold">Rs {maxPrice.toLocaleString()}</span></div><input id="price" type="range" min="20" max={highestPrice} step="10" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} className="mt-4 w-full accent-orange-500" /><div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>Rs 20</span><span>Rs {highestPrice.toLocaleString()}+</span></div></div>
      {(category || shop || query || maxPrice < highestPrice) && <button onClick={() => { setCategory(""); setShop(""); setQuery(""); setMaxPrice(highestPrice); }} className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold hover:border-orange-400 hover:text-orange-500 dark:border-white/10">Clear all filters</button>}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block"><div className="surface sticky top-36 p-5">{filters}</div></aside>
      <div className="min-w-0">
        <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10"><p className="text-sm text-slate-500"><b className="text-slate-950 dark:text-white">{filtered.length}</b> products</p><div className="flex gap-2"><button onClick={() => setFiltersOpen(true)} className="button-secondary lg:hidden"><SlidersHorizontal className="size-4" /> Filters</button><div className="relative"><select value={sort} onChange={(event) => setSort(event.target.value)} className="h-[46px] appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-xs font-bold outline-none dark:border-white/10 dark:bg-white/5"><option value="featured">Featured</option><option value="rating">Top rated</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2" /></div></div></div>
        {searchType === "shop" ? matchingShops.length ? <ShopGrid shops={matchingShops} /> : <EmptySearch label="shops" /> : searchType === "category" ? matchingCategories.length ? <CategoryResults categories={matchingCategories} /> : <EmptySearch label="categories" /> : everythingHasResults ? <div className="space-y-10">{filtered.length > 0 && <section><h2 className="mb-4 text-xl font-black">Products <span className="text-sm font-semibold text-slate-400">({filtered.length})</span></h2><ProductGrid products={filtered} /></section>}{matchingShops.length > 0 && <section><h2 className="mb-4 text-xl font-black">Shops <span className="text-sm font-semibold text-slate-400">({matchingShops.length})</span></h2><ShopGrid shops={matchingShops} /></section>}{matchingCategories.length > 0 && <section><h2 className="mb-4 text-xl font-black">Categories <span className="text-sm font-semibold text-slate-400">({matchingCategories.length})</span></h2><CategoryResults categories={matchingCategories} /></section>}</div> : <EmptySearch label="products, shops, or categories" />}
      </div>
      <div className={`fixed inset-0 z-50 lg:hidden ${filtersOpen ? "visible" : "invisible"}`}><button onClick={() => setFiltersOpen(false)} className={`absolute inset-0 bg-slate-950/50 transition-opacity ${filtersOpen ? "opacity-100" : "opacity-0"}`} aria-label="Close filters" /><aside className={`absolute inset-y-0 right-0 w-[min(90vw,380px)] overflow-y-auto bg-white p-6 transition-transform dark:bg-slate-950 ${filtersOpen ? "translate-x-0" : "translate-x-full"}`}><div className="mb-7 flex items-center justify-between"><h2 className="text-xl font-extrabold">Filters</h2><button onClick={() => setFiltersOpen(false)} className="icon-button"><X className="size-5" /></button></div>{filters}<button onClick={() => setFiltersOpen(false)} className="button-primary mt-8 w-full">Show {filtered.length} products</button></aside></div>
    </div>
  );
}

function EmptySearch({ label }: { label: string }) { return <div className="surface grid min-h-80 place-items-center p-8 text-center"><div><p className="text-lg font-extrabold">No {label} found</p><p className="mt-2 text-sm text-slate-500">Try another search or choose a different search type.</p></div></div>; }
function CategoryResults({ categories }: { categories: Category[] }) { return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{categories.map((item) => <a key={item.id} href={`/search?category=${item.slug}`} className="surface p-5 transition hover:-translate-y-1 hover:border-orange-300"><p className="text-lg font-extrabold">{item.name}</p><p className="mt-2 text-xs text-slate-500">{item.productCount} products</p></a>)}</div>; }
