import type { Metadata } from "next";
import { CategoryManager } from "@/components/category-manager";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Categories | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").order("name");
  const categories = (data ?? []) as Row[];

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Catalog control</p>
        <h1 className="mt-2 text-3xl font-black">Categories</h1>
        <p className="mt-1 text-slate-500">Keep the marketplace taxonomy clear and useful.</p>
      </div>
      <CategoryManager initialCategories={categories} error={error ? error.message : null} />
    </div>
  );
}
