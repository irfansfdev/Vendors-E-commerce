"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Edit3 } from "lucide-react";
import { ActionMenu } from "@/components/action-menu";
import { DeleteProductButton } from "@/components/delete-product-button";

type Product = { id: string; title: string; variantCount: number; price: number; stock: number; status: string; featured: boolean; createdAt: string; slug: string };
const pageSize = 10;

export function SellerProductsTable({ products, onDelete }: { products: Product[]; onDelete: (id: string) => Promise<unknown> }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = useMemo(() => products.slice((currentPage - 1) * pageSize, currentPage * pageSize), [products, currentPage]);

  return (
    <section className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-[.1em] text-slate-400 dark:border-white/10 dark:bg-white/5">
            <tr><th className="px-5 py-4">Product</th><th className="px-5 py-4">Variants</th><th className="px-5 py-4">Price</th><th className="px-5 py-4">Stock</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Featured</th><th className="px-5 py-4">Created</th><th className="px-5 py-4 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {visible.map((product) => (
              <tr key={product.id} className="transition hover:bg-orange-50/40 dark:hover:bg-white/5">
                <td className="px-5 py-4"><p className="font-semibold">{product.title}</p><p className="mt-1 text-xs text-slate-400">/{product.slug}</p></td>
                <td className="px-5 py-4"><span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{product.variantCount} {product.variantCount === 1 ? "variant" : "variants"}</span></td>
                <td className="px-5 py-4 font-semibold">Rs {product.price.toLocaleString()}</td>
                <td className="px-5 py-4 font-semibold">{product.stock}</td>
                <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${product.status === "published" ? "bg-emerald-50 text-emerald-700" : product.status === "archived" ? "bg-rose-50 text-rose-700" : "bg-orange-50 text-orange-700"}`}>{product.status}</span></td>
                <td className="px-5 py-4">{product.featured ? "Yes" : "No"}</td>
                <td className="px-5 py-4 text-slate-500">{product.createdAt ? new Date(product.createdAt).toLocaleDateString() : "-"}</td>
                <td className="px-5 py-4"><ActionMenu label="Product actions"><Link href={`/seller/products/${product.id}/edit`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-orange-50 dark:hover:bg-white/5"><Edit3 className="size-3.5" /> Edit</Link><form action={async () => { await onDelete(product.id); }}><DeleteProductButton /></form></ActionMenu></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && <nav className="flex items-center justify-center gap-2 p-4" aria-label="Product pagination"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="icon-button border border-slate-200 disabled:opacity-40 dark:border-white/10" aria-label="Previous page"><ChevronLeft className="size-4" /></button><span className="text-xs font-bold text-slate-500">Page {currentPage} of {pageCount}</span><button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} className="icon-button border border-slate-200 disabled:opacity-40 dark:border-white/10" aria-label="Next page"><ChevronRight className="size-4" /></button></nav>}
    </section>
  );
}
