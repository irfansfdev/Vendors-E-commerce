import type { ReturnReasonCode, ReturnRefundMethod } from "./config";

export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "escalated"
  | "pickup_assigned"
  | "picked_up"
  | "returned_to_shop"
  | "inspection_passed"
  | "inspection_failed"
  | "refund_pending"
  | "refunded"
  | "cancelled"
  | "received";

export type ReturnItemInput = {
  orderItemId: string;
  quantity: number;
};

export type ReturnEvidenceInput = {
  objectPath: string;
  contentType?: string;
};

export type CreateReturnRequestInput = {
  shopOrderId: string;
  items: ReturnItemInput[];
  reasonCode: ReturnReasonCode;
  customerNote?: string;
  evidencePaths: string[];
  refundMethod: ReturnRefundMethod;
  accountHolderName: string;
  accountNumber: string;
  bankName?: string;
};

export type ReturnEvent = {
  id: string;
  from_status: ReturnStatus | null;
  to_status: ReturnStatus;
  event_type: string;
  note: string | null;
  actor_id: string | null;
  actor_role: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RiderReturnPickupDetails = {
  assignment_id: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  shop_name: string;
  shop_phone: string;
  shop_address: string;
  items: Array<{ title: string; quantity: number }>;
};
