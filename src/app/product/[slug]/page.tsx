import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { ReviewForm } from "@/components/review-form";
import { ProductDetail } from "@/components/product-detail";
import { ProductGrid } from "@/components/storefront-sections";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getProductBySlug, getStorefrontData } from "@/lib/storefront";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return product ? { title: product.name, description: product.description } : { title: "Product not found" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, data, user] = await Promise.all([getProductBySlug(slug), getStorefrontData(), getCurrentUser()]);
  if (!product) notFound();
  const supabase = await createClient();
  const { data: reviewRows } = await supabase.from("product_reviews").select("id, rating, review, created_at").eq("product_id", product.id).eq("status", "approved").order("created_at", { ascending: false });
  const reviews = (reviewRows ?? []) as { id: string; rating: number; review: string; created_at: string }[];
  const average = reviews.length ? reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length : 0;
  const breakdown = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: reviews.filter((review) => Number(review.rating) === rating).length }));
  const related = data.products.filter((item) => item.id !== product.id && (item.category.id === product.category.id || item.shop.id === product.shop.id)).slice(0, 5);

  return <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><nav className="mb-7 flex flex-wrap items-center gap-2 text-xs text-slate-400"><Link href="/" className="hover:text-orange-500">Home</Link><span>/</span><Link href={`/search?category=${product.category.slug}`} className="hover:text-orange-500">{product.category.name}</Link><span>/</span><span className="truncate text-slate-700 dark:text-slate-300">{product.name}</span></nav><ProductDetail product={{ ...product, rating: Number(average.toFixed(1)), reviewsCount: reviews.length }} /><section id="reviews" className="mt-14 border-t border-slate-200 pt-10 dark:border-white/10"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Customer reviews</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em] sm:text-3xl">What shoppers say</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Verified purchases</span></div><div className="grid gap-5 lg:grid-cols-[260px_1fr]"><div className="surface p-5"><div className="flex items-end gap-3"><span className="text-4xl font-black tracking-tight">{average ? average.toFixed(1) : "-"}</span><div className="pb-1"><div className="flex text-amber-400">{[1,2,3,4,5].map((item) => <Star key={item} className={`size-3.5 ${item <= Math.round(average) ? "fill-current" : ""}`} />)}</div><p className="mt-1 text-[11px] text-slate-500">{reviews.length} approved reviews</p></div></div><div className="mt-5 space-y-2 text-[11px]">{breakdown.map(({ rating, count }) => <div key={rating} className="flex items-center gap-2"><span className="w-3 text-slate-500">{rating}</span><Star className="size-3 fill-amber-400 text-amber-400" /><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }} /></span><span className="w-5 text-right text-slate-400">{count}</span></div>)}</div></div><div className="space-y-4">{reviews.length ? reviews.map((review) => <article key={review.id} className="border-b border-slate-200 pb-4 last:border-0 dark:border-white/10"><div className="flex items-center justify-between gap-3"><div className="flex text-amber-400">{[1,2,3,4,5].map((item) => <Star key={item} className={`size-4 ${item <= review.rating ? "fill-current" : ""}`} />)}</div><time className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</time></div><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{review.review}</p><p className="mt-2 text-xs font-bold text-emerald-600">Verified purchase</p></article>) : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/15">No approved reviews yet. Be the first to share your experience.</div>}</div></div>{user && <ReviewForm productId={product.id} slug={slug} />}</section>{related.length > 0 && <section className="mt-16"><div className="mb-5 flex items-end justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Keep exploring</p><h2 className="mt-2 text-2xl font-black">You may also like</h2></div><Link href={`/search?category=${product.category.slug}`} className="text-xs font-bold text-orange-500">View all</Link></div><ProductGrid products={related} /></section>}</main>;
}