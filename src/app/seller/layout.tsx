import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { SellerSidebar } from "@/components/seller/seller-sidebar";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const counts: { products?: number; orders?: number; returns?: number; payouts?: number } = {};
  const badgeItems: { products?: string[]; orders?: string[]; returns?: string[]; payouts?: string[] } = {};
  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    const memberResult = await supabase.from("shop_members")
      .select("shop_id,shops(id,status)")
      .eq("user_id", user.id)
      .in("role", ["owner", "manager"])
      .limit(1)
      .maybeSingle();
    let shop: { id: string; status: string } | null = null;
    const memberRelation: unknown = memberResult.data?.shops;
    const memberShop = Array.isArray(memberRelation) ? memberRelation[0] : memberRelation;
    if (memberShop && typeof memberShop === "object" && "id" in memberShop) {
      shop = memberShop as { id: string; status: string };
    }

    if (!shop || typeof shop !== "object") {
      const ownerResult = await supabase.from("shops")
        .select("id,status")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();
      shop = ownerResult.data as { id: string; status: string } | null;
    }

    if (shop && typeof shop === "object" && shop.id && shop.status === "active") {
      const shopId = String(shop.id);
      const [
        ordersResult,
        productsResult,
        returnsResult,
        payoutsResult,
      ] = await Promise.all([
        supabase.from("shop_orders").select("id", { count: "exact" })
          .eq("shop_id", shopId).in("order_status", ["pending", "confirmed", "preparing", "ready_for_pickup"]).limit(10000),
        supabase.from("products").select("id", { count: "exact" })
          .eq("shop_id", shopId).eq("status", "pending").limit(10000),
        supabase.from("return_requests").select("id,shop_orders!inner(shop_id)", { count: "exact" })
          .eq("shop_orders.shop_id", shopId).in("status", ["requested", "returned_to_shop"]).limit(10000),
        supabase.from("payouts").select("id", { count: "exact" })
          .eq("shop_id", shopId).eq("status", "available").limit(10000),
      ]);
      const errors = [
        ["seller order", ordersResult.error],
        ["seller product", productsResult.error],
        ["seller return", returnsResult.error],
        ["seller payout", payoutsResult.error],
      ] as const;
      for (const [label, error] of errors) {
        if (error) console.error(`Could not load ${label} badge count:`, error.message);
      }
      if (!ordersResult.error) counts.orders = ordersResult.count ?? 0;
      if (!productsResult.error) counts.products = productsResult.count ?? 0;
      if (!returnsResult.error) counts.returns = returnsResult.count ?? 0;
      if (!payoutsResult.error) counts.payouts = payoutsResult.count ?? 0;
      if (!ordersResult.error) badgeItems.orders = (ordersResult.data ?? []).map((row) => `order:${String(row.id)}`);
      if (!productsResult.error) badgeItems.products = (productsResult.data ?? []).map((row) => `product:${String(row.id)}`);
      if (!returnsResult.error) badgeItems.returns = (returnsResult.data ?? []).map((row) => `return:${String(row.id)}`);
      if (!payoutsResult.error) badgeItems.payouts = (payoutsResult.data ?? []).map((row) => `payout:${String(row.id)}`);
    } else if (memberResult.error) {
      console.error("Could not resolve seller shop for sidebar request counts:", memberResult.error.message);
    }
  }

  return <div className="mx-auto grid max-w-[1440px] items-start gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[210px_1fr] lg:px-8"><SellerSidebar counts={counts} badgeItems={badgeItems} userId={user?.id ?? "guest"} /><div className="min-w-0">{children}</div></div>;
}
