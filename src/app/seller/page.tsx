import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SellerDashboard } from "@/components/seller-dashboard";
import { SellerOnboarding, ShopPendingNotice } from "@/components/seller-onboarding";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Seller dashboard" };
export const dynamic = "force-dynamic";

export default async function SellerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/seller");
  const supabase = await createClient();
  let shop: Record<string, unknown> | null = null;
  let role = "owner";
  try {
    const memberResult = await supabase.from("shop_members").select("role, shop_id, shops(*)").eq("user_id", user.id).in("role", ["owner", "manager"]).limit(1).maybeSingle();
    const member = memberResult.data as Record<string, unknown> | null;
    if (member) {
      role = String(member.role ?? "viewer");
      const relation = Array.isArray(member.shops) ? member.shops[0] : member.shops;
      if (relation && typeof relation === "object") shop = relation as Record<string, unknown>;
    }
    if (!shop) {
      const ownerResult = await supabase.from("shops").select("*").eq("owner_id", user.id).limit(1).maybeSingle();
      shop = ownerResult.data as Record<string, unknown> | null;
    }
  } catch { shop = null; }
  if (!shop?.id) return <SellerOnboarding />;
  if (String(shop.status ?? "") !== "active") return <ShopPendingNotice shop={shop} />;
  const shopId = String(shop.id);
  const [productsResult, ordersResult, payoutsResult] = await Promise.all([
    supabase.from("products").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(25),
    supabase.from("shop_orders").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(25),
    supabase.from("payouts").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(12),
  ]);
  return <SellerDashboard shop={shop} role={role} products={(productsResult.data ?? []) as Record<string, unknown>[]} orders={(ordersResult.data ?? []) as Record<string, unknown>[]} payouts={(payoutsResult.data ?? []) as Record<string, unknown>[]} />;
}
