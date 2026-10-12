import Link from "next/link";
function formatExactMoney(amount: number) {
  return `Rs ${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export type CompactPanelRow = {
  label: string;
  value: string;
  helper?: string;
  exactValue?: number;
  attention?: boolean;
  href?: string;
};

type CompactPanelProps = {
  title: string;
  rows: CompactPanelRow[];
  actionHref?: string;
  actionLabel?: string;
};

export function CompactPanel({ title, rows, actionHref, actionLabel }: CompactPanelProps) {
  const titleAction = actionHref && actionLabel
    ? <Link href={actionHref} className="inline-flex min-h-11 items-center text-xs font-semibold text-orange-600 hover:text-orange-700">{actionLabel}</Link>
    : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#102a2a]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</h2>
        {titleAction}
      </div>
      <dl className="divide-y divide-slate-100 dark:divide-white/10">
        {rows.map((row) => {
          const content = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                {row.attention && <span className="size-2 shrink-0 rounded-full bg-rose-500" aria-label="Needs attention" />}
                <span className="min-w-0">
                  <span className={`block text-sm ${row.attention ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"}`}>{row.label}</span>
                  {row.helper && <span className="mt-0.5 block text-xs text-slate-400">{row.helper}</span>}
                </span>
              </span>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${row.attention ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}
                title={row.exactValue === undefined ? undefined : formatExactMoney(row.exactValue)}
              >
                {row.value}
              </span>
            </>
          );

          return (
            <div key={row.label} className="flex min-h-12 items-center justify-between gap-4 py-3">
              {row.href
                ? <Link href={row.href} className="flex w-full items-center justify-between gap-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">{content}</Link>
                : content}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
