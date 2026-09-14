"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronRight, CreditCard, LoaderCircle, LockKeyhole, MapPin, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

type Address = { id: string; label: string; line: string; city: string; isDefault: boolean };

export function CheckoutForm({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const { lines, subtotal, clearCart } = useCart();
  const [addressId, setAddressId] = useState(addresses.find((item) => item.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [payment, setPayment] = useState("card");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const shops = useMemo(() => new Set(lines.map((line) => line.product.shop.id)).size, [lines]);
  const shipping = subtotal >= 75 ? 0 : 8.9;

  async function synchronizeCart(userId: string) {
    const supabase = createClient();
    let cartResult = await supabase.from("carts").select("id").eq("customer_id", userId).maybeSingle();
    if (cartResult.error) cartResult = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
    let cartId = (cartResult.data as { id?: string } | null)?.id;
    if (!cartId) {
      let created = await supabase.from("carts").insert({ customer_id: userId }).select("id").single();
      if (created.error) created = await supabase.from("carts").insert({ user_id: userId }).select("id").single();
      cartId = (created.data as { id?: string } | null)?.id;
    }
    if (!cartId) throw new Error("We couldn’t prepare your secure cart. Please refresh and try again.");

    for (const line of lines) {
      if (!line.variant?.id) continue;
      let result = await supabase.from("cart_items").upsert({ cart_id: cartId, product_variant_id: line.variant.id, quantity: line.quantity }, { onConflict: "cart_id,product_variant_id" });
      if (result.error) result = await supabase.from("cart_items").upsert({ cart_id: cartId, variant_id: line.variant.id, quantity: line.quantity }, { onConflict: "cart_id,variant_id" });
      if (result.error) throw new Error(result.error.message);
    }
  }

  async function placeOrder() {
    if (!lines.length) { router.push("/cart"); return; }
    if (!addressId) { setError("Add or select a shipping address before placing your order."); return; }
    setPlacing(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) { router.push("/login?next=/checkout"); return; }
      await synchronizeCart(authData.user.id);
      const { data, error: orderError } = await supabase.rpc("create_multi_vendor_order", {
        p_customer_id: authData.user.id,
        p_shipping_address_id: addressId,
        p_payment_method: payment,
      });
      if (orderError) throw orderError;
      const response = Array.isArray(data) ? data[0] : data;
      const id = typeof response === "string" ? response : (response as { order_id?: string; id?: string } | null)?.order_id ?? (response as { id?: string } | null)?.id ?? "confirmed";
      setOrderId(id);
      clearCart();
      toast.success("Order placed successfully", { description: `Split into ${shops} seller shipment${shops === 1 ? "" : "s"}.` });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : typeof caught === "object" && caught !== null && "message" in caught ? String((caught as { message?: unknown }).message ?? "") : "";
      setError(message || "We couldn’t place your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  if (orderId) return <div className="surface mx-auto max-w-xl p-8 text-center shadow-xl sm:p-12"><span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><CheckCircle2 className="size-8" /></span><p className="mt-6 text-[11px] font-black uppercase tracking-[.18em] text-emerald-600">Order confirmed</p><h1 className="mt-2 text-3xl font-black tracking-[-.05em]">Thanks for shopping small.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Your parent order has been created and split into {shops} seller shipment{shops === 1 ? "" : "s"}. Each shop will provide its own tracking updates.</p><div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/5">Order reference: <b>{orderId}</b></div><button onClick={() => router.push(`/account/orders/${orderId}`)} className="button-primary mt-7">Track your order <ChevronRight className="size-4" /></button></div>;

  return <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]"><div className="space-y-5"><section className="surface p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10"><MapPin className="size-4" /></span><div><p className="text-xs text-slate-400">Step 1</p><h2 className="font-black">Shipping address</h2></div></div>{addresses.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{addresses.map((address) => <label key={address.id} className={`cursor-pointer rounded-xl border p-4 transition ${addressId === address.id ? "border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/10 dark:bg-orange-500/10" : "border-slate-200 dark:border-white/10"}`}><div className="flex items-start gap-2"><input type="radio" checked={addressId === address.id} onChange={() => setAddressId(address.id)} className="mt-1 accent-orange-500" /><div><p className="text-sm font-extrabold">{address.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{address.line}<br />{address.city}</p></div></div></label>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-white/15"><p className="text-sm font-bold">No shipping address yet</p><p className="mt-1 text-xs text-slate-500">Add one in your account to continue.</p><button onClick={() => router.push("/account/addresses?next=/checkout")} className="button-secondary mt-4">Add address</button></div>}</section><section className="surface p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10"><CreditCard className="size-4" /></span><div><p className="text-xs text-slate-400">Step 2</p><h2 className="font-black">Payment method</h2></div></div><div className="mt-5 space-y-3">{[{ id: "card", icon: CreditCard, title: "Credit or debit card", text: "Visa, Mastercard, Amex" }, { id: "cash_on_delivery", icon: PackageCheck, title: "Cash on delivery", text: "Pay when your order arrives" }].map(({ id, icon: Icon, title, text }) => <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${payment === id ? "border-orange-500" : "border-slate-200 dark:border-white/10"}`}><input type="radio" checked={payment === id} onChange={() => setPayment(id)} className="accent-orange-500" /><Icon className="size-5 text-slate-400" /><div><p className="text-sm font-extrabold">{title}</p><p className="text-xs text-slate-400">{text}</p></div></label>)}</div></section></div><aside className="surface sticky top-36 p-5 sm:p-6"><h2 className="font-black">Review your order</h2><p className="mt-1 text-xs text-slate-400">{lines.length} line items from {shops} shops</p><div className="mt-5 max-h-52 space-y-3 overflow-y-auto pr-1">{lines.map((line) => <div key={line.lineId} className="flex justify-between gap-3 text-xs"><span className="line-clamp-1 text-slate-500">{line.quantity} × {line.product.name}</span><b>{formatCurrency((line.variant?.price ?? line.product.price) * line.quantity)}</b></div>)}</div><div className="my-5 h-px bg-slate-200 dark:bg-white/10" /><div className="space-y-3 text-sm"><div className="flex justify-between text-slate-500"><span>Subtotal</span><b className="text-slate-950 dark:text-white">{formatCurrency(subtotal)}</b></div><div className="flex justify-between text-slate-500"><span>Shipping</span><b className="text-emerald-600">{shipping ? formatCurrency(shipping) : "Free"}</b></div><div className="flex justify-between pt-2 text-base"><b>Total</b><b className="text-xl">{formatCurrency(subtotal + shipping)}</b></div></div>{error && <div className="mt-5 flex gap-2 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}<button disabled={placing || !lines.length} onClick={placeOrder} className="button-primary mt-6 w-full bg-orange-500 hover:bg-orange-600">{placing ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}{placing ? "Placing order…" : "Place order"}</button><p className="mt-4 flex justify-center gap-1.5 text-[10px] text-slate-400"><Truck className="size-3.5" /> Each seller ships separately</p></aside></div>;
}
