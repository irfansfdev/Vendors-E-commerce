export type CouponStatus = "active" | "scheduled" | "expired" | "paused";

export function getCouponStatus(
  coupon: { is_active?: unknown; start_date?: unknown; end_date?: unknown },
  now = Date.now(),
): CouponStatus {
  if (coupon.is_active !== true) return "paused";
  const start = coupon.start_date ? new Date(String(coupon.start_date)).getTime() : 0;
  const end = coupon.end_date ? new Date(String(coupon.end_date)).getTime() : Number.POSITIVE_INFINITY;
  if (start > now) return "scheduled";
  if (end <= now) return "expired";
  return "active";
}
