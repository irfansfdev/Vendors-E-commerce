import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BabulShop — Shop independent, live inspired", template: "%s | BabulShop" },
  description: "Discover exceptional products from independent shops in one trusted marketplace.",
  keywords: ["marketplace", "independent shops", "multi-vendor ecommerce", "online shopping"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#080d18" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const supabase = user ? await createClient() : null;
  const sellerCheck = user && supabase
    ? await Promise.all([
        supabase.from("shops").select("id").eq("owner_id", user.id).limit(1).maybeSingle(),
        supabase.from("shop_members").select("shop_id").eq("user_id", user.id).in("role", ["owner", "manager"]).limit(1).maybeSingle(),
      ])
    : null;
  const isSeller = Boolean(sellerCheck?.[0].data || sellerCheck?.[1].data);
  const riderCheck = user && supabase
    ? await supabase.from("delivery_profiles").select("status").eq("user_id", user.id).eq("status", "approved").maybeSingle()
    : null;
  const isRider = Boolean(riderCheck?.data);

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Providers>
          <SiteHeader
            user={user ? { email: user.email, name: String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? ""), isAdmin: user.app_metadata?.is_admin === true, isSeller, isRider } : null}
          />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
