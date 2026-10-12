"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.app_metadata?.is_admin !== true) redirect("/");
}

function readCoupon(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const type = String(formData.get("discount_type") ?? "");
  const discount = Number(formData.get("discount_value"));
  const minimum = Number(formData.get("min_order_value") ?? 0);
  const maxRaw = String(formData.get("max_discount") ?? "").trim();
  const startRaw = String(formData.get("start_date") ?? "").trim();
  const endRaw = String(formData.get("end_date") ?? "").trim();
  const totalRaw = String(formData.get("usage_limit_total") ?? "").trim();
  const userRaw = String(formData.get("usage_limit_per_user") ?? "").trim();

  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) throw new Error("Use 2–40 letters, numbers, hyphens, or underscores.");
  if (!["percentage", "fixed", "free_delivery"].includes(type)) throw new Error("Choose a valid coupon type.");
  if (!Number.isFinite(discount) || discount < 0 || (type !== "free_delivery" && discount <= 0)) throw new Error("Enter a positive discount value.");
  if (type === "percentage" && discount > 100) throw new Error("Percentage discount cannot exceed 100%.");
  if (!Number.isFinite(minimum) || minimum < 0) throw new Error("Minimum order must be zero or more.");
  const maxDiscount = maxRaw ? Number(maxRaw) : null;
  const totalLimit = totalRaw ? Number(totalRaw) : null;
  const userLimit = userRaw ? Number(userRaw) : null;
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) throw new Error("Maximum discount must be a positive amount.");
  if (totalLimit !== null && (!Number.isInteger(totalLimit) || totalLimit < 1)) throw new Error("Total usage limit must be a positive whole number.");
  if (userLimit !== null && (!Number.isInteger(userLimit) || userLimit < 1)) throw new Error("Per-customer usage limit must be a positive whole number.");
  const starts = startRaw ? new Date(startRaw) : null;
  const ends = endRaw ? new Date(endRaw) : null;
  if ((starts && Number.isNaN(starts.getTime())) || (ends && Number.isNaN(ends.getTime()))) throw new Error("Enter valid coupon dates.");
  if (starts && ends && starts >= ends) throw new Error("The end date must be after the start date.");

  return {
    code,
    discount_type: type,
    discount_value: type === "free_delivery" ? 0 : discount,
    min_order_value: minimum,
    max_discount: maxDiscount,
    start_date: starts?.toISOString() ?? null,
    end_date: ends?.toISOString() ?? null,
    usage_limit_total: totalLimit,
    usage_limit_per_user: userLimit,
    first_order_only: formData.get("first_order_only") === "true",
    scope: "platform",
    shop_id: null,
    is_active: true,
  };
}

export async function createPlatformCouponAction(formData: FormData): Promise<void> {
  await requireAdmin();
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("coupons").insert(readCoupon(formData));
    if (error) throw new Error(error.message);
    revalidatePath("/admin/coupons");
    redirect("/admin/coupons?saved=1");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "Could not create platform coupon.";
    redirect(`/admin/coupons?error=${encodeURIComponent(message)}`);
  }
}

export async function setAdminCouponActiveAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) redirect(`/admin/coupons?error=${encodeURIComponent("Coupon ID is required.")}`);
  const supabase = await createClient();
  const { data, error } = await supabase.from("coupons").update({ is_active: active }).eq("id", id).select("id").maybeSingle();
  if (error || !data) redirect(`/admin/coupons?error=${encodeURIComponent(error?.message ?? "Coupon not found.")}`);
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons?saved=1");
}
