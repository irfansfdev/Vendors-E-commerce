import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Benefits,
  ProductGrid,
  SectionHeading,
  ShopGrid,
} from "@/components/storefront-sections";
import { PremiumHero } from "@/components/premium-hero";
import { getStorefrontData } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { products, shops, isLive } = await getStorefrontData();

  return (
    <main>
      <PremiumHero products={products.slice(0, 3)} />
      <div className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 sm:pt-7 lg:px-8">
        <div className="mt-5">
          <Benefits />
        </div>

        <section className="pt-8 pb-16">
          <SectionHeading
            eyebrow="Picked for you"
            title="A few good things"
            href="/search"
            linkLabel="View all products"
          />
          {products.length > 0 ? (
            <ProductGrid products={products.slice(0, 4)} />
          ) : (
            <div className="surface grid min-h-48 place-items-center p-8 text-center">
              <div>
                <p className="font-extrabold">Products are arriving soon</p>
                <p className="mt-2 text-sm text-slate-500">
                  Independent sellers are preparing their next collection.
                </p>
              </div>
            </div>
          )}
        </section>

        {products.some((product) => product.badge) && (
          <section className="pb-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-rose-500">
                  Featured products
                </div>
                <h2 className="text-2xl font-extrabold tracking-[-.045em] text-slate-950 dark:text-white sm:text-3xl">
                  Deals worth a look
                </h2>
              </div>
              <Link
                href="/search?deal=true"
                className="flex items-center gap-1 text-xs font-bold hover:text-orange-500"
              >
                See all <ArrowRight className="size-4" />
              </Link>
            </div>
            <ProductGrid
              products={products.filter((product) => product.badge).slice(0, 5)}
            />
          </section>
        )}

        <section className="pb-16">
          <SectionHeading eyebrow="Freshly listed" title="New to BabulShop" />
          <ProductGrid products={products.slice(3, 8)} />
        </section>

        {shops.length > 0 && (
          <section className="pb-16">
            <SectionHeading
              eyebrow="Shop small, find big"
              title="Meet our top shops"
              href="/search?view=shops"
              linkLabel="Explore shops"
            />
            <ShopGrid shops={shops} />
          </section>
        )}
      </div>

      <section className="bg-[#102a2a] text-white">
        <div className="mx-auto grid max-w-[1440px] items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 lg:px-8 lg:py-16">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-orange-300">
              The good inbox
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-.05em] sm:text-4xl">
              New finds, minus the noise.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Weekly edits, maker stories, and first access to limited drops.
            </p>
          </div>
          <Link
            href="/signup"
            className="button-primary w-fit bg-orange-500 hover:bg-orange-600"
          >
            Create an account <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {!isLive && (
        <div className="mx-auto max-w-[1440px] px-4 pb-6 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          Catalog data is currently unavailable.
        </div>
      )}
    </main>
  );
}
