"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

type ReturnResult = { success?: string; error?: string };

export async function requestReturnAction(_previous: ReturnResult, formData: FormData): Promise<ReturnResult> {
  const user = await getCurrentUser();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!user) return { error: "Please sign in before requesting a return." };
  if (!orderId || reason.length < 5) return { error: "Please tell us why you are requesting a return." };

  const supabase = await createClient();
  const { data: parentOrder, error: orderError } = await supabase
    .from("orders")
    .select("id, status, payment_status")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .maybeSingle();
  let order = parentOrder;
  let shopOrderId: string | null = null;
  if (!order && !orderError) {
    const childResult = await supabase.from("shop_orders").select("id, parent_order_id, order_status").eq("id", orderId).maybeSingle();
    if (childResult.error || !childResult.data) return { error: "Order not found." };
    shopOrderId = String(childResult.data.id);
    const parentResult = await supabase.from("orders").select("id, status, payment_status").eq("id", childResult.data.parent_order_id).eq("customer_id", user.id).maybeSingle();
    order = parentResult.data;
  }
  if (!order) return { error: "Order not found." };
  if (!shopOrderId && orderId !== String(order.id)) shopOrderId = orderId;
  if (!shopOrderId && !["delivered", "completed"].includes(String(order.status).toLowerCase())) return { error: "Returns are available after delivery." };
  if (shopOrderId) {
    const child = await supabase.from("shop_orders").select("order_status").eq("id", shopOrderId).maybeSingle();
    if (!["delivered", "completed"].includes(String(child.data?.order_status).toLowerCase())) return { error: "Returns are available after delivery." };
  }
  if (!["paid", "partially_refunded"].includes(String(order.payment_status ?? "paid").toLowerCase())) return { error: "This order is not eligible for a refund yet." };

  const { error } = await supabase.from("return_requests").insert({ order_id: order.id, shop_order_id: shopOrderId, customer_id: user.id, reason, status: "requested" });
  if (error) return { error: error.code === "23505" ? "A return request is already open for this order." : error.message };
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/account");
  return { success: "Return request sent for review." };
}
