"use client";

import { Eye, RotateCcw } from "lucide-react";
import { RowActions } from "@/components/ui/row-actions";

export type AccountOrderReturnAction = {
  id: string;
  label: "View return" | "Return items";
  href: string;
};

export function AccountOrderActions({
  orderHref,
  returnActions,
}: {
  orderHref: string;
  returnActions: AccountOrderReturnAction[];
}) {
  return (
    <RowActions
      label="Order actions"
      items={[
        { id: "view-order", type: "link", label: "View order", icon: Eye, href: orderHref },
        ...returnActions.map((action) => ({
          ...action,
          type: "link" as const,
          icon: RotateCcw,
        })),
      ]}
    />
  );
}
