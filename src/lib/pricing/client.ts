"use client";

import { z } from "zod";
import type { CartLine } from "@/lib/types";
import type { CartPricing } from "@/lib/pricing/types";
import { createClient } from "@/lib/supabase/client";

const money = z.coerce.number().finite();
const lineSchema = z.object({
  variant_id: z.string(),
  qty: z.coerce.number().int().positive(),
  unit_price: money,
  line_subtotal: money,
  discount_amount: money,
}).passthrough();
const shopSchema = z.object({
  shop_id: z.string(),
  shop_name: z.string().optional().default(""),
  lines: z.array(lineSchema),
  subtotal: money,
  discount_amount: money,
  delivery_fee: money,
  delivery_discount: money,
  payable_total: money,
  free_delivery_remaining: money.optional().default(0),
}).passthrough();
const pricingSchema = z.object({
  shops: z.array(shopSchema),
  subtotal: money,
  discount_amount: money,
  delivery_fee: money,
  delivery_discount: money,
  payable_total: money,
  applied_coupon: z.object({
    code: z.string(),
    type: z.enum(["percentage", "fixed", "free_delivery"]).optional(),
    scope: z.enum(["platform", "shop"]).optional(),
  }).nullable().optional().default(null),
  error: z.object({
    code: z.enum([
      "not_found",
      "expired",
      "not_started",
      "inactive",
      "min_order_not_met",
      "usage_limit_reached",
      "already_used",
      "not_applicable_to_cart",
    ]),
    missing_amount: money.optional(),
  }).nullable().optional().default(null),
}).passthrough();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePricingResponse(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const shops = Array.isArray(value.shops) ? value.shops : Array.isArray(value.shop_breakdown) ? value.shop_breakdown : [];
  const normalizedShops = shops.map((candidate) => {
    if (!isRecord(candidate)) return candidate;
    const nestedShop = isRecord(candidate.shop) ? candidate.shop : {};
    const lines = Array.isArray(candidate.lines) ? candidate.lines : [];
    return {
      ...candidate,
      shop_id: candidate.shop_id ?? nestedShop.id,
      shop_name: candidate.shop_name ?? nestedShop.name ?? candidate.name ?? "",
      subtotal: candidate.subtotal ?? candidate.sub_total,
      discount_amount: candidate.discount_amount ?? candidate.discount,
      payable_total: candidate.payable_total ?? candidate.total_payable ?? candidate.total,
      free_delivery_remaining: candidate.free_delivery_remaining ?? candidate.amount_to_free_delivery ?? 0,
      lines: lines.map((line) => isRecord(line) ? {
        ...line,
        qty: line.qty ?? line.quantity,
        discount_amount: line.discount_amount ?? line.discount ?? 0,
      } : line),
    };
  });
  const rawError = value.error ?? value.error_code;
  const error = typeof rawError === "string"
    ? { code: rawError, missing_amount: value.missing_amount }
    : isRecord(rawError)
      ? { ...rawError, code: rawError.code ?? rawError.error_code, missing_amount: rawError.missing_amount ?? value.missing_amount }
      : null;
  const rawCoupon = value.applied_coupon ?? value.coupon ?? null;
  const appliedCoupon = typeof rawCoupon === "string"
    ? { code: rawCoupon }
    : isRecord(rawCoupon)
      ? { ...rawCoupon, code: rawCoupon.code ?? rawCoupon.coupon_code }
      : null;
  return {
    ...value,
    shops: normalizedShops,
    subtotal: value.subtotal ?? value.subtotal_amount,
    discount_amount: value.discount_amount ?? value.discount,
    payable_total: value.payable_total ?? value.total_payable ?? value.total,
    applied_coupon: appliedCoupon,
    error,
  };
}

export const PRICING_ERROR_MESSAGES: Record<string, string> = {
  not_found: "That coupon code was not found.",
  expired: "That coupon has expired.",
  not_started: "That coupon is not available yet.",
  inactive: "That coupon is currently paused.",
  min_order_not_met: "Your order does not meet this coupon’s minimum.",
  usage_limit_reached: "That coupon has reached its usage limit.",
  already_used: "You have already used that coupon.",
  not_applicable_to_cart: "That coupon does not apply to items in your cart.",
};

function getLineInputs(lines: CartLine[]) {
  return lines.map((line) => {
    if (!line.variant?.id) {
      throw new Error(`${line.product.name} needs a selected variant before it can be priced.`);
    }
    return { variant_id: line.variant.id, qty: line.quantity };
  });
}

export async function calculateCartPricing(lines: CartLine[], couponCode: string) {
  const supabase = createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!auth.user) throw new Error("Sign in to see your delivery and coupon totals.");

  const { data, error } = await supabase.rpc("calculate_cart_pricing", {
    p_lines: getLineInputs(lines),
    p_coupon_code: couponCode.trim() || null,
  });
  if (error) throw new Error(error.message);

  const parsed = pricingSchema.safeParse(normalizePricingResponse(data));
  if (!parsed.success) {
    throw new Error("The pricing service returned an unexpected breakdown. Please try again.");
  }
  const result: CartPricing = parsed.data;
  return result;
}
