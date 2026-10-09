export const PAGE_SIZES = [10, 15, 20] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export type PaginationParams = Record<string, string | string[] | undefined> | URLSearchParams;

export type PaginationState = {
  page: number;
  pageSize: PageSize;
  from: number;
  to: number;
};

export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: PageSize;
  totalPages: number;
  from: number;
  to: number;
};

function getParam(params: PaginationParams, key: string) {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizePageSize(value: string | undefined, defaultSize: number): PageSize {
  const parsed = Number(value);
  if (PAGE_SIZES.some((size) => size === parsed)) return parsed as PageSize;
  return PAGE_SIZES.some((size) => size === defaultSize) ? defaultSize as PageSize : 10;
}

export function parsePagination(searchParams: PaginationParams, defaultSize = 10): PaginationState {
  const pageSize = normalizePageSize(getParam(searchParams, "pageSize"), defaultSize);
  const parsedPage = Number(getParam(searchParams, "page"));
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const from = (page - 1) * pageSize;

  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function buildPaginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safePageSize = normalizePageSize(String(pageSize), pageSize);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  const from = safeTotal === 0 ? 0 : (safePage - 1) * safePageSize;
  const to = safeTotal === 0 ? -1 : Math.min(from + safePageSize - 1, safeTotal - 1);
  return { total: safeTotal, page: safePage, pageSize: safePageSize, totalPages, from, to };
}
