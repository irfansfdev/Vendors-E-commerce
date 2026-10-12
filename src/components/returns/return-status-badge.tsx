const labels: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Under review",
  pickup_assigned: "Pickup assigned",
  picked_up: "Picked up",
  returned_to_shop: "At shop",
  inspection_passed: "Inspection passed",
  inspection_failed: "Needs review",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  cancelled: "Cancelled",
  received: "Received",
  assigned: "Assigned",
  accepted: "Accepted",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  failed: "Pickup failed",
};

const colors: Record<string, string> = {
  requested: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  approved: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  escalated: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  pickup_assigned: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  picked_up: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  returned_to_shop: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300",
  inspection_passed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  inspection_failed: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  refund_pending: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  refunded: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  received: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300",
  assigned: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  accepted: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  out_for_delivery: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  delivered: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  failed: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
};

export function ReturnStatusBadge({ status, overdue = false }: { status: string; overdue?: boolean }) {
  const label = overdue ? "Response overdue" : labels[status] ?? status.replaceAll("_", " ");
  const color = overdue ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : colors[status] ?? colors.requested;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${color}`}>{label}</span>;
}
