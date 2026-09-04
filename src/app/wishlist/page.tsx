import type { Metadata } from "next";
import { WishlistPageContent } from "@/components/wishlist-page";
import { getStorefrontData } from "@/lib/storefront";

export const metadata: Metadata = { title: "Saved items" };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const { products } = await getStorefrontData();
  return <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><div className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Keep it close</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Your wishlist</h1><p className="mt-2 text-sm text-slate-500">A collection of products you&apos;d love to come back to.</p></div><WishlistPageContent products={products} /></main>;
}
