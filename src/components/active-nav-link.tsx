"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeDollarSign, Bike, Box, Boxes, ClipboardList, CreditCard, Heart, LayoutDashboard, MapPin, Settings, ShoppingBag, Star, Store, UserRound } from "lucide-react";

const icons = {
  dashboard: LayoutDashboard,
  store: Store,
  products: Boxes,
  categories: Box,
  orders: ShoppingBag,
  reviews: Star,
  payouts: CreditCard,
  riders: Bike,
  deliveries: ClipboardList,
  profile: UserRound,
  wishlist: Heart,
  addresses: MapPin,
  sellerProducts: Box,
  sellerOrders: ShoppingBag,
  sellerPayouts: BadgeDollarSign,
  settings: Settings,
} as const;

export function ActiveNavLink({
  href,
  label,
  icon,
  exact = false,
  compact = false,
}: {
  href: string;
  label: string;
  icon: keyof typeof icons;
  exact?: boolean;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const IconComponent = icons[icon];

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${compact ? "shrink-0 whitespace-nowrap px-3 py-2" : "px-3 py-3"} flex items-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
        active
          ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300"
          : "text-slate-500 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"
      }`}
    >
      <IconComponent className="size-4" />
      {label}
    </Link>
  );
}
