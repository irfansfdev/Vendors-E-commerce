"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSellerContext } from "@/lib/seller";

const statuses = ["pending", "confirmed", "preparing", "ready_for_pickup"];
const nextStatus: Record<string, string> = { pending: "confirmed", confirmed: "preparing", preparing: "ready_for_pickup", processing: "preparing" };

export async function updateSellerOrderStatus(formData: FormData) {
  const { supabase, shop } = await getSellerContext();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "").toLowerCase();
  if (!orderId || !statuses.includes(status)) throw new Error("Invalid shop order status");

  const { data: current, error: readError } = await supabase.from("shop_orders").select("order_status, parent_order_id").eq("id", orderId).eq("shop_id", String(shop.id)).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("This order could not be found for your shop.");
  const rawCurrentStatus = String(current.order_status ?? "pending").toLowerCase();
  const currentStatus = rawCurrentStatus === "processing" ? "preparing" : rawCurrentStatus;
  if (nextStatus[currentStatus] !== status) {
    redirect(`/seller/orders/${orderId}?error=${encodeURIComponent("Use the next preparation stage before moving this shop order forward.")}`);
  }
  const { data, error } = await supabase.from("shop_orders").update({ order_status: status }).eq("id", orderId).eq("shop_id", String(shop.id)).select("id, order_status").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This order could not be updated. Check seller order permissions.");
  revalidatePath("/seller/orders");
  revalidatePath(`/seller/orders/${orderId}`);
  revalidatePath("/seller");
  revalidatePath("/account");
  if (current.parent_order_id) revalidatePath(`/account/orders/${current.parent_order_id}`);
  redirect(`/seller/orders/${orderId}`);
}