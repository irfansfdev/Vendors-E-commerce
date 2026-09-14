"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Grid2X2, Grid3X3, LayoutGrid, X } from "lucide-react";
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
  const pageSize = 10;
  const highestPrice = Math.ceil(Math.max(...products.map((product) => product.price), 500));
  const [query, setQuery] = useState(initialQuery);
  const [categoriesSelected, setCategoriesSelected] = useState(initialCategory ? initialCategory.split(",").filter(Boolean) : []);
  const [shopsSelected, setShopsSelected] = useState(initialShop ? initialShop.split(",").filter(Boolean) : []);
  const [minPrice, setMinPrice] = useState(20);
  const [maxPrice, setMaxPrice] = useState(highestPrice);
  const [sort, setSort] = useState("featured");
  const [columns, setColumns] = useState<3 | 4 | 5>(5);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [shopsOpen, setShopsOpen] = useState(false);

  const filtered = useMemo(() => {
    const lowered = query.toLowerCase().trim();
    const next = products.filter((product) => {
      const searchable = searchType === "product" ? `${product.name} ${product.description}` : searchType === "shop" ? product.shop.name : searchType === "category" ? product.category.name : `${product.name} ${product.description} ${product.shop.name} ${product.category.name}`;
      const matchesQuery = !lowered || searchable.toLowerCase().includes(lowered);
      return matchesQuery && (!categoriesSelected.length || categoriesSelected.includes(product.category.slug)) && (!shopsSelected.length || shopsSelected.includes(product.shop.slug)) && product.price >= minPrice && product.price <= maxPrice && (!dealsOnly || Boolean(product.compareAtPrice));
    });
    return [...next].sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating;
      return Number(Boolean(b.badge)) - Number(Boolean(a.badge));
    });
  }, [products, query, searchType, categoriesSelected, shopsSelected, minPrice, maxPrice, sort, dealsOnly]);

  const matchingShops = useMemo(() => {
    const lowered = query.toLowerCase().trim();
    return shops.filter((item) => !lowered || `${item.name} ${item.description}`.toLowerCase().includes(lowered));
  }, [shops, query]);

  const matchingCategories = useMemo(() => {
    const lowered = query.toLowerCase().trim();
    return categories.filter((item) => !lowered || `${item.name} ${item.slug}`.toLowerCase().includes(lowered));
  }, [categories, query]);

  const everythingHasResults = filtered.length > 0 || matchingShops.length > 0 || (searchType === "category" && matchingCategories.length > 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleProducts = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilterCount = Number(Boolean(query)) + categoriesSelected.length + shopsSelected.length + Number(minPrice > 20 || maxPrice < highestPrice);

  function updatePage(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), pageCount));
  }

  function changeQuery(value: string) { setQuery(value); setPage(1); }
  function toggleCategory(value: string) { setCategoriesSelected((selected) => selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]); setPage(1); }
  function toggleShop(value: string) { setShopsSelected((selected) => selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]); setPage(1); }
  function changeMinPrice(value: number) { setMinPrice(Math.min(value, maxPrice)); setPage(1); }
  function changeMaxPrice(value: number) { setMaxPrice(value); setPage(1); }
  function changeSort(value: string) { setSort(value); setPage(1); }

  const filters = (
    <div className="space-y-7">
      <div><label className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Search</label><input value={query} onChange={(event) => changeQuery(event.target.value)} className="field mt-3" placeholder="What are you looking for?" /></div>
      <fieldset><button type="button" onClick={() => setCategoriesOpen((open) => !open)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-extrabold uppercase tracking-[.12em] text-slate-500 transition hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300" aria-expanded={categoriesOpen}><span>Categories{categoriesSelected.length > 0 && <span className="ml-2 normal-case tracking-normal text-orange-500">{categoriesSelected.length} selected</span>}</span><ChevronDown className={`size-4 transition-transform ${categoriesOpen ? "rotate-180 text-orange-500" : ""}`} /></button>{categoriesOpen && <div className="mt-2 max-h-40 space-y-2.5 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 p-3 dark:border-white/10">{categories.map((item) => <label key={item.id} className="flex cursor-pointer items-center justify-between gap-2.5 text-sm"><span className="flex items-center gap-2.5"><input type="checkbox" checked={categoriesSelected.includes(item.slug)} onChange={() => toggleCategory(item.slug)} className="size-4 accent-orange-500" />{item.name}</span><small className="text-slate-400">{products.filter((product) => product.category.slug === item.slug).length}</small></label>)}</div>}</fieldset>
      <fieldset><button type="button" onClick={() => setShopsOpen((open) => !open)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-extrabold uppercase tracking-[.12em] text-slate-500 transition hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300" aria-expanded={shopsOpen}><span>Shops{shopsSelected.length > 0 && <span className="ml-2 normal-case tracking-normal text-orange-500">{shopsSelected.length} selected</span>}</span><ChevronDown className={`size-4 transition-transform ${shopsOpen ? "rotate-180 text-orange-500" : ""}`} /></button>{shopsOpen && <div className="mt-2 max-h-40 space-y-2.5 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 p-3 dark:border-white/10">{shops.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2.5 text-sm"><input type="checkbox" checked={shopsSelected.includes(item.slug)} onChange={() => toggleShop(item.slug)} className="size-4 accent-orange-500" />{item.name}</label>)}</div>}</fieldset>
      <div><div className="flex items-center justify-between"><label className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Price range</label><span className="text-xs font-bold text-orange-600 dark:text-orange-300">Rs {minPrice.toLocaleString()} - Rs {maxPrice.toLocaleString()}</span></div><div className="relative mt-4 h-6"><div className="absolute left-0 right-0 top-2.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/10" /><div className="absolute top-2.5 h-1.5 rounded-full bg-orange-500" style={{ left: `${((minPrice - 20) / (highestPrice - 20)) * 100}%`, right: `${100 - ((maxPrice - 20) / (highestPrice - 20)) * 100}%` }} /><input aria-label="Minimum price" type="range" min="20" max={highestPrice} step="10" value={minPrice} onChange={(event) => changeMinPrice(Number(event.target.value))} className="range-input absolute inset-0 w-full" /><input aria-label="Maximum price" type="range" min="20" max={highestPrice} step="10" value={maxPrice} onChange={(event) => changeMaxPrice(Math.max(Number(event.target.value), minPrice))} className="range-input absolute inset-0 w-full" /></div><div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>Rs 20</span><span>Rs {highestPrice.toLocaleString()}+</span></div></div>
      {(categoriesSelected.length || shopsSelected.length || query || minPrice > 20 || maxPrice < highestPrice) && <button onClick={() => { setCategoriesSelected([]); setShopsSelected([]); changeQuery(""); setMinPrice(20); changeMaxPrice(highestPrice); }} className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold hover:border-orange-400 hover:text-orange-500 dark:border-white/10">Clear all filters</button>}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block"><div className="surface sticky top-36 p-5">{filters}</div></aside>
      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10"><p className="text-sm text-slate-500"><b className="text-slate-950 dark:text-white">{filtered.length}</b> products <span className="ml-2 text-xs text-slate-400">{activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active` : "Showing all products"}</span></p><div className="flex items-center gap-2"><span className="hidden text-xs font-bold text-slate-400 sm:inline">Sort by</span><div className="relative"><select aria-label="Sort products" value={sort} onChange={(event) => changeSort(event.target.value)} className="h-[46px] appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-xs font-bold outline-none dark:border-white/10 dark:bg-white/5"><option value="featured">Featured</option><option value="rating">Top rated</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2" /></div><div className="hidden items-center gap-1 sm:flex" aria-label="Products per row"><button type="button" onClick={() => setColumns(3)} className={`grid size-9 place-items-center rounded-lg border ${columns === 3 ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-400 dark:border-white/10"}`} aria-label="Show 3 products per row" title="3 per row"><Grid3X3 className="size-4" /></button><button type="button" onClick={() => setColumns(4)} className={`grid size-9 place-items-center rounded-lg border ${columns === 4 ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-400 dark:border-white/10"}`} aria-label="Show 4 products per row" title="4 per row"><LayoutGrid className="size-4" /></button><button type="button" onClick={() => setColumns(5)} className={`grid size-9 place-items-center rounded-lg border ${columns === 5 ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-400 dark:border-white/10"}`} aria-label="Show 5 products per row" title="5 per row"><Grid2X2 className="size-4" /></button></div></div></div>
        {searchType === "shop" ? matchingShops.length ? <ShopGrid shops={matchingShops} /> : <EmptySearch label="shops" /> : searchType === "category" ? matchingCategories.length ? <CategoryResults categories={matchingCategories} /> : <EmptySearch label="categories" /> : everythingHasResults ? <div className="space-y-10">{filtered.length > 0 && <section><h2 className="mb-4 text-xl font-black">Products <span className="text-sm font-semibold text-slate-400">({filtered.length})</span></h2><ProductGrid products={visibleProducts} columns={columns} />{pageCount > 1 && <Pagination page={page} pageCount={pageCount} onPageChange={updatePage} />}</section>}{matchingShops.length > 0 && <section><h2 className="mb-4 text-xl font-black">Shops <span className="text-sm font-semibold text-slate-400">({matchingShops.length})</span></h2><ShopGrid shops={matchingShops} /></section>}</div> : <EmptySearch label="products or shops" />}
      </div>
      <div className={`fixed inset-0 z-50 lg:hidden ${filtersOpen ? "visible" : "invisible"}`}><button onClick={() => setFiltersOpen(false)} className={`absolute inset-0 bg-slate-950/50 transition-opacity ${filtersOpen ? "opacity-100" : "opacity-0"}`} aria-label="Close filters" /><aside className={`absolute inset-y-0 right-0 w-[min(90vw,380px)] overflow-y-auto overscroll-contain bg-white p-6 transition-transform dark:bg-slate-950 ${filtersOpen ? "translate-x-0" : "translate-x-full"}`}><div className="mb-7 flex items-center justify-between"><h2 className="text-xl font-extrabold">Filters</h2><button onClick={() => setFiltersOpen(false)} className="icon-button"><X className="size-5" /></button></div>{filters}<button onClick={() => setFiltersOpen(false)} className="button-primary mt-8 w-full">Show {filtered.length} products</button></aside></div>
    </div>
  );
}

