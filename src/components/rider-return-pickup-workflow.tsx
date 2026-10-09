"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LoaderCircle, MapPin, PackageCheck, Phone, Truck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updateReturnPickup } from "@/lib/returns/actions";
import type { RiderReturnPickupDetails } from "@/lib/returns/types";
import { ReturnStatusBadge } from "@/components/return-status-badge";

type Stage = "accepted" | "picked_up" | "out_for_delivery" | "delivered" | "failed";

export function RiderReturnPickupWorkflow({
  assignmentId,
  assignmentStatus,
  attempts,
  details,
}: {
  assignmentId: string;
  assignmentStatus: string;
  attempts: number;
  details: RiderReturnPickupDetails;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, startTransition] = useTransition();
  const retryAvailable = assignmentStatus === "failed" && attempts < 2;

  async function uploadProof() {
    if (!proof) return null;
    const client = createClient();
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) throw new Error(authError?.message ?? "Please sign in again.");
    const extension = proof.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
    const path = `${authData.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("return-evidence").upload(path, proof, {
      contentType: proof.type,
      upsert: false,
    });
    if (error) throw new Error(`Could not upload proof photo: ${error.message}`);
    return path;
  }

  function update(status: Stage) {
    if (status === "picked_up" && code.length !== 6 && (note.trim().length < 5 || !proof)) {
      toast.error("Enter the customer's six-digit code, or add a note and proof photo.");
      return;
    }
    if (status === "failed" && (note.trim().length < 5 || !proof)) {
      toast.error("For a customer-unavailable attempt, add a note and photo.");
      return;
    }
    startTransition(async () => {
      let proofPath: string | null = null;
      try {
        proofPath = await uploadProof();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not upload proof.");
        return;
      }
      const result = await updateReturnPickup({
        assignmentId,
        status,
        confirmationCode: code || undefined,
        note: note.trim() || undefined,
        proofPath: proofPath ?? undefined,
      });
      if (result.error) {
        if (proofPath) {
          const { error } = await createClient().storage.from("return-evidence").remove([proofPath]);
          if (error) toast.error(`Pickup update failed and the proof photo could not be removed: ${error.message}`);
        }
        toast.error(result.error);
        return;
      }
      toast.success(status === "failed"
        ? attempts + 1 >= 2 ? "Second attempt recorded; admin has been notified." : "Attempt recorded. You may try the pickup once more."
        : status === "picked_up" ? "Return collected from the customer."
          : status === "delivered" ? "Shop handover recorded."
            : status === "accepted" ? "Return pickup accepted."
              : "Return pickup updated.");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-4xl">
      <Link href="/rider/assignments" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"><ArrowLeft className="size-4" /> Assignments</Link>
      <div className="mb-7 mt-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Return pickup</p><h1 className="mt-2 text-3xl font-black tracking-[-.05em]">Return #{assignmentId.slice(0, 8)}</h1><p className="mt-2 text-sm text-slate-500">Return delivery to {details.shop_name}</p></div>
        <ReturnStatusBadge status={assignmentStatus} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          <div className="surface p-5"><div className="flex items-center gap-3"><MapPin className="size-5 text-orange-500" /><h2 className="font-black">Customer pickup</h2></div><p className="mt-4 text-lg font-black">{details.customer_name}</p><p className="mt-2 text-sm leading-6 text-slate-500">{details.pickup_address || "Pickup address unavailable"}</p>{details.customer_phone && <a href={`tel:${details.customer_phone}`} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-orange-600"><Phone className="size-4" /> {details.customer_phone}</a>}</div>
          <div className="surface p-5"><div className="flex items-center gap-3"><PackageCheck className="size-5 text-orange-500" /><h2 className="font-black">Return items</h2></div><ul className="mt-4 space-y-2">{details.items.map((item, index) => <li key={`${item.title}-${index}`} className="flex justify-between gap-3 text-sm"><span>{item.title}</span><span className="text-slate-500">× {item.quantity}</span></li>)}</ul></div>
          <div className="surface p-5"><div className="flex items-center gap-3"><Truck className="size-5 text-orange-500" /><h2 className="font-black">Return to shop</h2></div><p className="mt-3 font-bold">{details.shop_name}</p><p className="mt-1 text-sm text-slate-500">{details.shop_address || "Shop address unavailable"}</p>{details.shop_phone && <a href={`tel:${details.shop_phone}`} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-orange-600"><Phone className="size-4" /> {details.shop_phone}</a>}</div>
        </section>
        <aside className="surface h-fit p-5">
          <h2 className="font-black">Pickup steps</h2>
          {assignmentStatus === "assigned" && <><p className="mt-2 text-sm text-slate-500">Accept this pickup to start the route.</p><button type="button" disabled={busy} onClick={() => update("accepted")} className="button-primary mt-4 w-full bg-orange-500 hover:bg-orange-600">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Accept pickup</button></>}
          {assignmentStatus === "accepted" && <>
            <p className="mt-2 text-sm text-slate-500">Ask the customer for their code. If unavailable, document the attempt with a note and photo.</p>
            <label className="mt-4 block text-sm font-bold">Customer pickup code<input className="field mt-2 w-full font-mono tracking-[.2em]" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
            <label className="mt-4 block text-sm font-bold">Attempt note<textarea className="field mt-2 min-h-20 w-full" maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required if customer code is unavailable." /></label>
            <label className="mt-4 block text-sm font-bold">Proof photo<input className="field mt-2 w-full p-2 text-xs" type="file" accept="image/*" onChange={(event) => setProof(event.target.files?.[0] ?? null)} /></label>
            <button type="button" disabled={busy} onClick={() => update("picked_up")} className="button-primary mt-4 w-full bg-orange-500 hover:bg-orange-600">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Confirm customer pickup</button>
            <button type="button" disabled={busy} onClick={() => update("failed")} className="button-secondary mt-3 w-full">Customer unavailable — log attempt</button>
          </>}
          {retryAvailable && <><p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Attempt {attempts} of 2 recorded. You can retry once.</p><button type="button" disabled={busy} onClick={() => update("accepted")} className="button-primary mt-4 w-full bg-orange-500 hover:bg-orange-600">{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}Retry pickup</button></>}
          {assignmentStatus === "picked_up" && <><p className="mt-2 text-sm text-slate-500">Parcel collected. Continue to the shop.</p><button type="button" disabled={busy} onClick={() => update("out_for_delivery")} className="button-primary mt-4 w-full bg-orange-500 hover:bg-orange-600">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Truck className="size-4" />} Start return delivery</button></>}
          {assignmentStatus === "out_for_delivery" && <>
            <p className="mt-2 text-sm text-slate-500">Hand the parcel to the shop. You may add a note or photo as proof; no code is needed.</p>
            <label className="mt-4 block text-sm font-bold">Handover note (optional)<textarea className="field mt-2 min-h-20 w-full" maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note about the handover." /></label>
            <label className="mt-4 block text-sm font-bold">Handover photo (optional)<input className="field mt-2 w-full p-2 text-xs" type="file" accept="image/*" onChange={(event) => setProof(event.target.files?.[0] ?? null)} /></label>
            <button type="button" disabled={busy} onClick={() => update("delivered")} className="button-primary mt-4 w-full bg-orange-500 hover:bg-orange-600">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Handed to shop</button>
          </>}
          {assignmentStatus === "failed" && !retryAvailable && <p className="mt-3 text-sm font-semibold text-amber-700 dark:text-amber-300">Two pickup attempts recorded. The return is back with admin for reassignment.</p>}
          {["delivered", "cancelled"].includes(assignmentStatus) && <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">This pickup assignment is complete.</p>}
        </aside>
      </div>
    </main>
  );
}
