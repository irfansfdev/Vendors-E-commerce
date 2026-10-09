"use client";

import type { ReactNode } from "react";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";

export function PaginatedList({ items, pageSize = 10 }: { items: ReactNode[]; pageSize?: number }) {
  const pagination = useUrlPagination(items.length, pageSize);
  return <div data-pagination-list className={pagination.isPending ? "pointer-events-none opacity-60" : ""}>
    {items.slice(pagination.from, pagination.to + 1)}
    <Pagination total={items.length} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
  </div>;
}
