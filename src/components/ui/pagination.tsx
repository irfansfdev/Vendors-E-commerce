"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { buildPaginationMeta, PAGE_SIZES, parsePagination, type PageSize } from "@/lib/pagination";

export function useUrlPagination(total: number, defaultSize = 10) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = parsePagination(new URLSearchParams(searchParams.toString()), defaultSize);
  const meta = buildPaginationMeta(total, initial.page, initial.pageSize);
  const [isPending, startTransition] = useTransition();
  const navigate = useCallback((nextPage: number, nextSize = meta.pageSize) => {
    const nextMeta = buildPaginationMeta(total, nextPage, nextSize);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("page", String(nextMeta.page));
    nextParams.set("pageSize", String(nextSize));
    const query = nextParams.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>("[data-pagination-list]");
      if (!target) return;
      const bounds = target.getBoundingClientRect();
      if (bounds.top < 0 || bounds.top > window.innerHeight) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, [meta.pageSize, pathname, router, searchParams, startTransition, total]);

  const setPage = useCallback((page: number) => navigate(page), [navigate]);
  const setPageSize = useCallback((pageSize: PageSize) => {
    const firstVisibleIndex = (meta.page - 1) * meta.pageSize;
    navigate(Math.floor(firstVisibleIndex / pageSize) + 1, pageSize);
  }, [meta.page, meta.pageSize, navigate]);
  const resetPage = useCallback(() => {
    if (meta.page !== 1) navigate(1);
  }, [meta.page, navigate]);

  return { ...meta, isPending, setPage, setPageSize, resetPage };
}

type PaginationProps = {
  total: number;
  page: number;
  pageSize: PageSize;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
};

function pageNumbers(page: number, totalPages: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const middleStart = Math.max(2, page - 1);
  const middleEnd = Math.min(totalPages - 1, page + 1);
  const result: Array<number | "ellipsis-start" | "ellipsis-end"> = [1];
  if (middleStart > 2) result.push("ellipsis-start");
  for (let number = middleStart; number <= middleEnd; number += 1) result.push(number);
  if (middleEnd < totalPages - 1) result.push("ellipsis-end");
  result.push(totalPages);
  return result;
}

export function Pagination({ total, page, pageSize, totalPages, onPageChange, onPageSizeChange }: PaginationProps) {
  const live = useRef<HTMLParagraphElement>(null);
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  useEffect(() => {
    if (live.current) live.current.textContent = `Showing ${first} to ${last} of ${total} results`;
  }, [first, last, total]);

  if (total <= 10) return null;

  const buttonClass = "grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pagination-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950";
  const numbers = pageNumbers(page, totalPages);

  return (
    <div className="mt-6 flex w-full items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Show</span>
        <label>
          <span className="sr-only">Results per page</span>
          <select
            aria-label="Results per page"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
            className="h-10 rounded-lg border border-[var(--pagination-border)] bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-[var(--pagination-accent)] dark:bg-slate-900 dark:text-slate-100"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <span>Results</span>
      </div>
      <nav aria-label="Pagination" className="flex items-center gap-2 max-[399px]:w-full max-[399px]:justify-between">
        <p ref={live} aria-live="polite" className="sr-only" />
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={`${buttonClass} bg-[var(--pagination-bg)] text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300`}>
          <ArrowLeft className="size-4 stroke-[1.5]" />
        </button>
        <span className="hidden text-sm font-semibold text-slate-600 max-[399px]:inline dark:text-slate-300">Page {page} of {totalPages}</span>
        <div className="flex items-center gap-2 max-[399px]:hidden">
          {numbers.map((item) => typeof item === "number" ? (
            <button key={item} type="button" aria-current={item === page ? "page" : undefined} onClick={() => onPageChange(item)} className={`${buttonClass} ${item === page ? "bg-[var(--pagination-accent)] font-bold text-white" : "bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{item}</button>
          ) : <span key={item} aria-hidden="true" className="grid size-10 place-items-center text-slate-400">…</span>)}
        </div>
        <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className={`${buttonClass} bg-[var(--pagination-bg)] text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300`}>
          <ArrowRight className="size-4 stroke-[1.5]" />
        </button>
      </nav>
    </div>
  );
}

export function UrlPagination({ total, defaultSize = 10 }: { total: number; defaultSize?: number }) {
  const pagination = useUrlPagination(total, defaultSize);
  useEffect(() => {
    const target = document.querySelector<HTMLElement>("[data-pagination-list]");
    target?.classList.toggle("pointer-events-none", pagination.isPending);
    target?.classList.toggle("opacity-60", pagination.isPending);
  }, [pagination.isPending]);
  return <Pagination total={total} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />;
}
