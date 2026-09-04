import type { Metadata } from "next";
import Image from "next/image";
import { AuthForm } from "@/components/auth-form";
import { loginAction } from "@/app/auth/actions";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };
type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
    const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? params.error : undefined;
  return <main className="mx-auto grid min-h-[720px] max-w-[1440px] items-stretch md:grid-cols-2"><section className="flex items-center justify-center px-5 py-14 sm:px-10"><div className="w-full max-w-[410px]"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Welcome back</p><h1 className="mt-3 text-4xl font-black tracking-[-.055em]">Sign in to BabulShop</h1><p className="mt-3 text-sm leading-6 text-slate-500">Access your orders, saved items, and favorite independent shops.</p><div className="mt-8"><AuthForm mode="login" action={loginAction} next={next} queryError={error} /></div></div></section><section className="relative m-4 hidden overflow-hidden rounded-3xl bg-[#102a2a] md:block"><Image src="https://images.pexels.com/photos/11112735/pexels-photo-11112735.jpeg?auto=compress&cs=tinysrgb&w=1400" alt="Curated modern furniture" fill priority sizes="50vw" className="object-cover opacity-85" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" /><blockquote className="absolute inset-x-10 bottom-10 text-white"><p className="max-w-lg font-serif text-3xl italic leading-tight">“I found the kind of pieces you usually only discover while traveling.”</p><footer className="mt-4 text-xs font-bold text-orange-200">Maya · BabulShop customer since 2023</footer></blockquote></section></main>;
}
