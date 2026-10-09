export function getReturnDeadline(
  deliveredAt: string | null | undefined,
  returnWindowDays: number | null | undefined,
) {
  if (!deliveredAt || !returnWindowDays || returnWindowDays < 1) return null;
  const delivered = new Date(deliveredAt);
  if (!Number.isFinite(delivered.getTime())) return null;
  delivered.setDate(delivered.getDate() + returnWindowDays);
  return delivered;
}

export function isReturnWindowOpen(deadline: Date | null, now = new Date()) {
  return deadline !== null && now.getTime() <= deadline.getTime();
}

export function formatReturnDate(date: Date) {
  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
