"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Pause,
  Play,
  Search,
  Store,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { updateShopStatusAction } from "@/app/actions/admin";

type Shop = {
  id: string;
  name: string;
  slug: string;
  status: string;
  owner: string;
  email: string;
  logo: string;
  products: number;
  orders: number;
  sales: number;
};
type Tab = "all" | "pending" | "active" | "suspended";
const pageSize = 8;

export function AdminShopsTable({ shops }: { shops: Shop[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const counts = {
    all: shops.length,
    pending: shops.filter((shop) => shop.status === "pending").length,
    active: shops.filter((shop) => shop.status === "active").length,
    suspended: shops.filter((shop) => shop.status === "suspended").length,
  };
  const filtered = useMemo(
    () =>
      shops.filter(
        (shop) =>
          (tab === "all" || shop.status === tab) &&
          [shop.name, shop.owner, shop.slug]
            .join(" ")
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [shops, tab, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const reset = () => setPage(1);

  async function changeStatus(
    shop: Shop,
    status: "active" | "suspended" | "rejected",
  ) {
    const reason =
      status === "rejected"
        ? window.prompt("Why is this shop request being rejected?")?.trim()
        : undefined;
    if (status === "rejected" && !reason) return;
    if (
      !window.confirm(
        `${status === "active" ? "Approve" : status === "suspended" ? "Suspend" : "Reject"} ${shop.name}?`,
      )
    )
      return;
    setBusy(shop.id);
    const result = await updateShopStatusAction(shop.id, status, reason);
    setBusy(null);
    if (result.success) {
      toast.success(
        status === "active"
          ? "Shop activated"
          : status === "suspended"
            ? "Shop suspended"
            : "Shop request rejected",
      );
      window.location.reload();
    } else toast.error(result.error ?? "Could not update shop.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "active", "suspended"] as Tab[]).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => {
                setTab(item);
                reset();
              }}
              className={`rounded-xl px-3.5 py-2 text-xs font-black capitalize transition ${tab === item ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-orange-500 dark:bg-white/5 dark:ring-white/10"}`}
            >
              {item === "pending" ? "Pending Requests" : item}{" "}
              <span className="ml-1 opacity-60">{counts[item]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              reset();
            }}
            placeholder="Search by shop or owner"
            aria-label="Search shops or owners"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-white/5"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                reset();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}-
          {Math.min(currentPage * pageSize, filtered.length)} of{" "}
          {filtered.length} shops
        </span>
        {query && <span>Filtered results</span>}
      </div>
      <section className="surface overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[.12em] text-slate-400 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-5 py-4">Shop</th>
                <th className="px-5 py-4">Owner</th>
                <th className="px-5 py-4">Products</th>
                <th className="px-5 py-4">Orders</th>
                <th className="px-5 py-4">Sales</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {visible.map((shop) => (
                <ShopRow
                  key={shop.id}
                  shop={shop}
                  busy={busy === shop.id}
                  onStatus={changeStatus}
                  menuKey={`desktop-${shop.id}`}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/10 md:hidden">
          {visible.map((shop) => (
            <div key={shop.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <ShopIdentity shop={shop} />
                <Status status={shop.status} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <Metric label="Products" value={shop.products} />
                <Metric label="Orders" value={shop.orders} />
                <Metric
                  label="Sales"
                  value={`Rs ${shop.sales.toLocaleString()}`}
                />
              </div>
              <div className="mt-5 flex items-center justify-between">
                <Actions
                  shop={shop}
                  busy={busy === shop.id}
                  onStatus={changeStatus}
                  menuKey={`mobile-${shop.id}`}
                  open={openMenu === `mobile-${shop.id}`}
                  setOpenMenu={setOpenMenu}
                />
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500">
            No shops match your search.
          </div>
        )}
      </section>
      {pageCount > 1 && (
        <nav
          className="flex items-center justify-center gap-2"
          aria-label="Shop pagination"
        >
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="icon-button border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(
            (number) => (
              <button
                type="button"
                key={number}
                onClick={() => setPage(number)}
                className={`grid size-9 place-items-center rounded-lg text-xs font-black ${number === currentPage ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-orange-50 hover:text-orange-600"}`}
              >
                {number}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
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

function ShopRow({
  shop,
  busy,
  onStatus,
  menuKey,
  openMenu,
  setOpenMenu,
}: {
  shop: Shop;
  busy: boolean;
  onStatus: (shop: Shop, status: "active" | "suspended" | "rejected") => void;
  menuKey: string;
  openMenu: string | null;
  setOpenMenu: (key: string | null) => void;
}) {
  return (
    <tr className="transition hover:bg-orange-50/40 dark:hover:bg-white/5">
      <td className="px-5 py-4">
        <ShopIdentity shop={shop} />
      </td>
      <td className="px-5 py-4">
        <p className="text-sm font-bold">{shop.owner}</p>
        <p className="text-xs text-slate-400">
          Requested{" "}
          {shop.email ? new Date(shop.email).toLocaleDateString() : "Recently"}
        </p>
      </td>
      <td className="px-5 py-4 text-sm font-bold">{shop.products}</td>
      <td className="px-5 py-4 text-sm font-bold">{shop.orders}</td>
      <td className="px-5 py-4 text-sm font-bold">
        Rs {shop.sales.toLocaleString()}
      </td>
      <td className="px-5 py-4">
        <Status status={shop.status} />
      </td>
      <td className="px-5 py-4 text-right">
        <Actions
          shop={shop}
          busy={busy}
          onStatus={onStatus}
          menuKey={menuKey}
          open={openMenu === menuKey}
          setOpenMenu={setOpenMenu}
        />
      </td>
    </tr>
  );
}
function ShopIdentity({ shop }: { shop: Shop }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="flex min-w-[190px] items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
        {shop.logo && !imageFailed ? (
          <img
            src={shop.logo}
            alt={`${shop.name} logo`}
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Store className="size-5" />
        )}
      </span>
      <div>
        <p className="font-black">{shop.name}</p>
        <p className="text-xs text-slate-400">/{shop.slug}</p>
      </div>
    </div>
  );
}
function Status({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      : status === "pending"
        ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
        : status === "suspended"
          ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] ${tone}`}
    >
      {status}
    </span>
  );
}
function Actions({
  shop,
  busy,
  onStatus,
  menuKey,
  open,
  setOpenMenu,
}: {
  shop: Shop;
  busy: boolean;
  onStatus: (shop: Shop, status: "active" | "suspended" | "rejected") => void;
  menuKey: string;
  open: boolean;
  setOpenMenu: (key: string | null) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 220;
    setPosition({
      top:
        rect.bottom + menuHeight + 8 > window.innerHeight
          ? Math.max(8, rect.top - menuHeight - 8)
          : rect.bottom + 8,
      left: Math.min(window.innerWidth - 208, Math.max(8, rect.right - 192)),
    });
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        !buttonRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      )
        setOpenMenu(null);
    };
    const closeOnScroll = () => setOpenMenu(null);
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open, setOpenMenu]);
  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          style={{ top: position.top, left: position.left }}
          className="fixed z-100 max-h-[min(70vh,320px)] w-48 max-w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl dark:border-white/10 dark:bg-slate-900"
        >
          <Link
            href={`/admin/shops/${shop.id}`}
            onClick={() => setOpenMenu(null)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-orange-50"
          >
            <ExternalLink className="size-3.5" /> View details
          </Link>
          <Link
            href={`/shop/${shop.slug}`}
            target="_blank"
            onClick={() => setOpenMenu(null)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-orange-50"
          >
            <Store className="size-3.5" /> View shop
          </Link>
          <Link
            href={`/admin/shops/${shop.id}/products`}
            onClick={() => setOpenMenu(null)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-orange-50"
          >
            <Store className="size-3.5" /> View products
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              onStatus(
                shop,
                shop.status === "suspended"
                  ? "active"
                  : shop.status === "pending"
                    ? "active"
                    : "suspended",
              );
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-orange-50"
          >
            {shop.status === "suspended" ? (
              <Play className="size-3.5 text-emerald-600" />
            ) : shop.status === "pending" ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Pause className="size-3.5 text-rose-600" />
            )}
            {shop.status === "suspended"
              ? "Activate shop"
              : shop.status === "pending"
                ? "Approve shop"
                : "Suspend shop"}
          </button>
          {shop.status === "pending" && (
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onStatus(shop, "rejected");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
            >
              <X className="size-3.5" /> Reject shop
            </button>
          )}
        </div>,
        document.body,
      )
    : null;
  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        ref={buttonRef}
        onClick={() => setOpenMenu(open ? null : menuKey)}
        className="icon-button border border-slate-200 dark:border-white/10"
        aria-label="Shop actions"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {menu}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
