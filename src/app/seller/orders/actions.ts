"use server";

import { revalidatePath } from "next/cache";
import { getSellerContext } from "@/lib/seller";

const transitions: Record<string, string[]> = {
  pending: ["processing", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

export async function updateSellerOrderStatus(formData: FormData) {
  const { supabase, shop } = await getSellerContext();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "").toLowerCase();
  if (!orderId || !Object.values(transitions).some((values) => values.includes(status))) throw new Error("Invalid order status");

  const { data: current, error: readError } = await supabase.from("shop_orders").select("order_status").eq("id", orderId).eq("shop_id", String(shop.id)).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("This order could not be found for your shop.");
  const currentStatus = String(current.order_status ?? "pending").toLowerCase();
  if (!transitions[currentStatus]?.includes(status)) throw new Error(`Cannot move an order from ${currentStatus} to ${status}.`);

  const { data, error } = await supabase.from("shop_orders").update({ order_status: status }).eq("id", orderId).eq("shop_id", String(shop.id)).select("id, order_status").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This order could not be updated. Check seller order permissions.");
  revalidatePath("/seller/orders");
  revalidatePath(`/seller/orders/${orderId}`);
  revalidatePath("/seller");
  revalidatePath("/account");
  revalidatePath(`/account/orders/${orderId}`);
}