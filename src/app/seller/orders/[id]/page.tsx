import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, PackageCheck, UserRound } from "lucide-react";
import { updateSellerOrderStatus } from "@/app/seller/orders/actions";
import { getSellerContext } from "@/lib/seller";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details | Seller" };
export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;
type Row = Record<string, any>;
const statuses = ["pending", "processing", "shipped", "delivered", "completed", "cancelled"];

export default async function SellerOrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, shop } = await getSellerContext();
  const { data: order, error } = await supabase.from("shop_orders").select("*").eq("id", id).eq("shop_id", String(shop.id)).maybeSingle();
  if (error || !order) return <main className="mx-auto max-w-[1000px] px-4 py-10"><Link href="/seller/orders" className="text-sm font-bold text-orange-500">Back to orders</Link><div className="surface mt-6 p-8 text-sm text-rose-600">{error?.message ?? "Order not found."}</div></main>;
  const row = order as Row;
  const currentStatus = String(row.order_status ?? "pending").toLowerCase();
  const { data: parent } = row.parent_order_id ? await supabase.from("orders").select("*").eq("id", row.parent_order_id).maybeSingle() : { data: null };
  const parentRow = (parent ?? {}) as Row;
  const [{ data: address }, { data: profile }, { data: items }] = await Promise.all([
    parentRow.shipping_address_id ? supabase.from("addresses").select("*").eq("id", parentRow.shipping_address_id).maybeSingle() : Promise.resolve({ data: null }),
    parentRow.customer_id ? supabase.from("profiles").select("*").eq("id", parentRow.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("order_items").select("quantity, variant_id, product_variants(id, product_id, price, products(title, price))").eq("shop_order_id", id),
  ]);
  const addressRow = (address ?? {}) as Row;
  const profileRow = (profile ?? {}) as Row;
  const lineItems = (items ?? []) as Row[];
  const itemTotal = lineItems.reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.product_variants?.price ?? item.product_variants?.products?.price ?? 0), 0);
  const total = itemTotal || Number(row.total_amount ?? row.subtotal ?? 0);
  const paymentStatus = String(parentRow.payment_status ?? "pending").toLowerCase();
  const customerName = String(addressRow.full_name ?? profileRow.full_name ?? profileRow.name ?? profileRow.display_name ?? parentRow.customer_name ?? parentRow.full_name ?? "Customer");
  const customerPhone = String(addressRow.phone ?? profileRow.phone ?? parentRow.phone ?? parentRow.customer_phone ?? "");
  const addressText = [
    addressRow.address_line1 ?? addressRow.address_line_1 ?? addressRow.line1 ?? parentRow.address_line1 ?? parentRow.shipping_address,
    addressRow.address_line2 ?? addressRow.address_line_2 ?? addressRow.line2 ?? parentRow.address_line2,
    addressRow.city ?? parentRow.city,
    addressRow.state ?? parentRow.state,
    addressRow.postal_code ?? addressRow.zip_code ?? parentRow.postal_code,
    addressRow.country ?? parentRow.country,
  ].filter(Boolean).join(", ");
  const addressDisplay = addressText || "No shipping address available.";
  const customerId = parentRow.customer_id ?? parentRow.user_id ?? profileRow.id ?? "-";
  return <main className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/seller/orders" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> Orders</Link>
    <div className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Fulfillment detail</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Order #{String(row.id).slice(0, 8)}</h1><p className="mt-2 text-sm text-slate-500">{row.created_at ? new Date(String(row.created_at)).toLocaleString() : ""}</p></div><span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black uppercase text-orange-700">{currentStatus}</span></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><section className="space-y-6"><div className="surface p-6"><div className="flex items-center gap-3"><PackageCheck className="size-5 text-orange-500" /><h2 className="font-black">Order summary</h2></div><div className="mt-5 space-y-3">{lineItems.length ? lineItems.map((item, index) => <div key={`${item.variant_id}-${index}`} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0 dark:border-white/10"><span>{String(item.product_variants?.products?.title ?? "Product")} <b className="text-slate-400">x{String(item.quantity ?? 1)}</b></span><b>{formatCurrency(Number(item.quantity ?? 0) * Number(item.product_variants?.price ?? item.product_variants?.products?.price ?? 0), String(parentRow.currency ?? "PKR"))}</b></div>) : <p className="text-sm text-slate-500">No line items found.</p>}<div className="flex justify-between border-t border-slate-200 pt-4 text-sm dark:border-white/10"><span className="font-bold">Total</span><b className="text-lg">{formatCurrency(total, String(parentRow.currency ?? "PKR"))}</b></div></div><dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 dark:border-white/10"><div><dt className="text-xs text-slate-400">Payment</dt><dd className="mt-1 font-bold capitalize">{paymentStatus === "paid" || currentStatus === "delivered" || currentStatus === "completed" ? "Paid" : paymentStatus}</dd></div><div><dt className="text-xs text-slate-400">Customer</dt><dd className="mt-1 font-bold">{customerName}</dd></div></dl></div>
    <div className="surface p-6"><div className="flex items-center gap-3"><UserRound className="size-5 text-orange-500" /><h2 className="font-black">Customer information</h2></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-400">Name</dt><dd className="mt-1 font-bold">{customerName}</dd></div><div><dt className="text-xs text-slate-400">Phone</dt><dd className="mt-1 font-bold">{customerPhone || "No phone provided"}</dd></div><div><dt className="text-xs text-slate-400">Customer ID</dt><dd className="mt-1 break-all font-bold">{String(customerId)}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-slate-400">Delivery address</dt><dd className="mt-1 font-bold leading-6">{addressDisplay}</dd></div></dl></div></section>
    <aside className="surface h-fit p-6"><h2 className="font-black">Update status</h2><p className="mt-1 text-xs leading-5 text-slate-500">The customer will see this status in tracking.</p><form action={updateSellerOrderStatus} className="mt-5 space-y-4"><input type="hidden" name="orderId" value={id} /><select name="status" defaultValue={currentStatus} className="field">{statuses.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select><button className="button-primary w-full bg-orange-500 hover:bg-orange-600">Save status</button></form></aside></div>
  </main>;
}
