"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

type VariantInput = { id?: string; name?: string; sku: string; price?: string | number; stock?: string | number; attributes: Record<string, string> };

async function adminClient() {
  const user = await getCurrentUser();
  if (user?.app_metadata?.is_admin !== true) return null;
  return createClient();
}

function parseVariants(value: FormDataEntryValue | null): VariantInput[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveAdminProductAction(productId: string | null, formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return { success: false, error: "Admin access required." };
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const shopId = String(formData.get("shop_id") ?? "").trim();
  const price = Number(formData.get("price"));
  const variants = parseVariants(formData.get("variants_json"));
  const categoryIds = formData.getAll("category_ids").map(String).filter(Boolean);
  const images = formData.getAll("images").map(String).map((item) => item.trim()).filter(Boolean);
  if (name.length < 2 || !slug || !shopId || !Number.isFinite(price) || price < 0) return { success: false, error: "Name, slug, shop, and a valid price are required." };
  const skuList = variants.map((item) => item.sku.trim()).filter(Boolean);
  if (new Set(skuList.map((item) => item.toLowerCase())).size !== skuList.length) return { success: false, error: "Variant SKUs must be unique." };

  const duplicateQuery = await supabase.from("product_variants").select("sku, product_id").in("sku", skuList);
  if (duplicateQuery.error) return { success: false, error: duplicateQuery.error.message };
  if ((duplicateQuery.data ?? []).some((row) => String(row.product_id) !== String(productId ?? ""))) return { success: false, error: "A variant SKU is already in use." };

  const id = productId ?? crypto.randomUUID();
  const payload = {
    id, shop_id: shopId, title: name, slug, description: String(formData.get("description") ?? "").trim(),
    brand: String(formData.get("brand") ?? "").trim() || null, sku: String(formData.get("sku") ?? "").trim() || null,
    price, compare_at_price: String(formData.get("sale_price") ?? "").trim() ? Number(formData.get("sale_price")) : null,
    status: formData.get("is_active") === "on" ? "published" : "draft", is_active: formData.get("is_active") === "on", is_featured: formData.get("is_featured") === "on",
  };
  let productResult = productId ? await supabase.from("products").update(payload).eq("id", id) : await supabase.from("products").insert(payload);
  if (productResult.error && /brand|is_active|is_featured/i.test(productResult.error.message)) {
    const legacyPayload = { id, shop_id: shopId, title: name, slug, description: payload.description, sku: payload.sku, price, compare_at_price: payload.compare_at_price, status: payload.status };
    productResult = productId ? await supabase.from("products").update(legacyPayload).eq("id", id) : await supabase.from("products").insert(legacyPayload);
  }
  if (productResult.error) return { success: false, error: productResult.error.message };

  const existing = await supabase.from("product_variants").select("id").eq("product_id", id);
  const keepIds = variants.map((item) => item.id).filter(Boolean) as string[];
  if (existing.data?.length) {
    const removed = existing.data.map((item) => String(item.id)).filter((item) => !keepIds.includes(item));
    if (removed.length) await supabase.from("product_variants").delete().in("id", removed);
  }
  if (variants.length) {
    const rows = variants.map((item) => ({ id: item.id || crypto.randomUUID(), product_id: id, name: item.name?.trim() || null, sku: item.sku.trim(), price: String(item.price ?? "").trim() ? Number(item.price) : price, stock_quantity: String(item.stock ?? "").trim() ? Math.max(0, Number(item.stock)) : 0, attributes: item.attributes }));
    const variantResult = await supabase.from("product_variants").upsert(rows, { onConflict: "id" });
    if (variantResult.error) return { success: false, error: variantResult.error.message };
  }
  await supabase.from("product_categories").delete().eq("product_id", id);
  if (categoryIds.length) await supabase.from("product_categories").insert(categoryIds.map((categoryId) => ({ product_id: id, category_id: categoryId })));
  if (images.length) {
    await supabase.from("product_images").delete().eq("product_id", id);
    let imageResult = await supabase.from("product_images").insert(images.map((image_url, index) => ({ id: crypto.randomUUID(), product_id: id, image_url, display_order: index + 1 })));
    if (imageResult.error) return { success: false, error: imageResult.error.message };
  }
  revalidatePath("/admin/products"); revalidatePath(`/admin/products/${id}/edit`); revalidatePath(`/product/${slug}`); revalidatePath("/");
  return { success: true, productId: id };
}