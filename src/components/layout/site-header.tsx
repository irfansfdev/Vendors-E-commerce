"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Moon,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Sun,
  Truck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useCart } from "@/components/providers";
import { NotificationBell } from "@/components/notification-bell";
import { signoutAction } from "@/app/auth/actions";

type HeaderUser = {
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  isSeller?: boolean;
  isRider?: boolean;
};

type HeaderProps = {
  user: HeaderUser | null;
};

const ANNOUNCEMENT = {
  text: "Weekend drop: up to 30% off independent brands",
  href: "/search?deal=true",
  cta: "Shop now",
};

const NAV_LINKS = [
  { href: "/search", label: "Products" },
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500";

function getInitials(user: HeaderUser) {
  const source = (user.name || user.email || "?").trim();
  const parts = source.split(/\s+/);
  const letters =
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

function UserAvatar({
  user,
  className,
}: {
  user: HeaderUser;
  className: string;
}) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#102a2a] font-bold text-white dark:bg-orange-500 ${className}`}>
      {user.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt=""
          width={40}
          height={40}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        getInitials(user)
      )}
    </span>
  );
}

function getPortals(user: HeaderUser | null) {
  const portals: { href: string; label: string; icon: LucideIcon }[] = [];
  if (!user) return portals;
  if (user.isAdmin)
    portals.push({ href: "/admin", label: "Admin panel", icon: ShieldCheck });
  if (user.isSeller)
    portals.push({ href: "/seller", label: "Seller dashboard", icon: Store });
  if (user.isRider)
    portals.push({ href: "/rider", label: "Delivery desk", icon: Truck });
  return portals;
}

function toggleTheme() {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("vendra-theme", next ? "dark" : "light");
  } catch {
    /* storage unavailable */
  }
}

function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <form onSubmit={submit} role="search" className="group relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-orange-500" />
      <input
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Search BabulShop"
        className="h-11 w-full rounded-full bg-slate-100 pl-11 pr-4 text-sm text-slate-900 outline-none ring-1 ring-transparent transition placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-orange-500/60 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400 dark:focus:bg-white/15"
      />
    </form>
  );
}

function ThemeIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <>
      <Moon className={`${className} dark:hidden`} />
      <Sun className={`${className} hidden dark:block`} />
    </>
  );
}

