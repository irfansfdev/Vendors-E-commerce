import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { getSellerContext } from "@/lib/seller";
import { publicStorageUrl } from "@/lib/media";
import { ShopMediaPicker } from "@/components/shop-media-picker";

export const metadata: Metadata = { title: "Settings | Seller" };
export const dynamic = "force-dynamic";

export default async function SellerSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { shop } = await getSellerContext();
  const { error } = await searchParams;
  async function saveSettings(formData: FormData) {
    "use server";
    const { supabase: client, shop: currentShop } = await getSellerContext();
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (name.length < 2 || !description) return;
    const updates: Record<string, string> = { name, description };
    for (const field of ["logo", "banner"] as const) {
      const file = formData.get(field);
      if (!file || typeof file === "string" || file.size === 0) continue;
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        redirect(`/seller/settings?error=${encodeURIComponent(`${field === "logo" ? "Shop logo" : "Shop banner"} must be an image smaller than 5 MB.`)}`);
      }
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${currentShop.id}/${field}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const upload = await client.storage
        .from("shop-assets")
        .upload(path, bytes, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upload.error) {
        redirect(`/seller/settings?error=${encodeURIComponent(`${field === "logo" ? "Shop logo" : "Shop banner"} upload failed: ${upload.error.message}`)}`);
      }
      const publicUrl = publicStorageUrl("shop-assets", client.storage
        .from("shop-assets")
        .getPublicUrl(path).data.publicUrl);
      const stored = await fetch(publicUrl, { cache: "no-store" });
      updates[`${field}_url`] = stored.ok
        ? publicUrl
        : `data:${file.type || "image/jpeg"};base64,${bytes.toString("base64")}`;
    }
    const { error: updateError } = await client
      .from("shops")
      .update(updates)
      .eq("id", currentShop.id);
    if (updateError) {
      redirect(`/seller/settings?error=${encodeURIComponent(`Settings could not be saved: ${updateError.message}`)}`);
    }
    redirect("/seller?settings=saved");
  }
  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/seller"
        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-500"
      >
        <ChevronLeft className="size-4" /> Dashboard
      </Link>
      <div className="mb-8 mt-5">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">
          Shop configuration
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.055em]">
          Settings
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Keep your public shop information up to date.
        </p>
      </div>
      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <form
        action={saveSettings}
        className="surface space-y-5 p-6 sm:p-8"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5 dark:border-white/10">
          <span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
            <Settings className="size-5" />
          </span>
          <div>
            <h2 className="font-black">Public shop details</h2>
            <p className="text-xs text-slate-500">
              These details appear on your storefront.
            </p>
          </div>
        </div>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Shop name</span>
          <input
            name="name"
            required
            defaultValue={String(shop.name ?? "")}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Description</span>
          <textarea
            name="description"
            required
            defaultValue={String(shop.description ?? "")}
            className="field min-h-32 resize-y"
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-bold">Shop logo</span>
            <ShopMediaPicker
              name="logo"
              currentUrl={publicStorageUrl("shop-assets", shop.logo_url)}
              alt="Shop logo"
              inputClassName="field p-2 text-xs"
              previewClassName="mb-3 size-24 rounded-xl object-cover"
              fallbackClassName="mb-3 grid size-24 place-items-center rounded-xl bg-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold">Shop banner</span>
            <ShopMediaPicker
              name="banner"
              currentUrl={publicStorageUrl("shop-assets", shop.banner_url)}
              alt="Shop banner"
              inputClassName="field p-2 text-xs"
              previewClassName="mb-3 h-24 w-full rounded-xl object-cover"
              fallbackClassName="mb-3 grid h-24 w-full place-items-center rounded-xl bg-slate-100"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button className="button-primary bg-orange-500 hover:bg-orange-600">
            Save settings
          </button>
        </div>
      </form>
    </main>
  );
}
