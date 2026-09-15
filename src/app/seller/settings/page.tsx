import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { getSellerContext } from "@/lib/seller";

export const metadata: Metadata = { title: "Settings | Seller" };
export const dynamic = "force-dynamic";

export default async function SellerSettingsPage() {
  const { shop } = await getSellerContext();
  async function saveSettings(formData: FormData) {
    "use server";
    const { supabase: client, shop: currentShop } = await getSellerContext();
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (name.length < 2 || !description) return;
    const updates: Record<string, string> = { name, description };
    for (const field of ["logo", "banner"] as const) {
      const file = formData.get(field);
      if (!(file instanceof File) || file.size === 0) continue;
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${currentShop.id}/${field}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const upload = await client.storage
        .from("shop-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upload.error) return;
      updates[`${field}_url`] = client.storage
        .from("shop-assets")
        .getPublicUrl(path).data.publicUrl;
    }
    await client.from("shops").update(updates).eq("id", currentShop.id);
    redirect("/seller/settings");
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
      <form
        action={saveSettings}
        encType="multipart/form-data"
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
            {typeof shop.logo_url === "string" && shop.logo_url && (
              <Image
                src={shop.logo_url}
                alt="Current shop logo"
                width={96}
                height={96}
                unoptimized
                className="mb-3 size-24 rounded-xl object-cover"
              />
            )}
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="field p-2 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold">Shop banner</span>
            {typeof shop.banner_url === "string" && shop.banner_url && (
              <Image
                src={shop.banner_url}
                alt="Current shop banner"
                width={800}
                height={128}
                unoptimized
                className="mb-3 h-24 w-full rounded-xl object-cover"
              />
            )}
            <input
              name="banner"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="field p-2 text-xs"
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
