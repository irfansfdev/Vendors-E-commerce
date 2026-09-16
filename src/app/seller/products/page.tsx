import type { Metadata } from "next";
import Link from "next/link";
import { Box, ChevronLeft, ExternalLink, Plus } from "lucide-react";
import { deleteProductAction } from "./actions";
import { SellerProductsTable } from "@/components/seller-products-table";
import { getSellerContext } from "@/lib/seller";

export const metadata: Metadata = { title: "Products | Seller" };
export const dynamic = "force-dynamic";

export default async function SellerProductsPage() {
  const { supabase, shop } = await getSellerContext();
  const { data } = await supabase.from("products").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false });
  const products = (data ?? []) as Record<string, unknown>[];
  const productIds = products.map((product) => String(product.id));
  const { data: variants } = productIds.length ? await supabase.from("product_variants").select("product_id,sku,stock_quantity").in("product_id", productIds) : { data: [] };
  const productInfo = new Map<string, { sku: string; stock: number }>();
  for (const variant of variants ?? []) {
    const id = String(variant.product_id);
    const current = productInfo.get(id) ?? { sku: "", stock: 0 };
    current.sku = [current.sku, String(variant.sku ?? "")].filter(Boolean).join(", ");
    current.stock += Number(variant.stock_quantity ?? 0);
    productInfo.set(id, current);
  }
  const rows = products.map((product) => { const info = productInfo.get(String(product.id)); return { id: String(product.id), title: String(product.title ?? "Untitled product"), slug: String(product.slug ?? ""), sku: String(product.sku ?? info?.sku ?? ""), price: Number(product.price ?? 0), stock: info?.stock ?? Number(product.stock_quantity ?? product.stock ?? product.quantity ?? 0), status: String(product.status ?? "draft"), featured: Boolean(product.is_featured), createdAt: String(product.created_at ?? "") }; });
  const shopSlug = String(shop.slug ?? "");

  return <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Dashboard</Link><p className="mt-5 text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Catalog management</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Products</h1><p className="mt-2 text-sm text-slate-500">Manage the listings shown in your shop.</p></div>
      <div className="flex gap-2">{shopSlug && <Link href={`/shop/${shopSlug}`} className="button-secondary"><ExternalLink className="size-4" /> View shop</Link>}<Link href="/seller/products/new" className="button-primary bg-orange-500 hover:bg-orange-600"><Plus className="size-4" /> Add product</Link></div>
    </div>
    {rows.length === 0 ? <section className="surface p-12 text-center"><Box className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No products yet</p><Link href="/seller/products/new" className="mt-4 inline-flex button-primary bg-orange-500">Create your first product</Link></section> : <SellerProductsTable products={rows} onDelete={deleteProductAction} />}
  </main>;
}
