import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function getSellerContext() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/seller");

  const supabase = await createClient();
  const member = await supabase
    .from("shop_members")
    .select("role, shop_id, shops(*)")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .limit(1)
    .maybeSingle();
  const memberRow = member.data as Record<string, unknown> | null;
  const memberShop = memberRow?.shops;
  let shop = Array.isArray(memberShop) ? memberShop[0] : memberShop;
  let role = String(memberRow?.role ?? "owner");

  if (!shop || typeof shop !== "object") {
    const owned = await supabase.from("shops").select("*").eq("owner_id", user.id).limit(1).maybeSingle();
    shop = owned.data;
    role = "owner";
  }

  if (!shop || typeof shop !== "object" || !shop.id) redirect("/seller");
  if (String(shop.status ?? "") !== "active") redirect("/seller");
  return { supabase, user, shop: shop as Record<string, unknown>, role };
}
