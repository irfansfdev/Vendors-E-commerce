import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SellerDashboard } from "@/components/seller-dashboard";
import { SellerOnboarding, ShopPendingNotice } from "@/components/seller-onboarding";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Seller dashboard" };
export const dynamic = "force-dynamic";

export default async function SellerPage({
  searchParams,
}: {
  searchParams: Promise<{ settings?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/seller");
  const { settings } = await searchParams;
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
  await supabase.rpc("refresh_payout_availability");
  await supabase.rpc("refresh_earnings_availability");
  const [productsResult, ordersResult, payoutsResult, earningsResult] = await Promise.all([
    supabase.from("products").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(25),
    supabase.from("shop_orders").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(25),
    supabase.from("payouts").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(1000),
    supabase.from("shop_earnings").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(1000),
  ]);
  const shopOrders = (ordersResult.data ?? []) as Record<string, unknown>[];
  const parentOrderIds = shopOrders.map((order) => String(order.parent_order_id ?? "")).filter(Boolean);
  const { data: parentOrders } = parentOrderIds.length
    ? await supabase.from("orders").select("*").in("id", parentOrderIds)
    : { data: [] };
  const parentById = new Map((parentOrders ?? []).map((order) => [String(order.id), order as Record<string, unknown>]));
  const dashboardOrders = shopOrders.map((order) => {
    const parent = parentById.get(String(order.parent_order_id ?? ""));
    return {
      ...order,
      payment_status: parent?.payment_status ?? order.payment_status,
      paid_at: parent?.paid_at ?? order.paid_at,
    };
  });
  const { data: orderItems } = parentOrderIds.length
    ? await supabase.from("order_items").select("quantity, shop_order_id, product_variants(price, products(price))").in("shop_order_id", shopOrders.map((order) => String(order.id)))
    : { data: [] };
  return <><div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-8">{settings === "saved" && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Shop settings saved successfully.</p>}</div><SellerDashboard shop={shop} role={role} products={(productsResult.data ?? []) as Record<string, unknown>[]} orders={dashboardOrders} payouts={(payoutsResult.data ?? []) as Record<string, unknown>[]} earnings={(earningsResult.data ?? []) as Record<string, unknown>[]} orderItems={(orderItems ?? []) as Record<string, unknown>[]} /></>;
}
