import Link from "next/link";
import { Logo } from "@/components/layout/logo";

const groups = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/search" },
      { label: "Deals", href: "/search?deal=true" },
      { label: "Shops", href: "/search?type=shop" },
    ],
  },
  {
    title: "Sell and deliver",
    links: [
      { label: "Open a shop", href: "/seller" },
      { label: "Become a rider", href: "/rider/apply" },
      { label: "Track orders", href: "/account/orders" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "My account", href: "/account" },
      { label: "Returns", href: "/account/returns" },
      { label: "Notifications", href: "/notifications" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_2fr] lg:px-10">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Thoughtful products from independent shops.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-semibold text-[var(--text)]">{group.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-[var(--text-muted)] transition hover:text-[var(--accent)]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-[var(--text-muted)] sm:flex-row sm:px-6 lg:px-10">
          <p>© 2026 BabulShop Marketplace. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
