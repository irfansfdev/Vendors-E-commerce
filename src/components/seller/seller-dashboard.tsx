"use client";

import Link from "next/link";
import { BadgeDollarSign, Box, CircleDollarSign, ExternalLink, Plus, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CompactPanel } from "@/components/shared/compact-panel";
import { formatMoney, StatCard } from "@/components/shared/stat-card";
import { DashboardAnalyticsHub } from "@/components/shared/dashboard-analytics-hub";

type Row = Record<string, unknown>;
type Props = { shop: Row; products: Row[]; orders: Row[]; payouts: Row[]; earnings: Row[]; orderItems: Row[]; returns: Row[]; role: string; asOfMs: number };

function orderAmount(order: Row) {
  const direct = Number(order.gross_amount ?? order.calculated_total ?? order.total_amount ?? order.subtotal ?? order.total ?? order.amount ?? order.order_total ?? order.grand_total ?? order.total_price ?? 0);
  const gross = direct > 0 ? direct : Number(order.seller_earnings ?? 0) + Number(order.platform_commission ?? 0);
  return Math.max(0, gross - Number(order.refund_amount ?? 0));
}

function orderStatus(order: Row) {
  return String(order.order_status ?? order.status ?? "pending").toLowerCase();
}

function isPaid(order: Row) {
  const paymentStatus = String(order.payment_status ?? "").toLowerCase();
  return ["paid", "partially_refunded"].includes(paymentStatus);
}

function isDelivered(order: Row) {
  return ["delivered", "completed"].includes(orderStatus(order));
}

function getMonthlyTimeline(orders: Row[]) {
  const today = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (11 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const matching = orders.filter((order) => String(order.delivered_at ?? order.created_at ?? "").slice(0, 7) === key);
    return {
      label: date.toLocaleDateString("en-US", { month: "short" }),
      primaryValue: matching.reduce((sum, order) => sum + orderAmount(order), 0),
      secondaryValue: matching.length,
      count: matching.length,
    };
  });
}

