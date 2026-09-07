import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Star } from "lucide-react";
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

  return <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><nav className="mb-7 flex flex-wrap items-center gap-2 text-xs text-slate-400"><Link href="/" className="hover:text-orange-500">Home</Link><span>/</span><Link href={`/search?category=${product.category.slug}`} className="hover:text-orange-500">{product.category.name}</Link><span>/</span><span className="truncate text-slate-700 dark:text-slate-300">{product.name}</span></nav><ProductDetail product={product} /><section id="reviews" className="mt-14 border-t border-slate-200 pt-10 dark:border-white/10"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Customer reviews</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em] sm:text-3xl">What shoppers say</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Verified purchases</span></div><div className="grid gap-5 lg:grid-cols-[240px_1fr]"><div className="surface p-5"><div className="flex items-end gap-3"><span className="text-4xl font-black tracking-tight">{product.rating}</span><div className="pb-1"><div className="flex text-amber-400">{[1,2,3,4,5].map((item) => <Star key={item} className="size-3.5 fill-current" />)}</div><p className="mt-1 text-[11px] text-slate-500">{product.reviewsCount} reviews</p></div></div><div className="mt-5 space-y-2 text-[11px]">{[[5, 86], [4, 10], [3, 3], [2, 1], [1, 0]].map(([stars, value]) => <div key={stars} className="flex items-center gap-2"><span className="w-3 text-slate-500">{stars}</span><Star className="size-3 fill-amber-400 text-amber-400" /><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${value}%` }} /></span><span className="w-7 text-right text-slate-400">{value}%</span></div>)}</div></div><article className="surface p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex text-amber-400">{[1,2,3,4,5].map((item) => <Star key={item} className="size-3.5 fill-current" />)}</div><h3 className="mt-2 text-base font-extrabold">Excellent quality</h3></div><span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><ShieldCheck className="size-3.5" /> Verified purchase</span></div><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Exactly as described, beautifully packed, and delivered ahead of schedule. I’d happily shop from this seller again.</p><div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs dark:border-white/10"><span className="grid size-7 place-items-center rounded-full bg-orange-100 font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">MR</span><span className="font-bold">Morgan R.</span><span className="text-slate-400">2 weeks ago</span></div></article></div></section>{related.length > 0 && <section className="mt-16"><SectionHeading title="You may also like" /><ProductGrid products={related} /></section>}</main>;
}
