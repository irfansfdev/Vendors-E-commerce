import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, ChevronLeft, PackageCheck, PhoneCall, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { ReturnCustomerActions } from "@/components/return-customer-actions";
import { ReturnStatusBadge } from "@/components/return-status-badge";
import { ReturnTimeline } from "@/components/return-timeline";
import {
  getCustomerReturnPickupCode,
  getCustomerReturnRiderDetails,
} from "@/lib/returns/actions";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { RETURN_REASONS } from "@/lib/returns/config";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Return details" };
export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;
type Row = Record<string, any>;
const pickupCodeStatuses = ["pickup_assigned"];
const assignedRiderStatuses = ["pickup_assigned", "picked_up", "returned_to_shop"];

export default async function CustomerReturnDetailPage({ params }: { params: Params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/returns");
  const { id } = await params;
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("return_requests")
    .select("id,shop_order_id,status,reason_code,reason,customer_note,requested_at,updated_at,decided_at,refund_amount,pickup_fee,refund_method,refund_reference,seller_response_reason,inspection_note,escalation_reason,delivery_assignment_id,shop_orders(id,parent_order_id,shops(name)),return_items(id,order_item_id,quantity,purchase_unit_price,refund_amount,order_items(product_variants(products(title)))),return_evidence(id,object_path,content_type,evidence_type,created_at),return_events(id,from_status,to_status,event_type,note,actor_role,created_at)")
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (error) {
    return <main className="mx-auto max-w-4xl px-4 py-10"><div className="surface p-6 text-sm text-rose-600">{error.message}</div></main>;
  }
  if (!request) notFound();

  const returnRow = request as Row;
  const status = String(returnRow.status);
  const shopOrderRows = returnRow.shop_orders;
  const shopOrder = Array.isArray(shopOrderRows) ? shopOrderRows[0] ?? {} : shopOrderRows ?? {};
  const shop = Array.isArray(shopOrder.shops) ? shopOrder.shops[0] : shopOrder.shops;
  const items = (returnRow.return_items ?? []) as Row[];
  const totalQuantity = items.reduce((total, item) => total + Number(item.quantity ?? 0), 0);
  const itemSubtotal = items.reduce((total, item) => total + Number(item.refund_amount ?? 0), 0);
  const events = [...((returnRow.return_events ?? []) as Row[])].sort((a, b) =>
    new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime(),
  );
  const evidence = (returnRow.return_evidence ?? []) as Row[];
  const signedEvidence: Row[] = await Promise.all(evidence.map(async (item) => {
    const { data, error: signError } = await supabase.storage
      .from("return-evidence")
      .createSignedUrl(String(item.object_path), 3600);
    return { ...item, url: data?.signedUrl ?? null, error: signError?.message ?? null };
  }));
  const canShowCode = pickupCodeStatuses.includes(status);
  const canShowRider = assignedRiderStatuses.includes(status);
  const riderAssignedEvent = events.find((event) =>
    ["rider_assigned", "return_pickup_assigned"].includes(String(event.event_type)),
  );
  const [pickupCode, riderResult] = await Promise.all([
    canShowCode ? getCustomerReturnPickupCode(id) : Promise.resolve(null),
    canShowRider ? getCustomerReturnRiderDetails(id) : Promise.resolve(null),
  ]);
  const escalationDeadline = status === "rejected" && returnRow.decided_at
    ? new Date(new Date(String(returnRow.decided_at)).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    : status === "inspection_failed" && returnRow.updated_at
      ? new Date(new Date(String(returnRow.updated_at)).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const returnReason = String(returnRow.reason_code ?? "");
  const reasonLabel = RETURN_REASONS[returnReason as keyof typeof RETURN_REASONS] ?? String(returnRow.reason ?? "Return");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/account/returns" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> My returns</Link>
      <div className="mb-7 mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Return tracking</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">Return #{String(returnRow.id).slice(0, 8)}</h1>
          <p className="mt-2 text-sm text-slate-500">{String(shop?.name ?? "Shop")} · Order #{String(returnRow.shop_order_id).slice(0, 8)}</p>
        </div>
        <ReturnStatusBadge status={status} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:gap-6">
        <div className="space-y-5">
          <section className="surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><PackageCheck className="size-5 text-orange-500" /><h2 className="font-black">Items and estimate</h2></div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {items.length} {items.length === 1 ? "item" : "items"} · {totalQuantity} {totalQuantity === 1 ? "unit" : "units"}
              </span>
            </div>
            <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 px-4 dark:divide-white/10 dark:border-white/10">
              {items.map((item) => {
                const orderItem = item.order_items;
                const variant = Array.isArray(orderItem) ? orderItem[0]?.product_variants : orderItem?.product_variants;
                const product = Array.isArray(variant) ? variant[0]?.products : variant?.products;
                const quantity = Number(item.quantity ?? 0);
                const unitPrice = Number(item.purchase_unit_price ?? 0);
                return <div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold">{String(product?.title ?? "Item")}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatCurrency(unitPrice)} × {quantity} {quantity === 1 ? "unit" : "units"}</p>
                  </div>
                  <span className="shrink-0 text-sm font-black tabular-nums">{formatCurrency(Number(item.refund_amount ?? unitPrice * quantity))}</span>
                </div>;
              })}
            </div>
            <div className="mt-4 space-y-2.5 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-white/[.035]">
              <p className="flex justify-between gap-3"><span className="text-slate-500">Items subtotal</span><span className="font-semibold tabular-nums">{formatCurrency(itemSubtotal)}</span></p>
              {Number(returnRow.pickup_fee ?? 0) > 0 && <p className="flex justify-between gap-3"><span className="text-slate-500">Pickup fee deduction</span><span className="font-semibold tabular-nums">− {formatCurrency(Number(returnRow.pickup_fee))}</span></p>}
              <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-3 dark:border-white/10">
                <div><p className="font-black">Estimated refund</p><p className="mt-1 text-[11px] text-slate-500">Final amount follows inspection</p></div>
                <span className="text-lg font-black tabular-nums text-orange-600">{formatCurrency(Number(returnRow.refund_amount ?? 0))}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="rounded-full bg-orange-50 px-2.5 py-1 font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Reason: {reasonLabel}</span>
              <span className="text-slate-500">Shipping is not included</span>
            </div>
            {returnRow.customer_note && <p className="mt-4 rounded-xl border border-slate-100 px-4 py-3 text-sm leading-6 text-slate-600 dark:border-white/10 dark:text-slate-300"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Your note</span>{String(returnRow.customer_note)}</p>}
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-orange-500" /><h2 className="font-black">Photos and review</h2></div>
            {returnRow.seller_response_reason && <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300"><b>Shop response:</b> {String(returnRow.seller_response_reason)}</p>}
            {returnRow.inspection_note && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300"><b>Inspection:</b> {String(returnRow.inspection_note)}</p>}
            {returnRow.escalation_reason && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300"><b>Escalation:</b> {String(returnRow.escalation_reason)}</p>}
            {signedEvidence.length === 0 ? <p className="mt-4 text-sm text-slate-500">No photos were attached.</p> : (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {signedEvidence.map((item) => <li key={String(item.id)} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
                  {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="font-bold text-orange-600 underline underline-offset-2">{String(item.evidence_type ?? "Photo").replaceAll("_", " ")} · Open photo</a> : <p className="text-xs text-rose-600">{String(item.error ?? "Photo is currently unavailable.")}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">{new Date(String(item.created_at)).toLocaleString()}</p>
                </li>)}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          {canShowRider && <section className="surface overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white px-5 py-4 dark:border-white/10 dark:from-orange-500/[.08] dark:to-transparent">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-orange-600">Pickup contact</p><h2 className="mt-1 font-black">Your rider</h2></div>
                <span className="grid size-10 place-items-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100 dark:bg-white/5 dark:ring-white/10"><UserRound className="size-5" /></span>
              </div>
            </div>
            <div className="p-5">
              {riderResult?.data ? <>
                <p className="text-lg font-black">{riderResult.data.name}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {status === "pickup_assigned" ? "Assigned to collect your return from you." : status === "picked_up" ? "Your item has been collected and is on its way to the shop." : "Your return has reached the shop."}
                </p>
                {riderResult.data.phone ? <a href={`tel:${riderResult.data.phone}`} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-600"><PhoneCall className="size-4" /> Call rider <span className="font-medium text-orange-100">{riderResult.data.phone}</span></a> : <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:bg-white/5">Rider phone number is not available.</p>}
                {riderAssignedEvent && <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-400"><CalendarDays className="size-3.5" /> Assigned {new Date(String(riderAssignedEvent.created_at)).toLocaleString()}</p>}
              </> : <p className="text-sm text-rose-600">{riderResult?.error ?? "Rider details are not available."}</p>}
            </div>
          </section>}
          {canShowCode && <section className="surface overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10"><ShieldCheck className="size-5 text-orange-500" /><h2 className="font-black">Pickup confirmation code</h2></div>
            <div className="p-5">
              {pickupCode?.data ? <><p className="text-xs leading-5 text-slate-500">Only share this with your assigned rider when you hand over the parcel.</p><p className="mt-4 rounded-2xl border border-dashed border-orange-300 bg-orange-50 py-4 text-center font-mono text-3xl font-black tracking-[.3em] text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">{pickupCode.data}</p><p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Keep this code private until pickup</p></> : <p className="text-sm text-rose-600">{pickupCode?.error ?? "Pickup code is not available yet."}</p>}
            </div>
          </section>}
          {status === "refunded" && <section className="surface p-5"><h2 className="font-black text-emerald-700 dark:text-emerald-400">Refund completed</h2><p className="mt-2 text-sm text-slate-500">{returnRow.refund_method ? `Sent via ${String(returnRow.refund_method).replaceAll("_", " ")}.` : "Your refund has been marked paid."}</p>{returnRow.refund_reference && <p className="mt-2 break-all text-xs text-slate-500">Reference: {String(returnRow.refund_reference)}</p>}</section>}
          <ReturnCustomerActions returnId={String(returnRow.id)} status={status} escalationDeadline={escalationDeadline} />
          <Link href={`/account/orders/${String(shopOrder.parent_order_id ?? returnRow.shop_order_id)}`} className="block text-center text-sm font-bold text-slate-500 hover:text-orange-600">View original order</Link>
        </aside>
      </div>
      <div className="mt-6">
        <ReturnTimeline events={events.map((event) => ({
          id: String(event.id),
          from_status: event.from_status ? String(event.from_status) : null,
          to_status: event.to_status ? String(event.to_status) : null,
          event_type: event.event_type ? String(event.event_type) : null,
          note: event.note ? String(event.note) : null,
          actor_role: event.actor_role ? String(event.actor_role) : null,
          created_at: String(event.created_at),
        }))} />
      </div>
    </main>
  );
}
