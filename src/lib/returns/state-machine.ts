import type { ReturnStatus } from "./types";

const transitions: Partial<Record<ReturnStatus, readonly ReturnStatus[]>> = {
  requested: ["approved", "rejected", "cancelled"],
  approved: ["pickup_assigned", "cancelled"],
  rejected: ["escalated"],
  escalated: ["approved", "rejected"],
  pickup_assigned: ["picked_up", "cancelled"],
  picked_up: ["returned_to_shop"],
  returned_to_shop: ["inspection_passed", "inspection_failed"],
  inspection_passed: ["refund_pending"],
  inspection_failed: ["escalated"],
  refund_pending: ["refunded"],
};

export function canTransitionReturn(
  current: ReturnStatus,
  next: ReturnStatus,
): boolean {
  return transitions[current]?.includes(next) ?? false;
}

export function getReturnTransitions(
  current: ReturnStatus,
): readonly ReturnStatus[] {
  return transitions[current] ?? [];
}
