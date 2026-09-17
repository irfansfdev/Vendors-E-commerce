"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search, Star, X } from "lucide-react";
import { moderateReviewAction } from "@/app/actions/reviews";

type Review = {
  id: string;
  product: string;
  customer: string;
  rating: number;
  review: string;
  status: string;
  createdAt: string;
};
type Tab = "all" | "pending" | "approved" | "rejected";
const pageSize = 8;
const tabs: Tab[] = ["all", "pending", "approved", "rejected"];

export function AdminReviewsTable({ reviews }: { reviews: Review[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const counts = {
    all: reviews.length,
    pending: reviews.filter((review) => review.status === "pending").length,
    approved: reviews.filter((review) => review.status === "approved").length,
    rejected: reviews.filter((review) => review.status === "rejected").length,
  };
  const filtered = useMemo(() => reviews.filter((review) => {
    const search = query.trim().toLowerCase();
    return (tab === "all" || review.status === tab) && (!search || [review.product, review.customer, review.review].join(" ").toLowerCase().includes(search));
  }), [reviews, query, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <button key={item} type="button" onClick={() => { setTab(item); setPage(1); }} className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-black capitalize transition ${tab === item ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-orange-500 dark:bg-white/5 dark:ring-white/10"}`}>
              {item === "all" ? "All reviews" : item === "pending" ? "New reviews" : item} <span className="ml-1 opacity-60">{counts[item]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search product or customer" aria-label="Search reviews" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-white/5" />
          {query && <button type="button" onClick={() => { setQuery(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500" aria-label="Clear search"><X className="size-4" /></button>}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500"><span>Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} reviews</span>{query && <span>Filtered results</span>}</div>
      <section className="surface overflow-hidden">
        {visible.length === 0 ? <p className="p-12 text-center text-sm text-slate-500">No reviews match this filter.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[.12em] text-slate-400 dark:border-white/10 dark:bg-white/5"><tr><th className="px-5 py-4">Product</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Review</th><th className="px-5 py-4">Rating</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Date</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/10">{visible.map((review) => <tr key={review.id} className="align-top transition hover:bg-orange-50/40 dark:hover:bg-white/5"><td className="max-w-[190px] px-5 py-4"><p className="font-semibold">{review.product}</p></td><td className="max-w-[180px] px-5 py-4 text-slate-600 dark:text-slate-300">{review.customer}</td><td className="max-w-[330px] px-5 py-4"><p className="line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{review.review}</p></td><td className="px-5 py-4"><div className="flex items-center gap-0.5 text-amber-400" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`size-3.5 ${star <= review.rating ? "fill-current" : "text-slate-200 dark:text-slate-700"}`} />)}</div></td><td className="px-5 py-4"><Status status={review.status} /></td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "-"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{review.status === "pending" && <><form action={moderateReviewAction}><input type="hidden" name="id" value={review.id} /><input type="hidden" name="status" value="approved" /><button className="button-primary min-h-9 bg-emerald-600 px-3 py-1.5 text-xs hover:bg-emerald-700"><Check className="size-3.5" /> Approve</button></form><form action={moderateReviewAction}><input type="hidden" name="id" value={review.id} /><input type="hidden" name="status" value="rejected" /><button className="button-secondary min-h-9 px-3 py-1.5 text-xs text-rose-600"><X className="size-3.5" /> Reject</button></form></>}</div></td></tr>)}</tbody></table></div>}
      </section>
      {pageCount > 1 && <nav className="flex items-center justify-center gap-2" aria-label="Review pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Previous page"><ChevronLeft className="size-4" /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button type="button" key={number} onClick={() => setPage(number)} className={`grid size-9 place-items-center rounded-lg text-xs font-black ${number === currentPage ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-orange-50 hover:text-orange-600"}`}>{number}</button>)}<button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10" aria-label="Next page"><ChevronRight className="size-4" /></button></nav>}
    </div>
  );
}

function Status({ status }: { status: string }) {
  const tone = status === "approved" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : status === "rejected" ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] ${tone}`}>{status}</span>;
}
