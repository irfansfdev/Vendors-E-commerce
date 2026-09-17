import type { Metadata } from "next";
import { AdminOrdersTable } from "@/components/admin-orders-table";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orders | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function value(row: Row, ...keys: string[]) {
  return keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && item !== "");
}

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select("*, shop_orders(*)").order("created_at", { ascending: false }).limit(200);
  const orders = (data ?? []) as Row[];
  const customerIds = orders.map((order) => String(order.customer_id ?? order.user_id ?? "")).filter(Boolean);
  const shopIds = orders.flatMap((order) => Array.isArray(order.shop_orders) ? (order.shop_orders as Row[]).map((shopOrder) => String(shopOrder.shop_id ?? "")).filter(Boolean) : []);
  const addressIds = orders.map((order) => String(order.shipping_address_id ?? "")).filter(Boolean);
  const [{ data: profiles }, { data: shops }, { data: addresses }, { data: authNames }] = await Promise.all([
    customerIds.length
    ? await supabase.from("profiles").select("id, full_name, name, display_name").in("id", customerIds)
    : Promise.resolve({ data: [] }),
    shopIds.length ? supabase.from("shops").select("id, name").in("id", [...new Set(shopIds)]) : Promise.resolve({ data: [] }),
    addressIds.length ? supabase.from("addresses").select("id, full_name, name").in("id", [...new Set(addressIds)]) : Promise.resolve({ data: [] }),
    customerIds.length ? supabase.rpc("get_admin_user_display_names", { target_user_ids: [...new Set(customerIds)] }) : Promise.resolve({ data: [] }),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [String(profile.id), profile as Row]));
  const shopById = new Map((shops ?? []).map((shop) => [String(shop.id), shop as Row]));
  const addressById = new Map((addresses ?? []).map((address) => [String(address.id), address as Row]));
  const authNameById = new Map((authNames ?? []).map((row: Row) => [String(row.user_id), String(row.display_name ?? "")]));

  for (const order of orders) {
    const profile = profileById.get(String(order.customer_id ?? order.user_id));
    const address = addressById.get(String(order.shipping_address_id ?? ""));
    const name = value(address ?? {}, "full_name", "name") ?? value(order, "customer_name", "full_name") ?? (profile && value(profile, "full_name", "name", "display_name")) ?? authNameById.get(String(order.customer_id ?? order.user_id));
    if (name && !value(order, "customer_name")) order.customer_name = name;
    if (Array.isArray(order.shop_orders)) {
      order.shop_orders = (order.shop_orders as Row[]).map((shopOrder) => ({
        ...shopOrder,
        shop_name: shopById.get(String(shopOrder.shop_id ?? ""))?.name ?? shopOrder.shop_name,
      }));
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] p-5 sm:p-8 lg:p-10">
      <header className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Platform operations</p>
        <h1 className="page-title mt-2">Global orders</h1>
        <p className="mt-2 text-sm text-slate-500">Monitor order activity across the marketplace. Delivery status is managed by the responsible shop and rider.</p>
      </header>
      {error ? <section className="surface p-6 text-sm text-rose-600">Could not load orders: {error.message}</section> : <AdminOrdersTable orders={orders} />}
    </div>
  );
}
