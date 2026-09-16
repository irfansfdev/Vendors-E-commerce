import type { Metadata } from "next";
import Link from "next/link";
import { Bike, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { applyAsRiderAction } from "@/app/rider/actions";

export const metadata: Metadata = { title: "Become a delivery rider" };
export const dynamic = "force-dynamic";

export default async function RiderApplyPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <main className="mx-auto max-w-xl px-4 py-16 text-center"><Bike className="mx-auto size-12 text-orange-500" /><h1 className="mt-5 text-3xl font-black">Become a delivery rider</h1><p className="mt-3 text-sm text-slate-500">Sign in first, then submit your rider application.</p><Link href="/login?next=/rider/apply" className="button-primary mt-6 inline-flex bg-orange-500">Sign in</Link></main>;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("delivery_profiles").select("status, rejection_reason").eq("user_id", user.id).maybeSingle();
  const { submitted } = await searchParams;
  if (existing) return <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6"><section className="surface p-8 text-center"><CheckCircle2 className="mx-auto size-12 text-emerald-500" /><h1 className="mt-5 text-3xl font-black">Rider application {String(existing.status)}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{existing.status === "approved" ? "Your rider desk is ready." : existing.status === "rejected" ? String(existing.rejection_reason ?? "Please contact support for more details.") : "The super admin will review your information and activate your rider account."}</p>{existing.status === "approved" && <Link href="/rider" className="button-primary mt-6 inline-flex bg-orange-500">Open rider desk</Link>}</section></main>;
  return <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6"><div className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Delivery network</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Apply as a rider</h1><p className="mt-2 text-sm text-slate-500">Share your details. A super admin will review and approve your application.</p></div>{submitted && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">Application submitted successfully.</p>}<form action={applyAsRiderAction} className="surface grid gap-4 p-6 sm:grid-cols-2"><Field label="Full name" name="fullName" defaultValue={String(user.user_metadata?.full_name ?? "")} required /><Field label="Email" name="email" type="email" defaultValue={user.email ?? ""} required /><Field label="Phone" name="phone" required /><Field label="CNIC / ID" name="cnic" required /><Field label="Address" name="address" className="sm:col-span-2" required /><Field label="Vehicle type" name="vehicleType" placeholder="Bike, car, van" required /><Field label="Vehicle number" name="vehicleNumber" required /><Field label="License number" name="licenseNumber" required /><button className="button-primary mt-2 bg-orange-500 sm:col-span-2">Submit application</button></form></main>;
}
function Field({ label, name, type = "text", className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className={`grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 ${className}`}><span>{label}</span><input {...props} name={name} type={type} className="field" /></label>; }