export function SiteHeader({ user }: HeaderProps) {
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const portals = getPortals(user);
  const mainPortal = portals.find((p) => p.href === "/admin") ??
    portals.find((p) => p.href === "/rider") ??
    portals.find((p) => p.href === "/seller") ?? {
      href: "/seller",
      label: "Sell on BabulShop",
      icon: Store,
    };
  const MainPortalIcon = mainPortal.icon;

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const iconButton = `relative grid size-11 shrink-0 place-items-center rounded-full text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 ${focusRing}`;

  return (
    <>
      {/* Announcement */}
      <div className="bg-[#102a2a] px-4 py-2 text-center text-xs text-white/90">
        {ANNOUNCEMENT.text}
        <Link
          href={ANNOUNCEMENT.href}
          className="ml-2 font-semibold text-orange-300 underline decoration-orange-300/40 underline-offset-2 hover:decoration-orange-300"
        >
          {ANNOUNCEMENT.cta}
        </Link>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
        {/* Main row */}
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:gap-8 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`${iconButton} md:hidden`}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
            <Menu className="size-5" />
          </button>

          <Logo className="min-w-0 shrink-0" />

          <div className="mx-auto hidden w-full max-w-xl md:block">
            <SearchBox placeholder="Search products, shops and categories" />
          </div>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {user && <NotificationBell />}

            <Link href="/cart" className={iconButton} aria-label="Cart">
              <ShoppingCart className="size-5" />
              {itemCount > 0 && (
                <span className="absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-white dark:ring-slate-950">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="relative hidden md:block" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label="Account menu"
                  className={`flex h-11 items-center gap-1 rounded-full pl-1 pr-1.5 transition hover:bg-slate-100 dark:hover:bg-white/10 ${focusRing}`}
                >
                  <UserAvatar user={user} className="size-9 text-xs" />
                  <ChevronDown
                    className={`hidden size-4 text-slate-500 transition-transform sm:block ${accountOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900"
                  >
                    <div className="px-3 pb-3 pt-2">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                        {user.name || "My account"}
                      </p>
                      {user.email && (
                        <p className="truncate text-xs text-slate-500">
                          {user.email}
                        </p>
                      )}
                    </div>

                    <MenuLink href="/account" icon={UserRound} onNavigate={() => setAccountOpen(false)}>
                      My account
                    </MenuLink>
                    <MenuLink href="/account/orders" icon={Package} onNavigate={() => setAccountOpen(false)}>
                      My orders
                    </MenuLink>
                    <MenuLink href="/account/returns" icon={RotateCcw} onNavigate={() => setAccountOpen(false)}>
                      My returns
                    </MenuLink>
                    <MenuLink href="/wishlist" icon={Heart} onNavigate={() => setAccountOpen(false)}>
                      Wishlist
                    </MenuLink>

                    {portals.length > 0 && (
                      <>
                        <div className="my-2 h-px bg-slate-100 dark:bg-white/10" />
                        {portals.map((portal) => (
                          <MenuLink
                            key={portal.href}
                            href={portal.href}
                            icon={portal.icon}
                            onNavigate={() => setAccountOpen(false)}
                          >
                            {portal.label}
                          </MenuLink>
                        ))}
                      </>
                    )}

                    <div className="my-2 h-px bg-slate-100 dark:bg-white/10" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={toggleTheme}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5 ${focusRing}`}
                    >
                      <ThemeIcon className="size-4" />
                      <span className="dark:hidden">Dark mode</span>
                      <span className="hidden dark:inline">Light mode</span>
                    </button>

                    <form action={signoutAction}>
                      <button
                        type="submit"
                        role="menuitem"
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-400 ${focusRing}`}
                      >
                        <LogOut className="size-4" />
                        Sign out
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`${iconButton} hidden md:grid`}
                  aria-label="Toggle dark mode"
                >
                  <ThemeIcon />
                </button>
                <Link
                  href="/login"
                  className={`ml-1 inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-orange-500 dark:bg-white dark:text-slate-950 dark:hover:bg-orange-400 ${focusRing}`}
                >
                  <UserRound className="size-4 sm:hidden" />
                  <span className="hidden sm:inline">Sign in</span>
                  <span className="sm:hidden">Sign in</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile search */}
        <div className="px-3 pb-3 md:hidden">
          <SearchBox placeholder="Search BabulShop" />
        </div>

        {/* Desktop secondary nav */}
        <nav
          aria-label="Main"
          className="hidden border-t border-slate-100 md:block dark:border-white/5"
        >
          <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-7 px-8 text-[13px] font-medium text-slate-600 dark:text-slate-300">
            <Link
              href="/"
              className={`transition hover:text-slate-950 dark:hover:text-white ${focusRing}`}
            >
              Home
            </Link>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition hover:text-slate-950 dark:hover:text-white ${focusRing}`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={mainPortal.href}
              className={`ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-800 transition hover:border-orange-400 hover:text-orange-600 dark:border-white/15 dark:text-slate-100 dark:hover:border-orange-400 dark:hover:text-orange-300 ${focusRing}`}
            >
              <MainPortalIcon className="size-3.5" />
              {mainPortal.label}
            </Link>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${menuOpen ? "visible" : "invisible"}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity ${menuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
          tabIndex={menuOpen ? 0 : -1}
        />
        <aside
          id="mobile-navigation"
          className={`absolute inset-y-0 left-0 flex w-[min(88vw,340px)] flex-col overflow-y-auto bg-white p-5 shadow-2xl transition-transform duration-300 dark:bg-slate-950 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between">
            <Logo />
            <button
              type="button"
              className={iconButton}
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            {user ? (
              <div className="flex items-center gap-3">
                <UserAvatar user={user} className="size-10 text-sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {user.name || "My account"}
                  </p>
                  {user.email && (
                    <p className="truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold">Welcome to BabulShop</p>
                <p className="mt-1 text-xs text-slate-500">
                  Sign in to track orders and save your favourites.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex-1 rounded-full bg-slate-950 py-2.5 text-center text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMenuOpen(false)}
                    className="flex-1 rounded-full border border-slate-300 py-2.5 text-center text-sm font-semibold dark:border-white/20"
                  >
                    Sign up
                  </Link>
                </div>
              </>
            )}
          </div>

          <p className="mt-6 text-xs font-semibold text-slate-400">Browse</p>
          <div className="mt-1 grid">
            <DrawerLink href="/" onNavigate={() => setMenuOpen(false)}>
              Home
            </DrawerLink>
            {NAV_LINKS.map((link) => (
              <DrawerLink
                key={link.href}
                href={link.href}
                onNavigate={() => setMenuOpen(false)}
              >
                {link.label}
              </DrawerLink>
            ))}
          </div>

          <p className="mt-6 text-xs font-semibold text-slate-400">You</p>
          <div className="mt-1 grid">
            {user && (
              <>
                <DrawerLink href="/account" onNavigate={() => setMenuOpen(false)}>
                  My account
                </DrawerLink>
                <DrawerLink href="/account/orders" onNavigate={() => setMenuOpen(false)}>
                  My orders
                </DrawerLink>
                <DrawerLink href="/account/returns" onNavigate={() => setMenuOpen(false)}>
                  My returns
                </DrawerLink>
              </>
            )}
            <DrawerLink href="/wishlist" onNavigate={() => setMenuOpen(false)}>
              Wishlist
            </DrawerLink>
            {portals.map((portal) => (
              <DrawerLink
                key={portal.href}
                href={portal.href}
                onNavigate={() => setMenuOpen(false)}
                accent
              >
                {portal.label}
              </DrawerLink>
            ))}
            {!user?.isSeller && !user?.isAdmin && (
              <DrawerLink href="/seller" onNavigate={() => setMenuOpen(false)} accent>
                Start selling
              </DrawerLink>
            )}
            {!user?.isRider && !user?.isAdmin && (
              <DrawerLink href="/rider/apply" onNavigate={() => setMenuOpen(false)} accent>
                Become a rider
              </DrawerLink>
            )}
          </div>

          <div className="mt-auto grid gap-2 pt-8">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium dark:border-white/10"
            >
              <span className="dark:hidden">Dark mode</span>
              <span className="hidden dark:inline">Light mode</span>
              <ThemeIcon className="size-4" />
            </button>
            {user && (
              <form action={signoutAction} onSubmit={() => setMenuOpen(false)}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5 ${focusRing}`}
    >
      <Icon className="size-4 text-slate-400" />
      {children}
    </Link>
  );
}

function DrawerLink({
  href,
  children,
  onNavigate,
  accent = false,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`border-b border-slate-100 py-3.5 text-[15px] font-medium last:border-0 dark:border-white/10 ${accent ? "text-orange-600 dark:text-orange-400" : "text-slate-900 dark:text-white"}`}
    >
      {children}
    </Link>
  );
}