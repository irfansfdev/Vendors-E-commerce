import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PackageCheck, ShieldCheck } from "lucide-react";
import {
  SellerReturnDecision,
  SellerReturnInspection,
  SellerReturnReceipt,
} from "@/components/seller-return-controls";
import { createClient } from "@/lib/supabase/server";
import { getSellerContext } from "@/lib/seller";
import { getShopReturnRiderDetails } from "@/lib/returns/actions";
import { ReturnStatusBadge } from "@/components/return-status-badge";
import { ReturnTimeline } from "@/components/return-timeline";
import { RETURN_REASONS } from "@/lib/returns/config";
import { getCurrentTimeMs } from "@/lib/returns/time";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Return details | Seller" };
export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;
type Row = Record<string, any>;

export default async function SellerReturnDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, shop } = await getSellerContext();
  const { data: request, error } = await supabase
    .from("return_requests")
    .select("id,shop_order_id,status,reason,reason_code,customer_note,requested_at,seller_response_due_at,seller_response_reason,inspection_note,inspection_failure_code,receipt_confirmed_at,escalation_reason,pickup_fee,refund_amount,delivery_assignment_id,return_items(id,quantity,purchase_unit_price,refund_amount,order_items(product_variants(products(title)))),return_events(id,from_status,to_status,event_type,note,actor_role,created_at),return_evidence(id,object_path,evidence_type,created_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) return <main className="mx-auto max-w-4xl px-4 py-10"><div className="surface p-6 text-sm text-rose-600">{error.message}</div></main>;
  if (!request) notFound();
  const row = request as Row;
  const status = String(row.status);
  const items = (row.return_items ?? []) as Row[];
  const events = [...((row.return_events ?? []) as Row[])].sort((a, b) =>
    new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime(),
  );
  const evidence = (row.return_evidence ?? []) as Row[];
  const signedEvidence: Row[] = await Promise.all(evidence.map(async (item) => {
    const { data, error: signedError } = await supabase.storage.from("return-evidence")
      .createSignedUrl(String(item.object_path), 3600);
    return { ...item, url: data?.signedUrl ?? null, error: signedError?.message ?? null };
  }));
  const reasonCode = String(row.reason_code ?? "");
  const reasonLabel = RETURN_REASONS[reasonCode as keyof typeof RETURN_REASONS] ?? String(row.reason ?? "Return");
  const overdue = status === "requested" && !!row.seller_response_due_at
    && new Date(String(row.seller_response_due_at)).getTime() <= getCurrentTimeMs();
  const riderResult = ["pickup_assigned", "picked_up", "returned_to_shop"].includes(status)
    ? await getShopReturnRiderDetails(id)
    : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/seller/returns" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Returns</Link>
      <div className="mb-7 mt-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Return review · {String(shop.name ?? "Your shop")}</p><h1 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">Return #{String(row.id).slice(0, 8)}</h1><p className="mt-2 text-sm text-slate-500">Order #{String(row.shop_order_id).slice(0, 8)} · {new Date(String(row.requested_at)).toLocaleString()}</p></div>
        <ReturnStatusBadge status={status} overdue={overdue} />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:gap-6">
        <div className="space-y-5">
          <section className="surface p-5 sm:p-6">
            <div className="flex items-center gap-3"><PackageCheck className="size-5 text-orange-500" /><h2 className="font-black">Requested items</h2></div>
            <div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
              {items.map((item) => {
                const orderItem = item.order_items;
                const variant = Array.isArray(orderItem) ? orderItem[0]?.product_variants : orderItem?.product_variants;
                const product = Array.isArray(variant) ? variant[0]?.products : variant?.products;
                return <div key={String(item.id)} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{String(product?.title ?? "Item")} × {Number(item.quantity ?? 0)} <span className="text-xs text-slate-400">({formatCurrency(Number(item.purchase_unit_price ?? 0))} each)</span></span><b>{formatCurrency(Number(item.refund_amount ?? 0))}</b></div>;
              })}
            </div>
            <p className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm dark:border-white/10"><span className="text-slate-500">Pickup fee</span><span>{formatCurrency(Number(row.pickup_fee ?? 0))}</span></p>
            <p className="mt-2 flex justify-between text-sm"><b>Estimated refund</b><b className="text-orange-600">{formatCurrency(Number(row.refund_amount ?? 0))}</b></p>
            <p className="mt-4 text-xs text-slate-500">Reason: <b className="text-slate-700 dark:text-slate-300">{reasonLabel}</b></p>
            {row.customer_note && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{String(row.customer_note)}</p>}
          </section>
          <section className="surface p-5 sm:p-6">
            <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-orange-500" /><h2 className="font-black">Customer photos and notes</h2></div>
            {signedEvidence.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{signedEvidence.map((item) => <div key={String(item.id)} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">{item.url ? <a href={String(item.url)} target="_blank" rel="noreferrer" className="font-bold text-orange-600 underline">{String(item.evidence_type ?? "Photo").replaceAll("_", " ")} · Open photo</a> : <p className="text-xs text-rose-600">{String(item.error ?? "Photo could not be loaded.")}</p>}<p className="mt-1 text-[11px] text-slate-400">{new Date(String(item.created_at)).toLocaleString()}</p></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No evidence photos attached.</p>}
            {row.seller_response_reason && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300"><b>Your response:</b> {String(row.seller_response_reason)}</p>}
            {row.inspection_note && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300"><b>Inspection:</b> {String(row.inspection_note)}</p>}
            {row.escalation_reason && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300"><b>Customer escalation:</b> {String(row.escalation_reason)}</p>}
          </section>
        </div>
        <aside className="space-y-5">
          {overdue && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"><p>Seller response is overdue.</p><p className="mt-2 text-xs font-normal">This request is now for administrator review. Do not approve or reject from the seller portal.</p><Link href="/admin/returns" className="mt-3 inline-block font-black underline">Admin return queue</Link></section>}
          {!overdue && <SellerReturnDecision returnId={id} status={status} overdue={overdue} />}
          {riderResult?.data && <section className="surface p-5"><h2 className="font-black">Assigned rider</h2><p className="mt-3 font-bold">{riderResult.data.name}</p>{riderResult.data.phone ? <a className="mt-1 inline-flex text-sm font-bold text-orange-600" href={`tel:${riderResult.data.phone}`}>{riderResult.data.phone}</a> : <p className="mt-1 text-sm text-slate-500">Phone number not available.</p>}</section>}
          {riderResult?.error && <section className="surface p-5 text-sm text-rose-600">{riderResult.error}</section>}
          {status === "returned_to_shop" && !row.receipt_confirmed_at && <SellerReturnReceipt returnId={id} />}
          {status === "returned_to_shop" && !!row.receipt_confirmed_at && <SellerReturnInspection returnId={id} />}
          {status === "inspection_failed" && row.inspection_failure_code === "not_received" && <section className="surface p-5 text-sm text-rose-700 dark:text-rose-300"><h2 className="font-black">Receipt is under review</h2><p className="mt-2">{String(row.inspection_note ?? "You reported that the parcel was not received.")}</p></section>}
          {["inspection_passed", "refund_pending"].includes(status) && <section className="surface p-5"><h2 className="font-black text-emerald-700 dark:text-emerald-400">Inspection passed</h2><p className="mt-2 text-sm text-slate-500">Refund is now awaiting admin processing.</p></section>}
          <Link href={`/seller/orders/${String(row.shop_order_id)}`} className="block text-center text-sm font-bold text-slate-500 hover:text-orange-600">Open shop order</Link>
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
