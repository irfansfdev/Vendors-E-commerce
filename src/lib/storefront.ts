import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Category, Product, ProductVariant, Shop, StorefrontData } from "@/lib/types";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const firstRecord = (value: unknown) => record(Array.isArray(value) ? value[0] : value);
const text = (value: unknown, fallback = "") => (typeof value === "string" && value ? value : fallback);
const number = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);
const rows = (value: unknown) => (Array.isArray(value) ? value.map(record) : []);

const fallbackCategoryImages: Record<string, string> = {
  ceramics: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80",
  textiles: "https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=400&q=80",
  apparel: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80",
  clothing: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80",
  lighting: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80",
  home: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80",
  stationery: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=400&q=80",
  art: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80",
};

function storageUrl(bucket: string, value: unknown) {
  const path = text(value).trim();
  if (!path || path === "undefined" || path === "null") return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:image/")) return path;
  const cleanPath = path.replace(/^\/+/, "");
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!baseUrl) return path;
  if (cleanPath.startsWith(`${bucket}/`)) {
    return `${baseUrl}/storage/v1/object/public/${cleanPath}`;
  }
  return `${baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

function mapCategory(raw: Record<string, unknown>): Category | null {
  const id = text(raw.id);
  const name = text(raw.name);
  if (!id || !name) return null;
  const slug = text(raw.slug, name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  
  const rawImage =
    raw.image_url ??
    raw.imageUrl ??
    raw.image ??
    raw.image_path ??
    raw.cover_image ??
    raw.thumbnail_url ??
    raw.banner_url;

  let imageUrl = "";
  if (rawImage && typeof rawImage === "string" && rawImage.trim()) {
    imageUrl = storageUrl("category-images", rawImage);
    if (!imageUrl || imageUrl.endsWith("/undefined") || imageUrl.endsWith("/null")) {
      imageUrl = storageUrl("shop-assets", rawImage);
    }
  }

  if (!imageUrl || imageUrl.endsWith("/undefined") || imageUrl.endsWith("/null")) {
    imageUrl = fallbackCategoryImages[slug] ?? "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80";
  }

  return {
    id,
    name,
    slug,
    imageUrl,
    productCount: number(raw.product_count ?? raw.products_count),
  };
}

function mapShop(raw: Record<string, unknown>): Shop | null {
  const id = text(raw.id);
  const name = text(raw.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    slug: text(raw.slug, name.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
    description: text(raw.description),
    logoUrl: storageUrl("shop-assets", raw.logo_url ?? raw.logo ?? raw.logo_path) || undefined,
    bannerUrl: storageUrl("shop-assets", raw.banner_url ?? raw.banner ?? raw.banner_path) || undefined,
    rating: number(raw.rating ?? raw.average_rating, 5),
    productCount: number(raw.product_count ?? raw.products_count),
    verified: bool(raw.verified ?? raw.is_verified, true),
  };
}

function mapVariant(raw: Record<string, unknown>, index: number, productPrice: number): ProductVariant {
  const attributesValue = record(raw.attributes);
  const attributes = Object.fromEntries(
    Object.entries(attributesValue).map(([key, value]) => [key, String(value)]),
  );
  return {
    id: text(raw.id, `variant-${index}`),
    name: text(raw.name, Object.values(attributes).join(" / ") || `Standard option`),
    sku: text(raw.sku, `SKU-${index + 1}`),
    price: number(raw.price, productPrice),
    stock: number(raw.stock_quantity ?? raw.stock, 10),
    attributes,
  };
}

function extractProductImages(raw: Record<string, unknown>): string[] {
  const urls: string[] = [];

  // 1. Array of images or product_images objects/strings
  const rawImages = raw.product_images ?? raw.images;
  if (Array.isArray(rawImages)) {
    // Sort if objects have position/display_order
    const sorted = [...rawImages].sort((a, b) => {
      if (a && typeof a === "object" && b && typeof b === "object") {
        const orderA = number((a as Record<string, unknown>).display_order ?? (a as Record<string, unknown>).sort_order ?? (a as Record<string, unknown>).position, 0);
        const orderB = number((b as Record<string, unknown>).display_order ?? (b as Record<string, unknown>).sort_order ?? (b as Record<string, unknown>).position, 0);
        return orderA - orderB;
      }
      return 0;
    });

    for (const item of sorted) {
      if (typeof item === "string" && item.trim()) {
        const url = storageUrl("product-images", item);
        if (url && !urls.includes(url)) urls.push(url);
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const imgVal = obj.image_url ?? obj.url ?? obj.path ?? obj.storage_path ?? obj.src ?? obj.image;
        if (imgVal) {
          const url = storageUrl("product-images", imgVal);
          if (url && !urls.includes(url)) urls.push(url);
        }
      }
    }
  } else if (typeof rawImages === "string" && rawImages.trim()) {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string" && item.trim()) {
            const url = storageUrl("product-images", item);
            if (url && !urls.includes(url)) urls.push(url);
          }
        }
      }
    } catch {
      const url = storageUrl("product-images", rawImages);
      if (url && !urls.includes(url)) urls.push(url);
    }
  }

  // 2. Direct product level fields
  const directFields = [
    raw.image_url,
    raw.imageUrl,
    raw.thumbnail_url,
    raw.thumbnailUrl,
    raw.cover_image,
    raw.coverImage,
    raw.image,
    raw.image_path,
  ];

  for (const field of directFields) {
    if (typeof field === "string" && field.trim()) {
      const url = storageUrl("product-images", field);
      if (url && !urls.includes(url)) {
        // Direct field image becomes primary if not already in list
        urls.unshift(url);
      }
    }
  }

  return urls.filter(Boolean);
}

function mapProduct(
  raw: Record<string, unknown>,
  categories: Category[],
  shops: Shop[],
): Product | null {
  const embeddedShop = firstRecord(raw.shops ?? raw.shop);
  const embeddedCategory = firstRecord(raw.categories ?? raw.category ?? raw.product_categories);
  const embeddedCategories = rows(raw.product_categories ?? raw.categories).map((item) => firstRecord(item.categories ?? item.category ?? item)).filter((item) => Object.keys(item).length > 0).map(mapCategory).filter((item): item is Category => item !== null);
  const id = text(raw.id);
  const name = text(raw.name ?? raw.title);
  if (!id || !name) return null;
  const shopId = text(raw.shop_id);
  const categoryId = text(raw.category_id);
  const productShop = Object.keys(embeddedShop).length
    ? mapShop(embeddedShop)
    : shops.find((item) => item.id === shopId) ?? shops[0] ?? null;
  const productCategory = Object.keys(embeddedCategory).length
    ? mapCategory(firstRecord(embeddedCategory.categories ?? embeddedCategory.category ?? embeddedCategory))
    : categories.find((item) => item.id === categoryId) ?? categories[0] ?? null;
  if (!productShop || !productCategory) return null;
  const price = number(raw.base_price ?? raw.price ?? raw.min_price, 25);
  const variantRows = rows(raw.product_variants ?? raw.variants);
  const variants = variantRows.length
    ? variantRows.map((item, variantIndex) => mapVariant(item, variantIndex, price))
    : [];

  const extractedImages = extractProductImages(raw);
  const images = extractedImages.length
    ? extractedImages
    : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80"];

  const stock = variants.length ? variants.reduce((total, variant) => total + variant.stock, 0) : number(raw.stock_quantity ?? raw.stock, 0);

  return {
    id,
    name,
    slug: text(raw.slug, name.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
    description: text(raw.description ?? raw.short_description, "A handcrafted item made with care."),
    price: variants.length ? Math.min(...variants.map((item) => item.price)) : price,
    compareAtPrice: number(raw.compare_at_price ?? raw.original_price) || undefined,
    currency: text(raw.currency, "PKR"),
    rating: number(raw.rating ?? raw.average_rating, 5),
    reviewsCount: number(raw.reviews_count ?? raw.review_count, 1),
    stock,
    badge: text(raw.badge) || (bool(raw.is_featured) ? "FEATURED" : undefined),
    images,
    category: productCategory,
    categories: embeddedCategories.length ? embeddedCategories : productCategory ? [productCategory] : [],
    shop: productShop,
    variants,
  };
}

export const getStorefrontData = cache(async (): Promise<StorefrontData> => {
  try {
    const supabase = await createClient();
    let [categoryResult, shopResult, productResult] = await Promise.all([
      supabase.from("categories").select("*"),
      supabase.from("shops").select("*"),
      supabase
        .from("products")
        .select("*, shops(*), product_variants(*), product_images(*), product_categories(categories(*))"),
    ]);

    if (productResult.error) {
      productResult = await supabase
        .from("products")
        .select("*, shops(*), product_variants(*), product_images(*)");
    }
    if (productResult.error) {
      productResult = await supabase.from("products").select("*");
    }

    if (categoryResult.error || shopResult.error || !productResult.data) {
      return { products: [], categories: [], shops: [], isLive: false };
    }

    const rawProducts = (productResult.data ?? []) as Record<string, unknown>[];

    // If product_images weren't loaded via join, load them separately
    if (rawProducts.length > 0 && !rawProducts.some((p) => Array.isArray(p.product_images) && p.product_images.length > 0)) {
      try {
        const { data: allImages } = await supabase.from("product_images").select("*");
        if (allImages && allImages.length > 0) {
          for (const p of rawProducts) {
            p.product_images = allImages.filter((img: { product_id?: string }) => img.product_id === p.id);
          }
        }
      } catch {
        // Continue with direct image attributes
      }
    }

    const rawCategories = (categoryResult.data ?? [])
      .map((item) => mapCategory(record(item)))
      .filter((item): item is Category => Boolean(item));
    const rawShops = (shopResult.data ?? [])
      .map((item) => mapShop(record(item)))
      .filter((item): item is Shop => Boolean(item));
    const products = rawProducts
      .map((item) => mapProduct(record(item), rawCategories, rawShops))
      .filter((item): item is Product => Boolean(item));

    // Dynamically calculate actual product counts for categories & shops
    const categories = rawCategories.map((cat) => {
      const dynamicCount = products.filter((p) => p.category.id === cat.id || p.category.slug === cat.slug).length;
      return {
        ...cat,
        productCount: Math.max(cat.productCount, dynamicCount),
      };
    });

    const shops = rawShops.map((sh) => {
      const dynamicCount = products.filter((p) => p.shop.id === sh.id || p.shop.slug === sh.slug).length;
      return {
        ...sh,
        productCount: Math.max(sh.productCount, dynamicCount),
      };
    });

    return { products, categories, shops, isLive: true };
  } catch {
    return { products: [], categories: [], shops: [], isLive: false };
  }
});

export async function getProductBySlug(slug: string) {
  const supabase = await createClient();
  let [categoryResult, shopResult, productResult] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("shops").select("*"),
    supabase
      .from("products")
      .select("*, shops(*), product_variants(*), product_images(*), product_categories(categories(*))")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle(),
  ]);

  if (productResult.error || !productResult.data) {
    productResult = await supabase
      .from("products")
      .select("*, shops(*), product_variants(*), product_images(*)")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
  }

  if (productResult.error || !productResult.data) {
    productResult = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
  }

  if (productResult.error || !productResult.data) {
    productResult = await supabase
      .from("products")
      .select("*, shops(*), product_variants(*), product_images(*), product_categories(categories(*))")
      .eq("id", slug)
      .limit(1)
      .maybeSingle();
  }

  if (!productResult.data) return null;

  const productRaw = record(productResult.data);

  // If product_images wasn't embedded, load directly
  if (!Array.isArray(productRaw.product_images) || productRaw.product_images.length === 0) {
    const { data: imagesData } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", String(productRaw.id))
      .order("display_order", { ascending: true });
    if (imagesData && imagesData.length > 0) {
      productRaw.product_images = imagesData;
    }
  }

  // If product_variants wasn't embedded, load directly
  if (!Array.isArray(productRaw.product_variants) || productRaw.product_variants.length === 0) {
    const { data: variantsData } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", String(productRaw.id));
    if (variantsData && variantsData.length > 0) {
      productRaw.product_variants = variantsData;
    }
  }

  const categories = (categoryResult.data ?? [])
    .map((item) => mapCategory(record(item)))
    .filter((item): item is Category => Boolean(item));
  const shops = (shopResult.data ?? [])
    .map((item) => mapShop(record(item)))
    .filter((item): item is Shop => Boolean(item));

  return mapProduct(productRaw, categories, shops);
}

export async function getShopBySlug(slug: string) {
  const supabase = await createClient();
  const shopResult = await supabase.from("shops").select("*").eq("slug", slug).limit(1).maybeSingle();
  if (shopResult.error || !shopResult.data) return null;
  const rawShop = mapShop(record(shopResult.data));
  if (!rawShop) return null;

  let [categoryResult, productResult] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase
      .from("products")
      .select("*, product_variants(*), product_images(*)")
      .eq("shop_id", rawShop.id),
  ]);

  if (productResult.error || !productResult.data) {
    productResult = await supabase
      .from("products")
      .select("*")
      .eq("shop_id", rawShop.id);
  }

  const rawProducts = (productResult.data ?? []) as Record<string, unknown>[];

  if (rawProducts.length > 0 && !rawProducts.some((p) => Array.isArray(p.product_images) && p.product_images.length > 0)) {
    try {
      const { data: allImages } = await supabase
        .from("product_images")
        .select("*")
        .in("product_id", rawProducts.map((p) => String(p.id)));
      if (allImages && allImages.length > 0) {
        for (const p of rawProducts) {
          p.product_images = allImages.filter((img: { product_id?: string }) => img.product_id === p.id);
        }
      }
    } catch {
      // Continue
    }
  }

  const categories = (categoryResult.data ?? [])
    .map((item) => mapCategory(record(item)))
    .filter((item): item is Category => Boolean(item));
  const products = rawProducts
    .map((item) => mapProduct(record(item), categories, [rawShop]))
    .filter((item): item is Product => Boolean(item));
  const shop = {
    ...rawShop,
    productCount: Math.max(rawShop.productCount, products.length),
  };
  return { shop, products };
}