function EmptySearch({ label }: { label: string }) { return <div className="surface grid min-h-80 place-items-center p-8 text-center"><div><p className="text-lg font-extrabold">No {label} found</p><p className="mt-2 text-sm text-slate-500">Try another search or choose a different search type.</p></div></div>; }
function Pagination({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (page: number) => void }) { return <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="Product pages"><button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-orange-300 hover:text-orange-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Previous page"><ChevronLeft className="size-4" /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button type="button" key={number} onClick={() => onPageChange(number)} className={`grid size-9 place-items-center rounded-lg text-xs font-bold transition ${number === page ? "bg-orange-500 text-white" : "border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-500 dark:border-white/10 dark:text-slate-300"}`} aria-current={number === page ? "page" : undefined}>{number}</button>)}<button type="button" onClick={() => onPageChange(page + 1)} disabled={page === pageCount} className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-orange-300 hover:text-orange-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Next page"><ChevronRight className="size-4" /></button></nav>; }
function CategoryResults({ categories }: { categories: Category[] }) { return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{categories.map((item) => <a key={item.id} href={`/search?category=${item.slug}`} className="surface p-5 transition hover:-translate-y-1 hover:border-orange-300"><p className="text-lg font-extrabold">{item.name}</p><p className="mt-2 text-xs text-slate-500">{item.productCount} products</p></a>)}</div>; }
