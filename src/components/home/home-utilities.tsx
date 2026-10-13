import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SellDeliverStrip({
  isSeller,
  isAdmin,
  isRider,
  isLive,
}: {
  isSeller: boolean;
  isAdmin: boolean;
  isRider: boolean;
  isLive: boolean;
}) {
  return (
    <section className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-[var(--text)]">
          Selling something? Open your shop on BabulShop and reach more shoppers.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/seller" className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white transition hover:bg-orange-600">
            {isSeller || isAdmin ? "Go to your shop" : "Start selling"}
          </Link>
          <Link href={isRider ? "/rider" : "/rider/apply"} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline">
            {isRider ? "Delivery desk" : "Become a rider"} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
      {!isLive && <p className="mt-3 text-xs text-[var(--text-muted)]">Catalog data is currently unavailable.</p>}
    </section>
  );
}
