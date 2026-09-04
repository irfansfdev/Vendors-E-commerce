import { SellerSidebar } from "@/components/seller-sidebar";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto grid max-w-[1440px] items-start gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[210px_1fr] lg:px-8"><SellerSidebar /><div className="min-w-0">{children}</div></div>;
}
