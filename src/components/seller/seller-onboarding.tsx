"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImageIcon, LoaderCircle, Store, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { createShopRequestAction } from "@/app/seller/actions";

export function SellerOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({ logo: null, banner: null });
  const [previews, setPreviews] = useState<Record<string, string>>({ logo: "", banner: "" });
  const previewsRef = useRef(previews);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  useEffect(() => () => Object.values(previewsRef.current).forEach((preview) => preview && URL.revokeObjectURL(preview)), []);

  function chooseImage(name: "logo" | "banner", file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(`${name === "logo" ? "Shop logo" : "Shop banner"} must be an image file.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(`${name === "logo" ? "Shop logo" : "Shop banner"} must be smaller than 5 MB.`);
      return;
    }
    setError("");
    if (previews[name]) URL.revokeObjectURL(previews[name]);
    setSelectedFiles((current) => ({ ...current, [name]: file }));
    setPreviews((current) => ({ ...current, [name]: URL.createObjectURL(file) }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await createShopRequestAction(form);
      if (!result.success) throw new Error(result.error);
      toast.success("Shop request submitted", { description: "Your request is pending Admin Approval." });
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "We couldn’t create your shop.";
      setError(message || "We couldn’t create your shop.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/5 dark:border-white/10 dark:bg-slate-900 lg:grid-cols-[.8fr_1.2fr]">
        <aside className="bg-[#102a2a] p-7 text-white sm:p-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-orange-500">
            <Store className="size-5" />
          </span>
          <h1 className="mt-8 text-4xl font-black tracking-[-.055em]">Turn your work into a storefront.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Join independent sellers reaching customers who value quality, originality, and a human story.
          </p>
          <div className="mt-10 space-y-5 text-sm">
            {["Powerful product and inventory tools", "One checkout, separate seller fulfillment", "Clear earnings and payout reporting"].map((item, index) => (
              <div key={item} className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-full bg-white/10 text-xs font-black text-orange-300">{index + 1}</span>
                {item}
              </div>
            ))}
          </div>
        </aside>
        <section className="p-6 sm:p-10">
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Seller onboarding</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Create your shop</h2>
          <p className="mt-2 text-sm text-slate-500">You can update all of these details later.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold">Shop name</span>
                <input
                  name="name"
                  required
                  minLength={2}
                  className="field"
                  placeholder="Northstar Goods"
                  onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold">Shop URL</span>
                <div className="flex min-h-[2.9rem] items-center rounded-xl border border-slate-300 bg-white pl-3 text-xs text-slate-400 focus-within:border-orange-400 dark:border-white/10 dark:bg-white/5">
                  <span className="shrink-0 font-medium">BabulShop.com/shop/</span>
                  <input
                    name="slug"
                    required
                    value={slug}
                    onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="min-w-0 flex-1 bg-transparent p-3 text-sm text-slate-950 outline-none dark:text-white"
                    placeholder="my-shop"
                  />
                </div>
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-bold">Description</span>
              <textarea name="description" required rows={4} className="field resize-none" placeholder="Tell shoppers what makes your shop special…" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { name: "logo" as const, title: "Shop logo", text: "Square, at least 400×400", icon: ImageIcon },
                { name: "banner" as const, title: "Shop banner", text: "Wide, at least 1600×600", icon: UploadCloud },
              ].map(({ name, title, text, icon: Icon }) => (
                <label key={name} className="cursor-pointer rounded-2xl border border-dashed border-slate-300 p-5 text-center transition hover:border-orange-400 hover:bg-orange-50/40 dark:border-white/15 dark:hover:bg-orange-500/5">
                  {previews[name] ? <Image src={previews[name]} alt={`${title} preview`} width={320} height={80} unoptimized className="mx-auto h-20 w-full rounded-xl object-cover" /> : <Icon className="mx-auto size-6 text-orange-500" />}
                  <span className="mt-3 block text-xs font-extrabold">{selectedFiles[name]?.name || title}</span>
                  <span className="mt-1 block text-[10px] text-slate-400">{selectedFiles[name] ? `${(selectedFiles[name]!.size / 1024 / 1024).toFixed(1)} MB selected` : text}</span>
                  <input type="file" name={name} accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => chooseImage(name, event.target.files?.[0])} />
                </label>
              ))}
            </div>
            {error && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
            <button disabled={loading} className="button-primary w-full bg-orange-500 hover:bg-orange-600">
              {loading && <LoaderCircle className="size-4 animate-spin" />}
              {loading ? "Building your shop…" : "Create shop"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export function ShopPendingNotice({ shop }: { shop: Record<string, unknown> }) {
  const status = String(shop.status ?? "pending");
  const isRejected = status === "rejected";
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <section className="surface border-orange-200 bg-orange-50/60 p-8 text-center dark:border-orange-500/20 dark:bg-orange-500/5 sm:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-500 text-white"><Store className="size-6" /></span>
        <p className="mt-6 text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Seller onboarding</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-.05em]">{String(shop.name ?? "Your shop")} {isRejected ? "was rejected" : status === "suspended" ? "is suspended" : "is under review"}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">{isRejected ? "Your shop request was rejected by Admin. Please contact support if you need more details." : status === "suspended" ? "This shop is currently suspended by Admin. Seller tools will return when it is reactivated." : "Your shop request has been submitted and is pending Admin Approval."}</p>
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-orange-200 bg-white p-5 text-left text-sm dark:border-orange-500/20 dark:bg-white/5"><div className="flex justify-between gap-4"><span className="text-slate-500">Status</span><strong className="capitalize text-orange-600">{status}</strong></div><div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Shop URL</span><strong>/{String(shop.slug ?? "-")}</strong></div><div className="mt-3"><span className="text-slate-500">Description</span><p className="mt-1 leading-6">{String(shop.description ?? "No description provided.")}</p></div></div>
      </section>
    </main>
  );
}
