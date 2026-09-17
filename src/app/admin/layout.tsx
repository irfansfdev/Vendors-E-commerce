// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { ActiveNavLink } from "@/components/active-nav-link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isAdmin = user?.app_metadata?.is_admin === true;

  if (!isAdmin) {
    redirect("/"); // Agar admin nahi hai toh wapas home bhej do
  }

  const navItems = [
    { name: "Overview", href: "/admin", icon: "dashboard" as const },
    { name: "Shops", href: "/admin/shops", icon: "store" as const },
    { name: "Products", href: "/admin/products", icon: "products" as const },
    { name: "Categories", href: "/admin/categories", icon: "categories" as const },
    { name: "Global Orders", href: "/admin/orders", icon: "orders" as const },
    { name: "Reviews", href: "/admin/reviews", icon: "reviews" as const },
    { name: "Payouts", href: "/admin/payouts", icon: "payouts" as const },
    { name: "Riders", href: "/admin/riders", icon: "riders" as const },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-[#080d18] lg:flex-row">
      {/* Admin Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start overflow-y-auto border-r bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-950 lg:block">
        <h2 className="mb-8 px-2 text-xl font-black text-orange-500 tracking-tight">BabulShop Admin</h2>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <ActiveNavLink key={item.name} href={item.href} label={item.name} icon={item.icon} exact={item.href === "/admin"} />
          ))}
        </nav>
      </aside>

      <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-950 lg:hidden">
        <div className="mb-2 text-xs font-black text-orange-500">BabulShop Admin</div>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => <ActiveNavLink key={item.name} href={item.href} label={item.name} icon={item.icon} exact={item.href === "/admin"} compact />)}
        </nav>
      </div>

      {/* Main Admin Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}