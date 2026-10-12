export type PricingErrorCode =
  | "not_found"
  | "expired"
  | "not_started"
  | "inactive"
  | "min_order_not_met"
  | "usage_limit_reached"
  | "already_used"
  | "not_applicable_to_cart";

export type PricedCartLine = {
  variant_id: string;
  qty: number;
  unit_price: number;
  line_subtotal: number;
  discount_amount: number;
};

export type ShopPricing = {
  shop_id: string;
  shop_name: string;
  lines: PricedCartLine[];
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  delivery_discount: number;
  payable_total: number;
  free_delivery_remaining: number;
};

export type AppliedCoupon = {
  code: string;
  type?: "percentage" | "fixed" | "free_delivery";
  scope?: "platform" | "shop";
};

export type CartPricing = {
  shops: ShopPricing[];
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  delivery_discount: number;
  payable_total: number;
  applied_coupon: AppliedCoupon | null;
  error: { code: PricingErrorCode; missing_amount?: number } | null;
};
