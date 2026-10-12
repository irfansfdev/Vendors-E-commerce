// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { ActiveNavLink } from "@/components/layout/active-nav-link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isAdmin = user?.app_metadata?.is_admin === true;

  if (!isAdmin) {
    redirect("/");
  }

  const supabase = await createClient();
  const [
    pendingShopsResult,
    pendingProductsResult,
    pendingFeaturedResult,
    pendingRidersResult,
    pendingReturnsResult,
    pendingReviewsResult,
    pendingPayoutsResult,
    pendingOrdersResult,
    readyOrdersResult,
    pickupReturnsResult,
    activeAssignmentsResult,
  ] = await Promise.all([
    supabase.from("shops").select("id", { count: "exact" }).eq("status", "pending").limit(10000),
    supabase.from("products").select("id", { count: "exact" }).eq("status", "pending").limit(10000),
    supabase.from("products").select("id", { count: "exact" }).eq("featured_status", "pending").limit(10000),
    supabase.from("delivery_profiles").select("id", { count: "exact" }).eq("status", "pending").limit(10000),
    supabase.from("return_requests").select("id", { count: "exact" }).in("status", ["requested", "escalated", "inspection_failed", "refund_pending"]).limit(10000),
    supabase.from("product_reviews").select("id", { count: "exact" }).eq("status", "pending").limit(10000),
    supabase.from("payouts").select("id", { count: "exact" }).in("status", ["pending", "requested"]).limit(10000),
    supabase.from("shop_orders").select("id", { count: "exact" }).eq("order_status", "pending").limit(10000),
    supabase.from("shop_orders").select("id").eq("order_status", "ready_for_pickup").limit(10000),
    supabase.from("return_requests").select("id").in("status", ["approved", "pickup_assigned"]).limit(10000),
    supabase.from("delivery_assignments").select("shop_order_id,return_request_id,assignment_type").in("status", ["assigned", "accepted", "picked_up", "out_for_delivery"]).limit(20000),
  ]);

  const readyOrderIds = new Set((readyOrdersResult.data ?? []).map((row) => String(row.id)));
  const pickupReturnIds = new Set((pickupReturnsResult.data ?? []).map((row) => String(row.id)));
  const assignedOrderIds = new Set<string>();
  const assignedReturnIds = new Set<string>();
  for (const assignment of activeAssignmentsResult.data ?? []) {
    if (assignment.assignment_type === "return_pickup" && assignment.return_request_id) {
      assignedReturnIds.add(String(assignment.return_request_id));
    } else if (assignment.shop_order_id) {
      assignedOrderIds.add(String(assignment.shop_order_id));
    }
  }
  const waitingPickupCount =
    [...readyOrderIds].filter((id) => !assignedOrderIds.has(id)).length
    + [...pickupReturnIds].filter((id) => !assignedReturnIds.has(id)).length;
  const waitingPickupIds = [
    ...[...readyOrderIds].filter((id) => !assignedOrderIds.has(id)).map((id) => `order:${id}`),
    ...[...pickupReturnIds].filter((id) => !assignedReturnIds.has(id)).map((id) => `return:${id}`),
  ];

  const sidebarCounts: Record<string, number | undefined> = {
    "/admin/shops": pendingShopsResult.error ? undefined : pendingShopsResult.count ?? 0,
    "/admin/products": pendingProductsResult.error || pendingFeaturedResult.error
      ? undefined
      : (pendingProductsResult.count ?? 0) + (pendingFeaturedResult.count ?? 0),
    "/admin/returns": pendingReturnsResult.error ? undefined : pendingReturnsResult.count ?? 0,
    "/admin/deliveries": readyOrdersResult.error || pickupReturnsResult.error || activeAssignmentsResult.error
      ? undefined
      : waitingPickupCount,
    "/admin/reviews": pendingReviewsResult.error ? undefined : pendingReviewsResult.count ?? 0,
    "/admin/payouts": pendingPayoutsResult.error ? undefined : pendingPayoutsResult.count ?? 0,
    "/admin/riders": pendingRidersResult.error ? undefined : pendingRidersResult.count ?? 0,
    "/admin/orders": pendingOrdersResult.error ? undefined : pendingOrdersResult.count ?? 0,
  };
  const sidebarItems: Record<string, string[] | undefined> = {
    "/admin/shops": pendingShopsResult.data?.map((row) => `shop:${String(row.id)}`),
    "/admin/products": [
      ...(pendingProductsResult.data ?? []).map((row) => `product:${String(row.id)}`),
      ...(pendingFeaturedResult.data ?? []).map((row) => `featured:${String(row.id)}`),
    ],
    "/admin/returns": pendingReturnsResult.data?.map((row) => `return:${String(row.id)}`),
    "/admin/deliveries": waitingPickupIds,
    "/admin/reviews": pendingReviewsResult.data?.map((row) => `review:${String(row.id)}`),
    "/admin/payouts": pendingPayoutsResult.data?.map((row) => `payout:${String(row.id)}`),
    "/admin/riders": pendingRidersResult.data?.map((row) => `rider:${String(row.id)}`),
    "/admin/orders": pendingOrdersResult.data?.map((row) => `order:${String(row.id)}`),
  };

  for (const [section, error] of [
    ["shop requests", pendingShopsResult.error],
    ["product requests", pendingProductsResult.error ?? pendingFeaturedResult.error],
    ["rider requests", pendingRidersResult.error],
    ["return requests", pendingReturnsResult.error],
    ["delivery queue", readyOrdersResult.error ?? pickupReturnsResult.error ?? activeAssignmentsResult.error],
    ["review requests", pendingReviewsResult.error],
    ["payout requests", pendingPayoutsResult.error],
    ["new order", pendingOrdersResult.error],
  ] as const) {
    if (error) console.error(`Could not load ${section} count for the admin sidebar:`, error.message);
  }

  const navItems = [
    { name: "Overview", href: "/admin", icon: "dashboard" as const },
    { name: "Shops", href: "/admin/shops", icon: "store" as const },
    { name: "Products", href: "/admin/products", icon: "products" as const },
    { name: "Categories", href: "/admin/categories", icon: "categories" as const },
    { name: "Global Orders", href: "/admin/orders", icon: "orders" as const },
    { name: "Coupons", href: "/admin/coupons", icon: "coupons" as const },
    { name: "Returns", href: "/admin/returns", icon: "returns" as const },
    { name: "Delivery queue", href: "/admin/deliveries", icon: "deliveries" as const },
    { name: "Reviews", href: "/admin/reviews", icon: "reviews" as const },
    { name: "Payouts", href: "/admin/payouts", icon: "payouts" as const },
    { name: "Riders", href: "/admin/riders", icon: "riders" as const },
    { name: "Pricing settings", href: "/admin/settings", icon: "settings" as const },
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-slate-50 dark:bg-[#080d18]">
      {/* Admin Sidebar - 'self-start' se sticky perfect kaam karega */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start overflow-y-auto bg-white px-4 py-6 dark:bg-slate-950 lg:block">
        <h2 className="mb-8 px-2 text-xl font-black text-orange-500 tracking-tight">BabulShop Admin</h2>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <ActiveNavLink key={item.name} href={item.href} label={item.name} icon={item.icon} exact={item.href === "/admin"} badge={sidebarCounts[item.href]} badgeItems={sidebarItems[item.href]} badgeStorageKey={`${user.id}:admin`} />
          ))}
        </nav>
      </aside>

      {/* Mobile Navbar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-950 lg:hidden">
        <div className="mb-2 text-xs font-black text-orange-500">BabulShop Admin</div>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <ActiveNavLink key={item.name} href={item.href} label={item.name} icon={item.icon} exact={item.href === "/admin"} compact badge={sidebarCounts[item.href]} badgeItems={sidebarItems[item.href]} badgeStorageKey={`${user.id}:admin`} />
          ))}
        </nav>
      </div>

      {/* Main Admin Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}