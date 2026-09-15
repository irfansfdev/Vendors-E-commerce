import type { Metadata } from "next";
import { updateAdminOrderStatus } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
const statuses = ["pending", "processing", "shipped", "delivered", "completed", "cancelled"];
function value(row: Row, ...keys: string[]) { return keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && item !== ""); }
function badge(status: string) { return status === "completed" || status === "paid" ? "bg-emerald-100 text-emerald-700" : status === "cancelled" ? "bg-rose-100 text-rose-700" : "bg-orange-100 text-orange-700"; }

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
  const orders = (data ?? []) as Row[];
  const customerIds = orders.map((order) => String(order.customer_id ?? order.user_id ?? "")).filter(Boolean);
  const { data: profiles } = customerIds.length
    ? await supabase.from("profiles").select("id, full_name, name, display_name").in("id", customerIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [String(profile.id), profile as Row]));
  for (const order of orders) {
    const profile = profileById.get(String(order.customer_id ?? order.user_id));
    const name = profile && value(profile, "full_name", "name", "display_name");
    if (name && !value(order, "customer_name", "customer_email")) order.customer_name = name;
  }
  return <div className="p-8"><div className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Platform operations</p><h1 className="mt-2 text-3xl font-black">Global orders</h1><p className="mt-1 text-slate-500">Monitor orders and update delivery status for customers.</p></div><section className="overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">{error ? <p className="p-6 text-sm text-rose-600">Could not load orders: {error.message}</p> : orders.length === 0 ? <p className="p-12 text-center text-slate-500">No orders have been placed yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950"><tr><th className="px-5 py-4">Order</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Shop</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Update</th><th className="px-5 py-4">Date</th></tr></thead><tbody className="divide-y dark:divide-slate-800">{orders.map((order) => { const status = String(value(order, "status", "payment_status") ?? "pending").toLowerCase(); return <tr key={String(order.id)}><td className="px-5 py-4 font-bold">#{String(order.id).slice(0, 10)}</td><td className="px-5 py-4">{String(value(order, "customer_name", "customer_email", "customer_id") ?? "Unknown")}</td><td className="px-5 py-4">{String(value(order, "shop_name", "shop_id") ?? "Multiple shops")}</td><td className="px-5 py-4 font-bold">{formatCurrency(Number(value(order, "total_amount", "total", "subtotal") ?? 0), String(order.currency ?? "USD"))}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${badge(status)}`}>{status}</span></td><td className="px-5 py-4"><form action={updateAdminOrderStatus} className="flex items-center gap-2"><input type="hidden" name="orderId" value={String(order.id)} /><select name="status" defaultValue={status} className="field min-h-9 w-32 px-2 py-1 text-xs"><option value="pending">Pending</option>{statuses.filter((item) => item !== "pending").map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select><button className="button-primary min-h-9 bg-orange-500 px-3 py-1.5 text-xs hover:bg-orange-600">Save</button></form></td><td className="px-5 py-4 text-slate-500">{String(order.created_at ?? "-")}</td></tr>; })}</tbody></table></div>}</section></div>;
}
