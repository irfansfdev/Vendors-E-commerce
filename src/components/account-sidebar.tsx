import { ActiveNavLink } from "@/components/active-nav-link";

const items = [
  ["Overview", "/account", "dashboard"],
  ["Orders", "/account/orders", "orders"],
  ["Wishlist", "/wishlist", "wishlist"],
  ["Addresses", "/account/addresses", "addresses"],
] as const;

export function AccountSidebar({ active }: { active: string }) {
  return <aside className="surface overflow-hidden p-2"><nav className="grid">{items.map(([label, href, Icon]) => <ActiveNavLink key={label} href={href} label={label} icon={Icon} exact={href === "/account"} />)}</nav></aside>;
}
