"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function applyAsRiderAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/rider/apply");
  const supabase = await createClient();
  const email = String(formData.get("email") ?? user.email ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!email || fullName.length < 2) return;
  const { error } = await supabase.from("delivery_profiles").insert({ user_id: user.id, email, full_name: fullName, phone: String(formData.get("phone") ?? "").trim() || null, address: String(formData.get("address") ?? "").trim() || null, cnic: String(formData.get("cnic") ?? "").trim() || null, vehicle_type: String(formData.get("vehicleType") ?? "").trim() || null, vehicle_number: String(formData.get("vehicleNumber") ?? "").trim() || null, license_number: String(formData.get("licenseNumber") ?? "").trim() || null, status: "pending" });
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath("/rider");
  redirect("/rider/apply?submitted=1");
}

export async function updateDeliveryAction(formData: FormData) {
  const { supabase } = await import("@/lib/rider").then((module) => module.getRiderContext());
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const status = String(formData.get("status") ?? "");
  const collected = Number(formData.get("collectedAmount") ?? 0);
  const reason = String(formData.get("failureReason") ?? "").trim() || null;
  const { data, error } = await supabase.rpc("update_delivery_assignment", { target_assignment_id: assignmentId, target_status: status, target_collected_amount: collected, target_failure_reason: reason });
  if (error || data !== true) throw new Error(error?.message ?? "Delivery update was not accepted.");
  revalidatePath("/rider");
  revalidatePath("/rider/assignments");
  redirect("/rider/assignments");
}

export async function updateRiderProfileAction(formData: FormData) {
  const { supabase, user, rider } = await import("@/lib/rider").then((module) => module.getRiderContext());
  const upload = async (value: FormDataEntryValue | null, type: string) => {
    if (!value || typeof value === "string" || value.size === 0) return null;
    if (!value.type.startsWith("image/") || value.size > 5 * 1024 * 1024) throw new Error("Images must be under 5MB.");
    const extension = value.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `riders/${user.id}/${type}-${Date.now()}.${extension}`;
    const bytes = Buffer.from(await value.arrayBuffer());
    const { error } = await supabase.storage.from("shop-assets").upload(path, bytes, { upsert: true, contentType: value.type, cacheControl: "3600" });
    if (error) throw new Error(`Could not upload ${type.replaceAll("_", " ")}.`);
    return supabase.storage.from("shop-assets").getPublicUrl(path).data.publicUrl;
  };
  const profilePhoto = await upload(formData.get("profilePhoto"), "profile");
  const licenseImage = await upload(formData.get("licenseImage"), "license");
  const payload: Record<string, string> = {
    full_name: String(formData.get("fullName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    cnic: String(formData.get("cnic") ?? "").trim(),
    vehicle_type: String(formData.get("vehicleType") ?? "").trim(),
    vehicle_number: String(formData.get("vehicleNumber") ?? "").trim(),
    license_number: String(formData.get("licenseNumber") ?? "").trim(),
  };
  if (payload.full_name.length < 2) throw new Error("Enter your full name.");
  if (profilePhoto) payload.profile_photo_url = profilePhoto;
  if (licenseImage) payload.license_image_url = licenseImage;
  const { error } = await supabase.from("delivery_profiles").update(payload).eq("id", String(rider.id)).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/rider");
  revalidatePath("/rider/profile");
  redirect("/rider/profile?saved=1");
}
