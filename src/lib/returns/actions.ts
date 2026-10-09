"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  RETURN_EVIDENCE_MAX_PHOTOS,
  RETURN_EVIDENCE_MIN_PHOTOS,
  RETURN_REFUND_METHODS,
  RETURN_REASONS,
  returnReasonRequiresPhotos,
} from "./config";
import type { RiderReturnPickupDetails } from "./types";

const uuid = z.string().uuid();
const reasonCode = z.enum(Object.keys(RETURN_REASONS) as [string, ...string[]]);
const refundMethod = z.enum(Object.keys(RETURN_REFUND_METHODS) as [string, ...string[]]);
const evidencePaths = z.array(z.string().min(3).max(512)).max(RETURN_EVIDENCE_MAX_PHOTOS);

const createReturnSchema = z.object({
  shopOrderId: uuid,
  items: z.array(z.object({ orderItemId: uuid, quantity: z.number().int().positive() })).min(1),
  reasonCode,
  customerNote: z.string().trim().max(2000).optional().default(""),
  evidencePaths,
  refundMethod,
  accountHolderName: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().min(5).max(120),
  bankName: z.string().trim().max(120).optional().default(""),
});

type Result<T = undefined> = { data?: T; error?: string };

async function currentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in to continue.");
  return user;
}

async function adminUser() {
  const user = await currentUser();
  if (user.app_metadata?.is_admin !== true) {
    throw new Error("Administrator access required.");
  }
  return user;
}

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function revalidateReturnViews(returnId?: string) {
  revalidatePath("/account/returns");
  revalidatePath("/account");
  revalidatePath("/seller/returns");
  revalidatePath("/admin/returns");
  revalidatePath("/admin/deliveries");
  revalidatePath("/rider/assignments");
  if (returnId) {
    revalidatePath(`/account/returns/${returnId}`);
    revalidatePath(`/account/orders/${returnId}`);
  }
}

