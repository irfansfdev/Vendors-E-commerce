"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createReturnRequest } from "@/lib/returns/actions";
import {
  RETURN_EVIDENCE_MAX_PHOTOS,
  RETURN_PICKUP_FEE_PKR,
  RETURN_REFUND_METHODS,
  RETURN_REASONS,
  returnReasonRequiresPhotos,
  type ReturnReasonCode,
  type ReturnRefundMethod,
} from "@/lib/returns/config";
import { formatReturnDate, getReturnDeadline, isReturnWindowOpen } from "@/lib/returns/eligibility";
import { formatCurrency } from "@/lib/utils";

type ReturnableItem = {
  id: string;
  title: string;
  quantity: number;
  returnedQty: number;
  reservedQty: number;
  price: number;
  returnable: boolean;
};

type Props = {
  shopOrderId: string;
  shopName: string;
  deliveredAt: string | null;
  returnWindowDays: number;
  orderStatus: string;
  items: ReturnableItem[];
};

const fieldClass =
  "field w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-900";

export function ReturnRequestForm({
  shopOrderId,
  shopName,
  deliveredAt,
  returnWindowDays,
  orderStatus,
  items,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReasonCode>("damaged_defective");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [refundMethod, setRefundMethod] = useState<ReturnRefundMethod>("jazzcash");
  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [busy, startTransition] = useTransition();

  const deadline = useMemo(
    () => getReturnDeadline(deliveredAt, returnWindowDays),
    [deliveredAt, returnWindowDays],
  );
  const eligibleItems = items.filter((item) =>
    item.returnable && item.quantity - item.returnedQty - item.reservedQty > 0,
  );
  const selectedItems = eligibleItems
    .filter((item) => (quantities[item.id] ?? 0) > 0)
    .map((item) => ({ ...item, selectedQty: quantities[item.id] }));
  const itemRefund = selectedItems.reduce(
    (sum, item) => sum + item.price * item.selectedQty,
    0,
  );
  const pickupFee = reason === "size_fit" || reason === "changed_mind"
    ? RETURN_PICKUP_FEE_PKR
    : 0;
  const estimatedRefund = Math.max(0, itemRefund - pickupFee);
  const canReturn = ["delivered", "completed"].includes(orderStatus.toLowerCase())
    && isReturnWindowOpen(deadline);
  const needsPhotos = returnReasonRequiresPhotos(reason);

  function moveNext() {
    if (step === 0 && selectedItems.length === 0) {
      toast.error("Select at least one item and quantity.");
      return;
    }
    if (step === 1 && needsPhotos && photos.length === 0) {
      toast.error("Add at least one photo for this reason.");
      return;
    }
    if (step === 2) {
      if (holderName.trim().length < 2 || accountNumber.trim().length < 5) {
        toast.error("Enter the refund account holder and account number.");
        return;
      }
      if (refundMethod === "bank_transfer" && !bankName.trim()) {
        toast.error("Enter the bank name.");
        return;
      }
    }
    setStep((current) => Math.min(3, current + 1));
  }

  function submitRequest() {
    startTransition(async () => {
      const client = createClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) {
        toast.error(authError?.message ?? "Please sign in to continue.");
        return;
      }

      const uploadedPaths: string[] = [];
      for (const file of photos) {
        const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const path = `${authData.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await client.storage.from("return-evidence").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          if (uploadedPaths.length) {
            const { error: cleanupError } = await client.storage.from("return-evidence").remove(uploadedPaths);
            if (cleanupError) toast.error(`Photo upload failed and temporary photos could not be removed: ${cleanupError.message}`);
          }
          toast.error(`Could not upload ${file.name}: ${error.message}`);
          return;
        }
        uploadedPaths.push(path);
      }

      const result = await createReturnRequest({
        shopOrderId,
        items: selectedItems.map((item) => ({ orderItemId: item.id, quantity: item.selectedQty })),
        reasonCode: reason,
        customerNote: note.trim(),
        evidencePaths: uploadedPaths,
        refundMethod,
        accountHolderName: holderName.trim(),
        accountNumber: accountNumber.trim(),
        bankName: bankName.trim(),
      });
      if (result.error || !result.data) {
        if (uploadedPaths.length) {
          const { error: cleanupError } = await client.storage.from("return-evidence").remove(uploadedPaths);
          if (cleanupError) toast.error(`Return request failed and temporary photos could not be removed: ${cleanupError.message}`);
        }
        toast.error(result.error ?? "Could not submit your return request.");
        return;
      }
      toast.success("Return request submitted.");
      router.push(`/account/returns/${result.data}`);
      router.refresh();
    });
  }

  if (!canReturn) {
    return (
      <section className="surface p-6">
        <h2 className="font-black">This order is not eligible for return</h2>
        <p className="mt-2 text-sm text-slate-500">
          Returns are available after delivery and within the shop&apos;s return window.
        </p>
      </section>
    );
  }

  if (eligibleItems.length === 0) {
    return (
      <section className="surface p-6">
        <h2 className="font-black">No returnable quantities remain</h2>
        <p className="mt-2 text-sm text-slate-500">All items are non-returnable or already returned/requested.</p>
      </section>
    );
  }

  const steps = ["Items", "Reason & photos", "Refund account", "Review"];

  return (
    <div className="space-y-5">
      <section className="surface p-5 sm:p-7">
        <p className="text-xs font-bold text-orange-600">{shopName}</p>
        <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Return request steps">
          {steps.map((label, index) => (
            <div key={label} className="min-w-0">
              <div className={`h-1.5 rounded-full ${index <= step ? "bg-orange-500" : "bg-slate-200 dark:bg-white/10"}`} />
              <p className={`mt-2 truncate text-[10px] font-bold sm:text-xs ${index === step ? "text-orange-600" : "text-slate-500"}`}>{label}</p>
            </div>
          ))}
        </div>
        <h1 className="mt-7 text-2xl font-black tracking-tight sm:text-3xl">
          {steps[step]}
        </h1>
        {deadline && <p className="mt-2 text-sm text-slate-500">Return by {formatReturnDate(deadline)}</p>}

        {step === 0 && (
          <div className="mt-5 divide-y divide-slate-100 dark:divide-white/10">
            {items.map((item) => {
              const remaining = item.quantity - item.returnedQty - item.reservedQty;
              const unavailable = !item.returnable || remaining <= 0;
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCurrency(item.price)} each · purchased {item.quantity}
                    </p>
                    {unavailable && <p className="mt-1 text-xs font-semibold text-slate-400">{item.returnable ? "No returnable quantity remaining" : "Not returnable"}</p>}
                  </div>
                  <label className="text-xs font-bold text-slate-500">
                    Quantity
                    <input
                      className={`${fieldClass} mt-1 w-24`}
                      type="number"
                      min={0}
                      max={Math.max(remaining, 0)}
                      value={quantities[item.id] ?? 0}
                      disabled={unavailable}
                      onChange={(event) => setQuantities((current) => ({
                        ...current,
                        [item.id]: Math.min(Math.max(Number(event.target.value) || 0, 0), Math.max(remaining, 0)),
                      }))}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-bold">
              Return reason
              <select className={`${fieldClass} mt-2`} value={reason} onChange={(event) => setReason(event.target.value as ReturnReasonCode)}>
                {Object.entries(RETURN_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold">
              Details <span className="font-normal text-slate-400">(optional)</span>
              <textarea className={`${fieldClass} mt-2 min-h-24`} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add any details that will help the shop review your request." />
            </label>
            <label className="block text-sm font-bold">
              Photos {needsPhotos ? "(required, 1–4)" : "(optional, up to 4)"}
              <span className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 hover:border-orange-400 dark:border-white/20">
                <ImagePlus className="size-5 text-orange-500" />
                Choose photos
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const chosen = Array.from(event.target.files ?? []);
                    if (chosen.some((file) => !file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)) {
                      toast.error("Choose image files no larger than 8 MB each.");
                      event.target.value = "";
                      return;
                    }
                    const next = [...photos, ...chosen];
                    if (next.length > RETURN_EVIDENCE_MAX_PHOTOS) {
                      toast.error("You can add up to four photos.");
                      event.target.value = "";
                      return;
                    }
                    setPhotos(next);
                    event.target.value = "";
                  }}
                />
              </span>
            </label>
            {photos.length > 0 && <ul className="space-y-2">{photos.map((photo, index) => <li key={`${photo.name}-${photo.lastModified}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5"><span className="truncate">{photo.name}</span><button type="button" className="text-slate-500 hover:text-rose-500" aria-label={`Remove ${photo.name}`} onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}><X className="size-4" /></button></li>)}</ul>}
          </div>
        )}

        {step === 2 && (
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-bold">
              Refund method
              <select className={`${fieldClass} mt-2`} value={refundMethod} onChange={(event) => setRefundMethod(event.target.value as ReturnRefundMethod)}>
                {Object.entries(RETURN_REFUND_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold">Account holder name<input className={`${fieldClass} mt-2`} autoComplete="name" value={holderName} onChange={(event) => setHolderName(event.target.value)} maxLength={120} required /></label>
            <label className="block text-sm font-bold">{refundMethod === "bank_transfer" ? "Account / IBAN number" : "Wallet account number"}<input className={`${fieldClass} mt-2`} autoComplete="off" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} maxLength={120} required /></label>
            {refundMethod === "bank_transfer" && <label className="block text-sm font-bold">Bank name<input className={`${fieldClass} mt-2`} value={bankName} onChange={(event) => setBankName(event.target.value)} maxLength={120} required /></label>}
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Your refund account details are private and are not shared with sellers or riders.</p>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
              <h2 className="font-black">Items requested</h2>
              {selectedItems.map((item) => <div key={item.id} className="mt-3 flex justify-between gap-3 text-sm"><span>{item.title} × {item.selectedQty}</span><span className="font-bold">{formatCurrency(item.price * item.selectedQty)}</span></div>)}
            </div>
            <div className="space-y-2 text-sm">
              <p className="flex justify-between"><span className="text-slate-500">Reason</span><b>{RETURN_REASONS[reason]}</b></p>
              <p className="flex justify-between"><span className="text-slate-500">Item refund</span><b>{formatCurrency(itemRefund)}</b></p>
              {pickupFee > 0 && <p className="flex justify-between"><span className="text-slate-500">Pickup fee</span><b>− {formatCurrency(pickupFee)}</b></p>}
              <p className="flex justify-between border-t border-slate-200 pt-3 text-base dark:border-white/10"><span className="font-black">Estimated refund</span><b className="font-black text-orange-600">{formatCurrency(estimatedRefund)}</b></p>
            </div>
            <p className="text-xs leading-5 text-slate-500">Shipping charges are not included. Refund is based on purchase-time item prices and is subject to review.</p>
            <p className="text-xs text-slate-500">Refund to {RETURN_REFUND_METHODS[refundMethod]} · {holderName} · ••••{accountNumber.slice(-4)}</p>
          </div>
        )}

        <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5 dark:border-white/10">
          <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || busy} className="button-secondary disabled:opacity-50">
            <ArrowLeft className="size-4" /> Back
          </button>
          {step < 3 ? (
            <button type="button" onClick={moveNext} className="button-primary bg-orange-500 hover:bg-orange-600">
              Continue <ArrowRight className="size-4" />
            </button>
          ) : (
            <button type="button" onClick={submitRequest} disabled={busy} className="button-primary bg-orange-500 hover:bg-orange-600 disabled:opacity-60">
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
              {busy ? "Submitting…" : "Submit return request"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
