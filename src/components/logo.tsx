import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="BabulShop home">
      <span className="grid size-9 place-items-center rounded-xl bg-orange-500 text-white shadow-[0_6px_20px_rgba(249,115,22,.24)] transition-transform group-hover:-rotate-3">
        <ShoppingBag className="size-[19px]" strokeWidth={2.4} />
      </span>
      <span className="text-[1.35rem] font-extrabold tracking-[-0.045em] text-slate-950 dark:text-white">BabulShop<span className="text-orange-500">.</span></span>
    </Link>
  );
}
