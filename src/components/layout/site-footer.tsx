import Link from "next/link";
import { Camera, MessagesSquare, Send, ShieldCheck, UsersRound } from "lucide-react";
import { Logo } from "@/components/logo";

const groups = [
  { title: "Shop", links: ["New arrivals", "Best sellers", "Deals", "Gift cards"] },
  { title: "Sell", links: ["Open a shop", "Seller handbook", "Payouts", "Seller protection"] },
  { title: "Support", links: ["Help center", "Track an order", "Returns", "Contact us"] },
  { title: "Company", links: ["About BabulShop", "Careers", "Sustainability", "Press"] },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_2fr] lg:px-8">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-5 text-sm leading-6 text-slate-500 dark:text-slate-400">A marketplace for exceptional products from independent shops around the world.</p>
          <div className="mt-6 flex gap-2">{[Camera, UsersRound, MessagesSquare, Send].map((Icon, index) => <a key={index} href="#" className="icon-button" aria-label="Social media"><Icon className="size-4" /></a>) }</div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {groups.map((group) => <div key={group.title}><h3 className="text-sm font-bold">{group.title}</h3><ul className="mt-4 space-y-3">{group.links.map((link) => <li key={link}><Link href="#" className="text-sm text-slate-500 transition hover:text-orange-500 dark:text-slate-400">{link}</Link></li>)}</ul></div>)}
          <div><h3 className="text-sm font-bold">Delivery</h3><ul className="mt-4 space-y-3"><li><Link href="/rider/apply" className="text-sm text-slate-500 transition hover:text-orange-500 dark:text-slate-400">Become a rider</Link></li><li><Link href="/account/orders" className="text-sm text-slate-500 transition hover:text-orange-500 dark:text-slate-400">Track deliveries</Link></li></ul></div>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-white/10"><div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8"><p>© 2026 BabulShop Marketplace. All rights reserved.</p><div className="flex items-center gap-5"><Link href="#">Privacy</Link><Link href="#">Terms</Link><span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-emerald-500" /> Secure checkout</span></div></div></div>
    </footer>
  );
}
