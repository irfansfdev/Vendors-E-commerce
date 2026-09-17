import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArrowUpRight, Check, Clock3, FileText, Package, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminProductsTable } from "@/components/admin-products-table";

export const metadata: Metadata = { title: "Products | BabulShop Admin" };
export const dynamic = "force-dynamic";
type Row = Record<string, any>;

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("id,title,slug,price,status,created_at,shop_id,shops(id,name,owner_id)").order("created_at", { ascending: false });
  const products = ((data ?? []) as Row[]).map((product) => {
    const shop = Array.isArray(product.shops) ? product.shops[0] : product.shops;
    return {
      id: String(product.id),
      title: String(product.title ?? "Untitled product"),
      slug: String(product.slug ?? ""),
      price: Number(product.price ?? 0),
      status: String(product.status ?? "draft").toLowerCase(),
      shop: String(shop?.name ?? "Unknown shop"),
      shopId: String(product.shop_id ?? shop?.id ?? ""),
      createdAt: String(product.created_at ?? ""),
    };
  });

  const pending = products.filter((product) => product.status === "pending").length;
  const published = products.filter((product) => product.status === "published").length;
  const draft = products.filter((product) => product.status === "draft").length;
  const archived = products.filter((product) => product.status === "archived").length;

  return (
    <div className="mx-auto max-w-[1440px] p-5 sm:p-8 lg:p-10">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Catalog control</p>
          <h1 className="page-title mt-2">Products</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Review shop submissions, manage catalog visibility, and see exactly which shop owns each product.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="button-secondary">
            <ArrowUpRight className="size-4" /> Overview
          </Link>
          <Link href="/admin/products/new" className="button-primary bg-orange-500">
            <Plus className="size-4" /> Add product
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Package} label="Total products" value={products.length} detail="All catalog products" />
        <Metric icon={Clock3} label="Pending requests" value={pending} detail="Waiting for review" tone="text-orange-600" />
        <Metric icon={Check} label="Published products" value={published} detail="Visible to customers" tone="text-emerald-600" />
        <Metric icon={FileText} label="Draft products" value={draft} detail="Not visible to customers" tone="text-rose-600" />
      </section>

      <section className="mt-8">
        <div className="mb-5">
          <h2 className="font-black">Product directory</h2>
          <p className="mt-1 text-xs text-slate-500">
            Requests submitted by shop admins appear in the Requests tab for approval.
          </p>
        </div>
        {error ? <p className="p-6 text-sm text-rose-600">Could not load products: {error.message}</p> : <AdminProductsTable products={products} />}
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Package; label: string; value: number; detail: string; tone?: string }) {
  return (
    <div className="surface p-5 sm:p-6">
      <span className={`grid size-11 place-items-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10 ${tone ?? ""}`}>
        <Icon className="size-5" />
      </span>
      <p className="mt-5 text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-black tracking-[-.04em] ${tone ?? ""}`}>{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
    </div>
  );
}
