import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopStorefront } from "@/components/shop-storefront";
import { getShopBySlug } from "@/lib/storefront";

type Params = Promise<{ slug: string }>;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getShopBySlug(slug);
  return result ? { title: result.shop.name, description: result.shop.description } : { title: "Shop not found" };
}

export default async function ShopPage({ params }: { params: Params }) {
  const { slug } = await params;
  const result = await getShopBySlug(slug);
  if (!result) notFound();
  return <ShopStorefront shop={result.shop} products={result.products} />;
}
