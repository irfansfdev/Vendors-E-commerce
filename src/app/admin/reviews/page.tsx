import type { Metadata } from "next";
import { AdminReviewsTable } from "@/components/admin-reviews-table";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reviews | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function text(row: Row | null | undefined, ...keys: string[]) {
  const value = keys.map((key) => row?.[key]).find((item) => item !== undefined && item !== null && item !== "");
  return value ? String(value) : "";
}

export default async function AdminReviewsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_reviews").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];
  const productIds = rows.map((review) => String(review.product_id ?? "")).filter(Boolean);
  const userIds = rows.map((review) => String(review.user_id ?? "")).filter(Boolean);
  const [{ data: products }, { data: profiles }, { data: authNames }] = await Promise.all([
    productIds.length ? supabase.from("products").select("id, title").in("id", [...new Set(productIds)]) : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from("profiles").select("id, full_name, name, display_name").in("id", [...new Set(userIds)]) : Promise.resolve({ data: [] }),
    userIds.length ? supabase.rpc("get_admin_user_display_names", { target_user_ids: [...new Set(userIds)] }) : Promise.resolve({ data: [] }),
  ]);
  const productMap = new Map((products ?? []).map((product) => [String(product.id), product as Row]));
  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile as Row]));
  const authMap = new Map<string, string>((authNames ?? []).map((row: Row) => [String(row.user_id), String(row.display_name ?? "")] as [string, string]));
  const reviews = rows.map((review) => {
    const userId = String(review.user_id ?? "");
    const profile = profileMap.get(userId);
    return {
      id: String(review.id),
      product: text(productMap.get(String(review.product_id)), "title") || "Product",
      customer: text(profile, "full_name", "name", "display_name") || authMap.get(userId) || String(review.customer_name ?? review.customer_email ?? "Customer"),
      rating: Number(review.rating ?? 0),
      review: String(review.review ?? ""),
      status: String(review.status ?? "pending").toLowerCase(),
      createdAt: String(review.created_at ?? ""),
    };
  });

  return (
    <div className="mx-auto max-w-[1440px] p-5 sm:p-8 lg:p-10">
      <header className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Trust and safety</p>
        <h1 className="page-title mt-2">Reviews</h1>
        <p className="mt-2 text-sm text-slate-500">Review customer feedback before it appears on product pages.</p>
      </header>
      {error ? <section className="surface p-6 text-sm text-rose-600">Could not load reviews: {error.message}</section> : <AdminReviewsTable reviews={reviews} />}
    </div>
  );
}
