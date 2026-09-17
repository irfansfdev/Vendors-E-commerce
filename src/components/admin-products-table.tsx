"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, Check, ChevronLeft, ChevronRight, Edit3, Eye, Search, Store, X } from "lucide-react";
import { ActionMenu } from "@/components/action-menu";
import { toast } from "sonner";
import { updateAdminProductStatusAction } from "@/app/actions/admin";

type Product = {
  id: string;
  title: string;
  slug: string;
  price: number;
  status: string;
  shop: string;
  shopId: string;
  createdAt: string;
};

type Tab = "all" | "pending" | "published" | "draft" | "archived";
const pageSize = 8;

export function AdminProductsTable({ products, initialTab = "all" }: { products: Product[]; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const counts = {
    all: products.length,
    pending: products.filter((item) => item.status === "pending").length,
    published: products.filter((item) => item.status === "published").length,
    draft: products.filter((item) => item.status === "draft").length,
    archived: products.filter((item) => item.status === "archived").length,
  };

  const filtered = useMemo(
    () =>
      products.filter(
        (item) =>
          (tab === "all" || item.status === tab) &&
          [item.title, item.shop, item.slug].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [products, tab, query],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function selectTab(next: Tab) {
    setTab(next);
    setPage(1);
  }

  async function changeStatus(product: Product, status: "published" | "draft" | "archived") {
    const actionText = status === "published" ? "Approve" : status === "archived" ? "Archive" : "Move to draft";
    if (!window.confirm(`${actionText} ${product.title}?`)) return;

    setBusy(product.id);
    const result = await updateAdminProductStatusAction(product.id, status);
    setBusy(null);

    if (result.success) {
      toast.success(
        status === "published"
          ? "Product approved"
          : status === "archived"
            ? "Product archived"
            : "Product moved to draft",
      );
      window.location.reload();
      return;
    }

    toast.error(result.error ?? "Could not update product.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "published", "draft", "archived"] as Tab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => selectTab(item)}
              className={`rounded-xl px-3.5 py-2 text-xs font-black capitalize transition ${
                tab === item
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-orange-500 dark:bg-white/5 dark:ring-white/10"
              }`}
            >
              {item === "pending" ? "Requests" : item}
              <span className="ml-1 opacity-70">{counts[item]}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by shop or product"
            aria-label="Search products or shops"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} products
        </span>
        {query && <span>Filtered results</span>}
      </div>

      <section className="surface overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] text-left">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[.12em] text-slate-400 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-5 py-4">Shop</th>
                <th className="px-5 py-4">Product</th>
                <th className="px-5 py-4">Price</th>
                <th className="px-5 py-4">Submitted</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {visible.map((product) => (
                <tr key={product.id} className="align-middle transition hover:bg-orange-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-4">
                    <ShopIdentity name={product.shop} />
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold">{product.title}</p>
                    <p className="text-xs text-slate-400">/{product.slug || "slug"}</p>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold">Rs {product.price.toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-5 py-4">
                    <Status status={product.status} />
                  </td>
                  <td className="px-5 py-4">
                    <Actions product={product} busy={busy === product.id} onStatus={changeStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/10 md:hidden">
          {visible.map((product) => (
            <div key={product.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <ShopIdentity name={product.shop} />
                  <p className="mt-4 font-semibold">{product.title}</p>
                  <p className="text-xs text-slate-400">/{product.slug || "slug"}</p>
                </div>
                <Status status={product.status} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric label="Price" value={`Rs ${product.price.toLocaleString()}`} />
                <Metric label="Submitted" value={product.createdAt ? new Date(product.createdAt).toLocaleDateString() : "-"} />
              </div>
              <div className="mt-5 flex justify-end">
                <Actions product={product} busy={busy === product.id} onStatus={changeStatus} />
              </div>
            </div>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500">No products match this filter.</div>
        )}
      </section>

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Product pagination">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage === 1}
            className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
            <button
              type="button"
              key={number}
              onClick={() => setPage(number)}
              className={`grid size-9 place-items-center rounded-lg text-xs font-black ${number === currentPage ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-orange-50 hover:text-orange-600"}`}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            disabled={currentPage === pageCount}
            className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

function Actions({ product, busy, onStatus }: { product: Product; busy: boolean; onStatus: (product: Product, status: "published" | "draft" | "archived") => void }) {
  return <ActionMenu label="Product actions" disabled={busy}><Link href={`/admin/products/${product.id}/edit`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-orange-50 dark:hover:bg-white/5"><Edit3 className="size-3.5" /> Edit product</Link><Link href={`/product/${product.slug}`} target="_blank" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-orange-50 dark:hover:bg-white/5"><Eye className="size-3.5" /> View product</Link>{product.status === "pending" && <><button type="button" disabled={busy} onClick={() => onStatus(product, "published")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><Check className="size-3.5" /> Approve product</button><button type="button" disabled={busy} onClick={() => onStatus(product, "archived")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"><X className="size-3.5" /> Reject product</button></>}{product.status === "draft" && <button type="button" disabled={busy} onClick={() => onStatus(product, "published")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><Check className="size-3.5" /> Publish product</button>}{product.status === "published" && <button type="button" disabled={busy} onClick={() => onStatus(product, "archived")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-orange-50"><Archive className="size-3.5" /> Archive product</button>}{product.status === "archived" && <button type="button" disabled={busy} onClick={() => onStatus(product, "draft")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-orange-50"><Archive className="size-3.5" /> Restore draft</button>}</ActionMenu>;
}

function ShopIdentity({ name }: { name: string }) {
  return (
    <div className="flex min-w-[170px] items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
        <Store className="size-5" />
      </span>
      <p className="font-semibold">{name}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Status({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] ${
        status === "published"
          ? "bg-emerald-50 text-emerald-700"
          : status === "pending"
            ? "bg-orange-50 text-orange-700"
            : status === "archived"
              ? "bg-rose-50 text-rose-700"
              : "bg-slate-100 text-slate-600"
      }`}
    >
      {status === "pending" ? "Pending review" : status === "draft" ? "Draft" : status}
    </span>
  );
}
