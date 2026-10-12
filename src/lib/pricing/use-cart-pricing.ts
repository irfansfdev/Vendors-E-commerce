"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateCartPricing, PRICING_ERROR_MESSAGES } from "@/lib/pricing/client";
import { useCart } from "@/components/providers/providers";
import type { CartLine } from "@/lib/types";
import type { CartPricing } from "@/lib/pricing/types";
import { formatCurrency } from "@/lib/utils";

export function useCartPricing(lines: CartLine[]) {
  const { couponCode, setCouponCode } = useCart();
  const [result, setResult] = useState<{
    key: string;
    pricing: CartPricing | null;
    error: string;
  } | null>(null);
  const lineInputs = useMemo(
    () => lines.map((line) => ({ variant_id: line.variant?.id ?? "", qty: line.quantity })),
    [lines],
  );
  const requestKey = `${JSON.stringify(lineInputs)}:${couponCode}`;

  useEffect(() => {
    if (!lines.length) return;
    let current = true;
    calculateCartPricing(lines, couponCode)
      .then((result) => {
        if (current) setResult({ key: requestKey, pricing: result, error: "" });
      })
      .catch((error: unknown) => {
        if (!current) return;
        setResult({
          key: requestKey,
          pricing: null,
          error: error instanceof Error ? error.message : "Could not calculate order pricing.",
        });
      });
    return () => {
      current = false;
    };
  }, [couponCode, lines, requestKey]);

  function applyCoupon(code: string) {
    const normalized = code.trim().toUpperCase();
    setCouponCode(normalized);
  }

  function removeCoupon() {
    applyCoupon("");
  }

  const currentResult = result?.key === requestKey ? result : null;
  const pricing = lines.length ? currentResult?.pricing ?? null : null;
  const loadError = currentResult?.error ?? "";
  const loading = lines.length > 0 && currentResult === null;
  const couponError = pricing?.error
    ? pricing.error.code === "min_order_not_met" && pricing.error.missing_amount !== undefined
      ? `Add ${formatCurrency(pricing.error.missing_amount)} more to use this coupon.`
      : PRICING_ERROR_MESSAGES[pricing.error.code]
    : "";

  return {
    couponCode,
    pricing,
    loading,
    loadError,
    couponError,
    applyCoupon,
    removeCoupon,
  };
}
