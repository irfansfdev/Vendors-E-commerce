import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { resetPasswordAction } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <main className="grid min-h-[650px] place-items-center px-4 py-16"><section className="surface w-full max-w-md p-6 shadow-xl shadow-slate-950/5 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><KeyRound className="size-5" /></span><h1 className="mt-6 text-3xl font-black tracking-[-.05em]">Reset your password</h1><p className="mt-3 text-sm leading-6 text-slate-500">Enter your email and we&apos;ll send you a secure reset link.</p><div className="mt-7"><AuthForm mode="reset" action={resetPasswordAction} /></div></section></main>;
}
