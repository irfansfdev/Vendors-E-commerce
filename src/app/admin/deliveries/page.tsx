import type { Metadata } from "next";
import { AdminDeliveryQueueTable, type DeliveryQueueRow } from "@/components/admin-delivery-queue-table";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Delivery queue | BabulShop" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;

function coordinate(row: Row, ...keys: string[]) {
  const value = keys.map((key) => row[key]).find((item) => item !== null && item !== undefined && item !== "");
  return value === undefined ? null : Number(value);
}
function distanceKm(fromLat: number | null, fromLng: number | null, toLat: number | null, toLng: number | null) {
  if ([fromLat, fromLng, toLat, toLng].some((value) => value === null || !Number.isFinite(value))) return null;
  const radians = (value: number) => value * Math.PI / 180;
  const latDelta = radians((toLat as number) - (fromLat as number));
  const lngDelta = radians((toLng as number) - (fromLng as number));
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(fromLat as number)) * Math.cos(radians(toLat as number)) * Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function km(value: number | null) { return value === null ? "GPS unavailable" : `${value.toFixed(1)} km`; }
function locationAge(updatedAt: unknown) {
  if (!updatedAt) return "GPS unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(String(updatedAt)).getTime()) / 60000));
  return minutes < 1 ? "Updated just now" : minutes < 60 ? `Updated ${minutes} min ago` : `Last updated ${Math.round(minutes / 60)}h ago`;
}
function text(row: Row, ...keys: string[]) { return String(keys.map((key) => row[key]).find((value) => value !== null && value !== undefined && value !== "") ?? ""); }

