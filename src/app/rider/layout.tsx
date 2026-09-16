import Link from "next/link";
import { Bike, ClipboardList, LayoutDashboard, UserRound } from "lucide-react";

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const items = [
    { href: "/rider", label: "Overview", icon: LayoutDashboard },
    { href: "/rider/assignments", label: "Deliveries", icon: ClipboardList },
    { href: "/rider/profile", label: "Profile", icon: UserRound },
  ];
  return <div className="min-h-[calc(100vh-180px)] bg-slate-50 dark:bg-[#080d18]"><div className="mx-auto grid max-w-[1180px] items-start gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[210px_1fr] lg:px-8"><aside className="surface h-fit p-2"><div className="mb-2 flex items-center gap-2 px-3 py-3 text-sm font-black"><Bike className="size-5 text-orange-500" /> Delivery desk</div><nav className="grid gap-1 text-sm font-bold">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-slate-500 transition hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"><Icon className="size-4" />{label}</Link>)}</nav></aside><div className="min-w-0">{children}</div></div></div>;
}
