import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BadgeDollarSign, Bike, CircleDollarSign, Package, ShoppingBag, Sparkles, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CompactPanel } from "@/components/shared/compact-panel";
import { formatMoney, StatCard } from "@/components/shared/stat-card";
import { AdminRequestLinks } from "@/components/shared/admin-request-links";
import { DashboardAnalyticsHub } from "@/components/shared/dashboard-analytics-hub";
import { getCurrentTimeMs } from "@/lib/returns/time";
import { AdminPendingShopActions } from "@/components/admin/shops/admin-pending-shop-actions";

export const metadata: Metadata = { title: "Platform Admin | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function amount(row: Row) {
  const gross = Number(row.gross_amount ?? 0);
  if (gross > 0) return gross;
  if (row.sub_total !== undefined) {
    return Math.max(0, Number(row.sub_total ?? 0) - (row.discount_funded_by === "shop" ? Number(row.discount_amount ?? 0) : 0));
  }
  if (row.subtotal_amount !== undefined) {
    return Math.max(0, Number(row.subtotal_amount ?? 0) - Number(row.discount_amount ?? 0));
  }
  const settlement = Number(row.seller_earnings ?? 0) + Number(row.platform_commission ?? row.platform_fee ?? 0);
  if (settlement > 0) return settlement;
  return Number(row.calculated_total ?? row.subtotal ?? row.amount ?? row.order_total ?? row.grand_total ?? row.total_price ?? row.total_amount ?? row.total ?? 0);
}
function status(row: Row) { return String(row.order_status ?? row.status ?? "pending").toLowerCase(); }
function isRevenue(row: Row) { return ["paid", "partially_refunded"].includes(String(row.payment_status ?? "").toLowerCase()) || ["delivered", "completed"].includes(status(row)); }
function monthlySales(rows: Row[]) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const matching = rows.filter((row) => isRevenue(row) && String(row.paid_at ?? row.delivered_at ?? row.updated_at ?? row.created_at ?? "").slice(0, 7) === key);
    return { label: date.toLocaleDateString("en-US", { month: "short" }), primaryValue: matching.reduce((sum, row) => sum + amount(row), 0), secondaryValue: matching.length, count: matching.length };
  });
}

