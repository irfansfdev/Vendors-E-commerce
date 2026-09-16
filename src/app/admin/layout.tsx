// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { LayoutDashboard, Store, Boxes, ShoppingCart, CreditCard, Star, Bike } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isAdmin = user?.app_metadata?.is_admin === true;

  if (!isAdmin) {
    redirect("/"); // Agar admin nahi hai toh wapas home bhej do
  }

  const navItems = [
    { name: "Overview", href: "/admin", icon: LayoutDashboard },
    { name: "Shops", href: "/admin/shops", icon: Store },
    { name: "Products", href: "/admin/products", icon: Boxes },
    { name: "Categories", href: "/admin/categories", icon: Boxes },
    { name: "Global Orders", href: "/admin/orders", icon: ShoppingCart },
    { name: "Reviews", href: "/admin/reviews", icon: Star },
    { name: "Payouts", href: "/admin/payouts", icon: CreditCard },
    { name: "Riders", href: "/admin/riders", icon: Bike },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#080d18]">
      {/* Admin Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start overflow-y-auto border-r bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-950 lg:block">
        <h2 className="mb-8 px-2 text-xl font-black text-orange-500 tracking-tight">BabulShop Admin</h2>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                <Icon className="size-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Admin Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}