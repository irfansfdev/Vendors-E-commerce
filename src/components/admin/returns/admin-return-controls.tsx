"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  assignReturnPickup,
  decideEscalatedReturn,
  markReturnRefunded,
  refundFailedInspectionAnyway,
} from "@/lib/returns/actions";
import { RETURN_REFUND_METHODS } from "@/lib/returns/config";

type Rider = { id: string; name: string; phone: string | null };

export function AdminReturnControls({
  returnId,
  status,
  overdue,
  riders,
  refundMethod,
}: {
  returnId: string;
  status: string;
  overdue: boolean;
  riders: Rider[];
  refundMethod: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [selectedRider, setSelectedRider] = useState("");
  const [method, setMethod] = useState(refundMethod in RETURN_REFUND_METHODS ? refundMethod as keyof typeof RETURN_REFUND_METHODS : "jazzcash");
  const [reference, setReference] = useState("");

  function decide(decision: "approve" | "reject") {
    if (reason.trim().length < 5) {
      toast.error("Enter a decision reason of at least five characters.");
      return;
    }
    startTransition(async () => {
      const result = await decideEscalatedReturn(returnId, decision, reason.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === "approve" ? "Return approved." : "Return rejected.");
      router.refresh();
    });
  }

  function refundAnyway() {
    if (reason.trim().length < 5) {
      toast.error("Explain why the refund is being approved despite the failed inspection.");
      return;
    }
    startTransition(async () => {
      const result = await refundFailedInspectionAnyway(returnId, reason.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Refund approved and added to the refunds-to-process queue.");
      router.refresh();
    });
  }

  function assign() {
    if (!selectedRider) {
      toast.error("Choose an approved rider.");
      return;
    }
    startTransition(async () => {
      const result = await assignReturnPickup(returnId, selectedRider);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Return pickup assigned.");
      router.refresh();
    });
  }

  function payRefund() {
    if (reference.trim().length < 3) {
      toast.error("Enter the refund transaction reference.");
      return;
    }
    startTransition(async () => {
      const result = await markReturnRefunded(returnId, method, reference.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Refund marked as paid.");
      router.refresh();
    });
  }

  const needsDecision = status === "escalated" || status === "inspection_failed" || (status === "requested" && overdue);
  const canAssign = status === "approved" || status === "pickup_assigned";
  return <div className="space-y-4">
    {needsDecision && <section className="surface p-5">
      <h2 className="flex items-center gap-2 font-black"><ShieldAlert className="size-4 text-orange-500" /> Admin decision</h2>
      <label className="mt-4 block text-sm font-bold">Decision reason<textarea className="field mt-2 min-h-20 w-full" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} /></label>
      <div className={`mt-3 grid gap-2 ${status === "inspection_failed" ? "" : "sm:grid-cols-2"}`}>
        {status !== "inspection_failed" && <button type="button" disabled={busy} onClick={() => decide("approve")} className="button-primary justify-center bg-emerald-600 hover:bg-emerald-700"><Check className="size-4" /> Approve</button>}
        <button type="button" disabled={busy} onClick={() => decide("reject")} className="button-secondary justify-center border-rose-200 text-rose-700">Reject finally</button>
      </div>
      {status === "inspection_failed" && <button type="button" disabled={busy} onClick={refundAnyway} className="button-primary mt-3 w-full justify-center bg-orange-500 hover:bg-orange-600"><RotateCcw className="size-4" /> Refund anyway</button>}
    </section>}
    {canAssign && <section className="surface p-5">
      <h2 className="font-black">Return pickup assignment</h2>
      {riders.length ? <>
        <label className="mt-3 block text-xs font-bold text-slate-500">Approved available rider
          <select className="field mt-2 w-full" value={selectedRider} onChange={(event) => setSelectedRider(event.target.value)}>
            <option value="">Choose rider</option>
            {riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}{rider.phone ? ` · ${rider.phone}` : ""}</option>)}
          </select>
        </label>
        <button type="button" disabled={busy || !selectedRider} onClick={assign} className="button-primary mt-3 w-full justify-center bg-orange-500 hover:bg-orange-600">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Assign or reassign rider</button>
      </> : <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">No approved, available rider has capacity.</p>}
    </section>}
    {status === "refund_pending" && <section className="surface p-5">
      <h2 className="font-black">Process customer refund</h2>
      <label className="mt-3 block text-xs font-bold text-slate-500">Refund method
        <select className="field mt-2 w-full" value={method} onChange={(event) => setMethod(event.target.value as keyof typeof RETURN_REFUND_METHODS)}>
          {Object.entries(RETURN_REFUND_METHODS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="mt-3 block text-xs font-bold text-slate-500">Payment reference
        <input className="field mt-2 w-full" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={200} required />
      </label>
      <button type="button" disabled={busy || reference.trim().length < 3} onClick={payRefund} className="button-primary mt-3 w-full justify-center bg-emerald-600 hover:bg-emerald-700">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Mark as refunded</button>
    </section>}
  </div>;
}
