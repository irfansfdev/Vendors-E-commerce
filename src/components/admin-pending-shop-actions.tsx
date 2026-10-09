"use client";

import { Check, X } from "lucide-react";
import { updateShopStatusAction } from "@/app/actions/admin";
import { RowActions } from "@/components/ui/row-actions";

export function AdminPendingShopActions({ shopId }: { shopId: string }) {
  return (
    <RowActions
      label="Shop request actions"
      items={[
        {
          id: "approve",
          type: "button",
          label: "Approve",
          icon: Check,
          onSelect: async () => {
            await updateShopStatusAction(shopId, "active");
          },
        },
        {
          id: "reject",
          type: "button",
          label: "Reject",
          icon: X,
          tone: "danger",
          confirm: {
            title: "Reject shop request?",
            message: "This shop request will be rejected.",
            confirmLabel: "Reject",
          },
          onSelect: async () => {
            await updateShopStatusAction(shopId, "rejected");
          },
        },
      ]}
    />
  );
}
