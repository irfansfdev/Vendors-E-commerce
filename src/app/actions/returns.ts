"use server";

import { createReturnRequest } from "@/lib/returns/actions";

type ReturnResult = { success?: string; error?: string };

export async function requestReturnAction(_previous: ReturnResult, formData: FormData): Promise<ReturnResult> {
  const rawItems = formData.get("items");
  const rawEvidence = formData.get("evidencePaths");
  if (typeof rawItems !== "string" || typeof rawEvidence !== "string") {
    return { error: "Please use the itemized return form to select products, reason, photos, and refund details." };
  }
  let items: unknown;
  let evidencePaths: unknown;
  try {
    items = JSON.parse(rawItems);
    evidencePaths = JSON.parse(rawEvidence);
  } catch {
    return { error: "Return item or photo details are invalid." };
  }
  const result = await createReturnRequest({
    shopOrderId: String(formData.get("shop_order_id") ?? ""),
    items,
    reasonCode: String(formData.get("reason_code") ?? ""),
    customerNote: String(formData.get("reason") ?? ""),
    evidencePaths,
    refundMethod: String(formData.get("refund_method") ?? ""),
    accountHolderName: String(formData.get("account_holder_name") ?? ""),
    accountNumber: String(formData.get("account_number") ?? ""),
    bankName: String(formData.get("bank_name") ?? ""),
  });
  return result.error ? { error: result.error } : { success: "Return request sent for review." };
}
