"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { cancelReturn, escalateReturn } from "@/lib/returns/actions";

export function ReturnCustomerActions({
  returnId,
  status,
  escalationDeadline,
}: {
  returnId: string;
  status: string;
  escalationDeadline: string | null;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, startTransition] = useTransition();
  const mayCancel = ["requested", "approved", "pickup_assigned"].includes(status);
  const mayEscalate = ["rejected", "inspection_failed"].includes(status)
    && escalationDeadline !== null
    && new Date().getTime() <= new Date(escalationDeadline).getTime();

  function cancel() {
    if (!window.confirm("Cancel this return request?")) return;
    startTransition(async () => {
      const result = await cancelReturn(returnId, "Cancelled by customer");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Return request cancelled.");
      router.refresh();
    });
  }

  function escalate() {
    if (reason.trim().length < 5) {
      toast.error("Explain why you are escalating (at least 5 characters).");
      return;
    }
    startTransition(async () => {
      const result = await escalateReturn(returnId, reason.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Return escalated to BabulShop support.");
      router.refresh();
    });
  }

  if (!mayCancel && !mayEscalate) return null;

  return (
    <section className="surface p-5">
      <h2 className="font-black">Need to take action?</h2>
      {mayCancel && (
        <div className="mt-4">
          <p className="text-sm text-slate-500">You can cancel this request before the rider picks up your item.</p>
          <button type="button" disabled={busy} onClick={cancel} className="button-secondary mt-3 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10">
            {busy && <LoaderCircle className="size-4 animate-spin" />} Cancel return
          </button>
        </div>
      )}
      {mayEscalate && (
        <div className="mt-4">
          <label className="block text-sm font-bold">
            Tell us why you disagree
            <textarea className="field mt-2 min-h-24 w-full" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the issue for our support team." />
          </label>
          <p className="mt-2 text-xs text-slate-500">Escalate by {new Date(escalationDeadline!).toLocaleString()}.</p>
          <button type="button" disabled={busy} onClick={escalate} className="button-primary mt-3 bg-orange-500 hover:bg-orange-600">
            {busy && <LoaderCircle className="size-4 animate-spin" />} Escalate to support
          </button>
        </div>
      )}
    </section>
  );
}
