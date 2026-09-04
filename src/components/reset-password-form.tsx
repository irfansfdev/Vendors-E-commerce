"use client";

import { useState } from "react";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useFormStatus } from "react-dom";
import { updatePasswordAction, type AuthState } from "@/app/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="button-primary mt-2 w-full bg-orange-500 hover:bg-orange-600">{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? "Updating..." : "Update password"}</button>;
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(updatePasswordAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return <form action={formAction} className="space-y-4">
    <label className="block"><span className="mb-2 block text-xs font-bold">New password</span><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" minLength={8} required className="field field-icon-both" placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Toggle password visibility">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
    {state.error && <div className="flex gap-2 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertCircle className="mt-0.5 size-4 shrink-0" />{state.error}</div>}
    {state.success && <div className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{state.success}</div>}
    <SubmitButton />
  </form>;
}