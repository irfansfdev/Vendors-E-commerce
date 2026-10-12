import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export type AdminRequestLink = {
  label: string;
  href: string;
  count: number | null;
  icon: LucideIcon;
  countError?: string | null;
};

export function AdminRequestLinks({ requests }: { requests: AdminRequestLink[] }) {
  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Review queues</p>
      <nav aria-label="Pending admin requests" className="flex flex-wrap gap-2 sm:justify-end">
        {requests.map(({ label, href, count, icon: Icon, countError }) => (
          <Link
            key={label}
            href={href}
            title={countError ? `Could not load request count: ${countError}` : `${count ?? 0} pending ${label.toLowerCase()}`}
            className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.02] transition hover:border-orange-300 hover:bg-orange-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 dark:border-white/10 dark:bg-[#102a2a] dark:text-slate-200 dark:hover:bg-white/5"
          >
            <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="whitespace-nowrap">{label}</span>
            {count !== null && count > 0 && (
              <span
                aria-label={`${count} pending`}
                className="inline-flex min-w-6 items-center justify-center rounded-full bg-orange-100 px-1.5 py-1 text-[11px] font-bold tabular-nums text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
              >
                {count.toLocaleString("en-US")}
              </span>
            )}
            <ArrowUpRight className="size-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
