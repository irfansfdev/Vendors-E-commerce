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
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, payment_status")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (orderError || !order) return { error: "Order not found." };
  if (!["delivered", "completed"].includes(String(order.status).toLowerCase())) return { error: "Returns are available after delivery." };
  if (!["paid", "partially_refunded"].includes(String(order.payment_status ?? "paid").toLowerCase())) return { error: "This order is not eligible for a refund yet." };

  const { error } = await supabase.from("return_requests").insert({ order_id: order.id, customer_id: user.id, reason, status: "requested" });
  if (error) return { error: error.code === "23505" ? "A return request is already open for this order." : error.message };
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/account");
  return { success: "Return request sent for review." };
}
