"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { CartLine, Product, ProductVariant } from "@/lib/types";

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (product: Product, variant?: ProductVariant, quantity?: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within Providers");
  return value;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [cartOwner, setCartOwner] = useState("guest");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  function storageKey(owner: string) {
    return `vendra-cart:${owner}`;
  }

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    function readCart(owner: string) {
      try {
        return JSON.parse(localStorage.getItem(storageKey(owner)) ?? "[]") as CartLine[];
      } catch {
        localStorage.removeItem(storageKey(owner));
        return [];
      }
    }

    async function loadCart(userId?: string) {
      const owner = userId ? `user:${userId}` : "guest";
      if (!active) return;
      setCartOwner(owner);
      setLines(readCart(owner));
      setReady(true);
    }

    void supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => loadCart(data.user?.id));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      void loadCart(session?.user.id);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [pathname]);

  useEffect(() => {
    if (ready) localStorage.setItem(storageKey(cartOwner), JSON.stringify(lines));
  }, [cartOwner, lines, ready]);

  useEffect(() => {
    const theme = localStorage.getItem("vendra-theme");
    if (theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("storefront-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_variants" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "cart_items" }, () => router.refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as { title?: string; body?: string };
        toast.info(row.title ?? "New notification", { description: row.body });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const addItem = useCallback((product: Product, variant?: ProductVariant, quantity = 1) => {
    const lineId = `${product.id}:${variant?.id ?? "default"}`;
    setLines((current) => {
      const existing = current.find((line) => line.lineId === lineId);
      if (existing) {
        return current.map((line) =>
          line.lineId === lineId
            ? { ...line, quantity: Math.min(line.quantity + quantity, variant?.stock ?? product.stock) }
            : line,
        );
      }
      return [...current, { lineId, product, variant, quantity }];
    });
    toast.success("Added to cart", { description: `${product.name} is ready for checkout.` });
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setLines((current) => current.filter((line) => line.lineId !== lineId));
    toast.success("Item removed");
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    if (quantity < 1) return;
    setLines((current) =>
      current.map((line) =>
        line.lineId === lineId
          ? { ...line, quantity: Math.min(quantity, line.variant?.stock ?? line.product.stock) }
          : line,
      ),
    );
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    localStorage.removeItem(storageKey(cartOwner));
  }, [cartOwner]);
  const value = useMemo(
    () => ({
      lines,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      subtotal: lines.reduce(
        (total, line) => total + (line.variant?.price ?? line.product.price) * line.quantity,
        0,
      ),
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [lines, addItem, removeItem, updateQuantity, clearCart],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <Toaster richColors closeButton position="bottom-right" />
    </CartContext.Provider>
  );
}
