"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  Heart,
  ImageOff,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/providers";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [image, setImage] = useState(product.images[0] ?? "");
  const [imageFailed, setImageFailed] = useState(false);
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >(() => {
    const firstVariant = product.variants[0];
    return firstVariant
      ? Object.fromEntries(Object.entries(firstVariant.attributes))
      : {};
  });
  const [quantity, setQuantity] = useState(1);
  const [saved, setSaved] = useState(false);
  const groups = useMemo(
    () =>
      Object.entries(
        product.variants.reduce<Record<string, string[]>>((result, variant) => {
          Object.entries(variant.attributes).forEach(([key, value]) => {
            result[key] ??= [];
            if (!result[key].includes(value)) result[key].push(value);
          });
          return result;
        }, {}),
      ),
    [product.variants],
  );
  const variant = useMemo(
    () =>
      product.variants.find((item) =>
        Object.entries(selectedAttributes).every(
          ([key, value]) => item.attributes[key] === value,
        ),
      ),
    [product.variants, selectedAttributes],
  );
  const hasVariants = product.variants.length > 0;
  const stock = variant?.stock ?? product.stock;
  const price = variant?.price ?? product.price;
  const selectedComplete =
    !hasVariants || groups.every(([key]) => selectedAttributes[key]);

  return (
    <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] lg:items-start">
      <section className="min-w-0 lg:sticky lg:top-24">
        <div className="space-y-4">
          <div className="relative aspect-square w-full max-w-[680px] overflow-hidden rounded-4xl bg-slate-100 shadow-sm dark:bg-white/5">
            {image && !imageFailed ? (
              <img
                src={image}
                alt={product.name}
                className="absolute inset-0 size-full object-cover"
                onError={() => {
                  const currentIndex = product.images.indexOf(image);
                  const nextImage = product.images.find(
                    (item, index) => index > currentIndex && item !== image,
                  );
                  if (nextImage) {
                    setImage(nextImage);
                    setImageFailed(false);
                  } else {
                    setImageFailed(true);
                  }
                }}
              />
            ) : (
              <div className="grid size-full place-items-center text-slate-400">
                <ImageOff className="size-12" />
              </div>
            )}
            {product.badge && (
              <span className="absolute left-5 top-5 rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-white">
                {product.badge}
              </span>
            )}
          </div>
          <div className="flex max-w-[680px] gap-3 overflow-x-auto pb-1">
            {product.images.map((item, index) => (
              <button
                type="button"
                key={`${item}-${index}`}
                onClick={() => {
                  setImage(item);
                  setImageFailed(false);
                }}
                className={`relative aspect-square size-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white transition ${image === item ? "border-orange-500 shadow-md" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                <img
                  src={item}
                  alt={`${product.name} view ${index + 1}`}
                  className="absolute inset-0 size-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="min-w-0 lg:pt-2">
        <Link
          href={`/shop/${product.shop.slug}`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-slate-500 hover:text-orange-500"
        >
          {product.shop.name}
          <BadgeCheck className="size-4 fill-sky-500 text-white" />
        </Link>
        <h1 className="mt-4 max-w-xl text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">
          {product.name}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1 font-bold">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            {product.rating || "New"}
          </span>
          <a
            href="#reviews"
            className="text-slate-500 underline-offset-4 hover:text-orange-500 hover:underline"
          >
            {product.reviewsCount} verified reviews
          </a>
          <span className="text-slate-300">|</span>
          <span
            className={
              stock > 0
                ? "font-bold text-emerald-600"
                : "font-bold text-rose-600"
            }
          >
            {stock > 0 ? `${stock} in stock` : "Out of stock"}
          </span>
        </div>
        <div className="mt-7 flex items-end gap-3 border-b border-slate-200 pb-6 dark:border-white/10">
          <span className="text-4xl font-black tracking-[-.05em]">
            {formatCurrency(price, product.currency)}
          </span>
          {product.compareAtPrice && (
            <span className="pb-1 text-base text-slate-400 line-through">
              {formatCurrency(product.compareAtPrice, product.currency)}
            </span>
          )}
        </div>
        <p className="mt-6 max-w-xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">
          {product.description}
        </p>
        {groups.length > 0 && (
          <fieldset className="mt-8 space-y-6">
            <legend className="text-sm font-black uppercase tracking-[.12em]">
              Choose options
            </legend>
            {groups.map(([key, values]) => (
              <div key={key}>
                <p className="mb-2 text-xs font-bold text-slate-500">{key}</p>
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => {
                    const matching = product.variants.find(
                      (item) =>
                        item.attributes[key] === value &&
                        Object.entries(selectedAttributes).every(
                          ([otherKey, otherValue]) =>
                            otherKey === key ||
                            item.attributes[otherKey] === otherValue,
                        ),
                    );
                    const selected = selectedAttributes[key] === value;
                    return (
                      <button
                        type="button"
                        key={value}
                        disabled={!matching || matching.stock < 1}
                        onClick={() => {
                          setSelectedAttributes((current) => ({
                            ...current,
                            [key]: value,
                          }));
                          setQuantity(1);
                        }}
                        className={`relative rounded-xl border px-4 py-3 text-sm font-bold transition ${selected ? "border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-500/10 dark:bg-orange-500/10 dark:text-orange-300" : "border-slate-200 bg-white hover:border-slate-400 dark:border-white/10 dark:bg-white/5"} disabled:cursor-not-allowed disabled:opacity-35`}
                      >
                        {value}
                        {selected && (
                          <Check className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-orange-500 p-0.5 text-white" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {hasVariants && selectedComplete && !variant && (
              <p className="text-sm font-bold text-rose-600">
                This combination is unavailable.
              </p>
            )}
          </fieldset>
        )}
        {variant && (
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs dark:bg-white/5">
            <span>
              <b>SKU</b> {variant.sku}
            </span>
            <span>
              <b>Availability</b>{" "}
              {variant.stock > 0 ? "In stock" : "Out of stock"}
            </span>
          </div>
        )}
        <div className="mt-8 flex gap-3">
          <div className="flex h-13 items-center rounded-xl border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="grid h-full w-10 place-items-center"
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(stock, value + 1))}
              className="grid h-full w-10 place-items-center"
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              addItem(product, hasVariants ? variant : undefined, quantity)
            }
            disabled={
              stock < 1 || !selectedComplete || (hasVariants && !variant)
            }
            className="button-primary flex-1 bg-orange-500 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingBag className="size-[18px]" /> Add to cart
          </button>
          <button
            type="button"
            onClick={() => {
              setSaved((value) => !value);
              toast.success(
                saved ? "Removed from wishlist" : "Saved to wishlist",
              );
            }}
            className={`icon-button h-13 w-13 border border-slate-200 dark:border-white/10 ${saved ? "text-rose-500" : ""}`}
            aria-label="Save to wishlist"
          >
            <Heart className={`size-5 ${saved ? "fill-current" : ""}`} />
          </button>
        </div>
        <div className="mt-8 grid gap-3 border-y border-slate-200 py-5 text-xs dark:border-white/10 sm:grid-cols-3">
          {[
            {
              icon: Truck,
              title: "Free delivery",
              text: "On orders over Rs 5,000",
            },
            {
              icon: ShieldCheck,
              title: "Buyer protection",
              text: "Secure checkout",
            },
            {
              icon: PackageCheck,
              title: "Easy returns",
              text: "30-day return window",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-2">
              <Icon className="size-5 shrink-0 text-orange-500" />
              <span>
                <b className="block">{title}</b>
                <small className="text-slate-500">{text}</small>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 text-sm text-slate-500">
          <span className="font-bold text-slate-900 dark:text-white">
            Categories:
          </span>{" "}
          {(product.categories?.length
            ? product.categories
            : [product.category]
          )
            .map((category) => category.name)
            .join(", ")}
        </div>
      </section>
    </div>
  );
}
