import Link from "next/link";
import { Heart, MapPin, PackageCheck, ShoppingBag } from "lucide-react";

const items = [
  ["Overview", "/account", PackageCheck],
  ["Orders", "/account/orders", ShoppingBag],
  ["Wishlist", "/wishlist", Heart],
  ["Addresses", "/account/addresses", MapPin],
] as const;

export function AccountSidebar({ active }: { active: string }) {
  return <aside className="surface overflow-hidden p-2"><nav className="grid text-sm font-bold">{items.map(([label, href, Icon]) => <Link key={label} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${active === label ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"}`}><Icon className="size-4" />{label}</Link>)}</nav></aside>;
}
