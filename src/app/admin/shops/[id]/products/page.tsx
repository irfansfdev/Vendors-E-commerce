import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminShopProductsTable } from "@/components/admin-shop-products-table";

export const dynamic = "force-dynamic";
export default async function AdminShopProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: shop }, { data: products }] = await Promise.all([
    supabase.from("shops").select("id,name").eq("id", id).maybeSingle(),
    supabase.from("products").select("*").eq("shop_id", id).order("created_at", { ascending: false }),
  ]);
  if (!shop) return <div className="p-8">Shop not found.</div>;
  const productRows = products ?? [];
  const productIds = productRows.map((product) => String(product.id));
  const { data: variants } = productIds.length
    ? await supabase.from("product_variants").select("product_id,stock_quantity").in("product_id", productIds)
    : { data: [] };
  const stockByProduct = new Map<string, number>();
  for (const variant of variants ?? []) {
    const productId = String(variant.product_id);
    stockByProduct.set(productId, (stockByProduct.get(productId) ?? 0) + Number(variant.stock_quantity ?? 0));
  }
  const rows = productRows.map((product) => ({ id: String(product.id), title: String(product.title ?? "Untitled product"), slug: String(product.slug ?? ""), price: Number(product.price ?? 0), stock: stockByProduct.get(String(product.id)) ?? Number(product.stock_quantity ?? product.stock ?? product.quantity ?? 0), status: String(product.status ?? "draft"), createdAt: String(product.created_at ?? "") }));
  return <div className="mx-auto max-w-6xl p-5 sm:p-8"><Link href={`/admin/shops/${id}`} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ArrowLeft className="size-4" /> Back to shop</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">{String(shop.name)} · Catalog review</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Products</h1><p className="mt-2 text-sm text-slate-500">Review and manage products submitted by this shop.</p></div><AdminShopProductsTable shopId={id} products={rows} /></div>;
}
