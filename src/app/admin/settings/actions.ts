"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function savePricingSettingsAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (user?.app_metadata?.is_admin !== true) redirect("/");

  const inputs = [
    { key: "pricing.delivery_base_fee", field: "delivery_base_fee", description: "Base delivery fee per shop order in PKR." },
    { key: "pricing.free_delivery_threshold", field: "free_delivery_threshold", description: "Shop subtotal for free delivery in PKR." },
    { key: "pricing.shop_coupon_max_percent", field: "shop_coupon_max_percent", description: "Maximum shop coupon percentage discount." },
  ];
  const values = inputs.map(({ key, field, description }) => {
    const raw = String(formData.get(field) ?? "").trim();
    if (!raw) redirect(`/admin/settings?error=${encodeURIComponent(`${field.replaceAll("_", " ")} is required.`)}`);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) redirect(`/admin/settings?error=${encodeURIComponent(`${field.replaceAll("_", " ")} must be zero or greater.`)}`);
    if (field === "shop_coupon_max_percent" && value > 100) redirect(`/admin/settings?error=${encodeURIComponent("Shop coupon maximum must be no more than 100%.")}`);
    return { key, value: JSON.stringify(value), description, updated_at: new Date().toISOString() };
  });

  const supabase = await createClient();
  const maxPercent = values.find((item) => item.key === "pricing.shop_coupon_max_percent")?.value;
  if (maxPercent) {
    const maximum = Number(maxPercent);
    const { data: coupons, error: couponError } = await supabase
      .from("coupons")
      .select("code,discount_value")
      .eq("scope", "shop")
      .in("discount_type", ["percentage", "percent"])
      .gt("discount_value", maximum);
    if (couponError) redirect(`/admin/settings?error=${encodeURIComponent(couponError.message)}`);
    if (coupons?.length) {
      redirect(`/admin/settings?error=${encodeURIComponent(`Lower or pause shop percentage coupons above ${maximum}% before reducing this cap.`)}`);
    }
  }
  const { error } = await supabase.from("app_settings").upsert(values, { onConflict: "key" });
  if (error) redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/settings");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  redirect("/admin/settings?saved=1");
}
