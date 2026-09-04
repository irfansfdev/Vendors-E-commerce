import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zptgxdlwqxglzrflmxsg.supabase.co";
const supabaseKey = "sb_publishable_yxkCet2gE_7wV05rnsOetA_k5g6Fahl";

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("=== CHECKING CATEGORIES TABLE ===");
  const { data: categories, error: catErr } = await supabase.from("categories").select("*");
  console.log("Categories error:", catErr);
  console.log("Categories data:", JSON.stringify(categories, null, 2));

  console.log("=== CHECKING PRODUCTS TABLE ===");
  const { data: products, error: prodErr } = await supabase.from("products").select("*").limit(5);
  console.log("Products error:", prodErr);
  console.log("Products data:", JSON.stringify(products, null, 2));

  console.log("=== CHECKING PRODUCT_IMAGES TABLE ===");
  const { data: prodImages, error: imgErr } = await supabase.from("product_images").select("*").limit(5);
  console.log("Product images error:", imgErr);
  console.log("Product images data:", JSON.stringify(prodImages, null, 2));

  console.log("=== CHECKING STORAGE BUCKETS ===");
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log("Buckets error:", bErr);
  console.log("Buckets:", JSON.stringify(buckets, null, 2));

  if (categories && categories.length > 0) {
    for (const cat of categories) {
      const img = cat.image_url || cat.image || cat.imageUrl || cat.image_path;
      if (img) {
        console.log(`Testing image URL for category ${cat.name}:`, img);
        try {
          const res = await fetch(img, { method: "HEAD" });
          console.log(`HTTP status for ${cat.name} image:`, res.status, res.statusText);
        } catch (e) {
          console.log(`Fetch error for ${cat.name}:`, e.message);
        }
      }
    }
  }
}

test();
