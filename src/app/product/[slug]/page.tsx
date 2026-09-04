import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { ProductDetail } from "@/components/product-detail";
import { ProductGrid, SectionHeading } from "@/components/storefront-sections";
import { getProductBySlug, getStorefrontData } from "@/lib/storefront";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return product ? { title: product.name, description: product.description } : { title: "Product not found" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, data] = await Promise.all([getProductBySlug(slug), getStorefrontData()]);
  if (!product) notFound();
  const related = data.products.filter((item) => item.id !== product.id && (item.category.id === product.category.id || item.shop.id === product.shop.id)).slice(0, 5);

  return <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><nav className="mb-7 flex flex-wrap items-center gap-2 text-xs text-slate-400"><Link href="/" className="hover:text-orange-500">Home</Link><span>/</span><Link href={`/search?category=${product.category.slug}`} className="hover:text-orange-500">{product.category.name}</Link><span>/</span><span className="truncate text-slate-700 dark:text-slate-300">{product.name}</span></nav><ProductDetail product={product} /><section id="reviews" className="mt-16 border-t border-slate-200 pt-12 dark:border-white/10"><div className="grid gap-8 lg:grid-cols-[280px_1fr]"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Customer reviews</p><div className="mt-3 flex items-end gap-3"><span className="text-5xl font-black">{product.rating}</span><div className="pb-1"><div className="flex text-amber-400">{[1,2,3,4,5].map((item) => <Star key={item} className="size-4 fill-current" />)}</div><p className="mt-1 text-xs text-slate-500">Based on {product.reviewsCount} reviews</p></div></div></div><div className="surface p-6"><div className="flex items-center justify-between"><div><p className="font-extrabold">Excellent quality</p><div className="mt-1 flex text-amber-400">{[1,2,3,4,5].map((item) => <Star key={item} className="size-3.5 fill-current" />)}</div></div><span className="text-xs text-slate-400">Verified purchase</span></div><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Exactly as described, beautifully packed, and delivered ahead of schedule. I’d happily shop from this seller again.</p><p className="mt-4 text-xs font-bold">Morgan R.</p></div></div></section>{related.length > 0 && <section className="mt-16"><SectionHeading title="You may also like" /><ProductGrid products={related} /></section>}</main>;
}
