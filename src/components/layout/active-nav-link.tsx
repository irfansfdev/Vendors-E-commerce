"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BadgeDollarSign, Bike, Box, Boxes, ClipboardList, CreditCard, Heart, LayoutDashboard, MapPin, RotateCcw, Settings, ShoppingBag, Star, Store, TicketPercent, UserRound } from "lucide-react";

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
  coupons: TicketPercent,
} as const;
const EMPTY_BADGE_ITEMS: string[] = [];

export function ActiveNavLink({
  href,
  label,
  icon,
  exact = false,
  compact = false,
  badge,
  badgeStorageKey,
  badgeItems,
}: {
  href: string;
  label: string;
  icon: keyof typeof icons;
  exact?: boolean;
  compact?: boolean;
  badge?: number;
  badgeStorageKey?: string;
  badgeItems?: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [path, query] = href.split("?");
  const queryMatches = !query || new URLSearchParams(query).toString() === searchParams.toString();
  const active = (exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`))
    && (queryMatches || (!query && !searchParams.has("type")));
  const IconComponent = icons[icon];
  const storageKey = badgeStorageKey ? `babulshop:sidebar-seen:${badgeStorageKey}:${path}` : null;
  const currentItemsSnapshot = JSON.stringify(badgeItems ?? []);
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener("babulshop:sidebar-seen", callback);
    return () => {
      window.removeEventListener("storage", callback);
      window.removeEventListener("babulshop:sidebar-seen", callback);
    };
  }, []);
  const getSeenSnapshot = useCallback(() => {
    return storageKey ? window.localStorage.getItem(storageKey) ?? "{}" : "{}";
  }, [storageKey]);
  const seenSnapshot = useSyncExternalStore(subscribe, getSeenSnapshot, () => "{}");
  const savedState = useMemo(() => {
    try {
      const saved = JSON.parse(seenSnapshot) as { count?: unknown; items?: unknown };
      return {
        count: typeof saved.count === "number" && Number.isFinite(saved.count) ? Math.max(0, saved.count) : 0,
        items: Array.isArray(saved.items) ? saved.items.filter((item): item is string => typeof item === "string") : [],
      };
    } catch {
      return { count: 0, items: [] as string[] };
    }
  }, [seenSnapshot]);
  const seenCount = savedState.count;
  const seenItems = savedState.items;
  const currentCount = Math.max(0, badge ?? 0);
  const currentItems = badgeItems ?? EMPTY_BADGE_ITEMS;
  const currentItemsSet = useMemo(() => new Set(currentItems), [currentItems]);

  useEffect(() => {
    if (!storageKey) return;
    if (active) {
      window.localStorage.setItem(storageKey, JSON.stringify({ count: currentCount, items: badgeItems ?? null }));
      window.dispatchEvent(new Event("babulshop:sidebar-seen"));
      return;
    }

    if (badgeItems !== undefined) {
      const retainedItems = seenItems.filter((item) => currentItemsSet.has(item));
      if (retainedItems.length !== seenItems.length) {
        window.localStorage.setItem(storageKey, JSON.stringify({ count: currentCount, items: retainedItems }));
        window.dispatchEvent(new Event("babulshop:sidebar-seen"));
      }
      return;
    }

    const adjustedSeenCount = Math.min(seenCount, currentCount);
    if (adjustedSeenCount !== seenCount) {
      window.localStorage.setItem(storageKey, JSON.stringify({ count: adjustedSeenCount, items: null }));
      window.dispatchEvent(new Event("babulshop:sidebar-seen"));
    }
  }, [active, badgeItems, currentCount, currentItemsSet, currentItemsSnapshot, seenCount, seenItems, storageKey]);
  const seenItemsSet = new Set(seenItems);
  const unreadCount = badgeItems === undefined
    ? Math.max(0, currentCount - Math.min(seenCount, currentCount))
    : currentItems.filter((item) => !seenItemsSet.has(item)).length;
  const visibleBadge = active ? undefined : badgeStorageKey
    ? unreadCount > 0 ? unreadCount : undefined
    : badge;

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
      {visibleBadge !== undefined && visibleBadge > 0 && <span className="ml-auto min-w-5 rounded-full bg-orange-500 px-1.5 py-0.5 text-center text-[10px] font-black text-white">{visibleBadge > 99 ? "99+" : visibleBadge}</span>}
    </Link>
  );
}
