"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ShieldCheck,
  Heart,
  LogOut,
  Menu,
  Moon,
  Search,
  ShoppingCart,
  Store,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useCart } from "@/components/providers";
import { signoutAction } from "@/app/auth/actions";
import type { Category } from "@/lib/types";

type HeaderProps = {
  categories: Category[];
  user: { email?: string | null; name?: string | null; isAdmin?: boolean; isSeller?: boolean } | null;
};

export function SiteHeader({ categories, user }: HeaderProps) {
  const router = useRouter();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("all");

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("vendra-theme", next ? "dark" : "light");
    setDark(next);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (searchType !== "all") params.set("type", searchType);
    router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <>
      <div className="bg-slate-950 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-white sm:text-xs">
        <span className="text-orange-300">Weekend drop:</span> Up to 30% off
        independent brands
        <Link
          href="/search?deal=true"
          className="ml-2 underline decoration-white/40 underline-offset-2 hover:decoration-white"
        >
          Shop now
        </Link>
      </div>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
          <button
  type="button"
  onClick={() => setMenuOpen(true)}
  className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 md:hidden!"
  aria-label="Open navigation menu"
  aria-expanded={menuOpen}
  aria-controls="mobile-navigation"
>
  <Menu className="size-5" />
</button>
          <Logo />

          <form
            onSubmit={submitSearch}
            className="relative mx-auto hidden max-w-2xl flex-1 md:block"
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, shops, and categories"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-40 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/10"
              aria-label="Search marketplace"
            />
            <div className="absolute right-0 top-0 flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-800">
              <select
                value={searchType}
                onChange={(event) => setSearchType(event.target.value)}
                aria-label="Search type"
                className="h-full border-0 bg-transparent px-3 text-xs font-bold outline-none"
              >
                <option value="all">Everything</option>
                <option value="product">Products</option>
                <option value="shop">Shops</option>
                <option value="category">Categories</option>
              </select>
              <button
                type="submit"
                className="h-full bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                Search
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-button grid shrink-0 border border-slate-200 dark:border-white/10"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={dark}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? (
                <Sun className="size-[18px]" />
              ) : (
                <Moon className="size-[18px]" />
              )}
            </button>
            <Link
              href="/wishlist"
              className="icon-button hidden sm:grid"
              aria-label="Wishlist"
            >
              <Heart className="size-[19px]" />
            </Link>
            <Link href="/cart" className="header-action relative">
              <span className="relative">
                <ShoppingCart className="size-5" />
                {itemCount > 0 && (
                  <span className="absolute -right-2.5 -top-2.5 grid min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[9px] font-bold leading-4 text-white">
                    {itemCount}
                  </span>
                )}
              </span>
              <span className="hidden xl:block">
                <small>Your cart</small>Cart
              </span>
            </Link>
            {user ? (
              <>
                <Link href="/account" className="header-action">
                  <UserRound className="size-[19px]" />
                  <span className="hidden lg:block max-w-28 truncate">
                    <small>Welcome back</small>
                    {user.name || "My account"}
                  </span>
                </Link>
                <form action={signoutAction}>
                  <button
                    type="submit"
                    className="hidden h-11 items-center gap-2 rounded-xl bg-orange-500 px-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-orange-600 sm:flex"
                    title="Sign out"
                  >
                    <LogOut className="size-4" />
                    <span className="hidden xl:inline">Sign out</span>
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login" className="header-action">
                <UserRound className="size-[19px]" />
                <span className="hidden xl:block">
                  <small>Sign in</small>Account
                </span>
              </Link>
            )}
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <form onSubmit={submitSearch} className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search BabulShop"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-36 text-sm outline-none focus:border-orange-400 dark:border-white/10 dark:bg-white/5"
            />
            <div className="absolute right-0 top-0 flex h-11 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-800">
              <select
                value={searchType}
                onChange={(event) => setSearchType(event.target.value)}
                aria-label="Search type"
                className="h-full border-0 bg-transparent px-2 text-[10px] font-bold outline-none"
              >
                <option value="all">All</option>
                <option value="product">Products</option>
                <option value="shop">Shops</option>
                <option value="category">Categories</option>
              </select>
              <button
                type="submit"
                className="h-full bg-slate-950 px-3 text-[11px] font-bold text-white dark:bg-orange-500"
              >
                Search
              </button>
            </div>
          </form>
        </div>
        <nav className="hidden border-t border-slate-100 dark:border-white/5 max-md:hidden md:block">
          <div className="mx-auto flex h-11 max-w-[1440px] items-center gap-7 px-8 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            <Link href="/" className="flex items-center gap-1 text-slate-950 transition hover:text-orange-500 dark:text-white">
              Home
            </Link>
            <Link
              href="/search"
              className="flex items-center gap-1 text-slate-950 dark:text-white"
            >
              Categories <ChevronDown className="size-3" />
            </Link>
            {categories.slice(0, 6).map((category) => (
              <Link
                key={category.id}
                href={`/search?category=${category.slug}`}
                className="transition hover:text-orange-500"
              >
                {category.name}
              </Link>
            ))}
            <Link href="/search?deal=true" className="text-rose-600">
              Today&apos;s deals
            </Link>
            {user?.isAdmin ? (
              <Link
                href="/admin"
                className="ml-auto flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-orange-600"
                title="Open admin panel"
              >
                <ShieldCheck className="size-4" /> Admin panel
              </Link>
            ) : user?.isSeller ? (
              <Link
                href="/seller"
                className="ml-auto flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-extrabold text-orange-700 shadow-sm transition hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300"
                title="Open seller dashboard"
              >
                <Store className="size-4" /> Seller dashboard
              </Link>
            ) : (
              <Link href="/seller" className="ml-auto flex items-center gap-2 text-slate-950 hover:text-orange-500 dark:text-white">
                <Store className="size-4" /> Sell on BabulShop
              </Link>
            )}
          </div>
        </nav>
      </header>

      <div
        className={`fixed inset-0 z-50 transition max-md:block md:hidden ${menuOpen ? "visible" : "invisible"}`}
        aria-hidden={!menuOpen}
      >
        <button
          className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity ${menuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
        <aside
          id="mobile-navigation"
            className={`absolute inset-y-0 left-0 w-[min(88vw,360px)] overflow-y-auto bg-white p-6 shadow-2xl transition-transform duration-300 dark:bg-slate-950 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between">
            <Logo />
            <button
              className="icon-button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="mt-8 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-xs text-slate-500">
              {user ? user.email : "Welcome to BabulShop"}
            </p>
            {user ? (
              <>
                {user.isAdmin && (
                  <Link
                    href="/admin"
                    className="mt-4 flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-orange-600"
                    onClick={() => setMenuOpen(false)}
                  >
                    <ShieldCheck className="size-4" /> Open admin panel
                  </Link>
                )}
                {user.isSeller && !user.isAdmin && (
                  <Link href="/seller" className="mt-4 flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-orange-600" onClick={() => setMenuOpen(false)}>
                    <Store className="size-4" /> Open seller dashboard
                  </Link>
                )}
                <Link
                  href="/account"
                  className="mt-1 block font-bold"
                  onClick={() => setMenuOpen(false)}
                >
                  {user.name || "Open your account"}
                </Link>
                <form
                  action={signoutAction}
                  onSubmit={() => setMenuOpen(false)}
                  className="mt-3"
                >
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-xl bg-orange-500 px-3 py-2.5 text-left text-xs font-extrabold text-white hover:bg-orange-600"
                  >
                    <LogOut className="size-4" /> Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="mt-1 block font-bold"
                onClick={() => setMenuOpen(false)}
              >
                Sign in or create account
              </Link>
            )}
          </div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-slate-400">
            Browse
          </p>
          <div className="mt-3 grid">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="border-b border-slate-100 py-3.5 font-semibold text-slate-950 dark:border-white/10 dark:text-white"
            >
              Home
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/search?category=${category.slug}`}
                onClick={() => setMenuOpen(false)}
                className="border-b border-slate-100 py-3.5 font-semibold dark:border-white/10"
              >
                {category.name}
              </Link>
            ))}
            {!user && <Link
              href="/seller"
              onClick={() => setMenuOpen(false)}
              className="py-3.5 font-semibold text-orange-500"
            >
              Start selling
            </Link>}
          </div>
          <button
            onClick={toggleTheme}
            className="mt-8 flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold dark:border-white/10"
          >
            <span>Appearance</span>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </aside>
      </div>
    </>
  );
}
