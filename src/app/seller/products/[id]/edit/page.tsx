import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSellerContext } from "@/lib/seller";
import { ProductEditForm } from "@/components/product-edit-form";

export const metadata: Metadata = { title: "Edit product | Seller" };
export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, shop } = await getSellerContext();
  const [{ data: product }, { data: categories }, { data: variants }, { data: images }] = await Promise.all([
    supabase.from("products").select("id, title, description, price, compare_at_price, category_id, status").eq("id", id).eq("shop_id", shop.id).maybeSingle(),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("product_variants").select("id, sku, price, compare_at_price, stock_quantity, attributes").eq("product_id", id).order("created_at"),
    supabase.from("product_images").select("image_url, display_order").eq("product_id", id).order("display_order"),
  ]);
  if (!product) notFound();
  const normalizedVariants = (variants ?? []).map((variant) => ({ id: String(variant.id), sku: String(variant.sku ?? ""), price: Number(variant.price ?? product.price ?? 0), compare_at_price: variant.compare_at_price == null ? null : Number(variant.compare_at_price), stock: Number(variant.stock_quantity ?? 0), attributes: (variant.attributes && typeof variant.attributes === "object" ? variant.attributes : {}) as Record<string, string> }));
  return <main className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-8"><Link href="/seller/products" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Products</Link><div className="mb-8 mt-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Catalog management</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Edit product</h1><p className="mt-2 text-sm text-slate-500">Update the same details available when creating a product.</p></div><ProductEditForm productId={id} product={product as Record<string, unknown>} categories={(categories ?? []).map((category) => ({ id: String(category.id), name: String(category.name) }))} variants={normalizedVariants} images={(images ?? []).map((image) => String(image.image_url))} /></main>;
}
