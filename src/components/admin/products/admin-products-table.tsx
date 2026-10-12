"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, Check, Edit3, Eye, Search, Store, Trash2, X } from "lucide-react";
import { RowActions } from "@/components/ui/row-actions";
import { toast } from "sonner";
import { updateAdminFeaturedStatusAction, updateAdminProductStatusAction } from "@/app/actions/admin";
import { Pagination, useUrlPagination } from "@/components/ui/pagination";

type Product = {
  id: string;
  title: string;
  slug: string;
  price: number;
  status: string;
  shop: string;
  shopId: string;
  createdAt: string;
  variantCount: number;
  isActive: boolean;
  isFeatured: boolean;
  featuredStatus: string;
};

type Tab = "all" | "pending" | "published" | "draft" | "archived" | "featured";

export function AdminProductsTable({ products, initialTab = "all" }: { products: Product[]; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const counts = {
    all: products.length,
    pending: products.filter((item) => item.status === "pending").length,
    published: products.filter((item) => item.status === "published").length,
    draft: products.filter((item) => item.status === "draft").length,
    archived: products.filter((item) => item.status === "archived").length,
    featured: products.filter((item) => item.featuredStatus === "pending" || item.featuredStatus === "approved").length,
  };

  const filtered = useMemo(
    () =>
      products.filter(
        (item) =>
          (tab === "all" || tab === "featured" ? (tab === "all" || item.featuredStatus === "pending" || item.featuredStatus === "approved") : item.status === tab) &&
          [item.title, item.shop, item.slug].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [products, tab, query],
  );

  const pagination = useUrlPagination(filtered.length);
  const visible = filtered.slice(pagination.from, pagination.to + 1);

  function selectTab(next: Tab) {
    setTab(next);
    pagination.resetPage();
  }

  async function changeStatus(product: Product, status: "published" | "draft" | "archived") {
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

  async function changeFeatured(product: Product, status: "approved" | "rejected") {
    setBusy(product.id);
    const result = await updateAdminFeaturedStatusAction(product.id, status);
    setBusy(null);
    if (result.success) { toast.success(status === "approved" ? "Featured product approved" : "Featured request rejected"); window.location.reload(); return; }
    toast.error(result.error ?? "Could not update Featured status.");
  }

  return (
    <div data-pagination-list className={`space-y-5 transition-opacity ${pagination.isPending ? "pointer-events-none opacity-60" : ""}`}>
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
          <button type="button" onClick={() => selectTab("featured")} className={`rounded-xl px-3.5 py-2 text-xs font-black transition ${tab === "featured" ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"}`}>Featured requests <span className="ml-1 opacity-70">{counts.featured}</span></button>
        </div>

        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              pagination.resetPage();
            }}
            placeholder="Search by shop or product"
            aria-label="Search products or shops"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); pagination.resetPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing {filtered.length ? pagination.from + 1 : 0}-{Math.min(pagination.to + 1, filtered.length)} of {filtered.length} products
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
                <th className="px-5 py-4">Variants</th>
                <th className="px-5 py-4">Price</th>
                <th className="px-5 py-4">Submitted</th>
                <th className="px-5 py-4">Status</th>
                <th className="w-14 px-2 py-4 text-right"><span className="sr-only">Actions</span></th>
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
                  <td className="px-5 py-4"><span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{product.variantCount} {product.variantCount === 1 ? "variant" : "variants"}</span></td>
                  <td className="px-5 py-4 text-sm font-semibold">Rs {product.price.toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-5 py-4">
                    <Status status={product.status} />
                    <FeaturedStatus status={product.featuredStatus} />
                  </td>
                  <td className="w-14 px-2 py-4 text-right">
                    <Actions product={product} busy={busy === product.id} onStatus={changeStatus} onFeatured={changeFeatured} />
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
                <div className="flex flex-col items-end gap-2"><Status status={product.status} /><FeaturedStatus status={product.featuredStatus} /></div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric label="Price" value={`Rs ${product.price.toLocaleString()}`} />
                <Metric label="Variants" value={product.variantCount} />
                <Metric label="Submitted" value={product.createdAt ? new Date(product.createdAt).toLocaleDateString() : "-"} />
              </div>
              <div className="mt-5 flex justify-end">
                <Actions product={product} busy={busy === product.id} onStatus={changeStatus} onFeatured={changeFeatured} />
              </div>
            </div>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500">No products match this filter.</div>
        )}
      </section>

      <Pagination total={filtered.length} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
    </div>
  );
}

