// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { ActiveNavLink } from "@/components/active-nav-link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isAdmin = user?.app_metadata?.is_admin === true;

  if (!isAdmin) {
    redirect("/");
  }

  const navItems = [
    { name: "Overview", href: "/admin", icon: "dashboard" as const },
    { name: "Shops", href: "/admin/shops", icon: "store" as const },
    { name: "Products", href: "/admin/products", icon: "products" as const },
    { name: "Categories", href: "/admin/categories", icon: "categories" as const },
    { name: "Global Orders", href: "/admin/orders", icon: "orders" as const },
    { name: "Returns", href: "/admin/returns", icon: "returns" as const },
    { name: "Delivery queue", href: "/admin/deliveries", icon: "deliveries" as const },
    { name: "Reviews", href: "/admin/reviews", icon: "reviews" as const },
    { name: "Payouts", href: "/admin/payouts", icon: "payouts" as const },
    { name: "Riders", href: "/admin/riders", icon: "riders" as const },
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-slate-50 dark:bg-[#080d18]">
      {/* Admin Sidebar - 'self-start' se sticky perfect kaam karega */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start overflow-y-auto bg-white px-4 py-6 dark:bg-slate-950 lg:block">
        <h2 className="mb-8 px-2 text-xl font-black text-orange-500 tracking-tight">BabulShop Admin</h2>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <ActiveNavLink key={item.name} href={item.href} label={item.name} icon={item.icon} exact={item.href === "/admin"} />
          ))}
        </nav>
      </aside>

      {/* Mobile Navbar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-950 lg:hidden">
        <div className="mb-2 text-xs font-black text-orange-500">BabulShop Admin</div>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <ActiveNavLink key={item.name} href={item.href} label={item.name} icon={item.icon} exact={item.href === "/admin"} compact />
          ))}
        </nav>
      </div>

      {/* Main Admin Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}