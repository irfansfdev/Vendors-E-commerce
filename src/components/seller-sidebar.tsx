"use client";

import Link from "next/link";
import { BadgeDollarSign, Box, LayoutDashboard, Settings, ShoppingBag, UsersRound } from "lucide-react";

const items = [
  { label: "Overview", href: "/seller", icon: LayoutDashboard },
  { label: "Products", href: "/seller/products", icon: Box },
  { label: "Orders", href: "/seller/orders", icon: ShoppingBag },
  { label: "Staff", href: "/seller/staff", icon: UsersRound },
  { label: "Payouts", href: "/seller/payouts", icon: BadgeDollarSign },
  { label: "Settings", href: "/seller/settings", icon: Settings },
];

export function SellerSidebar() {
  return <aside className="surface sticky top-36 hidden h-fit p-2 lg:block"><nav className="grid gap-1 text-sm font-bold">{items.map(({ label, href, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-slate-500 transition hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"><Icon className="size-4" />{label}</Link>)}</nav></aside>;
}
