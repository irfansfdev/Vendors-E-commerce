import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BadgeDollarSign, Boxes, Check, CircleDollarSign, ShoppingBag, Store, UsersRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { updateShopStatusAction } from "../actions/admin";

export const metadata: Metadata = { title: "Platform Admin | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type DailyPoint = { label: string; amount: number; orders: number };

function amount(row: Row) { const direct = Number(row.gross_amount ?? row.calculated_total ?? row.total_amount ?? row.subtotal ?? row.total ?? row.amount ?? row.order_total ?? row.grand_total ?? row.total_price ?? 0); if (direct > 0) return direct; return Number(row.seller_earnings ?? 0) + Number(row.platform_commission ?? row.platform_fee ?? 0); }
function status(row: Row) { return String(row.order_status ?? row.status ?? "pending").toLowerCase(); }
function isRevenue(row: Row) { return ["paid", "partially_refunded"].includes(String(row.payment_status ?? "").toLowerCase()) || ["delivered", "completed"].includes(status(row)); }
function dailySales(rows: Row[]): DailyPoint[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(now.getDate() - (6 - index));
    const key = date.toLocaleDateString("en-CA");
    const matching = rows.filter((row) => isRevenue(row) && String(row.paid_at ?? row.delivered_at ?? row.updated_at ?? row.created_at ?? "").slice(0, 10) === key);
    return { label: date.toLocaleDateString("en-US", { weekday: "short" }), amount: matching.reduce((sum, row) => sum + amount(row), 0), orders: matching.length };
  });
}

