import Link from "next/link";
import { ProductCard } from "@/components/catalog/product-card";
import { PremiumHero } from "@/components/home/premium-hero";
import { SellDeliverStrip } from "@/components/home/home-utilities";
import { TrendingProducts } from "@/components/home/trending-products";
import { BenefitsBar, CategoryGrid, SectionHeading, ShopGrid } from "@/components/shared/storefront-sections";
import { DEFAULT_FREE_DELIVERY_THRESHOLD } from "@/lib/pricing/config";
import { DEFAULT_RETURN_WINDOW_DAYS } from "@/lib/returns/config";
import { getAvailablePortals } from "@/lib/portal";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getStorefrontData } from "@/lib/storefront";

export const dynamic = "force-dynamic";

function settingNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function getFreeDeliveryThreshold() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "pricing.free_delivery_threshold")
      .maybeSingle();
    if (error) {
      console.warn("Could not load free-delivery threshold; using the configured default:", error.message);
      return DEFAULT_FREE_DELIVERY_THRESHOLD;
    }
    return settingNumber(data?.value, DEFAULT_FREE_DELIVERY_THRESHOLD);
  } catch (error) {
    console.warn("Could not load free-delivery threshold; using the configured default:", error);
    return DEFAULT_FREE_DELIVERY_THRESHOLD;
  }
}

export default async function HomePage() {
  const [{ products, categories, shops, isLive }, user] = await Promise.all([
    getStorefrontData(),
    getCurrentUser(),
  ]);

  const [freeDeliveryThreshold, portals] = await Promise.all([
    getFreeDeliveryThreshold(),
    user ? getAvailablePortals(user.id) : Promise.resolve({ isSeller: false, isRider: false }),
  ]);
  const isAdmin = user?.app_metadata?.is_admin === true;

  const popularCategories = [...categories].sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
  const saleProducts = products
    .filter((product) => product.compareAtPrice && product.compareAtPrice > product.price)
    .sort((a, b) => ((b.compareAtPrice ?? b.price) - b.price) - ((a.compareAtPrice ?? a.price) - a.price))
    .slice(0, 4);
  const featuredProducts = products.filter((product) => product.badge === "FEATURED");
  const popularProducts = products
    .filter((product) => product.badge !== "FEATURED")
    .sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount)
    .slice(0, 12);
  const topRatedProducts = products
    .filter((product) => product.rating > 0)
    .sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount)
    .slice(0, 12);
  const discoveryShops = [...shops]
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.productCount - a.productCount || b.rating - a.rating)
    .slice(0, 4);
  const showTrending = popularProducts.length > 0 || topRatedProducts.length > 0;

  return (
    <main className="overflow-hidden">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <PremiumHero products={featuredProducts.slice(0, 5)} />
        <BenefitsBar freeDeliveryThreshold={freeDeliveryThreshold} returnWindowDays={DEFAULT_RETURN_WINDOW_DAYS} />

        {popularCategories.length > 0 && (
          <section className="py-10 lg:py-14">
            <SectionHeading title="Shop by category" href="/search" linkLabel="All categories" />
            <CategoryGrid categories={popularCategories} />
          </section>
        )}

        {saleProducts.length > 0 && (
          <section className="my-2 rounded-2xl bg-[#102a2a] p-5 text-white sm:p-8">
            <div className="grid items-center gap-6 lg:grid-cols-[.7fr_1.8fr] lg:gap-8">
              <div>
                <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-300">Deals</span>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-.03em] sm:text-[28px]">Good finds, better prices.</h2>
                <p className="mt-2 text-sm text-white/70">Limited offers from shops worth knowing.</p>
                <Link href="/search?deal=true" className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-500">
                  See offers
                </Link>
              </div>
              <div className="-mx-5 overflow-x-auto px-5 pb-1 hide-scrollbar sm:mx-0 sm:px-0">
                <div className="grid w-max grid-flow-col snap-x snap-mandatory gap-3 lg:w-full lg:grid-flow-row lg:grid-cols-4">
                  {saleProducts.map((product) => (
                    <div key={product.id} className="w-[160px] snap-start lg:w-auto">
                      <ProductCard product={product} onDark />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {featuredProducts.length > 0 && (
          <section className="py-10 lg:py-14">
            <SectionHeading title="Featured" href="/search" />
            <div className="-mx-4 overflow-x-auto px-4 pb-1 hide-scrollbar sm:mx-0 sm:px-0">
              <div className="grid w-max grid-flow-col snap-x snap-mandatory gap-3 sm:gap-5 lg:w-full lg:grid-flow-row lg:grid-cols-6">
                {featuredProducts.slice(0, 6).map((product) => (
                  <div key={product.id} className="w-[160px] snap-start lg:w-auto">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {showTrending && (
          <TrendingProducts popularProducts={popularProducts} topRatedProducts={topRatedProducts} />
        )}

        {discoveryShops.length > 0 && (
          <section className="py-10 lg:py-14">
            <SectionHeading title="Shops to explore" href="/search?type=shop" linkLabel="Explore all shops" />
            <ShopGrid shops={discoveryShops} compact />
          </section>
        )}

        <SellDeliverStrip
          isSeller={portals.isSeller}
          isAdmin={isAdmin}
          isRider={portals.isRider}
          isLive={isLive}
        />
      </div>
    </main>
  );
}
