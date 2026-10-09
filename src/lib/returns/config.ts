export const DEFAULT_RETURN_WINDOW_DAYS = 7;
export const RETURN_SELLER_RESPONSE_HOURS = 48;
export const RETURN_ESCALATION_WINDOW_DAYS = 3;
export const RETURN_PICKUP_FEE_PKR = 150;
export const RETURN_EVIDENCE_MIN_PHOTOS = 1;
export const RETURN_EVIDENCE_MAX_PHOTOS = 4;

export const RETURN_REASONS = {
  damaged_defective: "Damaged or defective",
  wrong_item: "Wrong item",
  not_as_described: "Not as described",
  missing_item: "Missing item",
  size_fit: "Size or fit",
  changed_mind: "Changed my mind",
} as const;

export type ReturnReasonCode = keyof typeof RETURN_REASONS;

export const RETURN_REFUND_METHODS = {
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  bank_transfer: "Bank transfer",
} as const;

export type ReturnRefundMethod = keyof typeof RETURN_REFUND_METHODS;

export function returnReasonRequiresPhotos(reason: ReturnReasonCode) {
  return reason !== "size_fit" && reason !== "changed_mind";
}
