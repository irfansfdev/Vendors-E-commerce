import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return <main className="grid min-h-[620px] place-items-center px-4 py-16"><section className="max-w-lg text-center"><span className="mx-auto grid size-16 place-items-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10"><Compass className="size-7" /></span><p className="mt-6 text-[11px] font-black uppercase tracking-[.18em] text-orange-500">404 · Off the map</p><h1 className="mt-3 text-4xl font-black tracking-[-.055em]">That find has wandered off.</h1><p className="mt-3 text-sm leading-6 text-slate-500">The page may have moved, or this product is no longer listed.</p><Link href="/" className="button-primary mt-7"><ArrowLeft className="size-4" /> Back to the marketplace</Link></section></main>;
}
