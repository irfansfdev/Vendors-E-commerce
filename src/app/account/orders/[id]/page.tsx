import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, CircleCheck, Package, Truck } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getOrderStatus } from "@/lib/order-status";

export const metadata: Metadata = { title: "Track order" };
export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;
const steps = ["pending", "processing", "shipped", "delivered"];

export default async function CustomerOrderPage({ params }: { params: Params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/orders");
  const { id } = await params;
  const supabase = await createClient();
  const { data: parent } = await supabase.from("orders").select("*, shop_orders(*)").eq("customer_id", user.id).eq("id", id).maybeSingle();
  const child = (parent?.shop_orders ?? []).find((item: Record<string, unknown>) => String(item.id) === id);
  const order = child ?? (parent?.id === id ? parent : null);
  if (!order) return <main className="mx-auto max-w-[900px] px-4 py-10"><Link href="/account" className="text-sm font-bold text-orange-500">Back to account</Link><div className="surface mt-6 p-8 text-sm text-rose-600">Order not found.</div></main>;
  const row = order as Record<string, unknown>;
  const status = parent ? getOrderStatus(parent as Record<string, unknown>) : getOrderStatus(row);
  const activeStep = steps.indexOf(status);
  return <main className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 lg:px-8"><Link href="/account" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ChevronLeft className="size-4" /> My account</Link><div className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Order tracking</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Order #{String(row.id).slice(0, 8)}</h1><p className="mt-2 text-sm text-slate-500">{row.created_at ? new Date(String(row.created_at)).toLocaleString() : ""}</p></div><span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black uppercase text-orange-700">{status}</span></div><section className="surface p-6 sm:p-8"><div className="flex items-center gap-3"><Truck className="size-5 text-orange-500" /><div><h2 className="font-black">Delivery progress</h2><p className="mt-1 text-xs text-slate-500">Your shop updates will appear here.</p></div></div><div className="mt-8 grid gap-4 sm:grid-cols-4">{steps.map((step, index) => <div key={step} className={`rounded-xl border p-4 ${index <= activeStep ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300" : "border-slate-200 text-slate-400 dark:border-white/10"}`}><CircleCheck className={`size-5 ${index <= activeStep ? "" : "opacity-30"}`} /><p className="mt-3 text-xs font-black capitalize">{step}</p></div>)}</div></section><section className="mt-6 grid gap-6 sm:grid-cols-2"><div className="surface p-6"><div className="flex items-center gap-3"><Package className="size-5 text-orange-500" /><h2 className="font-black">Order summary</h2></div><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Total</dt><dd className="font-black">{formatCurrency(Number(row.total_amount ?? row.subtotal ?? row.total ?? 0))}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Payment</dt><dd className="font-bold capitalize">{String(row.payment_status ?? row.payment_method ?? "pending")}</dd></div></dl></div><div className="surface p-6"><h2 className="font-black">Shipping information</h2><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{String(row.shipping_address ?? row.address ?? "Your saved delivery address")}</p></div></section></main>;
}