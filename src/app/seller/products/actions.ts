"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type PublishProductInput = {
  shopId: string;
  name: string;
  slug: string;
  description: string;
  categoryId?: string;
  price: number;
  compare_at_price?: number | null;
  variants: {
    id: string;
    sku: string;
    price: number;
    compare_at_price?: number | null;
    stock: number;
    attributes: Record<string, string>;
  }[];
  images: string[];
};

export async function publishProductAction(input: PublishProductInput): Promise<{ success: boolean; error?: string; productId?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Please sign in to publish products." };
    }

    const supabase = await createClient();
    const productId = crypto.randomUUID();

    // Verify shop ownership or member role
    const memberResult = await supabase
      .from("shop_members")
      .select("role")
      .eq("shop_id", input.shopId)
      .eq("user_id", user.id)
      .in("role", ["owner", "manager"])
      .maybeSingle();

    const shopResult = await supabase
      .from("shops")
      .select("owner_id, slug, status")
      .eq("id", input.shopId)
      .maybeSingle();

    const isAuthorized = Boolean(memberResult.data) || (shopResult.data as { owner_id?: string } | null)?.owner_id === user.id;
    if (!isAuthorized) {
      return { success: false, error: "You do not have owner/manager permissions for this shop." };
    }
    if (String((shopResult.data as { status?: string } | null)?.status ?? "") !== "active") {
      return { success: false, error: "Only active shops can publish products." };
    }

    // 1. Insert the product using the columns in the catalog schema.
    const productPayload: Record<string, unknown> = {
      id: productId,
      shop_id: input.shopId,
      category_id: input.categoryId || null,
      title: input.name,
      slug: input.slug,
      description: input.description,
      price: input.price,
      compare_at_price: input.compare_at_price,
      status: "pending",
    };

    const prodResult = await supabase.from("products").insert(productPayload);
    if (prodResult.error) {
      return { success: false, error: `Could not save product: ${prodResult.error.message}` };
    }

    // 2. Insert variants
    if (input.variants.length > 0) {
      const variantPayload = input.variants.map((v) => ({
        id: v.id || crypto.randomUUID(),
        product_id: productId,
        sku: v.sku,
        price: v.price,
        compare_at_price: v.compare_at_price,
        stock_quantity: v.stock,
        attributes: v.attributes,
      }));

      const { error: varErr1 } = await supabase.from("product_variants").insert(variantPayload);
      if (varErr1) {
        const fallbackVariantPayload = input.variants.map((v) => ({
          id: v.id || crypto.randomUUID(),
          product_id: productId,
          sku: v.sku,
          price: v.price,
          compare_at_price: v.compare_at_price,
          stock: v.stock,
          attributes: v.attributes,
        }));
        await supabase.from("product_variants").insert(fallbackVariantPayload);
      }
    }

    // 3. Insert images into product_images table
    if (input.images.length > 0) {
      const imagePayload = input.images.map((url, index) => ({
        id: crypto.randomUUID(),
        product_id: productId,
        image_url: url,
        display_order: index + 1,
      }));
      const { error: imgErr } = await supabase.from("product_images").insert(imagePayload);
      if (imgErr) {
        return { success: false, error: `Could not save product images: ${imgErr.message}` };
      }
    }

    // 4. Link category in product_categories junction table
    if (input.categoryId) {
      try {
        await supabase.from("product_categories").insert({
          product_id: productId,
          category_id: input.categoryId,
        });
      } catch {
        // Handled via category_id if table not used
      }
    }

    // Revalidate paths so fresh images and product entries appear immediately
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/seller");
    revalidatePath(`/product/${input.slug}`);
    const shopSlug = (shopResult.data as { slug?: string } | null)?.slug;
    if (shopSlug) {
      revalidatePath(`/shop/${shopSlug}`);
    }

    return { success: true, productId };
  } catch (caught) {
    return {
      success: false,
      error: caught instanceof Error ? caught.message : "An unexpected error occurred while publishing.",
    };
  }
}

export async function deleteProductAction(productId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please sign in." };
  const supabase = await createClient();
  const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!shop?.id) return { success: false, error: "Seller shop not found." };
  const { error } = await supabase.from("products").delete().eq("id", productId).eq("shop_id", shop.id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/seller");
  revalidatePath("/seller/products");
  revalidatePath("/search");
  return { success: true };
}

export async function updateProductAction(productId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please sign in." };
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  const compareAtPriceValue = String(formData.get("compare_at_price") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const requestedStatus = String(formData.get("status") ?? "published");
  let variants: Array<{ id?: string; sku: string; price: number; compare_at_price?: number | null; stock: number; attributes: Record<string, string> }> = [];
  try { variants = JSON.parse(String(formData.get("variants_json") ?? "[]")); } catch { return { success: false, error: "Invalid variant data." }; }
  if (title.length < 2 || !description || !Number.isFinite(price) || price < 0) {
    return { success: false, error: "Please provide a valid title, description, and price." };
  }
  const supabase = await createClient();
  const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!shop?.id) return { success: false, error: "Seller shop not found." };
  const { data: currentProduct } = await supabase.from("products").select("status").eq("id", productId).eq("shop_id", shop.id).maybeSingle();
  const currentStatus = String(currentProduct?.status ?? "published").toLowerCase();
  const status = currentStatus === "pending" ? "pending" : ["published", "draft", "archived"].includes(requestedStatus) ? requestedStatus : "published";
  const { error } = await supabase.from("products").update({ title, description, price, compare_at_price: compareAtPriceValue ? Number(compareAtPriceValue) : null, category_id: categoryId || null, status }).eq("id", productId).eq("shop_id", shop.id);
  if (error) return { success: false, error: error.message };
  await supabase.from("product_variants").delete().eq("product_id", productId);
  if (variants.length > 0) {
    const { error: variantError } = await supabase.from("product_variants").insert(variants.map((variant) => ({ id: variant.id || crypto.randomUUID(), product_id: productId, sku: variant.sku, price: variant.price, compare_at_price: variant.compare_at_price ?? null, stock_quantity: variant.stock, attributes: variant.attributes })));
    if (variantError) return { success: false, error: variantError.message };
  }
  const imageFiles = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  const existingImages = formData.getAll("existing_images").filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  if (imageFiles.length > 0 || existingImages.length > 0) {
    const imageRows = [];
    imageRows.push(...existingImages.map((url, index) => ({ id: crypto.randomUUID(), product_id: productId, image_url: url, display_order: index + 1 })));
    for (const [index, file] of imageFiles.entries()) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${shop.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("product-images").upload(path, file, { upsert: true, contentType: file.type });
      if (upload.error) return { success: false, error: `Could not upload image: ${upload.error.message}` };
      const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      imageRows.push({ id: crypto.randomUUID(), product_id: productId, image_url: url, display_order: existingImages.length + index + 1 });
    }
    const { error: imageError } = await supabase.from("product_images").delete().eq("product_id", productId);
    if (imageError) return { success: false, error: imageError.message };
    const { error: insertError } = await supabase.from("product_images").insert(imageRows);
    if (insertError) return { success: false, error: insertError.message };
  }
  revalidatePath("/seller");
  revalidatePath("/seller/products");
  return { success: true };
}