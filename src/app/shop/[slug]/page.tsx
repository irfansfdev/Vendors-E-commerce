import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, MessageCircle, Star } from "lucide-react";
import { ProductGrid } from "@/components/storefront-sections";
import { MediaPreview } from "@/components/media-preview";
import { getShopBySlug } from "@/lib/storefront";
import { initials } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

function Image({
  src,
  alt,
  className,
  fill,
}: {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
}) {
  return <MediaPreview src={src} alt={alt} className={fill ? "absolute inset-0 h-full w-full object-cover" : className ?? ""} fallbackClassName={fill ? "absolute inset-0 grid place-items-center bg-slate-200" : "grid size-full place-items-center bg-orange-100"} />;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getShopBySlug(slug);
  return result ? { title: result.shop.name, description: result.shop.description } : { title: "Shop not found" };
}

export default async function ShopPage({ params }: { params: Params }) {
  const { slug } = await params;
  const result = await getShopBySlug(slug);
  if (!result) notFound();
  const { shop, products } = result;

  return <main><div className="relative h-48 overflow-hidden bg-slate-200 sm:h-64 lg:h-72">{shop.bannerUrl && <Image src={shop.bannerUrl} alt={`${shop.name} banner`} fill priority sizes="100vw" className="object-cover" />}<div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" /></div><div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8"><section className="relative -mt-14 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-slate-900 sm:-mt-16 sm:flex-row sm:items-end sm:p-7"><div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-orange-100 text-xl font-black text-orange-700 shadow-md dark:border-slate-900">{shop.logoUrl ? <Image src={shop.logoUrl} alt={shop.name} width={96} height={96} className="size-full object-cover" /> : initials(shop.name)}</div><div className="min-w-0 flex-1 sm:pb-1"><div className="flex items-center gap-2"><h1 className="text-2xl font-black tracking-[-.04em] sm:text-3xl">{shop.name}</h1>{shop.verified && <BadgeCheck className="size-5 fill-sky-500 text-white" />}</div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{shop.description}</p><div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-1"><Star className="size-3.5 fill-amber-400 text-amber-400" /><b className="text-slate-900 dark:text-white">{shop.rating}</b> seller rating</span><span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> On BabulShop since 2022</span></div></div><button className="button-secondary shrink-0"><MessageCircle className="size-4" /> Message shop</button></section><nav className="mt-7 flex gap-7 border-b border-slate-200 text-sm font-bold dark:border-white/10"><Link href="#products" className="border-b-2 border-orange-500 pb-4 text-orange-500">Products</Link><Link href="#about" className="pb-4 text-slate-500">About</Link><Link href="#policies" className="pb-4 text-slate-500">Policies</Link></nav><section id="products" className="py-10"><div className="mb-6 flex items-center justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">From this seller</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Shop all products</h2></div><span className="text-xs text-slate-400">{products.length} available</span></div>{products.length ? <ProductGrid products={products} /> : <div className="surface p-12 text-center"><p className="font-extrabold">This shop is preparing its next drop.</p><p className="mt-2 text-sm text-slate-500">Check back soon for new products.</p></div>}</section></div></main>;
}
