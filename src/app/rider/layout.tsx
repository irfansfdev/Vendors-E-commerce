import { Bike } from "lucide-react";
import { ActiveNavLink } from "@/components/active-nav-link";

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const items = [
    { href: "/rider", label: "Overview", icon: "dashboard" as const },
    { href: "/rider/assignments", label: "Deliveries", icon: "deliveries" as const },
    { href: "/rider/profile", label: "Profile", icon: "profile" as const },
  ];
  return <div className="min-h-[calc(100vh-180px)] bg-slate-50 dark:bg-[#080d18]"><div className="mx-auto max-w-[1180px] px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[210px_1fr] lg:items-start lg:gap-6 lg:px-8 lg:py-8"><aside className="surface hidden h-fit p-2 lg:block"><div className="mb-2 flex items-center gap-2 px-3 py-3 text-sm font-black"><Bike className="size-5 text-orange-500" /> Delivery desk</div><nav className="grid gap-1">{items.map(({ href, label, icon: Icon }) => <ActiveNavLink key={href} href={href} label={label} icon={Icon} exact={href === "/rider"} />)}</nav></aside><div className="mb-5 lg:hidden"><div className="mb-2 flex items-center gap-2 px-1 text-sm font-black"><Bike className="size-5 text-orange-500" /> Delivery desk</div><nav className="surface flex gap-2 overflow-x-auto p-2">{items.map(({ href, label, icon: Icon }) => <ActiveNavLink key={href} href={href} label={label} icon={Icon} exact={href === "/rider"} compact />)}</nav></div><div className="min-w-0">{children}</div></div></div>;
}
