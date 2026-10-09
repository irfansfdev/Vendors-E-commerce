"use client";

import { Clock3, History } from "lucide-react";
import { ReturnStatusBadge } from "@/components/return-status-badge";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";

type TimelineEvent = {
  id: string;
  from_status?: string | null;
  to_status?: string | null;
  event_type?: string | null;
  note?: string | null;
  actor_role?: string | null;
  created_at: string;
};

const eventTitles: Record<string, string> = {
  request_created: "Return request submitted",
  seller_approved: "Return approved",
  seller_rejected: "Return declined",
  customer_escalated: "Review requested",
  admin_decision: "BabulShop reviewed the return",
  return_pickup_assigned: "Rider assigned",
  rider_accepted: "Rider accepted pickup",
  rider_picked_up: "Item collected",
  rider_out_for_delivery: "Return on the way",
  rider_delivered: "Delivered to shop",
  seller_confirmed_receipt: "Shop confirmed receipt",
  seller_reported_not_received: "Shop reported item missing",
  seller_inspection_passed: "Inspection passed",
  refund_awaiting_admin: "Refund ready",
  seller_inspection_failed: "Inspection needs review",
  pickup_attempt_failed: "Pickup attempt unsuccessful",
  admin_refund_anyway: "Refund approved by BabulShop",
  admin_refunded: "Refund sent",
  customer_cancelled: "Return cancelled",
};

function label(value: string | null | undefined) {
  return (value ?? "Update")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function eventTitle(event: TimelineEvent) {
  const key = event.event_type ?? "";
  if (eventTitles[key]) return eventTitles[key];
  if (key.startsWith("rider_")) {
    const action = key.slice("rider_".length);
    if (action === "delivered") return "Delivered to shop";
    return `Rider ${label(action).toLowerCase()}`;
  }
  return label(key);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ReturnTimeline({
  events,
  title = "Return timeline",
  emptyMessage = "No timeline events yet.",
}: {
  events: TimelineEvent[];
  title?: string;
  emptyMessage?: string;
}) {
  const pagination = useUrlPagination(events.length);
  const visibleEvents = [...events]
    .reverse()
    .slice(pagination.from, pagination.to + 1)
    .reverse();
  const latestEventId = events.at(-1)?.id;

  return (
    <section
      data-pagination-list
      className={`surface overflow-hidden transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 text-orange-600 ring-1 ring-orange-200/70 dark:from-orange-500/15 dark:to-amber-500/5 dark:text-orange-300 dark:ring-orange-400/20">
          <History className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-black">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Updates to your return</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
          {events.length} {events.length === 1 ? "update" : "updates"}
        </span>
      </header>

      {events.length === 0 ? (
        <p className="m-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[.03] sm:m-6">
          {emptyMessage}
        </p>
      ) : (
        <>
          <ol className="px-5 py-4 sm:px-6">
          {visibleEvents.map((event, index) => (
            <li key={event.id} className="relative flex gap-3 pb-2.5 last:pb-0 sm:gap-3.5">
              {index < visibleEvents.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[11px] top-6 w-px bg-slate-200 dark:bg-white/10 sm:left-[13px]"
                />
              )}
              <span className={`relative z-10 mt-1 grid size-6 shrink-0 place-items-center rounded-full border bg-white dark:bg-[#111827] sm:size-7 ${
                event.id === latestEventId
                  ? "border-orange-300 dark:border-orange-400/50"
                  : "border-slate-200 dark:border-white/15"
              }`}>
                <span className={`size-1.5 rounded-full ${event.id === latestEventId ? "bg-orange-500" : "bg-slate-300 dark:bg-slate-600"}`} />
              </span>
              <article className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 transition-colors sm:px-3.5 ${
                event.id === latestEventId
                  ? "border-orange-200/80 bg-orange-50/50 dark:border-orange-400/20 dark:bg-orange-500/[.04]"
                  : "border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[.025]"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="break-words text-xs font-black leading-5 text-slate-900 dark:text-white sm:text-sm">
                      {eventTitle(event)}
                    </h3>
                    {event.id === latestEventId && (
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[.08em] text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                        Latest
                      </span>
                    )}
                    {event.to_status && event.from_status !== event.to_status && (
                      <ReturnStatusBadge status={event.to_status} />
                    )}
                  </div>
                  <time
                    dateTime={event.created_at}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 sm:shrink-0"
                  >
                    <Clock3 className="size-3 shrink-0" />
                    <span>{formatDate(event.created_at)}</span>
                  </time>
                </div>
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                  {label(event.actor_role ?? "system")}
                  {event.from_status && event.from_status !== event.to_status
                    ? ` · ${label(event.from_status)} → ${label(event.to_status)}`
                    : ""}
                </p>
                {event.note && (
                  <p className="mt-2 border-t border-slate-200/70 pt-2 text-xs leading-5 text-slate-600 dark:border-white/10 dark:text-slate-300">
                    {event.note}
                  </p>
                )}
              </article>
            </li>
          ))}
          </ol>
          <div className="px-5 pb-4 sm:px-6">
            <Pagination
              total={events.length}
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </div>
        </>
      )}
    </section>
  );
}
