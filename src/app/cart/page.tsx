import type { Metadata } from "next";
import { CartPageContent } from "@/components/cart-page";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return <main className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><div className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Ready when you are</p><h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Your cart</h1></div><CartPageContent /></main>;
}
