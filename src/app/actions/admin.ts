// src/app/actions/admin.ts
"use server";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateShopStatusAction(shopId: string, status: 'active' | 'suspended' | 'rejected', rejectionReason?: string) {
  try {
    if (!(await requireAdmin())) {
      return { success: false, error: "Unauthorized. Admin access required." };
    }

    const supabase = await createClient();
    const statusResult = await supabase.from("shops").update({ status }).eq("id", shopId);
    if (statusResult.error) throw new Error(statusResult.error.message);
    if (status === "rejected" && rejectionReason?.trim()) {
      const reasonResult = await supabase.from("shops").update({ rejection_reason: rejectionReason.trim() }).eq("id", shopId);
      if (reasonResult.error && !reasonResult.error.message.toLowerCase().includes("rejection_reason")) throw new Error(reasonResult.error.message);
    }

    revalidatePath("/admin");
    revalidatePath("/admin/shops");
    revalidatePath("/seller");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update shop status." };
  }
}

export async function removeShopAction(shopId: string) {
  try {
    if (!(await requireAdmin())) return { success: false, error: "Unauthorized. Admin access required." };
    const supabase = await createClient();
    const { error } = await supabase.from("shops").delete().eq("id", shopId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/shops");
    revalidatePath("/seller");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not remove shop." };
  }
}

export async function updateAdminProductStatusAction(productId: string, status: "published" | "draft" | "archived") {
  try {
    if (!(await requireAdmin())) return { success: false, error: "Unauthorized. Admin access required." };
    const supabase = await createClient();
    const { error } = await supabase.from("products").update({ status, is_active: status === "published" }).eq("id", productId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/products"); revalidatePath("/admin/shops");
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Could not update product status." }; }
}

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.app_metadata?.is_admin === true;
}

export async function saveCategoryAction(formData: FormData) {
  try {
    if (!(await requireAdmin())) return { success: false, error: "Unauthorized. Admin access required." };
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    let imageUrl = String(formData.get("image_url") ?? "").trim();
    if (!name || !slug) return { success: false, error: "Name and slug are required." };

    const supabase = await createClient();

    // Check if an image file was uploaded
    const imageFile = formData.get("image_file");
    if (imageFile instanceof File && imageFile.size > 0) {
      const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `categories/${slug || "cat"}-${Date.now()}.${ext}`;
      let uploaded = false;
      
      try {
        const uploadResult = await supabase.storage.from("category-images").upload(path, imageFile, {
          upsert: true,
          contentType: imageFile.type,
        });
        if (!uploadResult.error) {
          imageUrl = supabase.storage.from("category-images").getPublicUrl(path).data.publicUrl;
          uploaded = true;
        }
      } catch {}

      if (!uploaded) {
        try {
          const uploadResult = await supabase.storage.from("shop-assets").upload(path, imageFile, {
            upsert: true,
            contentType: imageFile.type,
          });
          if (!uploadResult.error) {
            imageUrl = supabase.storage.from("shop-assets").getPublicUrl(path).data.publicUrl;
            uploaded = true;
          }
        } catch {}
      }

      // If Supabase Storage upload failed (e.g. missing bucket or RLS), convert to base64 Data URL so user's image is never lost
      if (!uploaded) {
        try {
          const bytes = await imageFile.arrayBuffer();
          const buffer = Buffer.from(bytes);
          imageUrl = `data:${imageFile.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
        } catch {}
      }
    }

    const payload: Record<string, unknown> = { name, slug };
    if (imageUrl) {
      payload.image_url = imageUrl;
    } else if (!id) {
      payload.image_url = null;
    }

    let result = id
      ? await supabase.from("categories").update(payload).eq("id", id)
      : await supabase.from("categories").insert(payload);

    if (result.error) {
      const altPayload: Record<string, unknown> = {
        name,
        slug,
        image: imageUrl || null,
        image_path: imageUrl || null,
      };
      const retryResult = id
        ? await supabase.from("categories").update(altPayload).eq("id", id)
        : await supabase.from("categories").insert(altPayload);
      if (retryResult.error) {
        return { success: false, error: result.error.message };
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/categories");
    revalidatePath("/");
    revalidatePath("/search");
    return { success: true, imageUrl: imageUrl || undefined, id: id || undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save category." };
  }
}

export async function deleteCategoryAction(categoryId: string) {
  try {
    if (!(await requireAdmin())) return { success: false, error: "Unauthorized. Admin access required." };
    const supabase = await createClient();
    const { error } = await supabase.from("categories").delete().eq("id", categoryId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/categories");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not delete category." };
  }
}

export async function updatePayoutStatusAction(payoutId: string, status: "approved" | "paid") {
  try {
    if (!(await requireAdmin())) return { success: false, error: "Unauthorized. Admin access required." };
    const supabase = await createClient();
    let result = await supabase.from("payouts").update({ status, ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}) }).eq("id", payoutId);
    if (result.error) result = await supabase.from("transactions").update({ status }).eq("id", payoutId);
    if (result.error) return { success: false, error: result.error.message };
    revalidatePath("/admin/payouts");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not update payout." };
  }
}

export async function createRiderAction(formData: FormData) {
  try {
    if (!(await requireAdmin())) return { success: false, error: "Unauthorized. Admin access required." };
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const fullName = String(formData.get("fullName") ?? "").trim();
    if (!email || fullName.length < 2) return { success: false, error: "Name and email are required." };
    const supabase = await createClient();
    const { error } = await supabase.from("delivery_profiles").insert({ email, full_name: fullName, phone: String(formData.get("phone") ?? "").trim() || null, cnic: String(formData.get("cnic") ?? "").trim() || null, vehicle_type: String(formData.get("vehicleType") ?? "").trim() || null, vehicle_number: String(formData.get("vehicleNumber") ?? "").trim() || null, license_number: String(formData.get("licenseNumber") ?? "").trim() || null, status: "approved", approved_by: (await getCurrentUser())?.id, approved_at: new Date().toISOString() });
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/riders");
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Could not create rider." }; }
}

export async function createRiderFormAction(formData: FormData) {
  const result = await createRiderAction(formData);
  if (!result.success) throw new Error(result.error);
}

export async function updateRiderStatusAction(riderId: string, status: "approved" | "rejected" | "suspended" | "inactive", rejectionReason?: string) {
  try {
    if (!(await requireAdmin())) return { success: false, error: "Unauthorized. Admin access required." };
    const supabase = await createClient();
    const user = await getCurrentUser();
    const { error } = await supabase.from("delivery_profiles").update({ status, rejection_reason: status === "rejected" ? rejectionReason?.trim() || null : null, approved_by: status === "approved" ? user?.id : null, approved_at: status === "approved" ? new Date().toISOString() : null }).eq("id", riderId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/riders");
    revalidatePath("/rider");
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Could not update rider." }; }
}

export async function updateRiderStatusFormAction(formData: FormData) {
  const result = await updateRiderStatusAction(String(formData.get("riderId") ?? ""), String(formData.get("status") ?? "inactive") as "approved" | "rejected" | "suspended" | "inactive", String(formData.get("rejectionReason") ?? ""));
  if (!result.success) throw new Error(result.error);
}

export async function deleteRiderAction(riderId: string) {
  try {
    if (!(await requireAdmin())) return { success: false, error: "Unauthorized. Admin access required." };
    const supabase = await createClient();
    const { count, error: assignmentError } = await supabase.from("delivery_assignments").select("id", { count: "exact", head: true }).eq("rider_id", riderId);
    if (assignmentError) return { success: false, error: assignmentError.message };
    if ((count ?? 0) > 0) return { success: false, error: "This rider has delivery history. Suspend the rider instead of deleting the record." };
    const { error } = await supabase.from("delivery_profiles").delete().eq("id", riderId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/riders");
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Could not delete rider." }; }
}

export async function deleteRiderFormAction(formData: FormData) {
  const result = await deleteRiderAction(String(formData.get("riderId") ?? ""));
  if (!result.success) throw new Error(result.error);
}

export async function updateAdminOrderStatus(formData: FormData): Promise<void> {
  try {
    if (!(await requireAdmin())) return;
    const orderId = String(formData.get("orderId") ?? "").trim();
    const status = String(formData.get("status") ?? "").toLowerCase();
    const statuses = ["pending", "processing", "shipped", "out_for_delivery", "delivered", "completed", "cancelled"];
    if (!orderId || !statuses.includes(status)) return;

    const supabase = await createClient();
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) return;
    const { data: childOrders } = await supabase.from("shop_orders").select("id").eq("parent_order_id", orderId);
    if (childOrders?.length) await supabase.from("shop_orders").update({ order_status: status }).eq("parent_order_id", orderId);
    revalidatePath("/admin/orders", "page");
    revalidatePath("/account");
    revalidatePath(`/account/orders/${orderId}`);
    redirect("/admin/orders");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    console.error("Could not update admin order status", error);
  }
}
