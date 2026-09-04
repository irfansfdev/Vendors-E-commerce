"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import type { AuthState } from "@/app/auth/actions";
import { googleAction } from "@/app/auth/actions";

type AuthAction = (state: AuthState, formData: FormData) => Promise<AuthState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="button-primary mt-2 w-full bg-orange-500 hover:bg-orange-600">{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? "Please wait…" : label}</button>;
}

export function AuthForm({ mode, action, next = "/account", queryError }: { mode: "login" | "signup" | "reset"; action: AuthAction; next?: string; queryError?: string }) {
  const [state, formAction] = useActionState(action, {});
  const [showPassword, setShowPassword] = useState(false);
  const isLogin = mode === "login";
  const isSignup = mode === "signup";

  return (
    <div>
      {mode !== "reset" && <form action={googleAction}><input type="hidden" name="next" value={next} /><button className="button-secondary w-full"><span className="grid size-5 place-items-center rounded-full bg-white text-xs font-black text-blue-600 shadow-sm">G</span> Continue with Google</button></form>}
      {mode !== "reset" && <div className="my-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /> or continue with email <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {isSignup && <label className="block"><span className="mb-2 block text-xs font-bold">Full name</span><div className="relative"><UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input name="fullName" autoComplete="name" required className="field field-icon-left" placeholder="Alex Morgan" /></div></label>}
        <label className="block"><span className="mb-2 block text-xs font-bold">Email address</span><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="email" name="email" autoComplete="email" required className="field field-icon-left" placeholder="you@example.com" /></div></label>
        {mode !== "reset" && <label className="block"><span className="mb-2 flex items-center justify-between text-xs font-bold"><span>Password</span>{isLogin && <Link href="/forgot-password" className="font-semibold text-orange-500 hover:underline">Forgot password?</Link>}</span><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type={showPassword ? "text" : "password"} name="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} required className="field field-icon-both" placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Toggle password visibility">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>}
        {(state.error || queryError) && <div className="flex gap-2 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertCircle className="mt-0.5 size-4 shrink-0" />{state.error ?? queryError}</div>}
        {state.success && <div className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{state.success}</div>}
        <SubmitButton label={mode === "login" ? "Sign in" : mode === "signup" ? "Create my account" : "Send reset link"} />
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">{isLogin ? "New to BabulShop?" : isSignup ? "Already have an account?" : "Remembered your password?"} <Link href={isLogin ? `/signup?next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`} className="font-bold text-slate-950 hover:text-orange-500 dark:text-white">{isLogin ? "Create account" : "Sign in"}</Link></p>
      {isSignup && <p className="mt-5 text-center text-[10px] leading-4 text-slate-400">By creating an account, you agree to BabulShop&apos;s Terms and Privacy Policy.</p>}
    </div>
  );
}
