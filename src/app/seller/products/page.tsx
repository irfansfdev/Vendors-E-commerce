import type { Metadata } from "next";
import Link from "next/link";
import { Box, ChevronLeft, Edit3, ExternalLink, Plus } from "lucide-react";
import { deleteProductAction } from "./actions";
import { DeleteProductButton } from "@/components/delete-product-button";
import { getSellerContext } from "@/lib/seller";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Products | Seller" };
export const dynamic = "force-dynamic";

export default async function SellerProductsPage() {
  const { supabase, shop } = await getSellerContext();
  const { data } = await supabase.from("products").select("id, title, slug, price, status, created_at").eq("shop_id", shop.id).order("created_at", { ascending: false });
  const products = (data ?? []) as Record<string, unknown>[];
  const shopSlug = String(shop.slug ?? "");

  return <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><p className="mt-5 text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Catalog management</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Products</h1><p className="mt-2 text-sm text-slate-500">Manage the listings shown in your shop.</p></div>
      <div className="flex gap-2">{shopSlug && <Link href={`/shop/${shopSlug}`} className="button-secondary"><ExternalLink className="size-4" /> View shop</Link>}<Link href="/seller/products/new" className="button-primary bg-orange-500 hover:bg-orange-600"><Plus className="size-4" /> Add product</Link></div>
    </div>
    <section className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-white/10"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Box className="size-5" /></span><div><h2 className="font-black">Your inventory</h2><p className="text-xs text-slate-500">{products.length} listing{products.length === 1 ? "" : "s"}</p></div></div></div>
      {products.length === 0 ? <div className="p-12 text-center"><Box className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No products yet</p><Link href="/seller/products/new" className="mt-4 inline-flex button-primary bg-orange-500">Create your first product</Link></div> : <div className="divide-y divide-slate-100 dark:divide-white/10">{products.map((product) => <div key={String(product.id)} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-extrabold">{String(product.title ?? "Untitled product")}</h3><p className="mt-1 text-xs text-slate-500">{formatCurrency(Number(product.price ?? 0))} · <span className="capitalize">{String(product.status ?? "draft")}</span></p></div><div className="flex items-center gap-2"><Link href={`/seller/products/${String(product.id)}/edit`} className="button-secondary"><Edit3 className="size-4" /> Edit</Link><form action={async () => { "use server"; await deleteProductAction(String(product.id)); }}><DeleteProductButton /></form></div></div>)}</div>}
    </section>
  </main>;
}