export default async function AdminPage() {
  const supabase = await createClient();
  await supabase.rpc("refresh_payout_availability");
  const [ordersResult, shopsResult, profilesResult, categoriesResult, shopOrdersResult, transactionsResult, payoutsResult, pendingResult] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("shops").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("shop_orders").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("transactions").select("amount,platform_fee,status,created_at").eq("status", "completed").order("created_at", { ascending: false }).limit(2000),
    supabase.from("payouts").select("amount,net_amount,status").limit(2000),
    supabase.from("shops").select("id,name,slug,created_at", { count: "exact" }).eq("status", "pending").order("created_at", { ascending: false }).limit(6),
  ]);
  const orders = (ordersResult.data ?? []) as Row[];
  const shopOrders = (shopOrdersResult.data ?? []) as Row[];
  const transactionRows = (transactionsResult.data ?? []) as Row[];
  const orderRowsHaveValue = [...shopOrders, ...orders].some((row) => amount(row) > 0);
  const revenueRows = orderRowsHaveValue ? (shopOrders.length ? shopOrders : orders) : transactionRows;
  const delivered = revenueRows.filter((row) => ["delivered", "completed"].includes(status(row)));
  const sales = revenueRows.filter(isRevenue).reduce((sum, row) => sum + amount(row), 0);
  const deliveredSales = delivered.reduce((sum, row) => sum + amount(row), 0);
  const payouts = (payoutsResult.data ?? []) as Row[];
  const pendingPayouts = payouts.filter((row) => String(row.status).toLowerCase() === "pending").reduce((sum, row) => sum + Number(row.net_amount ?? row.amount ?? 0), 0);
  const refunds = revenueRows.reduce((sum, row) => sum + Number(row.refund_amount ?? 0), 0);
  const commission = revenueRows.reduce((sum, row) => sum + Number(row.platform_commission ?? row.platform_fee ?? 0), 0);
  const points = dailySales(revenueRows);
  const pendingShops = (pendingResult.data ?? []) as Row[];
  const metrics = [
    { icon: CircleDollarSign, label: "Total sales", value: formatCurrency(sales), detail: `${revenueRows.filter(isRevenue).length} paid or delivered orders`, tone: "text-slate-950 dark:text-white" },
    { icon: BadgeDollarSign, label: "Platform earnings", value: formatCurrency(commission), detail: "Commission collected", tone: "text-emerald-600" },
    { icon: ShoppingBag, label: "Delivered orders", value: delivered.length, detail: `${formatCurrency(deliveredSales)} delivered volume`, tone: "text-slate-950 dark:text-white" },
    { icon: Store, label: "Active shops", value: shopsResult.count ?? 0, detail: "Currently selling", tone: "text-slate-950 dark:text-white" },
  ];

  return <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10"><header className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">BabulShop control room</p><h1 className="mt-2 text-4xl font-black tracking-[-.06em] sm:text-5xl">Platform overview</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Keep track of marketplace sales, payouts, shops and customer activity from one place.</p></div><Link href="/admin/shops?status=pending" className="button-primary bg-orange-500 hover:bg-orange-600">Review shop requests <ArrowUpRight className="size-4" /></Link></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ icon: Icon, label, value, detail, tone }) => <div key={label} className="surface relative overflow-hidden p-5 sm:p-6"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Icon className="size-5" /></span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-emerald-600 dark:bg-emerald-500/10">Live</span></div><p className="mt-6 text-xs font-bold text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black tracking-[-.04em] ${tone}`}>{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>)}</section>
    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,.8fr)]"><SalesChart points={points} /><aside className="surface p-6"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Snapshot</p><h2 className="mt-1 text-xl font-black">Marketplace health</h2></div><span className="grid size-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Store className="size-5" /></span></div><div className="mt-7 space-y-5"><SnapshotRow label="Categories" value={categoriesResult.count ?? 0} icon={Boxes} /><SnapshotRow label="Registered users" value={profilesResult.count ?? 0} icon={UsersRound} /><SnapshotRow label="Pending payouts" value={formatCurrency(pendingPayouts)} icon={BadgeDollarSign} /><SnapshotRow label="Refunds" value={formatCurrency(refunds)} icon={CircleDollarSign} /></div><div className="mt-7 flex items-center gap-2 border-t border-slate-100 pt-5 text-xs font-bold text-emerald-600 dark:border-white/10"><span className="size-2 rounded-full bg-emerald-500" /> Systems operational</div></aside></section>
    <section className="surface mt-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6 dark:border-white/10"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Needs your attention</p><h2 className="mt-1 text-xl font-black">Pending shop requests</h2></div><Link href="/admin/shops?status=pending" className="text-xs font-bold text-orange-500">View all <ArrowUpRight className="ml-1 inline size-3.5" /></Link></div>{pendingShops.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No pending shop requests right now.</p> : <div className="divide-y divide-slate-100 dark:divide-white/10">{pendingShops.map((shop) => <div key={String(shop.id)} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-extrabold">{String(shop.name ?? "Unnamed shop")}</h3><p className="mt-1 text-xs text-slate-500">/shop/{String(shop.slug ?? "")} · {shop.created_at ? new Date(String(shop.created_at)).toLocaleDateString() : "Recently requested"}</p></div><div className="flex gap-2"><form action={async () => { "use server"; await updateShopStatusAction(String(shop.id), "active"); }}><button className="button-secondary text-emerald-700"><Check className="size-4" /> Approve</button></form><form action={async () => { "use server"; await updateShopStatusAction(String(shop.id), "rejected"); }}><button className="button-secondary text-rose-700"><X className="size-4" /> Reject</button></form></div></div>)}</div>}</section>
  </div>;
}

function SalesChart({ points }: { points: DailyPoint[] }) { const max = Math.max(...points.map((point) => point.amount), 1); const total = points.reduce((sum, point) => sum + point.amount, 0); return <section className="surface p-6 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-orange-500">Sales activity</p><h2 className="mt-1 text-xl font-black">Daily gross volume</h2><p className="mt-1 text-xs text-slate-400">Last seven days · {formatCurrency(total)} total</p></div><span className="rounded-full bg-orange-50 px-3 py-1.5 text-[11px] font-bold text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">Live orders</span></div><div className="mt-8 grid grid-cols-[52px_1fr] gap-3"><div className="flex h-64 flex-col justify-between pb-7 text-right text-[10px] font-bold text-slate-400"><span>{formatCurrency(max)}</span><span>{formatCurrency(max / 2)}</span><span>Rs 0</span></div><div className="relative flex h-64 items-end gap-2 border-b border-slate-200 sm:gap-4 dark:border-white/10">{[25,50,75].map((line) => <span key={line} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-200/80 dark:border-white/10" style={{ bottom: `${line}%` }} />)}{points.map((point) => <div key={point.label} className="group z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-3"><div className="relative flex h-full w-full items-end"><div className="relative w-full rounded-t-xl bg-orange-400 transition duration-300 group-hover:bg-orange-500" style={{ height: point.amount ? `${Math.max((point.amount / max) * 100, 9)}%` : "3px" }}><span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] font-bold text-white group-hover:block">{formatCurrency(point.amount)} · {point.orders} {point.orders === 1 ? "order" : "orders"}</span></div></div><span className="text-[10px] font-bold text-slate-400">{point.label}</span></div>)}</div></div><div className="mt-4 flex justify-between text-[10px] font-bold uppercase tracking-[.12em] text-slate-400"><span>Order volume by day</span><span>{points.reduce((sum, point) => sum + point.orders, 0)} orders</span></div></section>; }
function SnapshotRow({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Boxes }) { return <div className="flex items-center justify-between gap-4"><span className="flex items-center gap-3 text-sm font-semibold text-slate-500"><Icon className="size-4 text-orange-500" />{label}</span><strong className="text-sm font-black">{value}</strong></div>; }
