import type { Metadata } from "next";
import Image from "next/image";
import { AuthForm } from "@/components/auth-form";
import { signupAction } from "@/app/auth/actions";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Create account" };
type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function SignupPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  return <main className="mx-auto grid min-h-[760px] max-w-[1440px] items-stretch md:grid-cols-2"><section className="relative m-4 hidden overflow-hidden rounded-3xl bg-[#102a2a] md:block"><Image src="https://images.pexels.com/photos/19882424/pexels-photo-19882424.jpeg?auto=compress&cs=tinysrgb&w=1400" alt="Colorful independent fashion" fill priority sizes="50vw" className="object-cover opacity-90" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" /><div className="absolute inset-x-10 bottom-10 text-white"><p className="text-[11px] font-black uppercase tracking-[.2em] text-orange-200">One account, endless finds</p><h2 className="mt-3 max-w-md text-4xl font-black tracking-[-.05em]">Shop independent. Live inspired.</h2></div></section><section className="flex items-center justify-center px-5 py-14 sm:px-10"><div className="w-full max-w-[410px]"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Join the marketplace</p><h1 className="mt-3 text-4xl font-black tracking-[-.055em]">Create your account</h1><p className="mt-3 text-sm leading-6 text-slate-500">Checkout faster, track every seller shipment, and save the things you love.</p><div className="mt-8"><AuthForm mode="signup" action={signupAction} next={next} /></div></div></section></main>;
}
