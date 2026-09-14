"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { requestReturnAction } from "@/app/actions/returns";

export function ReturnRequestForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(requestReturnAction, {});
  return <form action={action} className="surface mt-6 space-y-4 p-6"><div><h2 className="font-black">Request a return</h2><p className="mt-1 text-xs text-slate-500">Returns are reviewed before any refund is issued.</p></div><input type="hidden" name="order_id" value={orderId} /><textarea name="reason" required minLength={5} maxLength={2000} rows={3} className="field" placeholder="Tell us what went wrong" />{state.error && <p className="text-sm font-bold text-rose-600">{state.error}</p>}{state.success && <p className="text-sm font-bold text-emerald-600">{state.success}</p>}<button disabled={pending} className="button-secondary"><RotateCcw className="size-4" />{pending ? "Sending..." : "Request return"}</button></form>;
}