export async function createReturnRequest(input: unknown): Promise<Result<string>> {
  try {
    const user = await currentUser();
    const parsed = createReturnSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your return details." };
    const value = parsed.data;
    if (
      returnReasonRequiresPhotos(value.reasonCode as keyof typeof RETURN_REASONS) &&
      value.evidencePaths.length < RETURN_EVIDENCE_MIN_PHOTOS
    ) {
      return { error: "Attach at least one photo for this return reason." };
    }
    const returnId = await callRpc<string>("create_return_request", {
      p_shop_order_id: value.shopOrderId,
      p_items: value.items.map((item) => ({
        order_item_id: item.orderItemId,
        quantity: item.quantity,
      })),
      p_reason_code: value.reasonCode,
      p_customer_note: value.customerNote,
      p_evidence_paths: value.evidencePaths,
      p_refund_method: value.refundMethod,
      p_account_holder_name: value.accountHolderName,
      p_account_number: value.accountNumber,
      p_bank_name: value.bankName || null,
    });
    revalidateReturnViews(returnId);
    return { data: returnId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not request a return." };
  }
}

export async function respondToReturn(
  returnRequestId: string,
  decision: "approve" | "reject",
  reason = "",
): Promise<Result<Record<string, unknown>>> {
  try {
    await currentUser();
    const parsed = z.object({
      returnRequestId: uuid,
      decision: z.enum(["approve", "reject"]),
      reason: z.string().trim().max(2000),
    }).safeParse({ returnRequestId, decision, reason });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid seller response." };
    const data = await callRpc<Record<string, unknown>>("seller_respond_return", {
      p_return_request_id: parsed.data.returnRequestId,
      p_decision: parsed.data.decision,
      p_reason: parsed.data.reason || null,
    });
    revalidateReturnViews(returnRequestId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not respond to the return." };
  }
}

export async function cancelReturn(
  returnRequestId: string,
  reason = "",
): Promise<Result<boolean>> {
  try {
    await currentUser();
    const parsed = z.object({ returnRequestId: uuid, reason: z.string().trim().max(1000) })
      .safeParse({ returnRequestId, reason });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid cancellation." };
    const data = await callRpc<boolean>("cancel_return_request", {
      p_return_request_id: parsed.data.returnRequestId,
      p_reason: parsed.data.reason || null,
    });
    revalidateReturnViews(returnRequestId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not cancel the return." };
  }
}

export async function escalateReturn(
  returnRequestId: string,
  reason: string,
): Promise<Result<boolean>> {
  try {
    await currentUser();
    const parsed = z.object({ returnRequestId: uuid, reason: z.string().trim().min(5).max(2000) })
      .safeParse({ returnRequestId, reason });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Explain why you are escalating." };
    const data = await callRpc<boolean>("escalate_return_request", {
      p_return_request_id: parsed.data.returnRequestId,
      p_reason: parsed.data.reason,
    });
    revalidateReturnViews(returnRequestId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not escalate the return." };
  }
}

export async function decideEscalatedReturn(
  returnRequestId: string,
  decision: "approve" | "reject",
  reason: string,
): Promise<Result<boolean>> {
  try {
    await adminUser();
    const parsed = z.object({
      returnRequestId: uuid,
      decision: z.enum(["approve", "reject"]),
      reason: z.string().trim().min(5).max(2000),
    }).safeParse({ returnRequestId, decision, reason });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid admin decision." };
    const data = await callRpc<boolean>("admin_decide_return", {
      p_return_request_id: parsed.data.returnRequestId,
      p_decision: parsed.data.decision,
      p_reason: parsed.data.reason,
    });
    revalidateReturnViews(returnRequestId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not decide the escalation." };
  }
}

export async function refundFailedInspectionAnyway(
  returnRequestId: string,
  reason: string,
): Promise<Result<boolean>> {
  try {
    await adminUser();
    const parsed = z.object({
      returnRequestId: uuid,
      reason: z.string().trim().min(5).max(2000),
    }).safeParse({ returnRequestId, reason });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Explain why the failed inspection is being overridden." };
    const data = await callRpc<boolean>("admin_refund_return_anyway", {
      p_return_request_id: parsed.data.returnRequestId,
      p_reason: parsed.data.reason,
    });
    revalidateReturnViews(returnRequestId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not override the failed inspection." };
  }
}

export async function assignReturnPickup(
  returnRequestId: string,
  riderId: string,
): Promise<Result<string>> {
  try {
    await adminUser();
    const parsed = z.object({ returnRequestId: uuid, riderId: uuid })
      .safeParse({ returnRequestId, riderId });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose a valid rider." };
    const data = await callRpc<string>("assign_return_pickup", {
      p_return_request_id: parsed.data.returnRequestId,
      p_rider_id: parsed.data.riderId,
    });
    revalidateReturnViews(returnRequestId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not assign the return pickup." };
  }
}

export async function updateReturnPickup(input: {
  assignmentId: string;
  status: "accepted" | "picked_up" | "out_for_delivery" | "delivered" | "failed";
  confirmationCode?: string;
  note?: string;
  proofPath?: string;
}): Promise<Result<boolean>> {
  try {
    await currentUser();
    const parsed = z.object({
      assignmentId: uuid,
      status: z.enum(["accepted", "picked_up", "out_for_delivery", "delivered", "failed"]),
      confirmationCode: z.string().trim().regex(/^\d{6}$/).optional(),
      note: z.string().trim().max(2000).optional(),
      proofPath: z.string().trim().max(512).optional(),
    }).safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid pickup update." };
    if (parsed.data.status === "failed" && (parsed.data.note?.length ?? 0) < 5) {
      return { error: "Add a note explaining the failed pickup." };
    }
    const data = await callRpc<boolean>("update_return_pickup", {
      p_assignment_id: parsed.data.assignmentId,
      p_target_status: parsed.data.status,
      p_confirmation_code: parsed.data.confirmationCode ?? null,
      p_note: parsed.data.note ?? null,
      p_proof_path: parsed.data.proofPath ?? null,
    });
    revalidateReturnViews();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the return pickup." };
  }
}

export async function inspectReturn(
  returnRequestId: string,
  passed: boolean,
  note: string,
  evidencePaths: string[] = [],
): Promise<Result<boolean>> {
  try {
    await currentUser();
    const parsed = z.object({
      returnRequestId: uuid,
      passed: z.boolean(),
      note: z.string().trim().min(3).max(2000),
      evidencePaths,
    }).safeParse({ returnRequestId, passed, note, evidencePaths });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid inspection details." };
    const data = await callRpc<boolean>("seller_inspect_return", {
      p_return_request_id: parsed.data.returnRequestId,
      p_passed: parsed.data.passed,
      p_note: parsed.data.note,
      p_evidence_paths: parsed.data.evidencePaths,
    });
    revalidateReturnViews(returnRequestId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the inspection." };
  }
}

export async function confirmReturnReceipt(
  returnRequestId: string,
): Promise<Result<boolean>> {
  try {
    await currentUser();
    const parsed = uuid.safeParse(returnRequestId);
    if (!parsed.success) return { error: "Invalid return request." };
    const data = await callRpc<boolean>("seller_confirm_return_receipt", {
      p_return_request_id: parsed.data,
    });
    revalidateReturnViews(returnRequestId);
    revalidatePath(`/seller/orders`);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not confirm shop receipt." };
  }
}

export async function reportReturnNotReceived(returnRequestId: string, reason: string): Promise<Result<boolean>> {
  try {
    await currentUser();
    const parsed = z.object({ returnRequestId: uuid, reason: z.string().trim().min(5).max(2000) })
      .safeParse({ returnRequestId, reason });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Explain why the return was not received." };
    const data = await callRpc<boolean>("seller_report_return_not_received", {
      p_return_request_id: parsed.data.returnRequestId,
      p_reason: parsed.data.reason,
    });
    revalidateReturnViews(returnRequestId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not report the missing return." };
  }
}

export async function getShopReturnRiderDetails(returnRequestId: string): Promise<Result<{ name: string; phone: string | null }>> {
  try {
    await currentUser();
    const parsed = uuid.safeParse(returnRequestId);
    if (!parsed.success) return { error: "Invalid return request." };
    const data = await callRpc<{ name: string; phone: string | null }>("get_shop_return_rider_details", {
      p_return_request_id: parsed.data,
    });
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load the assigned rider." };
  }
}
export async function markReturnRefunded(
  returnRequestId: string,
  method: keyof typeof RETURN_REFUND_METHODS,
  reference: string,
): Promise<Result<boolean>> {
  try {
    await adminUser();
    const parsed = z.object({
      returnRequestId: uuid,
      method: refundMethod,
      reference: z.string().trim().min(3).max(200),
    }).safeParse({ returnRequestId, method, reference });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid refund details." };
    const data = await callRpc<boolean>("admin_mark_return_refunded", {
      p_return_request_id: parsed.data.returnRequestId,
      p_refund_method: parsed.data.method,
      p_refund_reference: parsed.data.reference,
    });
    revalidateReturnViews(returnRequestId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not mark the refund as paid." };
  }
}

export async function getRiderReturnPickupDetails(assignmentId: string): Promise<Result<RiderReturnPickupDetails>> {
  try {
    await currentUser();
    const parsed = uuid.safeParse(assignmentId);
    if (!parsed.success) return { error: "Invalid pickup assignment." };
    return { data: await callRpc<RiderReturnPickupDetails>("get_rider_return_pickup_details", { p_assignment_id: assignmentId }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load pickup details." };
  }
}

export async function getCustomerReturnPickupCode(returnRequestId: string): Promise<Result<string>> {
  try {
    await currentUser();
    const parsed = uuid.safeParse(returnRequestId);
    if (!parsed.success) return { error: "Invalid return request." };
    return { data: await callRpc("get_customer_return_pickup_code", { p_return_request_id: returnRequestId }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load the pickup code." };
  }
}

export async function getCustomerReturnRiderDetails(
  returnRequestId: string,
): Promise<Result<{ name: string; phone: string | null }>> {
  try {
    await currentUser();
    const parsed = uuid.safeParse(returnRequestId);
    if (!parsed.success) return { error: "Invalid return request." };
    const details = await callRpc<{ name: string; phone: string | null }>(
      "get_customer_return_rider_details",
      { p_return_request_id: returnRequestId },
    );
    return { data: details };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load the assigned rider." };
  }
}