export default async function AdminDeliveriesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error: assignmentError, success } = await searchParams;
  const supabase = await createClient();
  const { data: shopOrders, error } = await supabase.from("shop_orders").select("*").eq("order_status", "ready_for_pickup").order("created_at", { ascending: true });
  const orders = (shopOrders ?? []) as Row[];
  const shopIds = [...new Set(orders.map((order) => text(order, "shop_id")).filter(Boolean))];
  const parentIds = [...new Set(orders.map((order) => text(order, "parent_order_id")).filter(Boolean))];
  const orderIds = orders.map((order) => text(order, "id"));
  const [{ data: shops }, { data: parents }, { data: riders }, { data: assignments }, { data: items }] = await Promise.all([
    shopIds.length ? supabase.from("shops").select("*").in("id", shopIds) : Promise.resolve({ data: [] }),
    parentIds.length ? supabase.from("orders").select("*").in("id", parentIds) : Promise.resolve({ data: [] }),
    supabase.from("delivery_profiles").select("*").eq("status", "approved").neq("availability_status", "offline").order("full_name"),
    supabase.from("delivery_assignments").select("shop_order_id, rider_id, status").in("status", ["assigned", "accepted", "picked_up", "out_for_delivery"]),
    orderIds.length ? supabase.from("order_items").select("shop_order_id, quantity, product_variants(price, products(price))").in("shop_order_id", orderIds) : Promise.resolve({ data: [] }),
  ]);
  const shopById = new Map((shops ?? []).map((row) => [String(row.id), row as Row]));
  const parentById = new Map((parents ?? []).map((row) => [String(row.id), row as Row]));
  const itemTotalByOrder = new Map<string, number>();
  for (const item of (items ?? []) as Row[]) {
    const variant = item.product_variants ?? {};
    const product = variant.products ?? {};
    const total = Number(item.quantity ?? 0) * Number(variant.price ?? product.price ?? 0);
    itemTotalByOrder.set(text(item, "shop_order_id"), (itemTotalByOrder.get(text(item, "shop_order_id")) ?? 0) + total);
  }
  const customerIds = [...new Set((parents ?? []).map((parent) => text(parent as Row, "customer_id", "user_id")).filter(Boolean))];
  const addressIds = [...new Set((parents ?? []).map((parent) => text(parent as Row, "shipping_address_id")).filter(Boolean))];
  const [{ data: profiles }, { data: addresses }] = await Promise.all([
    customerIds.length ? supabase.from("profiles").select("id, full_name, name, display_name, first_name, last_name").in("id", customerIds) : Promise.resolve({ data: [] }),
    addressIds.length ? supabase.from("addresses").select("id, full_name, name, address_line1, address_line_1, city").in("id", addressIds) : Promise.resolve({ data: [] }),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [String(profile.id), profile as Row]));
  const addressById = new Map((addresses ?? []).map((address) => [String(address.id), address as Row]));
  const activeByRider = new Map<string, number>();
  const assignedOrderIds = new Set<string>();
  for (const assignment of assignments ?? []) { activeByRider.set(String(assignment.rider_id), (activeByRider.get(String(assignment.rider_id)) ?? 0) + 1); assignedOrderIds.add(String(assignment.shop_order_id)); }
  const rows: DeliveryQueueRow[] = [];
  for (const order of orders) {
    if (assignedOrderIds.has(text(order, "id"))) continue;
    const shop = shopById.get(text(order, "shop_id")) ?? {};
    const parent = parentById.get(text(order, "parent_order_id")) ?? {};
    const profile = profileById.get(text(parent, "customer_id", "user_id")) ?? {};
    const address = addressById.get(text(parent, "shipping_address_id")) ?? {};
    const profileName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
    const customerName = text(address, "full_name", "name") || text(parent, "customer_name", "full_name") || text(profile, "full_name", "name", "display_name") || profileName || "Customer";
    const amount = Number(order.gross_amount ?? order.total_amount ?? order.subtotal ?? 0) || itemTotalByOrder.get(text(order, "id")) || 0;
    const pickupLat = coordinate(shop, "pickup_latitude", "latitude", "lat");
    const pickupLng = coordinate(shop, "pickup_longitude", "longitude", "lng", "lon");
    const deliveryLat = coordinate(parent, "delivery_latitude", "shipping_latitude", "latitude");
    const deliveryLng = coordinate(parent, "delivery_longitude", "shipping_longitude", "longitude", "lng", "lon");
    const candidates = (riders ?? []).map((rider) => {
      const row = rider as Row;
      const active = activeByRider.get(text(row, "id")) ?? 0;
      const capacity = Number(row.max_active_deliveries ?? 2);
      const pickupDistance = distanceKm(coordinate(row, "current_latitude"), coordinate(row, "current_longitude"), pickupLat, pickupLng);
      const customerDistance = distanceKm(coordinate(row, "current_latitude"), coordinate(row, "current_longitude"), deliveryLat, deliveryLng);
      return { row, active, capacity, pickupDistance, customerDistance, routeDistance: pickupDistance === null || customerDistance === null ? Number.POSITIVE_INFINITY : pickupDistance + customerDistance };
    }).filter((candidate) => candidate.active < candidate.capacity && text(candidate.row, "availability_status") !== "busy").sort((a, b) => a.routeDistance - b.routeDistance || a.active - b.active);
    const nearbyIds = new Set(candidates.filter((candidate) => candidate.pickupDistance !== null && candidate.customerDistance !== null && candidate.routeDistance <= 12).slice(0, 3).map((candidate) => text(candidate.row, "id")));
    for (const candidate of candidates) {
      const rider = candidate.row;
      rows.push({ shopOrderId: text(order, "id"), parentOrderId: text(order, "parent_order_id"), shopName: text(shop, "name") || "Shop", customerName, amount, paymentMethod: text(order, "payment_method") || "cash_on_delivery", riderId: text(rider, "id"), riderName: text(rider, "full_name") || "Rider", riderPhone: text(rider, "phone"), riderAddress: text(rider, "address"), availability: text(rider, "availability_status") || "available", active: candidate.active, capacity: candidate.capacity, pickupDistance: km(candidate.pickupDistance), customerDistance: km(candidate.customerDistance), location: locationAge(rider.last_location_updated_at), recommended: nearbyIds.has(text(rider, "id")) });
    }
  }
  rows.sort((a, b) => Number(b.recommended) - Number(a.recommended));
  return <div className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10"><header className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Logistics control</p><h1 className="page-title mt-2">Ready for Pickup / Assign Rider</h1><p className="mt-2 text-sm text-slate-500">Each ready shop order is listed independently. Rider distances use stored GPS coordinates only.</p></header>{error ? <section className="surface p-6 text-sm text-rose-600">Could not load the delivery queue: {error.message}</section> : <AdminDeliveryQueueTable rows={rows} error={assignmentError} success={success} />}</div>;
}
