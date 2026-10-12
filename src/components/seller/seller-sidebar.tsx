import { Settings } from "lucide-react";
import { ActiveNavLink } from "@/components/layout/active-nav-link";

const items = [
  { label: "Overview", href: "/seller", icon: "dashboard" as const },
  { label: "Products", href: "/seller/products", icon: "sellerProducts" as const },
  { label: "Orders", href: "/seller/orders", icon: "sellerOrders" as const },
  { label: "Coupons", href: "/seller/coupons", icon: "coupons" as const },
  { label: "Returns", href: "/seller/returns", icon: "returns" as const },
  { label: "Payouts", href: "/seller/payouts", icon: "sellerPayouts" as const },
  { label: "Settings", href: "/seller/settings", icon: "settings" as const },
];

export type SellerSidebarCounts = {
  products?: number;
  orders?: number;
  returns?: number;
  payouts?: number;
};

export type SellerSidebarItems = {
  products?: string[];
  orders?: string[];
  returns?: string[];
  payouts?: string[];
};

export function SellerSidebar({
  counts = {},
  badgeItems = {},
  userId,
}: {
  counts?: SellerSidebarCounts;
  badgeItems?: SellerSidebarItems;
  userId: string;
}) {
  const badges: Record<string, number | undefined> = {
    "/seller/products": counts.products,
    "/seller/orders": counts.orders,
    "/seller/returns": counts.returns,
    "/seller/payouts": counts.payouts,
  };
  const requestItems: Record<string, string[] | undefined> = {
    "/seller/products": badgeItems.products,
    "/seller/orders": badgeItems.orders,
    "/seller/returns": badgeItems.returns,
    "/seller/payouts": badgeItems.payouts,
  };
  return <><aside className="surface sticky top-36 hidden h-fit p-2 lg:block"><nav className="grid gap-1">{items.map(({ label, href, icon: Icon }) => <ActiveNavLink key={href} href={href} label={label} icon={Icon} exact={href === "/seller"} badge={badges[href]} badgeItems={requestItems[href]} badgeStorageKey={`${userId}:seller`} />)}</nav></aside><nav className="surface flex gap-2 overflow-x-auto p-2 lg:hidden">{items.map(({ label, href, icon: Icon }) => <ActiveNavLink key={href} href={href} label={label} icon={Icon} exact={href === "/seller"} compact badge={badges[href]} badgeItems={requestItems[href]} badgeStorageKey={`${userId}:seller`} />)}</nav></>;
}
