"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { respondToReturn, inspectReturn, confirmReturnReceipt, reportReturnNotReceived } from "@/lib/returns/actions";
import { createClient } from "@/lib/supabase/client";

export function SellerReturnDecision({
  returnId,
  status,
  overdue,
}: {
  returnId: string;
  status: string;
  overdue: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, startTransition] = useTransition();
  if (status !== "requested" || overdue) return null;

  function respond(decision: "approve" | "reject") {
    if (decision === "reject" && reason.trim().length < 5) {
      toast.error("Add a reason of at least five characters to reject this return.");
      return;
    }
    startTransition(async () => {
      const result = await respondToReturn(returnId, decision, reason.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === "approve" ? "Return approved; pickup details are ready." : "Return rejected.");
      router.refresh();
    });
  }

  return (
    <section className="surface p-5">
      <h2 className="font-black">Respond to return</h2>
      <label className="mt-4 block text-sm font-bold">
        Response note {status === "requested" && <span className="font-normal text-slate-400">(required to reject)</span>}
        <textarea className="field mt-2 min-h-24 w-full" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain your decision to the customer." />
      </label>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={busy} onClick={() => respond("approve")} className="button-primary bg-emerald-600 hover:bg-emerald-700">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
        </button>
        <button type="button" disabled={busy} onClick={() => respond("reject")} className="button-secondary border-rose-200 text-rose-700 dark:border-rose-500/30 dark:text-rose-300">
          Reject
        </button>
      </div>
      {overdue && <p className="mt-3 text-sm font-semibold text-amber-700 dark:text-amber-300">The response deadline has passed. An administrator must decide this request.</p>}
    </section>
  );
}

export function SellerReturnReceipt({
  returnId,
}: {
  returnId: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [busy, startTransition] = useTransition();

  function submit(received: boolean) {
    if (!received && reason.trim().length < 5) {
      toast.error("Explain why the return was not received.");
      return;
    }
    startTransition(async () => {
      const result = received
        ? await confirmReturnReceipt(returnId)
        : await reportReturnNotReceived(returnId, reason.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(received ? "Receipt confirmed. You can inspect the item now." : "The issue was sent to BabulShop for review.");
      router.refresh();
    });
  }

  return (
    <section className="surface p-5">
      <h2 className="font-black">Did the return arrive?</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Confirm receipt to inspect the item, or report that the parcel did not arrive.</p>
      {reporting && <label className="mt-4 block text-sm font-bold">Reason it was not received<textarea className="field mt-2 min-h-20 w-full" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => submit(true)} disabled={busy} className="button-primary bg-emerald-600 hover:bg-emerald-700">
          {busy && <LoaderCircle className="size-4 animate-spin" />} Mark as received
        </button>
        <button type="button" onClick={() => reporting ? submit(false) : setReporting(true)} disabled={busy} className="button-secondary border-rose-200 text-rose-700 dark:border-rose-500/30 dark:text-rose-300">
          {reporting ? "Not received — send report" : "Not received"}
        </button>
      </div>
    </section>
  );
}

export function SellerReturnInspection({
  returnId,
}: {
  returnId: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, startTransition] = useTransition();

  async function submit(passed: boolean) {
    if (note.trim().length < 3 || photos.length === 0) {
      toast.error("Add an inspection note and at least one photo.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        toast.error(authError?.message ?? "Please sign in again.");
        return;
      }
      const uploaded: string[] = [];
      for (const photo of photos) {
        const ext = photo.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const path = `${authData.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("return-evidence").upload(path, photo, {
          contentType: photo.type,
          upsert: false,
        });
        if (error) {
          if (uploaded.length) {
            const { error: cleanupError } = await supabase.storage.from("return-evidence").remove(uploaded);
            if (cleanupError) toast.error(`Inspection upload failed and temporary photos could not be removed: ${cleanupError.message}`);
          }
          toast.error(`Could not upload ${photo.name}: ${error.message}`);
          return;
        }
        uploaded.push(path);
      }
      const result = await inspectReturn(returnId, passed, note.trim(), uploaded);
      if (result.error) {
        if (uploaded.length) {
          const { error } = await supabase.storage.from("return-evidence").remove(uploaded);
          if (error) toast.error(`Inspection failed and temporary photos could not be removed: ${error.message}`);
        }
        toast.error(result.error);
        return;
      }
      toast.success(passed ? "Inspection passed; refund is pending." : "Inspection failed and the customer was notified.");
      router.refresh();
    });
  }

  return (
    <section className="surface p-5">
      <h2 className="font-black">Inspect returned items</h2>
      <label className="mt-4 block text-sm font-bold">Inspection note<textarea className="field mt-2 min-h-24 w-full" maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe the item's condition and inspection." /></label>
      <label className="mt-4 block text-sm font-bold">Inspection photos (1–4)
        <span className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 hover:border-orange-400 dark:border-white/20"><ImagePlus className="size-5 text-orange-500" /> Add photos
          <input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => {
            const chosen = Array.from(event.target.files ?? []);
            if (chosen.some((file) => !file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)) {
              toast.error("Choose images no larger than 8 MB each.");
              event.target.value = "";
              return;
            }
            if (photos.length + chosen.length > 4) {
              toast.error("Add up to four photos.");
              event.target.value = "";
              return;
            }
            setPhotos((current) => [...current, ...chosen]);
            event.target.value = "";
          }} />
        </span>
      </label>
      {!!photos.length && <ul className="mt-3 space-y-2">{photos.map((photo, index) => <li key={`${photo.name}-${photo.lastModified}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5"><span className="truncate">{photo.name}</span><button type="button" aria-label={`Remove ${photo.name}`} onClick={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X className="size-4 text-slate-500" /></button></li>)}</ul>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={busy} onClick={() => submit(true)} className="button-primary bg-emerald-600 hover:bg-emerald-700">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Pass inspection</button>
        <button type="button" disabled={busy} onClick={() => submit(false)} className="button-secondary border-rose-200 text-rose-700 dark:border-rose-500/30 dark:text-rose-300">Fail inspection</button>
      </div>
    </section>
  );
}
