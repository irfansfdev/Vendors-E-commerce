"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSellerContext } from "@/lib/seller";

function couponValues(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const discountType = String(formData.get("discount_type") ?? "");
  const discountValue = Number(formData.get("discount_value"));
  const minOrder = Number(formData.get("min_order_value") ?? 0);
  const maxRaw = String(formData.get("max_discount") ?? "").trim();
  const totalLimitRaw = String(formData.get("usage_limit_total") ?? "").trim();
  const userLimitRaw = String(formData.get("usage_limit_per_user") ?? "").trim();
  const startRaw = String(formData.get("start_date") ?? "").trim();
  const endRaw = String(formData.get("end_date") ?? "").trim();

  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) throw new Error("Use 2–40 letters, numbers, hyphens, or underscores for the coupon code.");
  if (!["percentage", "fixed", "free_delivery"].includes(discountType)) throw new Error("Choose a valid coupon type.");
  if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType !== "free_delivery" && discountValue <= 0)) throw new Error("Enter a positive discount value.");
  if (discountType === "percentage") {
    if (discountValue > 100) throw new Error("Percentage discount cannot exceed 100%.");
  }
  if (!Number.isFinite(minOrder) || minOrder < 0) throw new Error("Minimum order must be zero or more.");
  const maxDiscount = maxRaw ? Number(maxRaw) : null;
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) throw new Error("Maximum discount must be a positive amount.");
  const totalLimit = totalLimitRaw ? Number(totalLimitRaw) : null;
  const userLimit = userLimitRaw ? Number(userLimitRaw) : null;
  if (totalLimit !== null && (!Number.isInteger(totalLimit) || totalLimit < 1)) throw new Error("Total usage limit must be a positive whole number.");
  if (userLimit !== null && (!Number.isInteger(userLimit) || userLimit < 1)) throw new Error("Per-customer usage limit must be a positive whole number.");
  const startDate = startRaw ? new Date(startRaw) : null;
  const endDate = endRaw ? new Date(endRaw) : null;
  if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) throw new Error("Enter valid coupon dates.");
  if (startDate && endDate && startDate >= endDate) throw new Error("The coupon end date must be after its start date.");

  return {
    code,
    discount_type: discountType,
    discount_value: discountType === "free_delivery" ? 0 : discountValue,
    min_order_value: minOrder,
    max_discount: maxDiscount,
    start_date: startDate?.toISOString() ?? null,
    end_date: endDate?.toISOString() ?? null,
    usage_limit_total: totalLimit,
    usage_limit_per_user: userLimit,
    first_order_only: formData.get("first_order_only") === "true",
  };
}

function reportError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Coupon could not be saved.";
  redirect(`/seller/coupons?error=${encodeURIComponent(message)}`);
}

export async function saveSellerCouponAction(formData: FormData): Promise<void> {
  try {
    const { supabase, shop } = await getSellerContext();
    const id = String(formData.get("id") ?? "").trim();
    const values = couponValues(formData);
    const coupon = { ...values, shop_id: String(shop.id), scope: "shop" };
    const result = id
      ? await supabase.from("coupons").update(coupon).eq("id", id).eq("shop_id", String(shop.id)).select("id").maybeSingle()
      : await supabase.from("coupons").insert({ ...coupon, is_active: true }).select("id").maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("Coupon not found or you do not have permission to edit it.");
    revalidatePath("/seller/coupons");
    redirect("/seller/coupons?saved=1");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    reportError(error);
  }
}

export async function setSellerCouponActiveAction(formData: FormData): Promise<void> {
  const { supabase, shop } = await getSellerContext();
  const id = String(formData.get("id") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) redirect(`/seller/coupons?error=${encodeURIComponent("Coupon ID is required.")}`);
  const { data, error } = await supabase.from("coupons").update({ is_active: active }).eq("id", id).eq("shop_id", String(shop.id)).select("id").maybeSingle();
  if (error || !data) redirect(`/seller/coupons?error=${encodeURIComponent(error?.message ?? "Coupon not found.")}`);
  revalidatePath("/seller/coupons");
  redirect("/seller/coupons?saved=1");
}

export async function deleteSellerCouponAction(formData: FormData): Promise<void> {
  const { supabase, shop } = await getSellerContext();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(`/seller/coupons?error=${encodeURIComponent("Coupon ID is required.")}`);
  const { count, error: countError } = await supabase.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", id);
  if (countError) redirect(`/seller/coupons?error=${encodeURIComponent(countError.message)}`);
  if ((count ?? 0) > 0) redirect(`/seller/coupons?error=${encodeURIComponent("This coupon has redemption history and cannot be deleted. Pause it instead.")}`);
  const { data, error } = await supabase.from("coupons").delete().eq("id", id).eq("shop_id", String(shop.id)).select("id").maybeSingle();
  if (error || !data) redirect(`/seller/coupons?error=${encodeURIComponent(error?.message ?? "Coupon not found.")}`);
  revalidatePath("/seller/coupons");
  redirect("/seller/coupons?saved=1");
}
