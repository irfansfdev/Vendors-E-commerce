"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginatedList({ items, pageSize = 10 }: { items: ReactNode[]; pageSize?: number }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <>{visible}{pageCount > 1 && <nav className="flex items-center justify-center gap-2 border-t border-slate-100 p-4 dark:border-white/10" aria-label="Pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))} className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Previous page"><ChevronLeft className="size-4" /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button type="button" key={number} onClick={() => setPage(number)} className={`grid size-9 place-items-center rounded-lg text-xs font-black ${number === currentPage ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-orange-50 hover:text-orange-600"}`}>{number}</button>)}<button type="button" disabled={currentPage === pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))} className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Next page"><ChevronRight className="size-4" /></button></nav>}</>;
}