export default async function AdminPage() {
  const supabase = await createClient();
  await supabase.rpc("refresh_payout_availability");
  const [ordersResult, shopsResult, profilesResult, categoriesResult, shopOrdersResult, transactionsResult, payoutsResult, pendingResult, returnsResult, pendingProductsResult, pendingFeaturedResult, pendingRidersResult] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("shops").select("id, name, status, commission_rate"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id, name", { count: "exact" }),
    supabase.from("shop_orders").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("transactions").select("amount,platform_fee,status,created_at").eq("status", "completed").order("created_at", { ascending: false }).limit(2000),
    supabase.from("payouts").select("amount,net_amount,status").limit(2000),
    supabase.from("shops").select("id,name,slug,created_at", { count: "exact" }).eq("status", "pending").order("created_at", { ascending: false }).limit(6),
    supabase.from("return_requests").select("id,shop_order_id,status,refund_amount,refunded_at,seller_response_due_at,shop_orders!inner(shop_id)").order("requested_at", { ascending: false }).limit(5000),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("featured_status", "pending"),
    supabase.from("delivery_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const orders = (ordersResult.data ?? []) as Row[];
  const allShops = (shopsResult.data ?? []) as Row[];
  const shopOrders = (shopOrdersResult.data ?? []) as Row[];
  const transactionRows = (transactionsResult.data ?? []) as Row[];
  const orderRowsHaveValue = [...shopOrders, ...orders].some((row) => amount(row) > 0);
  const revenueRows = orderRowsHaveValue ? (shopOrders.length ? shopOrders : orders) : transactionRows;
  
  const delivered = revenueRows.filter((row) => ["delivered", "completed"].includes(status(row)));
  const statusDelivered = revenueRows.filter((row) => status(row) === "delivered");
  const completed = revenueRows.filter((row) => status(row) === "completed");
  const shipped = revenueRows.filter((row) => status(row) === "shipped");
  const processing = revenueRows.filter((row) => status(row) === "processing");
  const pending = revenueRows.filter((row) => status(row) === "pending");
  const cancelled = revenueRows.filter((row) => ["cancelled", "refunded", "failed"].includes(status(row)));

  const sales = revenueRows.filter(isRevenue).reduce((sum, row) => sum + amount(row), 0);
  const nowMs = getCurrentTimeMs();
  const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
  const recentPricingOrders = shopOrders.filter((row) => {
    const createdAt = new Date(String(row.created_at ?? "")).getTime();
    return Number.isFinite(createdAt) && createdAt >= thirtyDaysAgo && createdAt <= nowMs;
  });
  const couponDiscounts30d = recentPricingOrders.reduce((sum, row) => sum + Number(row.platform_discount_cost ?? 0) + Number(row.delivery_discount ?? 0), 0);
  const deliveryFees30d = recentPricingOrders.reduce((sum, row) => sum + Math.max(0, Number(row.delivery_fee ?? 0) - Number(row.delivery_discount ?? 0)), 0);
  const payouts = (payoutsResult.data ?? []) as Row[];
  const returnRows = (returnsResult.data ?? []) as Row[];
  const commission = revenueRows.reduce((sum, row) => sum + Number(row.platform_commission ?? row.platform_fee ?? 0), 0);
  
  const points = monthlySales(revenueRows);
  const activeShops = allShops.filter((s) => String(s.status).toLowerCase() === "active");
  const openReturns = returnRows.filter((row) => !["refunded", "rejected", "cancelled"].includes(String(row.status)));
  const needsReturnAttention = returnRows.filter((row) => ["escalated", "inspection_failed"].includes(String(row.status))
    || (row.status === "requested" && row.seller_response_due_at && new Date(String(row.seller_response_due_at)).getTime() <= nowMs));
  const refundsPending = returnRows.filter((row) => row.status === "refund_pending").reduce((sum, row) => sum + Number(row.refund_amount ?? 0), 0);
  const monthStart = new Date(new Date(nowMs).getFullYear(), new Date(nowMs).getMonth(), 1).getTime();
  const refundedThisMonth = returnRows.filter((row) => row.status === "refunded" && row.refunded_at
    && new Date(String(row.refunded_at)).getTime() >= monthStart
    && new Date(String(row.refunded_at)).getTime() <= nowMs)
    .reduce((sum, row) => sum + Number(row.refund_amount ?? 0), 0);
  const deliveredCountByShop = new Map<string, number>();
  for (const order of shopOrders) {
    if (!order.delivered_at && !["delivered", "completed"].includes(status(order))) continue;
    const shopId = String(order.shop_id ?? "");
    deliveredCountByShop.set(shopId, (deliveredCountByShop.get(shopId) ?? 0) + 1);
  }
  const returnOrdersByShop = new Map<string, Set<string>>();
  for (const returnRow of returnRows) {
    if (returnRow.status === "cancelled") continue;
    const shopOrder = Array.isArray(returnRow.shop_orders) ? returnRow.shop_orders[0] as Row | undefined : returnRow.shop_orders as Row | undefined;
    const shopId = String(shopOrder?.shop_id ?? "");
    if (!shopId) continue;
    const ordersForShop = returnOrdersByShop.get(shopId) ?? new Set<string>();
    ordersForShop.add(String(returnRow.shop_order_id));
    returnOrdersByShop.set(shopId, ordersForShop);
  }
  const highestReturnRates = allShops.map((shop) => {
    const shopId = String(shop.id);
    const deliveredCount = deliveredCountByShop.get(shopId) ?? 0;
    const requestCount = returnOrdersByShop.get(shopId)?.size ?? 0;
    return { id: shopId, name: String(shop.name ?? "Shop"), deliveredCount, requestCount, rate: deliveredCount ? requestCount / deliveredCount : 0 };
  }).filter((shop) => shop.deliveredCount > 0 && shop.requestCount > 0)
    .sort((a, b) => b.rate - a.rate || b.requestCount - a.requestCount)
    .slice(0, 5);

  // Shop Rankings Leaderboard (Horizontal Bars)
  const shopSalesMap = new Map<string, { name: string; sales: number; orders: number }>();
  for (const s of allShops) {
    shopSalesMap.set(String(s.id), { name: String(s.name ?? "Shop"), sales: 0, orders: 0 });
  }
  for (const o of shopOrders) {
    const sId = String(o.shop_id ?? "");
    const cur = shopSalesMap.get(sId) ?? { name: `Shop #${sId.slice(0, 6)}`, sales: 0, orders: 0 };
    cur.sales += amount(o);
    cur.orders += 1;
    shopSalesMap.set(sId, cur);
  }
  const topShopsRankings = Array.from(shopSalesMap.values())
    .filter((s) => s.sales > 0 || s.orders > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 6)
    .map((s, idx) => ({
      rank: idx + 1,
      label: s.name,
      primaryValue: s.sales,
      secondaryValue: s.orders,
      detail: `${s.orders} orders placed`,
    }));

  const fallbackRankings = topShopsRankings.length > 0 ? topShopsRankings : [
    { rank: 1, label: "Active Marketplace Stores", primaryValue: sales, secondaryValue: revenueRows.length, detail: `${activeShops.length} active shops` }
  ];

  // 7-Day "This Week vs Last Week" Comparative Line Data
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const comparativeWeekPulse = Array.from({ length: 7 }, (_, i) => {
    const dThis = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const thisKey = dThis.toISOString().slice(0, 10);
    const dLast = new Date(dThis.getFullYear(), dThis.getMonth(), dThis.getDate() - 7);
    const lastKey = dLast.toISOString().slice(0, 10);

    const thisDayRows = revenueRows.filter((r) => {
      const ts = String(r.created_at ?? r.paid_at ?? r.delivered_at ?? "");
      return ts.slice(0, 10) === thisKey;
    });

    const lastDayRows = revenueRows.filter((r) => {
      const ts = String(r.created_at ?? r.paid_at ?? r.delivered_at ?? "");
      return ts.slice(0, 10) === lastKey;
    });

    return {
      dayLabel: daysOfWeek[dThis.getDay()],
      thisWeekDate: dThis.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      lastWeekDate: dLast.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      thisWeekOrders: thisDayRows.length,
      thisWeekAmount: thisDayRows.reduce((sum, r) => sum + amount(r), 0),
      lastWeekOrders: lastDayRows.length,
      lastWeekAmount: lastDayRows.reduce((sum, r) => sum + amount(r), 0),
    };
  });

  // Payment Methods Distribution
  const paymentGroupMap = new Map<string, { count: number; amount: number }>();
  for (const r of revenueRows) {
    const method = String(r.payment_method ?? r.payment_status ?? "cash_on_delivery").toLowerCase();
    const name = method.includes("cod") || method.includes("delivery")
      ? "Cash on Delivery (COD)"
      : method.includes("card") || method.includes("stripe")
      ? "Debit / Credit Card"
      : method.includes("bank")
      ? "Bank Transfer"
      : method.includes("paid")
      ? "Digital Payment"
      : "Standard Checkout";

    const cur = paymentGroupMap.get(name) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += amount(r);
    paymentGroupMap.set(name, cur);
  }
  const colorMap: Record<string, string> = {
    "Cash on Delivery (COD)": "#f97316",
    "Debit / Credit Card": "#10b981",
    "Bank Transfer": "#0284c7",
    "Digital Payment": "#8b5cf6",
    "Standard Checkout": "#f59e0b",
  };
  const paymentItems = Array.from(paymentGroupMap.entries()).map(([label, v]) => ({
    label,
    count: v.count,
    amount: v.amount,
    color: colorMap[label] || "#64748b",
    detail: `${v.count} total orders`,
  }));

  const totalOrdersCount = Math.max(revenueRows.length, 1);
  const fulfillmentPct = Math.round((delivered.length / totalOrdersCount) * 100);

  const pendingShops = (pendingResult.data ?? []) as Row[];
  const requestLinks = [
    { label: "Shops", href: "/admin/shops?status=pending", count: pendingResult.count, icon: Store, countError: pendingResult.error?.message },
    { label: "Products", href: "/admin/products?status=pending", count: pendingProductsResult.count, icon: Package, countError: pendingProductsResult.error?.message },
    { label: "Featured", href: "/admin/products?status=featured", count: pendingFeaturedResult.count, icon: Sparkles, countError: pendingFeaturedResult.error?.message },
    { label: "Riders", href: "/admin/riders", count: pendingRidersResult.count, icon: Bike, countError: pendingRidersResult.error?.message },
  ];
  return <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10"><header className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">BabulShop control room</p><h1 className="page-title mt-2">Platform overview</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Keep track of marketplace sales, payouts, shops and customer activity from one place.</p></div><AdminRequestLinks requests={requestLinks} /></header>
    <section aria-label="Marketplace metrics" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard label="Total sales" value={formatMoney(sales)} exactValue={sales} subtitle={`${revenueRows.filter(isRevenue).length.toLocaleString("en-US")} paid or delivered orders`} icon={CircleDollarSign} href="/admin/orders" />
      <StatCard label="Platform earnings" value={formatMoney(commission)} exactValue={commission} subtitle="Commission collected" icon={BadgeDollarSign} href="/admin/payouts" valueClassName="text-emerald-600 dark:text-emerald-400" />
      <StatCard label="Delivered orders" value={delivered.length.toLocaleString("en-US")} icon={ShoppingBag} href="/admin/orders" />
      <StatCard label="Active shops" value={activeShops.length.toLocaleString("en-US")} subtitle="Currently selling" icon={Store} href="/admin/shops" />
    </section>
    <section aria-label="Returns and financial summary" className="mt-4 grid gap-4 pb-2 md:grid-cols-2">
      <CompactPanel
        title="Returns and refunds"
        actionHref="/admin/returns"
        actionLabel="View returns"
        rows={[
          { label: "Open returns", value: openReturns.length.toLocaleString("en-US") },
          { label: "Needs attention", value: needsReturnAttention.length.toLocaleString("en-US"), attention: needsReturnAttention.length > 0 },
          { label: "Refunds pending", value: formatMoney(refundsPending), exactValue: refundsPending },
          { label: "Refunded this month", value: formatMoney(refundedThisMonth), exactValue: refundedThisMonth },
        ]}
      />
      <CompactPanel
        title="Money this month (30 days)"
        rows={[
          { label: "Coupon discounts given", value: formatMoney(couponDiscounts30d), helper: "Funded by BabulShop", exactValue: couponDiscounts30d },
          { label: "Delivery fees collected", value: formatMoney(deliveryFees30d), helper: "After delivery discounts", exactValue: deliveryFees30d },
        ]}
      />
    </section>
    {returnsResult.error ? <section className="surface mt-4 p-4 text-sm text-rose-600">Could not load return metrics: {returnsResult.error.message}</section> : <section className="surface mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-white/10"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Marketplace health</p><h2 className="mt-1 text-lg font-black">Shops with highest return rate</h2></div><Link href="/admin/returns" className="text-xs font-bold text-orange-500">Review returns</Link></div>
      {highestReturnRates.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-white/5"><tr><th className="px-5 py-3">Shop</th><th className="px-5 py-3">Return rate</th><th className="px-5 py-3">Return orders</th><th className="px-5 py-3">Delivered orders</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{highestReturnRates.map((shop) => <tr key={shop.id}><td className="px-5 py-3 font-bold">{shop.name}</td><td className="px-5 py-3 font-black text-orange-600">{(shop.rate * 100).toFixed(1)}%</td><td className="px-5 py-3">{shop.requestCount}</td><td className="px-5 py-3">{shop.deliveredCount}</td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-slate-500">Return-rate data will appear after shops have delivered orders and received return requests.</p>}
      <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400 dark:border-white/10">Rate = distinct non-cancelled shop orders with a return request ÷ delivered shop orders.</p>
    </section>}
    
    {/* 5-Tab Intuitive Analytics Card */}
    <div className="mt-6">
      <DashboardAnalyticsHub
        panelRole="Super Admin"
        monthlyData={{
          points: points.map((p) => ({
            label: p.label,
            amount: p.primaryValue,
            orders: p.secondaryValue,
          })),
          amountLabel: "Gross Volume",
          ordersLabel: "Orders",
          isCurrency: true,
        }}
        statusData={{
          title: "Marketplace Order Status Breakdown",
          centerLabel: "Total Orders",
          centerSubtext: `${fulfillmentPct}% Delivered`,
          valueUnit: "orders",
          slices: [
            { label: "Pending", value: pending.length, color: "#f97316", subtext: "Awaiting confirmation" },
            { label: "Processing", value: processing.length, color: "#f59e0b", subtext: "Packing by seller" },
            { label: "Shipped", value: shipped.length, color: "#0284c7", subtext: "Shipped with courier" },
            { label: "Delivered", value: statusDelivered.length, color: "#10b981", subtext: "Delivered successfully" },
            { label: "Completed", value: completed.length, color: "#059669", subtext: "Order completed" },
            { label: "Cancelled", value: cancelled.length, color: "#f43f5e", subtext: "Order cancelled" },
          ],
        }}
        rankingsData={{
          title: "Top Performing Shops",
          subtitle: "Ranked by sales volume & total orders processed",
          primaryLabel: "Gross Sales",
          secondaryLabel: "orders",
          isCurrency: true,
          items: fallbackRankings,
        }}
        pulseData={{
          title: "This Week vs Last Week (Daily Pulse)",
          points: comparativeWeekPulse,
          isCurrency: false,
        }}
        distributionData={{
          title: "Payment Channel Breakdown",
          subtitle: "Distribution of revenue & order count by payment method",
          items: paymentItems,
          isCurrency: true,
        }}
      />
    </div>

    <section className="surface mt-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6 dark:border-white/10"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Needs your attention</p><h2 className="mt-1 text-xl font-black">Pending shop requests</h2></div><Link href="/admin/shops?status=pending" className="text-xs font-bold text-orange-500">View all <ArrowUpRight className="ml-1 inline size-3.5" /></Link></div>{pendingShops.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No pending shop requests right now.</p> : <div className="divide-y divide-slate-100 dark:divide-white/10">{pendingShops.map((shop) => <div key={String(shop.id)} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-extrabold">{String(shop.name ?? "Unnamed shop")}</h3><p className="mt-1 text-xs text-slate-500">/shop/{String(shop.slug ?? "")} · {shop.created_at ? new Date(String(shop.created_at)).toLocaleDateString() : "Recently requested"}</p></div><AdminPendingShopActions shopId={String(shop.id)} /></div>)}</div>}</section>
  </div>;
}
