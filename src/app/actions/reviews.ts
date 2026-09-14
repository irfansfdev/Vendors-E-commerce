"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

type ReviewResult = { error?: string; success?: string };
const deliveredStatuses = ["delivered", "completed"];

async function userPurchasedDeliveredProduct(userId: string, productId: string) {
  const supabase = await createClient();
  const { data: orders } = await supabase.from("orders").select("id, status, shop_orders(id, order_status)").eq("customer_id", userId);
  const deliveredOrderIds = (orders ?? []).flatMap((order) => {
    const parentDelivered = deliveredStatuses.includes(String(order.status).toLowerCase()) ? [order.id] : [];
    const children = Array.isArray(order.shop_orders) ? order.shop_orders : [];
    return [...parentDelivered, ...children.filter((child) => deliveredStatuses.includes(String(child.order_status).toLowerCase())).map((child) => child.id)];
  });
  if (!deliveredOrderIds.length) return false;

  for (const table of ["order_items", "shop_order_items"]) {
    const byOrder = await supabase.from(table).select("order_id, shop_order_id, product_id, product_variant_id, product_variants(product_id)").in("order_id", deliveredOrderIds);
    const byShopOrder = await supabase.from(table).select("order_id, shop_order_id, product_id, product_variant_id, product_variants(product_id)").in("shop_order_id", deliveredOrderIds);
    const items = [...(byOrder.data ?? []), ...(byShopOrder.data ?? [])];
    if (items.some((item) => {
      const variants = Array.isArray(item.product_variants) ? item.product_variants : [item.product_variants];
      return item.product_id === productId || variants.some((variant) => variant?.product_id === productId);
    })) return true;
  }
  return false;
}

export async function submitReviewAction(_previous: ReviewResult, formData: FormData): Promise<ReviewResult> {
  const user = await getCurrentUser();
  const productId = String(formData.get("product_id") ?? "");
  const rating = Number(formData.get("rating"));
  const review = String(formData.get("review") ?? "").trim();
  if (!user) return { error: "Please sign in before writing a review." };
  if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose a rating from 1 to 5 stars." };
  if (review.length < 10 || review.length > 2000) return { error: "Your review must be between 10 and 2,000 characters." };
  if (!(await userPurchasedDeliveredProduct(user.id, productId))) return { error: "Reviews are available after this product has been delivered." };

  const supabase = await createClient();
  const { error } = await supabase.from("product_reviews").insert({ product_id: productId, user_id: user.id, rating, review, status: "pending" });
  if (error) return { error: error.code === "23505" ? "You have already reviewed this product." : error.message };
  revalidatePath(`/product/${String(formData.get("slug") ?? "")}`);
  revalidatePath("/account");
  return { success: "Thanks. Your review is awaiting admin approval." };
}

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (user?.app_metadata?.is_admin !== true) throw new Error("Unauthorized");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["approved", "rejected"].includes(status)) throw new Error("Invalid review moderation request");
  const supabase = await createClient();
  await supabase.from("product_reviews").update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq("id", id);
  revalidatePath("/admin/reviews");
  revalidatePath("/product", "layout");
}