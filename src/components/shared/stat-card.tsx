import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export function formatMoney(amount: number) {
  return `Rs ${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US")}`;
}

function formatExactMoney(amount: number) {
  return `Rs ${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type StatCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  href?: string;
  exactValue?: number;
  valueClassName?: string;
};

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  href,
  exactValue,
  valueClassName = "",
}: StatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <div className="flex items-center gap-2">
          {href && <ArrowUpRight className="size-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />}
          <Icon className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
        </div>
      </div>
      <p
        className={`mt-3 text-[28px] font-semibold leading-tight tabular-nums tracking-[-0.03em] ${valueClassName || "text-slate-900 dark:text-white"}`}
        title={exactValue === undefined ? undefined : formatExactMoney(exactValue)}
      >
        {value}
      </p>
      {subtitle && <p className="mt-2 text-xs text-slate-400">{subtitle}</p>}
    </>
  );

  const className = `block rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#102a2a]${href ? " group cursor-pointer transition-colors hover:border-orange-300 hover:bg-orange-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 dark:hover:bg-white/5" : ""}`;
  return href
    ? <Link href={href} className={className} aria-label={`${label}: ${value}`}>{content}</Link>
    : <article className={className}>{content}</article>;
}
