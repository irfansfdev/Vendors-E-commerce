import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, MapPin, Phone, Truck } from "lucide-react";
import { rejectDeliveryAction, updateDeliveryAction } from "@/app/rider/actions";
import { getRiderContext } from "@/lib/rider";

export const metadata: Metadata = { title: "Delivery detail | Rider" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;

export default async function RiderAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, rider } = await getRiderContext();
  const { data: assignment } = await supabase.from("delivery_assignments").select("*").eq("id", id).eq("rider_id", String(rider.id)).maybeSingle();
  if (!assignment) return <main><Link href="/rider/assignments" className="text-sm font-bold text-orange-500">Back to deliveries</Link><p className="surface mt-5 p-8 text-sm text-rose-600">Assignment not found.</p></main>;
  const { data: order } = await supabase.from("shop_orders").select("*").eq("id", String(assignment.shop_order_id)).maybeSingle();
  const parentId = String(order?.parent_order_id ?? "");
  const [{ data: parent }, { data: address }, { data: profile }, { data: items }, { data: shop }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", parentId).maybeSingle(),
    parentId ? supabase.from("orders").select("shipping_address_id").eq("id", parentId).maybeSingle().then(async ({ data }) => data?.shipping_address_id ? supabase.from("addresses").select("*").eq("id", data.shipping_address_id).maybeSingle() : { data: null }) : Promise.resolve({ data: null }),
    parentId ? supabase.from("orders").select("customer_id").eq("id", parentId).maybeSingle().then(async ({ data }) => data?.customer_id ? supabase.from("profiles").select("*").eq("id", data.customer_id).maybeSingle() : { data: null }) : Promise.resolve({ data: null }),
    supabase.from("order_items").select("quantity, product_variants(products(title))").eq("shop_order_id", String(assignment.shop_order_id)),
    order?.shop_id ? supabase.from("shops").select("name,address,phone").eq("id", String(order.shop_id)).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const addressRow = (address ?? {}) as Row;
  const profileRow = (profile ?? {}) as Row;
  const customerName = String(addressRow.full_name ?? profileRow.full_name ?? profileRow.name ?? "Customer");
  const phone = String(addressRow.phone ?? profileRow.phone ?? "");
  const addressText = [addressRow.address_line1 ?? addressRow.address_line_1 ?? addressRow.line1, addressRow.address_line2 ?? addressRow.address_line_2 ?? addressRow.line2, addressRow.city, addressRow.state, addressRow.postal_code ?? addressRow.zip_code].filter(Boolean).join(", ");
  const status = String(assignment.status);
  const next = status === "assigned" ? "accepted" : status === "accepted" ? "picked_up" : status === "picked_up" ? "out_for_delivery" : status === "out_for_delivery" ? "delivered" : "";
  const itemRows = (items ?? []) as Row[];
  return <main>
    <Link href="/rider/assignments" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Deliveries</Link>
    <div className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Delivery detail</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Shop Order #{String(assignment.shop_order_id).slice(0, 8)}</h1><p className="mt-2 text-sm text-slate-500">{String(shop?.name ?? "Shop")} · Parent order #{parentId.slice(0, 8)}</p></div><span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black uppercase text-orange-700">{status.replaceAll("_", " ")}</span></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <div className="surface p-6"><div className="flex items-center gap-3"><MapPin className="size-5 text-orange-500" /><h2 className="font-black">Customer delivery</h2></div><p className="mt-5 text-lg font-black">{customerName}</p><p className="mt-2 text-sm leading-6 text-slate-500">{addressText || "No address available"}</p>{phone && <a href={`tel:${phone}`} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-orange-600"><Phone className="size-4" /> {phone}</a>}</div>
        <div className="surface p-6"><div className="flex items-center gap-3"><Truck className="size-5 text-orange-500" /><h2 className="font-black">Pickup and payment</h2></div><p className="mt-4 text-sm text-slate-500">Pickup from <b>{String(shop?.name ?? "the shop")}</b>{shop?.address ? `, ${String(shop.address)}` : ""}.</p><p className="mt-3 text-sm text-slate-500">{String(order?.payment_method ?? "cash_on_delivery") === "cash_on_delivery" ? `Collect Rs. ${Number(assignment.cod_expected_amount ?? 0).toLocaleString()} from the customer.` : "Online payment. No cash collection required."}</p>{itemRows.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10">{itemRows.map((item, index) => <p key={index} className="text-sm">{String(item.product_variants?.products?.title ?? "Product")} <span className="text-slate-400">x{String(item.quantity ?? 1)}</span></p>)}</div>}</div>
      </section>
      <aside className="surface h-fit p-6"><h2 className="font-black">Next action</h2>{next ? <form action={updateDeliveryAction} className="mt-5 grid gap-4"><input type="hidden" name="assignmentId" value={id} /><input type="hidden" name="status" value={next} />{next === "delivered" && String(order?.payment_method ?? "cash_on_delivery") === "cash_on_delivery" && <label className="text-sm font-bold">Amount collected<input name="collectedAmount" type="number" min={Number(assignment.cod_expected_amount ?? 0)} defaultValue={Number(assignment.cod_expected_amount ?? 0)} className="field mt-2" required /></label>}{next !== "delivered" && <input type="hidden" name="collectedAmount" value="0" />}<button className="button-primary w-full bg-orange-500 hover:bg-orange-600">{next === "accepted" ? "Accept delivery" : next === "picked_up" ? "Mark as picked up" : next === "out_for_delivery" ? "Start delivery" : "Mark as delivered"}</button></form> : <p className="mt-3 text-sm text-slate-500">This delivery has no further rider action.</p>}{status === "assigned" && <form action={rejectDeliveryAction} className="mt-7 border-t border-slate-100 pt-6 dark:border-white/10"><h3 className="font-black">Reject assignment</h3><select name="rejectionReason" className="field mt-3" required defaultValue=""><option value="" disabled>Choose a reason</option><option>Too far</option><option>Vehicle issue</option><option>Already handling another delivery</option><option>Unable to deliver</option><option>Other</option></select><input type="hidden" name="assignmentId" value={id} /><button className="button-secondary mt-3 w-full">Reject and return to queue</button></form>}{["accepted", "picked_up", "out_for_delivery"].includes(status) && <form action={updateDeliveryAction} className="mt-7 border-t border-slate-100 pt-6 dark:border-white/10"><h3 className="font-black">Delivery issue</h3><select name="issueType" className="field mt-3" required defaultValue=""><option value="" disabled>Choose an issue</option><option>Customer unavailable</option><option>Customer refused</option><option>Wrong / incomplete address</option><option>Unable to contact customer</option><option>Damaged package</option><option>Other</option></select><textarea name="failureReason" className="field mt-3 min-h-24" placeholder="Add a note about the attempt" required /><input type="hidden" name="assignmentId" value={id} /><input type="hidden" name="status" value="failed" /><input type="hidden" name="collectedAmount" value="0" /><button className="button-secondary mt-3 w-full">Report delivery issue</button></form>}</aside>
    </div>
  </main>;
}
