import type { Metadata } from "next";
import { Check, Pause, Play, Trash2, X } from "lucide-react";
import { removeShopAction, updateShopStatusAction } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shop management | BabulShop" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function AdminShopsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("shops").select("*").order("created_at", { ascending: false });
  const shops = (data ?? []) as Row[];

  return <div className="p-8"><div className="mb-8"><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">Marketplace control</p><h1 className="mt-2 text-3xl font-black">Shop management</h1><p className="mt-1 text-slate-500">Review vendor requests and control storefront availability.</p></div>
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">{error ? <p className="p-6 text-sm text-rose-600">Could not load shops: {error.message}</p> : shops.length === 0 ? <p className="p-12 text-center text-slate-500">No shops found in this view.</p> : <div className="divide-y dark:divide-slate-800">{shops.map((shop) => { const shopStatus = String(shop.status ?? "pending"); return <div key={String(shop.id)} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">{String(shop.name ?? "Unnamed shop")}</h2><p className="text-sm text-slate-500">/{String(shop.slug ?? "")} · Owner {String(shop.owner_id ?? "Unknown")}</p><p className="mt-1 text-xs text-slate-400">Requested {String(shop.created_at ?? "-")}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${shopStatus === "active" ? "bg-emerald-100 text-emerald-700" : shopStatus === "pending" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>{shopStatus}</span>{shopStatus !== "active" && shopStatus !== "suspended" && <form action={async () => { "use server"; await updateShopStatusAction(String(shop.id), "active"); }}><button title="Approve or reactivate" className="button-secondary text-emerald-700"><Check className="size-4" /> {shopStatus === "pending" ? "Approve" : "Reactivate"}</button></form>}{shopStatus !== "suspended" && shopStatus !== "rejected" && <form action={async () => { "use server"; await updateShopStatusAction(String(shop.id), "suspended"); }}><button title="Suspend shop" className="button-secondary text-amber-700"><Pause className="size-4" /> Suspend</button></form>}{shopStatus === "pending" && <form action={async () => { "use server"; await updateShopStatusAction(String(shop.id), "rejected"); }}><button title="Reject shop" className="button-secondary text-rose-700"><X className="size-4" /> Reject</button></form>}{shopStatus === "suspended" && <form action={async () => { "use server"; await updateShopStatusAction(String(shop.id), "active"); }}><button title="Reactivate shop" className="button-secondary"><Play className="size-4" /> Reactivate</button></form>}{(shopStatus === "rejected" || shopStatus === "suspended") && <form action={async () => { "use server"; await removeShopAction(String(shop.id)); }}><button title="Remove shop" className="button-secondary text-rose-700"><Trash2 className="size-4" /> Remove</button></form>}</div></div>; })}</div>}</section>
  </div>;
}
