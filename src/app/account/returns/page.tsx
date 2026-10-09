import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { AccountSidebar } from "@/components/account-sidebar";
import { ReturnsListTable, type ReturnsListRow } from "@/components/returns-list-table";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { RETURN_REASONS } from "@/lib/returns/config";
import { getCurrentTimeMs } from "@/lib/returns/time";

export const metadata: Metadata = { title: "My returns" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;

export default async function CustomerReturnsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/returns");
  const supabase = await createClient();
  const { data: requests, error } = await supabase
    .from("return_requests")
    .select("id,shop_order_id,status,reason_code,reason,requested_at,refund_amount,shop_orders(id,shops(name)),return_items(id,quantity,refund_amount,order_items(product_variants(products(title))))")
    .eq("customer_id", user.id)
    .order("requested_at", { ascending: false });

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="mb-7">
        <Link href="/account" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> My account</Link>
        <h1 className="mt-4 text-4xl font-black tracking-[-.055em]">My returns</h1>
        <p className="mt-2 text-sm text-slate-500">Track requests, pickup progress, and refunds.</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
        <AccountSidebar active="Returns" />
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-200 p-5 dark:border-white/10"><h2 className="font-black">Return requests</h2><p className="mt-1 text-xs text-slate-500">{requests?.length ?? 0} request{requests?.length === 1 ? "" : "s"}</p></div>
          {error ? <p className="p-6 text-sm font-semibold text-rose-600">{error.message}</p> : !requests?.length ? (
            <div className="p-12 text-center"><RotateCcw className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold">No return requests</p><p className="mt-1 text-sm text-slate-500">Eligible orders will show return options in your order details.</p><Link href="/account/orders" className="mt-4 inline-flex text-sm font-black text-orange-600">View orders</Link></div>
          ) : (
            <ReturnsListTable role="customer" now={getCurrentTimeMs()} emptyMessage="No returns in this section." rows={(requests as Row[]).map((request): ReturnsListRow => {
              const items = ((request.return_items ?? []) as Row[]).map((item) => {
                const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
                const variant = orderItem?.product_variants;
                const product = Array.isArray(variant) ? variant[0]?.products : variant?.products;
                return `${String(product?.title ?? "Item")} × ${Number(item.quantity ?? 0)}`;
              });
              const reasonCode = String(request.reason_code ?? "");
              const shopOrder = Array.isArray(request.shop_orders) ? request.shop_orders[0] : request.shop_orders;
              return {
                id: String(request.id),
                orderId: String(request.shop_order_id),
                href: `/account/returns/${String(request.id)}`,
                status: String(request.status),
                shop: String((Array.isArray(shopOrder?.shops) ? shopOrder.shops[0] : shopOrder?.shops)?.name ?? "Shop"),
                items,
                reason: RETURN_REASONS[reasonCode as keyof typeof RETURN_REASONS] ?? String(request.reason ?? "Return"),
                amount: Number(request.refund_amount ?? 0),
                requestedAt: String(request.requested_at),
              };
            })} />
          )}
        </section>
      </div>
    </main>
  );
}
