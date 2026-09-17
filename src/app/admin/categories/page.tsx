import type { Metadata } from "next";
import { CategoryManager } from "@/components/category-manager";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Categories | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: categoryLinks }] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase.from("product_categories").select("category_id"),
  ]);
  const counts = new Map<string, number>();
  for (const link of (categoryLinks ?? []) as Row[]) {
    const id = String(link.category_id ?? "");
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const categories = ((data ?? []) as Row[]).map((category) => ({
    ...category,
    productCount: counts.get(String(category.id)) ?? 0,
  }));

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Catalog control</p>
        <h1 className="page-title mt-2">Categories</h1>
        <p className="mt-1 text-slate-500">Keep the marketplace taxonomy clear and useful.</p>
      </div>
      <CategoryManager initialCategories={categories} error={error ? error.message : null} />
    </div>
  );
}
