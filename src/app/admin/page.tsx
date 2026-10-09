import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BadgeDollarSign, Boxes, Check, CircleDollarSign, ShoppingBag, Store, UsersRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { DashboardAnalyticsHub } from "@/components/dashboard-analytics-hub";
import { updateShopStatusAction } from "../actions/admin";
import { getCurrentTimeMs } from "@/lib/returns/time";

export const metadata: Metadata = { title: "Platform Admin | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function amount(row: Row) { const direct = Number(row.gross_amount ?? row.calculated_total ?? row.total_amount ?? row.subtotal ?? row.total ?? row.amount ?? row.order_total ?? row.grand_total ?? row.total_price ?? 0); if (direct > 0) return direct; return Number(row.seller_earnings ?? 0) + Number(row.platform_commission ?? row.platform_fee ?? 0); }
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
  const [ordersResult, shopsResult, profilesResult, categoriesResult, shopOrdersResult, transactionsResult, payoutsResult, pendingResult, returnsResult] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("shops").select("id, name, status, commission_rate"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id, name", { count: "exact" }),
    supabase.from("shop_orders").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("transactions").select("amount,platform_fee,status,created_at").eq("status", "completed").order("created_at", { ascending: false }).limit(2000),
    supabase.from("payouts").select("amount,net_amount,status").limit(2000),
    supabase.from("shops").select("id,name,slug,created_at", { count: "exact" }).eq("status", "pending").order("created_at", { ascending: false }).limit(6),
    supabase.from("return_requests").select("id,shop_order_id,status,refund_amount,refunded_at,seller_response_due_at,shop_orders!inner(shop_id)").order("requested_at", { ascending: false }).limit(5000),
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
  const deliveredSales = delivered.reduce((sum, row) => sum + amount(row), 0);
  const payouts = (payoutsResult.data ?? []) as Row[];
  const returnRows = (returnsResult.data ?? []) as Row[];
  const commission = revenueRows.reduce((sum, row) => sum + Number(row.platform_commission ?? row.platform_fee ?? 0), 0);
  
  const points = monthlySales(revenueRows);
  const activeShops = allShops.filter((s) => String(s.status).toLowerCase() === "active");
  const openReturns = returnRows.filter((row) => !["refunded", "rejected", "cancelled"].includes(String(row.status)));
  const nowMs = getCurrentTimeMs();
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
  const metrics = [
    { icon: CircleDollarSign, label: "Total sales", value: formatCurrency(sales), detail: `${revenueRows.filter(isRevenue).length} paid or delivered orders`, tone: "text-slate-950 dark:text-white" },
    { icon: BadgeDollarSign, label: "Platform earnings", value: formatCurrency(commission), detail: "Commission collected", tone: "text-emerald-600" },
    { icon: ShoppingBag, label: "Delivered orders", value: delivered.length, detail: `${formatCurrency(deliveredSales)} delivered volume`, tone: "text-slate-950 dark:text-white" },
    { icon: Store, label: "Active shops", value: activeShops.length, detail: "Currently selling", tone: "text-slate-950 dark:text-white" },
  ];

  return <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10"><header className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">BabulShop control room</p><h1 className="page-title mt-2">Platform overview</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Keep track of marketplace sales, payouts, shops and customer activity from one place.</p></div><Link href="/admin/shops?status=pending" className="button-primary bg-orange-500 hover:bg-orange-600">Review shop requests <ArrowUpRight className="size-4" /></Link></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ icon: Icon, label, value, detail, tone }) => <div key={label} className="surface relative overflow-hidden p-5 sm:p-6"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Icon className="size-5" /></span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-emerald-600 dark:bg-emerald-500/10">Live</span></div><p className="mt-6 text-xs font-bold text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black tracking-[-.04em] ${tone}`}>{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>)}</section>
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/admin/returns" className="surface p-4 transition hover:border-orange-300"><p className="text-xs font-bold text-slate-500">Open returns</p><p className="mt-2 text-2xl font-black">{openReturns.length}</p><p className="mt-1 text-xs text-slate-400">All active stages</p></Link>
      <Link href="/admin/returns" className="surface p-4 transition hover:border-orange-300"><p className="text-xs font-bold text-slate-500">Needs attention</p><p className="mt-2 text-2xl font-black">{needsReturnAttention.length}</p><p className="mt-1 text-xs text-slate-400">Overdue, escalated, or failed inspection</p></Link>
      <Link href="/admin/returns" className="surface p-4 transition hover:border-orange-300"><p className="text-xs font-bold text-slate-500">Refunds pending</p><p className="mt-2 text-2xl font-black">{formatCurrency(refundsPending)}</p><p className="mt-1 text-xs text-slate-400">Awaiting refund processing</p></Link>
      <Link href="/admin/returns" className="surface p-4 transition hover:border-orange-300"><p className="text-xs font-bold text-slate-500">Refunded this month</p><p className="mt-2 text-2xl font-black">{formatCurrency(refundedThisMonth)}</p><p className="mt-1 text-xs text-slate-400">Completed customer refunds</p></Link>
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

    <section className="surface mt-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6 dark:border-white/10"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Needs your attention</p><h2 className="mt-1 text-xl font-black">Pending shop requests</h2></div><Link href="/admin/shops?status=pending" className="text-xs font-bold text-orange-500">View all <ArrowUpRight className="ml-1 inline size-3.5" /></Link></div>{pendingShops.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No pending shop requests right now.</p> : <div className="divide-y divide-slate-100 dark:divide-white/10">{pendingShops.map((shop) => <div key={String(shop.id)} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-extrabold">{String(shop.name ?? "Unnamed shop")}</h3><p className="mt-1 text-xs text-slate-500">/shop/{String(shop.slug ?? "")} · {shop.created_at ? new Date(String(shop.created_at)).toLocaleDateString() : "Recently requested"}</p></div><div className="flex gap-2"><form action={async () => { "use server"; await updateShopStatusAction(String(shop.id), "active"); }}><button className="button-secondary text-emerald-700"><Check className="size-4" /> Approve</button></form><form action={async () => { "use server"; await updateShopStatusAction(String(shop.id), "rejected"); }}><button className="button-secondary text-rose-700"><X className="size-4" /> Reject</button></form></div></div>)}</div>}</section>
  </div>;
}
