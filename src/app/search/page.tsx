import type { Metadata } from "next";
import { CatalogBrowser } from "@/components/catalog-browser";
import { getStorefrontData } from "@/lib/storefront";

export const metadata: Metadata = { title: "Shop all" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, data] = await Promise.all([searchParams, getStorefrontData()]);
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const query = value("q");
  const searchType = value("type");

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="mb-9">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Shop</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.055em] sm:text-5xl">{query ? `Results for “${query}”` : value("deal") ? "Today’s best deals" : "Find your next favorite"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Thoughtfully selected products from independent shops, with secure checkout and buyer protection.</p>
      </div>
      <CatalogBrowser key={`${query}-${searchType}-${value("category")}-${value("shop")}-${value("deal")}`} products={data.products} categories={data.categories} shops={data.shops} initialQuery={query} initialCategory={value("category")} initialShop={value("shop")} searchType={searchType} dealsOnly={value("deal") === "true"} />
    </main>
  );
}
