"use client";

import { Settings } from "lucide-react";
import { ActiveNavLink } from "@/components/active-nav-link";

const items = [
  { label: "Overview", href: "/seller", icon: "dashboard" as const },
  { label: "Products", href: "/seller/products", icon: "sellerProducts" as const },
  { label: "Orders", href: "/seller/orders", icon: "sellerOrders" as const },
  { label: "Payouts", href: "/seller/payouts", icon: "sellerPayouts" as const },
  { label: "Settings", href: "/seller/settings", icon: "settings" as const },
];

export function SellerSidebar() {
  return <><aside className="surface sticky top-36 hidden h-fit p-2 lg:block"><nav className="grid gap-1">{items.map(({ label, href, icon: Icon }) => <ActiveNavLink key={href} href={href} label={label} icon={Icon} exact={href === "/seller"} />)}</nav></aside><nav className="surface flex gap-2 overflow-x-auto p-2 lg:hidden">{items.map(({ label, href, icon: Icon }) => <ActiveNavLink key={href} href={href} label={label} icon={Icon} exact={href === "/seller"} compact />)}</nav></>;
}
