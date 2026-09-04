"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function createShopRequestAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Please sign in before creating a shop." };

    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    const description = String(formData.get("description") ?? "").trim();
    if (name.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || description.length < 10) {
      return { success: false, error: "Please provide a valid shop name, URL, and description." };
    }

    const supabase = await createClient();
    const { data: existingShop } = await supabase.from("shops").select("id").eq("slug", slug).maybeSingle();
    if (existingShop) return { success: false, error: "This shop URL is already in use. Please choose another one." };

    const shopId = crypto.randomUUID();
    const upload = async (value: FormDataEntryValue | null, type: string) => {
      if (!(value instanceof File) || value.size === 0) return null;
      const extension = value.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${shopId}/${type}-${Date.now()}.${extension}`;
      try {
        const { error } = await supabase.storage.from("shop-assets").upload(path, value, { upsert: true, contentType: value.type });
        if (!error) {
          return supabase.storage.from("shop-assets").getPublicUrl(path).data.publicUrl;
        }
      } catch {}
      try {
        const bytes = await value.arrayBuffer();
        const buffer = Buffer.from(bytes);
        return `data:${value.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
      } catch {
        return null;
      }
    };

    const [logoUrl, bannerUrl] = await Promise.all([
      upload(formData.get("logo"), "logo"),
      upload(formData.get("banner"), "banner"),
    ]);

    const { error } = await supabase.from("shops").insert({ id: shopId, owner_id: user.id, name, slug, description, logo_url: logoUrl, banner_url: bannerUrl, status: "pending" });
    if (error) {
      if (error.code === "23505") return { success: false, error: "This shop URL is already in use. Please choose another one." };
      if (error.code === "42501" || error.message.toLowerCase().includes("row-level security")) {
        return { success: false, error: "Shop requests are not enabled in Supabase yet. Apply supabase/migrations/20260903000000_shop_request_rls.sql in the Supabase SQL Editor." };
      }
      return { success: false, error: `Shop request could not be submitted: ${error.message}` };
    }

    revalidatePath("/seller");
    revalidatePath("/admin");
    revalidatePath("/admin/shops");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Shop request could not be submitted." };
  }
}