function Actions({ product, busy, onStatus, onFeatured }: { product: Product; busy: boolean; onStatus: (product: Product, status: "published" | "draft" | "archived") => void; onFeatured: (product: Product, status: "approved" | "rejected") => void }) {
  const items = [
    { id: "edit", type: "link" as const, label: "Edit product", icon: Edit3, href: `/admin/products/${product.id}/edit` },
    { id: "view", type: "link" as const, label: "View product", icon: Eye, href: `/product/${product.slug}`, target: "_blank" },
    ...(product.status === "pending" ? [
      { id: "approve", type: "button" as const, label: "Approve product", icon: Check, disabled: busy, confirm: { title: `Approve ${product.title}?`, message: "This product will be published.", confirmLabel: "Approve product" }, onSelect: () => onStatus(product, "published") },
      { id: "reject", type: "button" as const, label: "Reject product", icon: X, tone: "danger" as const, disabled: busy, confirm: { title: `Archive ${product.title}?`, message: "This product request will be rejected.", confirmLabel: "Reject product" }, onSelect: () => onStatus(product, "archived") },
    ] : []),
    ...(product.status === "draft" ? [
      { id: "publish", type: "button" as const, label: "Publish product", icon: Check, disabled: busy, confirm: { title: `Approve ${product.title}?`, message: "This product will be published.", confirmLabel: "Publish product" }, onSelect: () => onStatus(product, "published") },
    ] : []),
    ...(product.status === "published" ? [
      { id: "archive", type: "button" as const, label: "Archive product", icon: Archive, disabled: busy, confirm: { title: `Archive ${product.title}?`, message: "This product will be archived.", confirmLabel: "Archive product" }, onSelect: () => onStatus(product, "archived") },
    ] : []),
    ...(product.featuredStatus === "pending" ? [
      { id: "approve-featured", type: "button" as const, label: "Approve Featured", icon: Check, disabled: busy || product.status !== "published", confirm: { title: `Approve Featured request for ${product.title}?`, message: "This product will be featured.", confirmLabel: "Approve Featured" }, onSelect: () => onFeatured(product, "approved") },
      { id: "reject-featured", type: "button" as const, label: "Reject Featured", icon: X, tone: "danger" as const, disabled: busy, confirm: { title: `Reject Featured request for ${product.title}?`, message: "This featured request will be rejected.", confirmLabel: "Reject Featured" }, onSelect: () => onFeatured(product, "rejected") },
    ] : []),
    ...(product.featuredStatus === "approved" ? [
      { id: "remove-featured", type: "button" as const, label: "Remove Featured", icon: Trash2, tone: "danger" as const, disabled: busy, confirm: { title: `Remove ${product.title} from featured products?`, message: "This product will no longer be featured.", confirmLabel: "Remove Featured" }, onSelect: () => onFeatured(product, "rejected") },
    ] : []),
  ];
  return <RowActions label="Product actions" disabled={busy} items={items} />;
}

function FeaturedStatus({ status }: { status: string }) { const label = status === "pending" ? "Featured pending" : status === "approved" ? "Featured approved" : status === "rejected" ? "Featured rejected" : "Not requested"; return <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${status === "approved" ? "bg-emerald-50 text-emerald-700" : status === "pending" ? "bg-orange-50 text-orange-700" : status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>{label}</span>; }

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
