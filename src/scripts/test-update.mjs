import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zptgxdlwqxglzrflmxsg.supabase.co";
const supabaseKey = "sb_publishable_yxkCet2gE_7wV05rnsOetA_k5g6Fahl";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  console.log("Testing update on categories table with image_url...");
  const testUrl = "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80";
  const { data, error } = await supabase
    .from("categories")
    .update({ image_url: testUrl })
    .eq("slug", "electronics")
    .select();

  console.log("Update result data:", data);
  console.log("Update error:", error);

  console.log("Testing storage upload to category-images...");
  const dummyBuffer = Buffer.from("fake-image-data");
  const uploadRes = await supabase.storage.from("category-images").upload("test-cat.txt", dummyBuffer, { upsert: true });
  console.log("Storage uploadRes:", uploadRes);

  const pubUrl = supabase.storage.from("category-images").getPublicUrl("test-cat.txt");
  console.log("Public URL:", pubUrl);
}

testUpdate();
