"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[620px] place-items-center px-4 py-16"><section className="surface max-w-lg p-8 text-center shadow-xl"><span className="mx-auto grid size-14 place-items-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10"><AlertTriangle className="size-6" /></span><h1 className="mt-5 text-3xl font-black tracking-[-.05em]">Something went sideways</h1><p className="mt-3 text-sm leading-6 text-slate-500">We couldn&apos;t load this part of the marketplace. Your cart and account are safe.</p><button onClick={reset} className="button-primary mt-6"><RotateCcw className="size-4" /> Try again</button></section></main>;
}
