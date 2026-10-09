import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, CreditCard, PackageCheck, ShieldAlert } from "lucide-react";
import { AdminReturnControls } from "@/components/admin-return-controls";
import { ReturnStatusBadge } from "@/components/return-status-badge";
import { ReturnTimeline } from "@/components/return-timeline";
import { getCurrentTimeMs } from "@/lib/returns/time";
import { RETURN_REASONS } from "@/lib/returns/config";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Return details | BabulShop Admin" };
export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;
type Row = Record<string, any>;
function relation(value: unknown): Row {
  return (Array.isArray(value) ? value[0] : value) as Row ?? {};
}
function displayText(row: Row, ...keys: string[]) {
  return String(keys.map((key) => row[key]).find((value) => value !== null && value !== undefined && value !== "") ?? "");
}

export default async function AdminReturnDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: request, error } = await supabase.from("return_requests")
    .select("*,shop_orders!inner(id,shop_id,parent_order_id,orders(*),shops(id,name)),return_items(id,quantity,purchase_unit_price,refund_amount,order_items(id,quantity,returned_qty,price_at_checkout,product_variants(products(title)))),return_evidence(id,object_path,evidence_type,content_type,created_at,uploaded_by),return_events(id,from_status,to_status,event_type,note,actor_role,created_at),return_refund_accounts(id,method,account_holder_name,account_number,bank_name,created_at)")
    .eq("id", id)
    .maybeSingle();
  if (error || !request) return <main className="mx-auto max-w-5xl p-4 py-8 sm:px-6"><Link href="/admin/returns" className="font-bold text-orange-600">Back to returns</Link><section className="surface mt-5 p-6 text-sm text-rose-600">{error?.message ?? "Return not found."}</section></main>;

  const row = request as Row;
  const shopOrder = relation(row.shop_orders);
  const shop = relation(shopOrder.shops);
  const parentOrder = relation(shopOrder.orders);
  const customerId = displayText(row, "customer_id");
  const [{ data: profile, error: profileError }, { data: addresses, error: addressError }, { data: riders, error: ridersError }, { data: activeAssignments, error: assignmentsError }] = await Promise.all([
    customerId ? supabase.from("profiles").select("full_name").eq("id", customerId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    parentOrder.shipping_address_id ? supabase.from("addresses").select("*").eq("id", String(parentOrder.shipping_address_id)).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("delivery_profiles").select("id,full_name,phone,max_active_deliveries").eq("status", "approved").eq("availability_status", "available").order("full_name"),
    supabase.from("delivery_assignments").select("rider_id").in("status", ["assigned", "accepted", "picked_up", "out_for_delivery"]),
  ]);
  const address = (addresses ?? {}) as Row;
  const profileRow = (profile ?? {}) as Row;
  const customerName = displayText(address, "full_name", "name") || displayText(profileRow, "full_name") || displayText(parentOrder, "customer_name", "full_name") || "Customer";
  const customerPhone = displayText(address, "phone") || displayText(parentOrder, "customer_phone", "phone");
  const addressText = [
    address.address_line1 ?? address.address_line_1 ?? address.line1 ?? parentOrder.address_line1,
    address.address_line2 ?? address.address_line_2 ?? address.line2,
    address.city ?? parentOrder.city,
    address.state ?? parentOrder.state,
    address.postal_code ?? address.zip_code,
  ].filter(Boolean).join(", ");
  const activeByRider = new Map<string, number>();
  for (const assignment of activeAssignments ?? []) {
    const riderId = String(assignment.rider_id);
    activeByRider.set(riderId, (activeByRider.get(riderId) ?? 0) + 1);
  }
  const availableRiders = (riders ?? []).map((rider) => {
    const id = String(rider.id);
    const active = activeByRider.get(id) ?? 0;
    return { id, name: String(rider.full_name ?? "Rider"), phone: rider.phone ? String(rider.phone) : null, active, capacity: Number(rider.max_active_deliveries ?? 2) };
  }).filter((rider) => rider.active < rider.capacity);
  const evidence = (row.return_evidence ?? []) as Row[];
  const signedEvidence: Row[] = await Promise.all(evidence.map(async (item): Promise<Row> => {
    const { data, error: signedError } = await supabase.storage.from("return-evidence").createSignedUrl(String(item.object_path), 3600);
    return { ...item, url: data?.signedUrl ?? null, error: signedError?.message ?? null };
  }));
  const events = [...((row.return_events ?? []) as Row[])].sort((a, b) => new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime());
  const account = relation(row.return_refund_accounts);
  const reasonCode = String(row.reason_code ?? "");
  const reasonLabel = RETURN_REASONS[reasonCode as keyof typeof RETURN_REASONS] ?? String(row.reason ?? "Return");
  const status = String(row.status);
  const now = getCurrentTimeMs();
  const overdue = status === "requested" && !!row.seller_response_due_at && new Date(String(row.seller_response_due_at)).getTime() <= now;
  const items = (row.return_items ?? []) as Row[];

  return <main className="mx-auto max-w-[1440px] p-4 py-8 sm:px-6 lg:p-8">
    <Link href="/admin/returns" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> All returns</Link>
    <header className="mb-6 mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">{String(shop.name ?? "Shop")} · Order #{String(row.shop_order_id).slice(0, 8)}</p><h1 className="mt-2 text-3xl font-black tracking-[-.05em]">Return #{String(row.id).slice(0, 8)}</h1><p className="mt-2 text-sm text-slate-500">Requested {row.requested_at ? new Date(String(row.requested_at)).toLocaleString() : "-"}</p></div><ReturnStatusBadge status={status} overdue={overdue} /></header>
    {(profileError || addressError || ridersError || assignmentsError) && <p className="surface mb-5 p-4 text-sm text-amber-700 dark:text-amber-300">Some return details could not be loaded: {[profileError?.message, addressError?.message, ridersError?.message, assignmentsError?.message].filter(Boolean).join(" · ")}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] xl:gap-6">
      <div className="space-y-5">
        <section className="surface p-5 sm:p-6"><div className="flex items-center gap-3"><PackageCheck className="size-5 text-orange-500" /><h2 className="font-black">Return request</h2></div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Customer</span><br /><b>{customerName}</b>{customerPhone && <span className="block text-slate-500">{customerPhone}</span>}</p><p><span className="text-slate-500">Pickup address</span><br /><b>{addressText || "Not available"}</b></p><p><span className="text-slate-500">Reason</span><br /><b>{reasonLabel}</b></p><p><span className="text-slate-500">Seller deadline</span><br /><b>{row.seller_response_due_at ? new Date(String(row.seller_response_due_at)).toLocaleString() : "Not set"}</b></p></div>
          {row.customer_note && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 dark:bg-white/5">{String(row.customer_note)}</p>}
          {row.seller_response_reason && <p className="mt-3 text-sm"><b>Seller response:</b> {String(row.seller_response_reason)}</p>}
          {row.escalation_reason && <p className="mt-3 text-sm"><b>Customer escalation:</b> {String(row.escalation_reason)}</p>}
          {row.inspection_note && <p className="mt-3 text-sm"><b>Inspection:</b> {String(row.inspection_note)}</p>}
        </section>
        <section className="surface p-5 sm:p-6"><h2 className="font-black">Items and refund calculation</h2><div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
          {items.map((item) => { const orderItem = relation(item.order_items); const variant = relation(orderItem.product_variants); const product = relation(variant.products); return <div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-bold">{String(product.title ?? "Item")} × {Number(item.quantity ?? 0)}</p><p className="mt-1 text-xs text-slate-500">{formatCurrency(Number(item.purchase_unit_price ?? 0))} per item · Previously returned {Number(orderItem.returned_qty ?? 0)} / {Number(orderItem.quantity ?? 0)}</p></div><b>{formatCurrency(Number(item.refund_amount ?? 0))}</b></div>; })}
        </div><p className="flex justify-between border-t border-slate-100 pt-3 text-sm dark:border-white/10"><span className="text-slate-500">Pickup fee deduction</span><span>{formatCurrency(Number(row.pickup_fee ?? 0))}</span></p><p className="mt-2 flex justify-between text-base"><b>Refund payable</b><b className="text-orange-600">{formatCurrency(Number(row.refund_amount ?? 0))}</b></p></section>
        <section className="surface p-5 sm:p-6"><h2 className="font-black">Evidence and inspection photos</h2>{signedEvidence.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{signedEvidence.map((item) => <article key={String(item.id)} className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-black capitalize text-slate-500">{String(item.evidence_type ?? "photo").replaceAll("_", " ")} · {String(item.content_type ?? "image")}</p>{item.url ? <a className="mt-2 inline-flex font-bold text-orange-600 underline" href={String(item.url)} target="_blank" rel="noreferrer">Open private evidence photo</a> : <p className="mt-2 text-xs text-rose-600">{String(item.error ?? "Could not generate photo link.")}</p>}<p className="mt-1 text-[10px] text-slate-400">{new Date(String(item.created_at)).toLocaleString()}</p></article>)}</div> : <p className="mt-3 text-sm text-slate-500">No evidence uploaded.</p>}</section>
      </div>
      <aside className="space-y-4">
        <section className="surface p-5"><div className="flex items-center gap-2"><CreditCard className="size-4 text-orange-500" /><h2 className="font-black">Restricted refund account</h2></div>{account.id ? <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-slate-500">Method</dt><dd className="font-bold capitalize">{String(account.method).replaceAll("_", " ")}</dd></div><div><dt className="text-xs text-slate-500">Account holder</dt><dd className="font-bold">{String(account.account_holder_name)}</dd></div><div><dt className="text-xs text-slate-500">Account / wallet number</dt><dd className="break-all font-mono font-bold">{String(account.account_number)}</dd></div>{account.bank_name && <div><dt className="text-xs text-slate-500">Bank</dt><dd className="font-bold">{String(account.bank_name)}</dd></div>}</dl> : <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">No refund account was stored for this legacy request.</p>}<p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate-500"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> Sensitive payment destination. Admin-only access; never share with sellers or riders.</p></section>
        {row.refunded_at && <section className="surface p-5"><h2 className="font-black">Refund completion</h2><p className="mt-3 text-sm">Paid on {new Date(String(row.refunded_at)).toLocaleString()}</p><p className="mt-2 text-sm capitalize">Method: <b>{String(row.refund_method ?? "").replaceAll("_", " ")}</b></p><p className="mt-2 break-all text-sm">Reference: <b>{String(row.refund_reference ?? "-")}</b></p></section>}
        <AdminReturnControls returnId={id} status={status} overdue={overdue} riders={availableRiders} refundMethod={String(account.method ?? "")} />
      </aside>
    </div>
    <div className="mt-6">
      <ReturnTimeline title="Complete audit timeline" emptyMessage="No audit events are recorded." events={events.map((event) => ({
        id: String(event.id),
        from_status: event.from_status ? String(event.from_status) : null,
        to_status: event.to_status ? String(event.to_status) : null,
        event_type: event.event_type ? String(event.event_type) : null,
        note: event.note ? String(event.note) : null,
        actor_role: event.actor_role ? String(event.actor_role) : null,
        created_at: String(event.created_at),
      }))} />
    </div>
  </main>;
}
