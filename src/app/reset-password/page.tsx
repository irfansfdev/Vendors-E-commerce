import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return <main className="grid min-h-[650px] place-items-center px-4 py-16"><section className="surface w-full max-w-md p-6 shadow-xl shadow-slate-950/5 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10"><KeyRound className="size-5" /></span><h1 className="mt-6 text-3xl font-black tracking-[-.05em]">Choose a new password</h1><p className="mt-3 text-sm leading-6 text-slate-500">Set a new password for your account.</p><div className="mt-7"><ResetPasswordForm /></div><Link href="/login" className="mt-6 block text-center text-xs font-bold text-orange-500 hover:underline">Back to sign in</Link></section></main>;
}