export function SellerDashboard({ shop, products, orders, payouts, earnings, orderItems, returns, role, asOfMs }: Props) {
  const totalsByOrder = new Map<string, number>();
  for (const item of orderItems) {
    const variant = item.product_variants as Row | null;
    const product = variant?.products as Row | null;
    const itemTotal = Number(item.quantity ?? 0) * Number(variant?.price ?? product?.price ?? 0);
    totalsByOrder.set(String(item.shop_order_id), (totalsByOrder.get(String(item.shop_order_id)) ?? 0) + itemTotal);
  }
  const ordersWithTotals: Row[] = orders.map((order) => ({ ...order, calculated_total: totalsByOrder.get(String(order.id)) ?? order.calculated_total }));
  const deliveredOrders = ordersWithTotals.filter(isDelivered);
  const statusDeliveredOrders = ordersWithTotals.filter((order) => orderStatus(order) === "delivered");
  const completedOrders = ordersWithTotals.filter((order) => orderStatus(order) === "completed");
  const shippedOrders = ordersWithTotals.filter((order) => orderStatus(order) === "shipped");
  const processingOrders = ordersWithTotals.filter((order) => orderStatus(order) === "processing");
  const pendingOrders = ordersWithTotals.filter((order) => orderStatus(order) === "pending");
  const cancelledOrders = ordersWithTotals.filter((order) => orderStatus(order) === "cancelled");

  const sales = ordersWithTotals.reduce((total, order) => total + orderAmount(order), 0);
  const monthlyTimeline = getMonthlyTimeline(ordersWithTotals);

  const earningAmount = (earning: Row) => Number(earning.net_amount ?? 0);
  const payoutAmount = (payout: Row) => Number(payout.net_amount ?? payout.amount ?? 0);
  const pendingPayout = earnings.filter((earning) => ["pending", "held"].includes(String(earning.status).toLowerCase())).reduce((total, earning) => total + earningAmount(earning), 0);
  const availableBalance = earnings.filter((earning) => String(earning.status).toLowerCase() === "available").reduce((total, earning) => total + earningAmount(earning), 0);
  const paidPayout = payouts.filter((payout) => String(payout.status).toLowerCase() === "paid").reduce((total, payout) => total + payoutAmount(payout), 0);
  const refunds = orders.reduce((total, order) => total + Number(order.refund_amount ?? 0), 0);
  const needsReturnResponse = returns.filter((item) => item.status === "requested"
    && item.seller_response_due_at).length;
  const openReturns = returns.filter((item) => !["refunded", "rejected", "cancelled"].includes(String(item.status))).length;
  const thirtyDaysAgo = asOfMs - 30 * 24 * 60 * 60 * 1000;
  const refundedLast30Days = returns
    .filter((item) => item.status === "refunded" && item.refunded_at
      && new Date(String(item.refunded_at)).getTime() >= thirtyDaysAgo)
    .reduce((sum, item) => sum + Number(item.refund_amount ?? 0), 0);
  const productsSold = orderItems.reduce((total, item) => total + Number(item.quantity ?? 0), 0);

  // Top products from order items
  const productSalesMap = new Map<string, { label: string; primaryValue: number; secondaryValue: number; stockValue: number; detail: string }>();
  for (const p of products) {
    const pId = String(p.id ?? "");
    const title = String(p.title ?? p.name ?? "Product");
    const variants = Array.isArray(p.product_variants) ? p.product_variants as Row[] : [];
    const stock = variants.length > 0
      ? variants.reduce((total, variant) => total + Number(variant.stock_quantity ?? 0), 0)
      : Number(p.stock_quantity ?? p.stock ?? p.quantity ?? 0);
    productSalesMap.set(pId, { label: title, primaryValue: 0, secondaryValue: 0, stockValue: stock, detail: `Stock: ${stock}` });
  }
  for (const item of orderItems) {
    const variant = item.product_variants as Row | null;
    const pRef = (variant?.products as Row | null) ?? null;
    const pId = String(item.product_id ?? variant?.product_id ?? pRef?.id ?? "");
    const qty = Number(item.quantity ?? 1);
    const price = Number(item.price ?? variant?.price ?? pRef?.price ?? 0);
    const amountVal = qty * price;
    const title = String(pRef?.title ?? pRef?.name ?? item.product_name ?? `Product #${pId.slice(0, 5)}`);
    const cur = productSalesMap.get(pId) ?? { label: title, primaryValue: 0, secondaryValue: 0, stockValue: Number(variant?.stock_quantity ?? 0), detail: "" };
    if (cur.stockValue === 0 && variant?.stock_quantity != null) cur.stockValue = Number(variant.stock_quantity);
    cur.primaryValue += qty;
    cur.secondaryValue += amountVal;
    cur.detail = `${cur.primaryValue} units sold · Stock: ${cur.stockValue}`;
    productSalesMap.set(pId, cur);
  }
  const topProductsRankings = Array.from(productSalesMap.values())
    .filter((p) => p.primaryValue > 0 || p.secondaryValue > 0)
    .sort((a, b) => b.primaryValue - a.primaryValue || b.secondaryValue - a.secondaryValue)
    .slice(0, 5)
    .map((p, idx) => ({
      rank: idx + 1,
      label: p.label,
      primaryValue: p.primaryValue,
      secondaryValue: p.secondaryValue,
      detail: p.detail,
    }));

  const fallbackProductRankings = topProductsRankings.length > 0 ? topProductsRankings : [
    { rank: 1, label: "No product sales yet", primaryValue: 0, secondaryValue: 0, detail: `${products.length} active products in store` }
  ];

  // 7-Day "This Week vs Last Week" Comparative Line Data
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const comparativeWeekPulse = Array.from({ length: 7 }, (_, i) => {
    const dThis = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const thisKey = dThis.toISOString().slice(0, 10);
    const dLast = new Date(dThis.getFullYear(), dThis.getMonth(), dThis.getDate() - 7);
    const lastKey = dLast.toISOString().slice(0, 10);

    const thisDayOrders = ordersWithTotals.filter((o) => {
      const ts = String(o.delivered_at ?? o.created_at ?? "");
      return ts.slice(0, 10) === thisKey;
    });

    const lastDayOrders = ordersWithTotals.filter((o) => {
      const ts = String(o.delivered_at ?? o.created_at ?? "");
      return ts.slice(0, 10) === lastKey;
    });

    return {
      dayLabel: daysOfWeek[dThis.getDay()],
      thisWeekDate: dThis.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      lastWeekDate: dLast.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      thisWeekOrders: thisDayOrders.length,
      thisWeekAmount: thisDayOrders.reduce((sum, o) => sum + orderAmount(o), 0),
      lastWeekOrders: lastDayOrders.length,
      lastWeekAmount: lastDayOrders.reduce((sum, o) => sum + orderAmount(o), 0),
    };
  });

  // Payment Channels Distribution for Seller
  const paymentMap = new Map<string, { count: number; amount: number }>();
  for (const o of ordersWithTotals) {
    const method = String(o.payment_method ?? o.payment_status ?? "cash_on_delivery").toLowerCase();
    const name = method.includes("cod") || method.includes("delivery")
      ? "Cash on Delivery (COD)"
      : method.includes("card") || method.includes("stripe")
      ? "Debit / Credit Card"
      : method.includes("bank")
      ? "Direct Bank Transfer"
      : method.includes("paid")
      ? "Digital Payment"
      : "Standard Payment";

    const cur = paymentMap.get(name) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += orderAmount(o);
    paymentMap.set(name, cur);
  }
  const colorMap: Record<string, string> = {
    "Cash on Delivery (COD)": "#f97316",
    "Debit / Credit Card": "#10b981",
    "Direct Bank Transfer": "#0284c7",
    "Digital Payment": "#8b5cf6",
    "Standard Payment": "#f59e0b",
  };
  const paymentItems = Array.from(paymentMap.entries()).map(([label, v]) => ({
    label,
    count: v.count,
    amount: v.amount,
    color: colorMap[label] || "#64748b",
    detail: `${v.count} orders`,
  }));

  const fulfillmentPct = ordersWithTotals.length > 0 ? Math.round((deliveredOrders.length / ordersWithTotals.length) * 100) : 100;

  const shopSlug = String(shop.slug ?? "");
  const shopName = String(shop.name ?? "Your shop");
  return (
    <main className="w-full min-w-0 mx-auto max-w-[1100px] px-4 py-2 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Seller command center</p>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-[-.05em] sm:text-4xl">{shopName}</h1>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{role}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {shopSlug && <Link href={`/shop/${shopSlug}`} className="button-secondary">View shop <ExternalLink className="size-4" /></Link>}
          <Link href="/seller/products/new" className="button-primary bg-orange-500 hover:bg-orange-600"><Plus className="size-4" /> Add product</Link>
        </div>
      </div>

      <section aria-label="Key shop metrics" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Net sales"
          value={formatMoney(sales)}
          exactValue={sales}
          subtitle={`${ordersWithTotals.filter((order) => isPaid(order) || isDelivered(order)).length.toLocaleString("en-US")} orders paid or delivered`}
          icon={CircleDollarSign}
          href="/seller/orders"
        />
        <StatCard
          label="Seller orders"
          value={orders.length.toLocaleString("en-US")}
          subtitle={`${orders.filter((order) => orderStatus(order) === "processing").length.toLocaleString("en-US")} orders in progress`}
          icon={ShoppingBag}
          href="/seller/orders"
        />
        <StatCard
          label="Products sold"
          value={productsSold.toLocaleString("en-US")}
          subtitle={`${products.length.toLocaleString("en-US")} active products`}
          icon={Box}
          href="/seller/products"
        />
        <StatCard
          label="Available balance"
          value={formatMoney(availableBalance)}
          exactValue={availableBalance}
          subtitle="Ready to request"
          icon={BadgeDollarSign}
          href="/seller/payouts"
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
      </section>

      <section aria-label="Returns and earnings summaries" className="mt-4 grid gap-4 md:grid-cols-2">
        <CompactPanel
          title="Returns"
          actionHref="/seller/returns"
          actionLabel="View returns"
          rows={[
            { label: "Returns to respond", value: needsReturnResponse.toLocaleString("en-US"), attention: needsReturnResponse > 0, href: "/seller/returns" },
            { label: "Open returns", value: openReturns.toLocaleString("en-US"), href: "/seller/returns" },
            { label: "Refunded last 30 days", value: formatMoney(refundedLast30Days), exactValue: refundedLast30Days },
          ]}
        />
        <CompactPanel
          title="Your earnings"
          actionHref="/seller/payouts"
          actionLabel="View payouts"
          rows={[
            { label: "Pending payout", value: formatMoney(pendingPayout), exactValue: pendingPayout, helper: "After fees" },
            { label: "Paid out", value: formatMoney(paidPayout), exactValue: paidPayout },
            { label: "Refunds", value: formatMoney(refunds), exactValue: refunds },
          ]}
        />
      </section>

      {/* 5-Tab Analytics Card */}
      <div className="mt-6">
        <DashboardAnalyticsHub
          panelRole="Shop Admin"
          monthlyData={{
            points: monthlyTimeline.map((m) => ({
              label: m.label,
              amount: m.primaryValue,
              orders: m.secondaryValue,
            })),
            amountLabel: "Gross Sales",
            ordersLabel: "Orders",
            isCurrency: true,
          }}
          statusData={{
            title: "Store Order Status Breakdown",
            centerLabel: "Shop Orders",
            centerSubtext: `${fulfillmentPct}% Fulfilled`,
            valueUnit: "orders",
            slices: [
              { label: "Pending", value: pendingOrders.length, color: "#f97316", subtext: "Awaiting review" },
              { label: "Processing", value: processingOrders.length, color: "#f59e0b", subtext: "Packing & readying" },
              { label: "Shipped", value: shippedOrders.length, color: "#0284c7", subtext: "Shipped with courier" },
              { label: "Delivered", value: statusDeliveredOrders.length, color: "#10b981", subtext: "Delivered successfully" },
              { label: "Completed", value: completedOrders.length, color: "#059669", subtext: "Order completed" },
              { label: "Cancelled", value: cancelledOrders.length, color: "#f43f5e", subtext: "Order cancelled" },
            ],
          }}
          rankingsData={{
            title: "Top Selling Products",
            subtitle: "Top 5 products ranked by units sold",
            primaryLabel: "units sold",
            secondaryLabel: "total sales",
            secondaryIsCurrency: true,
            isCurrency: false,
            items: fallbackProductRankings,
          }}
          pulseData={{
            title: "This Week vs Last Week (Daily Pulse)",
            points: comparativeWeekPulse,
            isCurrency: true,
          }}
          distributionData={{
            title: "Customer Payment Methods",
            subtitle: "Breakdown of customer orders by payment channel",
            items: paymentItems,
            isCurrency: true,
          }}
        />
      </div>

      <section className="surface mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-white/10">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Latest activity</p>
            <h2 className="mt-1 text-xl font-black">Recent orders</h2>
          </div>
          <Link href="/seller/orders" className="text-xs font-bold text-orange-500">See all</Link>
        </div>
        {ordersWithTotals.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No orders yet. New orders will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[.12em] text-slate-400 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="px-5 py-4">Order</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Items</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {ordersWithTotals.slice(0, 2).map((order) => (
                  <tr key={String(order.id)} className="transition hover:bg-orange-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-4 font-semibold">#{String(order.id).slice(0, 8)}</td>
                    <td className="px-5 py-4 font-medium">{String(order.customer_name ?? order.customer_email ?? "Customer")}</td>
                    <td className="px-5 py-4">{orderItems.filter((item) => String(item.shop_order_id) === String(order.id)).reduce((total, item) => total + Number(item.quantity ?? 0), 0)}</td>
                    <td className="px-5 py-4 font-semibold">{formatCurrency(orderAmount(order))}</td>
                    <td className="px-5 py-4 text-slate-500">{String(order.payment_method ?? order.payment_status ?? "-").replaceAll("_", " ")}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${["delivered", "completed"].includes(orderStatus(order)) ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>
                        {orderStatus(order).replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">{order.created_at ? new Date(String(order.created_at)).toLocaleDateString() : "-"}</td>
                    <td className="px-5 py-4"><Link href={`/seller/orders/${String(order.id)}`} className="font-bold text-orange-600 hover:text-orange-700">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}