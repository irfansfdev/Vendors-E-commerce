import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Benefits, CategoryGrid, ProductGrid, SectionHeading, ShopGrid } from "@/components/storefront-sections";
import { PremiumHero } from "@/components/premium-hero";
import { getStorefrontData } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { products, categories, shops, isLive } = await getStorefrontData();
  const popularCategories = [...categories].sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
  const saleProducts = products.filter((product) => product.compareAtPrice && product.compareAtPrice > product.price).sort((a, b) => ((b.compareAtPrice ?? b.price) - b.price) - ((a.compareAtPrice ?? a.price) - a.price)).slice(0, 4);
  const featuredProducts = products.filter((product) => product.badge === "FEATURED").slice(0, 8);
  const primaryProducts = products.filter((product) => product.badge !== "FEATURED").sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount).slice(0, 8);
  const ratedProducts = [...products].filter((product) => product.rating > 0).sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount).slice(0, 4);
  const discoveryShops = [...shops].sort((a, b) => Number(b.verified) - Number(a.verified) || b.productCount - a.productCount || b.rating - a.rating).slice(0, 4);

  return <main className="overflow-hidden">
    <PremiumHero products={featuredProducts.slice(0, 5)} />
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
      <div className="-mt-5 relative z-10"><Benefits /></div>
      {popularCategories.length > 0 && <section className="py-16 sm:py-20"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-orange-500">Shop by popularity</p><h2 className="mt-2 text-3xl font-black tracking-[-.06em] sm:text-4xl">What are shoppers browsing?</h2></div><Link href="/search" className="hidden items-center gap-1 text-sm font-bold text-slate-500 hover:text-orange-500 sm:flex">All categories <ArrowRight className="size-4" /></Link></div><CategoryGrid categories={popularCategories} /></section>}
      {featuredProducts.length > 0 && <section className="border-t border-slate-200 py-16 dark:border-white/10 sm:py-20"><SectionHeading eyebrow="Approved by our curators" title="Featured products" href="/search?featured=true" linkLabel="View all featured" /><ProductGrid products={featuredProducts} columns={5} /></section>}
      {primaryProducts.length > 0 && <section className="border-t border-slate-200 py-16 dark:border-white/10 sm:py-20"><SectionHeading eyebrow="The edit" title="Worth a closer look" href="/search" linkLabel="View all products" /><ProductGrid products={primaryProducts} columns={5} /></section>}
      {saleProducts.length > 0 && <section className="mb-16 grid items-center gap-8 rounded-[2rem] bg-[#102a2a] p-6 text-white sm:p-10 lg:grid-cols-[.8fr_1.7fr]"><div><div><span className="text-[11px] font-black uppercase tracking-[.2em] text-orange-300">A little extra</span></div><h2 className="mt-4 max-w-sm text-3xl font-black tracking-[-.06em] sm:text-4xl">Good finds, better prices.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">Limited offers from shops worth knowing.</p><Link href="/search?deal=true" className="button-primary mt-7 bg-orange-500 hover:bg-orange-600">See offers <ArrowRight className="size-4" /></Link></div><div><ProductGrid products={saleProducts} columns={4} /></div></section>}
      {ratedProducts.length > 0 && <section className="pb-16 sm:pb-20"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-orange-500">Loved by shoppers</p><h2 className="mt-2 text-3xl font-black tracking-[-.06em] sm:text-4xl">The highly rated four</h2></div><Link href="/search?sort=rating" className="flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-orange-500">Top rated <ArrowRight className="size-4" /></Link></div><ProductGrid products={ratedProducts} columns={5} /></section>}
      {discoveryShops.length > 0 && <section className="border-t border-slate-200 py-16 dark:border-white/10 sm:py-20"><SectionHeading eyebrow="People behind the products" title="Meet the shops" href="/search?view=shops" linkLabel="Explore all shops" /><ShopGrid shops={discoveryShops} /></section>}
    </div>
    <section className="bg-[#f0eadf] dark:bg-white/[.04]"><div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-7 px-4 py-16 sm:px-6 md:flex-row md:items-center lg:px-8 lg:py-20"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-orange-600">Your next good thing</p><h2 className="mt-3 max-w-2xl text-4xl font-black tracking-[-.07em] text-[#102a2a] dark:text-white sm:text-5xl">Shop with a little more intention.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">Independent shops, thoughtful products, and a checkout built around buyer protection.</p></div><Link href="/search" className="button-primary shrink-0 bg-[#102a2a] hover:bg-orange-500">Explore the marketplace <ArrowRight className="size-4" /></Link></div></section>
    {!isLive && <div className="mx-auto max-w-[1440px] px-4 py-5 text-center text-xs text-slate-500 sm:px-6 lg:px-8">Catalog data is currently unavailable.</div>}
  </main>;
}
