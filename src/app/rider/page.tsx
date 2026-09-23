import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Bike, CheckCircle2, Clock3, MapPin, PackageCheck, TrendingUp } from "lucide-react";
import { getRiderContext } from "@/lib/rider";
import { formatCurrency } from "@/lib/utils";
import { PaginatedList } from "@/components/paginated-list";
import { DashboardAnalyticsHub } from "@/components/dashboard-analytics-hub";

export const metadata: Metadata = { title: "Rider dashboard" };
export const dynamic = "force-dynamic";

export default async function RiderPage() {
  const { supabase, rider } = await getRiderContext();
  const { data: assignments } = await supabase.from("delivery_assignments").select("*, shop_orders(id, order_status, payment_method, gross_amount, parent_order_id)").eq("rider_id", String(rider.id)).order("assigned_at", { ascending: false }).limit(100);
  const rows = (assignments ?? []) as Record<string, any>[];
  const active = rows.filter((row) => !["delivered", "failed", "cancelled"].includes(String(row.status).toLowerCase()));
  const completed = rows.filter((row) => String(row.status).toLowerCase() === "delivered");
  const failed = rows.filter((row) => String(row.status).toLowerCase() === "failed");
  const cancelled = rows.filter((row) => String(row.status).toLowerCase() === "cancelled");
  const pickedUp = rows.filter((row) => ["picked_up", "out_for_delivery"].includes(String(row.status).toLowerCase()));
  const queue = active.filter((row) => !["picked_up", "out_for_delivery"].includes(String(row.status).toLowerCase()));
  
  const cod = completed.reduce((sum, row) => sum + Number(row.cod_collected_amount ?? 0), 0);
  const totalExpectedCod = rows.reduce((sum, row) => sum + Number(row.cod_expected_amount ?? 0), 0);
  
  const now = new Date();
  const timeline = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const matching = rows.filter((row) => String(row.assigned_at ?? row.created_at ?? "").slice(0, 7) === key);
    const done = matching.filter((row) => String(row.status).toLowerCase() === "delivered");
    return {
      label: date.toLocaleDateString("en-US", { month: "short" }),
      primaryValue: matching.length,
      secondaryValue: done.length,
      count: matching.length,
    };
  });

  // COD comparison batches
  const codBatches = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthRows = rows.filter((r) => String(r.assigned_at ?? r.created_at ?? "").slice(0, 7) === key);
    const expected = monthRows.reduce((sum, r) => sum + Number(r.cod_expected_amount ?? 0), 0);
    const collected = monthRows.reduce((sum, r) => sum + Number(r.cod_collected_amount ?? 0), 0);
    return {
      label: date.toLocaleDateString("en-US", { month: "short" }),
      primaryValue: collected,
      secondaryValue: expected,
      detail: `${monthRows.length} assignments`,
    };
  });

  const completionRate = rows.length > 0 ? Math.round((completed.length / rows.length) * 100) : 100;

  // 7-Day "This Week vs Last Week" Comparative Line Data
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const comparativeWeekPulse = Array.from({ length: 7 }, (_, i) => {
    const dThis = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
    const thisKey = dThis.toISOString().slice(0, 10);
    const dLast = new Date(dThis.getFullYear(), dThis.getMonth(), dThis.getDate() - 7);
    const lastKey = dLast.toISOString().slice(0, 10);

    const thisDayRows = rows.filter((r) => {
      const ts = String(r.assigned_at ?? r.created_at ?? "");
      return ts.slice(0, 10) === thisKey;
    });

    const lastDayRows = rows.filter((r) => {
      const ts = String(r.assigned_at ?? r.created_at ?? "");
      return ts.slice(0, 10) === lastKey;
    });

    return {
      dayLabel: daysOfWeek[dThis.getDay()],
      thisWeekDate: dThis.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      lastWeekDate: dLast.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      thisWeekOrders: thisDayRows.length,
      thisWeekAmount: thisDayRows.reduce((sum, r) => sum + Number(r.cod_collected_amount ?? r.cod_expected_amount ?? 0), 0),
      lastWeekOrders: lastDayRows.length,
      lastWeekAmount: lastDayRows.reduce((sum, r) => sum + Number(r.cod_collected_amount ?? r.cod_expected_amount ?? 0), 0),
    };
  });

  // Performance Batches / Leaderboard
  const batchRankings = codBatches
    .filter((b) => b.primaryValue > 0 || b.secondaryValue > 0)
    .map((b, idx) => ({
      rank: idx + 1,
      label: `${b.label} Deliveries`,
      primaryValue: b.primaryValue,
      secondaryValue: b.secondaryValue,
      detail: b.detail,
    }));
  const fallbackBatchRankings = batchRankings.length > 0 ? batchRankings : [
    { rank: 1, label: "Current Delivery Run", primaryValue: cod, secondaryValue: completed.length, detail: `${rows.length} assignments` }
  ];

  // COD Settlement Mix
  const failedCod = failed.reduce((sum, r) => sum + Number(r.cod_expected_amount ?? 0), 0);
  const pendingCod = Math.max(totalExpectedCod - cod - failedCod, 0);
  const codSettlementItems = [
    { label: "COD Collected (Delivered)", count: completed.length, amount: cod, color: "#10b981", detail: "Cash in hand" },
    { label: "Pending COD (On Route)", count: active.length, amount: pendingCod, color: "#0284c7", detail: "Active in transit" },
    { label: "Uncollected COD (Failed)", count: failed.length, amount: failedCod, color: "#f43f5e", detail: "Attempt failed" },
  ];

  return <main><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Delivery operations</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Welcome, {String(rider.full_name ?? "Rider")}</h1><p className="mt-2 text-sm text-slate-500">Your route, progress, and collections in one place.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black capitalize text-emerald-700"><Bike className="size-4" /> Active rider</span></div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Clock3} label="Active deliveries" value={active.length} detail={`${pickedUp.length} on the road`} /><Metric icon={CheckCircle2} label="Completed" value={completed.length} detail={`${failed.length} failed`} /><Metric icon={MapPin} label="COD collected" value={formatCurrency(cod)} detail="Delivered orders" /><Metric icon={Bike} label="Total assignments" value={rows.length} detail="All time" /></section>
  
  {/* 5-Tab Intuitive Analytics Card */}
  <div className="mt-6">
    <DashboardAnalyticsHub
      panelRole="Rider Operations"
      isRider={true}
      monthlyData={{
        points: timeline.map((t) => ({
          label: t.label,
          amount: t.primaryValue,
          orders: t.secondaryValue,
        })),
        amountLabel: "Assignments",
        ordersLabel: "Delivered",
        isCurrency: false,
      }}
      statusData={{
        title: "Delivery Assignment Status Breakdown",
        centerLabel: "Assignments",
        centerSubtext: `${completionRate}% Delivered`,
        valueUnit: "orders",
        slices: [
          { label: "Delivered", value: completed.length, color: "#10b981", subtext: "Handed to customer" },
          { label: "On The Road", value: pickedUp.length, color: "#0284c7", subtext: "In transit" },
          { label: "Active Queue", value: queue.length, color: "#f97316", subtext: "Awaiting pickup" },
          { label: "Failed", value: failed.length, color: "#f43f5e", subtext: "Attempt failed" },
          { label: "Cancelled", value: cancelled.length, color: "#64748b", subtext: "Cancelled order" },
        ],
      }}
      rankingsData={{
        title: "Monthly Delivery Performance",
        subtitle: "COD cash collected vs expected by delivery batch",
        primaryLabel: "COD Collected",
        secondaryLabel: "COD expected",
        isCurrency: true,
        items: fallbackBatchRankings,
      }}
      pulseData={{
        title: "This Week vs Last Week (Daily Pulse)",
        points: comparativeWeekPulse,
        isCurrency: true,
      }}
      distributionData={{
        title: "COD Cash Settlement Mix",
        subtitle: "Breakdown of cash collected, active on route, and uncollected amounts",
        items: codSettlementItems,
        isCurrency: true,
      }}
    />
  </div>

  <section className="surface mt-6 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-white/10"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Your route</p><h2 className="mt-1 text-xl font-black">Recent assignments</h2></div><Link href="/rider/assignments" className="text-xs font-bold text-orange-500">View all</Link></div>{rows.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No delivery assignments yet.</p> : <div className="divide-y divide-slate-100 dark:divide-white/10"><PaginatedList pageSize={5} items={rows.map((row) => <Link key={String(row.id)} href={`/rider/assignments/${String(row.id)}`} className="flex items-center justify-between gap-4 p-5 hover:bg-orange-50/50 dark:hover:bg-white/5"><div><p className="font-black">Order #{String(row.shop_order_id).slice(0, 8)}</p><p className="mt-1 text-xs capitalize text-slate-500">{String(row.status).replaceAll("_", " ")}</p></div><p className="font-black">{formatCurrency(Number(row.cod_expected_amount ?? 0))}</p></Link>)}/></div>}</section></main>;
}
function Metric({ icon: Icon, label, value, detail }: { icon: typeof Bike; label: string; value: string | number; detail: string }) { return <div className="surface p-5"><span className="grid size-11 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Icon className="size-5" /></span><p className="mt-5 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>; }

