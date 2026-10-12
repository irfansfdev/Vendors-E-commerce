"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BadgeDollarSign, Bike, Box, Boxes, ClipboardList, CreditCard, Heart, LayoutDashboard, MapPin, RotateCcw, Settings, ShoppingBag, Star, Store, UserRound } from "lucide-react";

const icons = {
  dashboard: LayoutDashboard,
  store: Store,
  products: Boxes,
  categories: Box,
  orders: ShoppingBag,
  returns: RotateCcw,
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
  returnPickups: RotateCcw,
} as const;

export function ActiveNavLink({
  href,
  label,
  icon,
  exact = false,
  compact = false,
  badge,
}: {
  href: string;
  label: string;
  icon: keyof typeof icons;
  exact?: boolean;
  compact?: boolean;
  badge?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [path, query] = href.split("?");
  const queryMatches = !query || new URLSearchParams(query).toString() === searchParams.toString();
  const active = (exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`))
    && (queryMatches || (!query && !searchParams.has("type")));
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
      {badge !== undefined && badge > 0 && <span className="ml-auto min-w-5 rounded-full bg-orange-500 px-1.5 py-0.5 text-center text-[10px] font-black text-white">{badge > 99 ? "99+" : badge}</span>}
    </Link>
  );
}
