"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

type ReviewResult = { error?: string; success?: string };
const deliveredStatuses = ["delivered", "completed"];

async function userPurchasedDeliveredProduct(userId: string, productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_review_product", { target_user_id: userId, target_product_id: productId });
  if (!error) return Boolean(data);
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