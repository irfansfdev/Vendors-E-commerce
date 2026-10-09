import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, ShoppingBag } from "lucide-react";
import { AccountSidebar } from "@/components/account-sidebar";
import { signoutAction } from "@/app/auth/actions";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getOrderStatus } from "@/lib/order-status";
import { formatReturnDate, getReturnDeadline, isReturnWindowOpen } from "@/lib/returns/eligibility";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { UrlPagination } from "@/components/ui/pagination";
import { AccountOrderActions, type AccountOrderReturnAction } from "@/components/account-order-actions";
import { ClickableCard } from "@/components/ui/clickable-row";

export const metadata: Metadata = { title: "My orders" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
const activeReturnStatuses = [
  "requested", "approved", "escalated", "pickup_assigned", "picked_up",
  "returned_to_shop", "inspection_passed", "inspection_failed", "refund_pending", "received",
];

export default async function AccountOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/orders");
  const pagination = parsePagination(await searchParams);
  const supabase = await createClient();
  let { data, error, count } = await supabase
    .from("orders")
    .select("*, shop_orders(*, shops(name,return_window_days))", { count: "exact" })
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);
  const meta = buildPaginationMeta(count ?? 0, pagination.page, pagination.pageSize);
  if ((count ?? 0) > 0 && meta.page !== pagination.page) {
    ({ data, error, count } = await supabase
      .from("orders")
      .select("*, shop_orders(*, shops(name,return_window_days))", { count: "exact" })
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .range(meta.from, meta.to));
  }
  const orders = (data ?? []) as Row[];
  const shopOrderIds = orders.flatMap((order) =>
    ((order.shop_orders ?? []) as Row[]).map((shopOrder) => String(shopOrder.id)),
  );
  const returnResult = shopOrderIds.length
    ? await supabase.from("return_requests").select("id,shop_order_id,status").in("shop_order_id", shopOrderIds)
    : { data: [], error: null };
  const fullName = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Shopper");
  const returnByShopOrder = new Map<string, Row>();
  for (const request of (returnResult.data ?? []) as Row[]) {
    if (activeReturnStatuses.includes(String(request.status))) {
      returnByShopOrder.set(String(request.shop_order_id), request);
    }
  }

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Your BabulShop</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Hello, {fullName}</h1>
          <p className="mt-2 text-sm text-slate-500">Track your orders and shop deliveries.</p>
        </div>
        <form action={signoutAction}><button className="button-secondary"><LogOut className="size-4" /> Sign out</button></form>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
        <AccountSidebar active="Orders" />
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-200 p-5 dark:border-white/10">
            <h2 className="font-black">All orders</h2>
            <p className="mt-1 text-xs text-slate-500">{count ?? 0} order{count === 1 ? "" : "s"} in your account.</p>
          </div>
          {error || returnResult.error ? (
            <p className="p-6 text-sm font-semibold text-rose-600">{error?.message ?? returnResult.error?.message}</p>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingBag className="mx-auto size-10 text-slate-300" />
              <p className="mt-3 font-bold">No orders yet</p>
              <p className="mt-1 text-sm text-slate-500">Your purchases will appear here.</p>
            </div>
          ) : (
            <div data-pagination-list className="divide-y divide-slate-100 dark:divide-white/10">
              {orders.map((order) => {
                const shopOrders = (order.shop_orders ?? []) as Row[];
                const orderStatus = getOrderStatus(order);
                const orderHref = `/account/orders/${String(order.id)}`;
                const orderReturnActions: AccountOrderReturnAction[] = shopOrders.flatMap<AccountOrderReturnAction>((shopOrder) => {
                  const openReturn = returnByShopOrder.get(String(shopOrder.id));
                  if (openReturn) {
                    return [{
                      id: `view-return-${String(openReturn.id)}`,
                      label: "View return",
                      href: `/account/returns/${String(openReturn.id)}`,
                    }];
                  }
                  const shopValue = shopOrder.shops ?? {};
                  const shop = (Array.isArray(shopValue) ? shopValue[0] : shopValue) as Row;
                  const windowDays = Number(shop.return_window_days ?? 7);
                  const deadline = getReturnDeadline(shopOrder.delivered_at, windowDays);
                  const delivered = ["delivered", "completed"].includes(String(shopOrder.order_status ?? "").toLowerCase());
                  return delivered && isReturnWindowOpen(deadline)
                    ? [{
                        id: `return-items-${String(shopOrder.id)}`,
                        label: "Return items",
                        href: `/account/orders/${String(shopOrder.id)}/return`,
                      }]
                    : [];
                });
                const hasReturnActions = orderReturnActions.length > 0;
                return (
                  <ClickableCard
                    key={String(order.id)}
                    href={orderHref}
                    className="p-5"
                    enabled={!hasReturnActions}
                  >
                    {hasReturnActions ? (
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="font-extrabold">Order #{String(order.id).slice(0, 8)}</h3>
                          <p className="mt-1 text-xs text-slate-500">{order.created_at ? new Date(String(order.created_at)).toLocaleString() : ""}</p>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <p className="font-black">{formatCurrency(Number(order.total_amount ?? order.subtotal ?? order.total ?? 0))}</p>
                            <span className="text-xs font-bold capitalize text-orange-600">{String(orderStatus ?? order.order_status ?? "pending")}</span>
                          </div>
                          <AccountOrderActions orderHref={orderHref} returnActions={orderReturnActions} />
                        </div>
                      </div>
                    ) : (
                    <Link href={orderHref} className="flex flex-wrap items-center justify-between gap-4 hover:text-orange-600">
                      <div>
                        <h3 className="font-extrabold">Order #{String(order.id).slice(0, 8)}</h3>
                        <p className="mt-1 text-xs text-slate-500">{order.created_at ? new Date(String(order.created_at)).toLocaleString() : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black">{formatCurrency(Number(order.total_amount ?? order.subtotal ?? order.total ?? 0))}</p>
                        <span className="text-xs font-bold capitalize text-orange-600">{String(orderStatus ?? order.order_status ?? "pending")}</span>
                      </div>
                    </Link>
                    )}
                    {shopOrders.length > 0 && (
                      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-white/10">
                        {shopOrders.map((shopOrder) => {
                          const shopValue = shopOrder.shops ?? {};
                          const shop = (Array.isArray(shopValue) ? shopValue[0] : shopValue) as Row;
                          const windowDays = Number(shop.return_window_days ?? 7);
                          const deadline = getReturnDeadline(shopOrder.delivered_at, windowDays);
                          const delivered = ["delivered", "completed"].includes(String(shopOrder.order_status ?? "").toLowerCase());
                          return (
                            <div key={String(shopOrder.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                              <div>
                                <p className="text-sm font-bold">{String(shop.name ?? "Shop")}</p>
                                <p className="mt-1 text-xs capitalize text-slate-500">{String(shopOrder.order_status ?? orderStatus).replaceAll("_", " ")}</p>
                                {delivered && deadline && <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Return by {formatReturnDate(deadline)}</p>}
                                {delivered && !deadline && <p className="mt-1 text-xs text-slate-400">Returns are disabled for this shop.</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!error && !returnResult.error && <div className="px-5 pb-5"><UrlPagination total={count ?? 0} /></div>}
                  </ClickableCard>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
