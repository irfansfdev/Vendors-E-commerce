"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { ProductGrid } from "@/components/storefront-sections";
import type { Product } from "@/lib/types";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";

export function WishlistPageContent({ products }: { products: Product[] }) {
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    function loadSaved() {
      startTransition(() =>
        setIds(
          JSON.parse(
            localStorage.getItem("vendra-wishlist") ?? "[]",
          ) as string[],
        ),
      );
    }
    loadSaved();
    window.addEventListener("storage", loadSaved);
    window.addEventListener("vendra-wishlist-updated", loadSaved);
    return () => {
      window.removeEventListener("storage", loadSaved);
      window.removeEventListener("vendra-wishlist-updated", loadSaved);
    };
  }, []);
  const saved = ids === null ? [] : products.filter((product) => ids.includes(product.id));
  const pagination = useUrlPagination(saved.length);
  const visible = saved.slice(pagination.from, pagination.to + 1);
  if (ids === null)
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="aspect-[.88] animate-pulse rounded-2xl bg-slate-200 dark:bg-white/5"
          />
        ))}
      </div>
    );
  if (!saved.length)
    return (
      <div className="surface grid min-h-[420px] place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-rose-50 text-rose-400 dark:bg-rose-500/10">
            <Heart className="size-7" />
          </span>
          <h2 className="mt-5 text-2xl font-black tracking-[-.04em]">
            Save what catches your eye
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Tap the heart on any product and it’ll be waiting here for you.
          </p>
          <Link href="/search" className="button-primary mt-6">
            Discover products <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  return <div data-pagination-list className={`transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}><ProductGrid products={visible} /><Pagination total={saved.length} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></div>;
}
