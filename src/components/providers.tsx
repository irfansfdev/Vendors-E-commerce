"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
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
  const [lines, setLines] = useState<CartLine[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("vendra-cart") ?? "[]") as CartLine[];
    } catch {
      localStorage.removeItem("vendra-cart");
      return [];
    }
  });
  const [ready] = useState(true);

  useEffect(() => {
    if (ready) localStorage.setItem("vendra-cart", JSON.stringify(lines));
  }, [lines, ready]);

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
        const row = payload.new as { title?: string; message?: string };
        toast.info(row.title ?? "New notification", { description: row.message });
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

  const clearCart = useCallback(() => setLines([]), []);
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
