import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Pause, Store, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminShopsTable } from "@/components/admin-shops-table";
import { publicStorageUrl } from "@/lib/media";

export const metadata: Metadata = { title: "Shops | BabulShop Admin" };
export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;
function numberValue(value: unknown) { return Number(value ?? 0); }
function orderAmount(row: Row, itemTotal = 0) { const direct = numberValue(row.gross_amount ?? row.total_amount ?? row.subtotal ?? row.total ?? row.amount ?? row.total_price ?? 0); const settlement = numberValue(row.seller_earnings) + numberValue(row.platform_commission); return direct || settlement || itemTotal; }

export default async function AdminShopsPage() {
  const supabase = await createClient();
  const [{ data: shopRows, error }, { data: products }, { data: shopOrders }, { data: orderItems }, { data: profiles }] = await Promise.all([
    supabase.from("shops").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("id,shop_id"),
    supabase.from("shop_orders").select("*"),
    supabase.from("order_items").select("quantity,shop_order_id,product_variants(price,products(price))"),
    supabase.from("profiles").select("id,full_name,name,display_name,username,first_name,last_name"),
  ]);
  const shops = (shopRows ?? []) as Row[];
  const productRows = (products ?? []) as Row[];
  const orderRows = (shopOrders ?? []) as Row[];
  const itemTotals = new Map<string, number>();
  for (const item of (orderItems ?? []) as Row[]) { const variant = item.product_variants as Row | null; const product = variant?.products as Row | null; const total = numberValue(item.quantity) * numberValue(variant?.price ?? product?.price); itemTotals.set(String(item.shop_order_id), (itemTotals.get(String(item.shop_order_id)) ?? 0) + total); }
  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile as Row]));
  const ownerIds = [...new Set(shops.map((shop) => String(shop.owner_id ?? "")).filter(Boolean))];
  const { data: authNames } = ownerIds.length ? await supabase.rpc("get_admin_user_display_names", { target_user_ids: ownerIds }) : { data: [] };
  const authNameMap = new Map(((authNames ?? []) as Row[]).map((row) => [String(row.user_id), String(row.display_name ?? "")]));
  const viewModels = shops.map((shop) => { const shopId = String(shop.id); const shopProducts = productRows.filter((product) => String(product.shop_id) === shopId); const shopOrdersForShop = orderRows.filter((order) => String(order.shop_id) === shopId); const owner = profileMap.get(String(shop.owner_id)); const profileName = owner && (owner.full_name || owner.name || owner.display_name || owner.username || [owner.first_name, owner.last_name].filter(Boolean).join(" ")); const ownerName = authNameMap.get(String(shop.owner_id)) || profileName || shop.owner_name || shop.owner_email || "Owner profile unavailable"; return { id: shopId, name: String(shop.name ?? "Unnamed shop"), slug: String(shop.slug ?? ""), status: String(shop.status ?? "pending").toLowerCase(), owner: String(ownerName), email: String(shop.created_at ?? ""), logo: publicStorageUrl("shop-assets", shop.logo_url ?? shop.logo), products: shopProducts.length, orders: shopOrdersForShop.length, sales: shopOrdersForShop.filter((order) => ["delivered", "completed"].includes(String(order.order_status ?? order.status ?? "").toLowerCase())).reduce((sum, order) => sum + orderAmount(order, itemTotals.get(String(order.id)) ?? 0), 0) }; });
  const summary = { total: viewModels.length, pending: viewModels.filter((shop) => shop.status === "pending").length, active: viewModels.filter((shop) => shop.status === "active").length, suspended: viewModels.filter((shop) => shop.status === "suspended").length };
  return <div className="mx-auto max-w-[1440px] p-5 sm:p-8 lg:p-10"><header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Marketplace control</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Shops</h1><p className="mt-2 text-sm text-slate-500">Manage and monitor all marketplace shops.</p></div><Link href="/admin" className="button-secondary"><ArrowUpRight className="size-4" /> Back to overview</Link></header>{error ? <section className="surface p-8 text-sm text-rose-600">Could not load shops: {error.message}</section> : <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Summary icon={Store} label="Total shops" value={summary.total} detail="All marketplace shops" /><Summary icon={Users} label="Pending requests" value={summary.pending} detail="Waiting for review" tone="text-orange-600" /><Summary icon={Check} label="Active shops" value={summary.active} detail="Currently selling" tone="text-emerald-600" /><Summary icon={Pause} label="Suspended shops" value={summary.suspended} detail="Temporarily unavailable" tone="text-rose-600" /></section><div className="mt-8"><AdminShopsTable shops={viewModels} /></div></>}</div>;
}
function Summary({ icon: Icon, label, value, detail, tone }: { icon: typeof Store; label: string; value: number; detail: string; tone?: string }) { return <div className="surface p-5 sm:p-6"><span className={`grid size-11 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10 ${tone ?? ""}`}><Icon className="size-5" /></span><p className="mt-5 text-xs font-bold text-slate-500">{label}</p><p className={`mt-1 text-3xl font-black tracking-[-.04em] ${tone ?? ""}`}>{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>; }
