"use client";

import { TicketPercent, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { deleteSellerCouponAction, setSellerCouponActiveAction } from "@/app/seller/coupons/actions";
import { setAdminCouponActiveAction } from "@/app/admin/coupons/actions";
import { RowActions, type RowActionItem } from "@/components/ui/row-actions";

export function CouponRowActions({
  id,
  code,
  active,
  isSeller,
}: {
  id: string;
  code: string;
  active: boolean;
  isSeller: boolean;
}) {
  const items: RowActionItem[] = isSeller
    ? [
        { id: "edit", type: "link", label: "Edit coupon", icon: TicketPercent, href: `/seller/coupons?edit=${encodeURIComponent(id)}` },
        { id: "toggle", type: "form", label: active ? "Pause coupon" : "Resume coupon", icon: active ? ToggleLeft : ToggleRight, action: setSellerCouponActiveAction, hidden: { id, active: String(!active) } },
        { id: "delete", type: "form", label: "Delete coupon", icon: Trash2, action: deleteSellerCouponAction, hidden: { id }, confirm: { title: "Delete coupon?", message: "Coupons with redemption history cannot be deleted. This action cannot be undone.", confirmLabel: "Delete coupon" } },
      ]
    : [
        { id: active ? "pause" : "resume", type: "form", label: active ? "Pause coupon" : "Resume coupon", icon: active ? ToggleLeft : ToggleRight, action: setAdminCouponActiveAction, hidden: { id, active: String(!active) } },
      ];

  return <RowActions label={`Actions for ${code}`} items={items} />;
}
