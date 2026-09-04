import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductEditor } from "@/components/product-editor";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/seller/products/new");
  const supabase = await createClient();
  let shopId = "";
  const member = await supabase.from("shop_members").select("shop_id").eq("user_id", user.id).in("role", ["owner", "manager"]).limit(1).maybeSingle();
  shopId = String((member.data as { shop_id?: string } | null)?.shop_id ?? "");
  if (!shopId) {
    const owned = await supabase.from("shops").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
    shopId = String((owned.data as { id?: string } | null)?.id ?? "");
  }
  if (!shopId) redirect("/seller");

  const categoriesResult = await supabase.from("categories").select("id, name, slug");
  const categories = (categoriesResult.data ?? []) as { id: string; name: string; slug: string }[];

  return (
    <main className="mx-auto max-w-[1220px] px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/seller" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500">
        <ChevronLeft className="size-4" /> Back to dashboard
      </Link>
      <div className="mb-8 mt-5">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">New listing</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Add a product</h1>
        <p className="mt-2 text-sm text-slate-500">Create the product, its variants, inventory, and gallery in one flow.</p>
      </div>
      <ProductEditor shopId={shopId} categories={categories} />
    </main>
  );
}
