export function normalizeProductStatus(value?: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isPublicProductStatus(value?: string | null): boolean {
  return normalizeProductStatus(value) === "published";
}

export function isProductAwaitingReview(value?: string | null): boolean {
  const status = normalizeProductStatus(value);
  return status === "pending" || status === "draft";
}
