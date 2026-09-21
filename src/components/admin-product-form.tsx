"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };
type Shop = { id: string; name: string };
type ImageItem = { url: string; alt: string; is_primary: boolean };
type Attribute = { key: string; value: string };
type Variant = { id?: string; name: string; sku: string; price: string; stock: string; attributes: Attribute[] };
type VariantOption = { name: string; values: string[] };
type ProductRow = Record<string, unknown>;
type CategoryLinkRow = { category_id: string };
type VariantRow = { id: string; name?: string | null; sku?: string | null; price?: number | null; stock_quantity?: number | null; attributes?: unknown };
type ImageRow = { image_url?: string | null; alt?: string | null; is_primary?: boolean | null };
type VariantSkuRow = { sku?: string | null; product_id?: string | null };

type ProductFormProps = {
  productId?: string;
  initialShopId?: string;
  product?: ProductRow;
  shops?: Shop[];
  categories?: Category[];
  selectedCategories?: string[];
  variants?: Array<{ id?: string; name?: string; sku: string; price: string | number; stock: string | number; attributes: Record<string, string> }>;
  images?: string[];
};

const emptyVariant = (): Variant => ({ id: crypto.randomUUID(), name: "", sku: "", price: "", stock: "", attributes: [] });
const defaultVariant = (product: ProductRow): Variant => ({ id: crypto.randomUUID(), name: "Standard", sku: String(product.sku ?? `SKU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`), price: String(product.price ?? ""), stock: String(product.stock_quantity ?? product.stock ?? product.quantity ?? 0), attributes: [] });
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const attributesToArray = (value: unknown): Attribute[] => value && typeof value === "object" ? Object.entries(value as Record<string, unknown>).map(([key, item]) => ({ key, value: String(item ?? "") })) : [];
const attributesToObject = (value: Attribute[]) => Object.fromEntries(value.filter((item) => item.key.trim()).map((item) => [item.key.trim(), item.value.trim()]));
const supabase = createClient();

export function ProductForm(props: ProductFormProps) {
  const router = useRouter();
  const productId = props.productId ?? (props.product?.id ? String(props.product.id) : undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [name, setName] = useState(String(props.product?.title ?? ""));
  const [slug, setSlug] = useState(String(props.product?.slug ?? ""));
  const [slugTouched, setSlugTouched] = useState(Boolean(props.product?.slug));
  const [sku, setSku] = useState(String(props.product?.sku ?? ""));
  const [price, setPrice] = useState(String(props.product?.price ?? ""));
  const [stock, setStock] = useState(String(props.product?.stock_quantity ?? props.product?.stock ?? props.product?.quantity ?? 0));
  const [compareAtPrice, setCompareAtPrice] = useState(String(props.product?.compare_at_price ?? ""));
  const [description, setDescription] = useState(String(props.product?.description ?? ""));
  const [isActive, setIsActive] = useState(props.product ? props.product.is_active !== false && props.product.status !== "draft" : true);
  const [isFeatured, setIsFeatured] = useState(props.product?.is_featured === true);
  const [featuredStatus, setFeaturedStatus] = useState(String(props.product?.featured_status ?? (props.product?.is_featured === true ? "approved" : "not_requested")));
  const [categories, setCategories] = useState<Category[]>(props.categories ?? []);
  const [shops, setShops] = useState<Shop[]>(props.shops ?? []);
  const [shopId, setShopId] = useState(String(props.product?.shop_id ?? props.initialShopId ?? props.shops?.[0]?.id ?? ""));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(props.selectedCategories ?? []);
  const [variants, setVariants] = useState<Variant[]>(props.variants?.length ? props.variants.map((item) => ({ id: item.id, name: item.name ?? "", sku: item.sku, price: String(item.price ?? ""), stock: String(item.stock ?? ""), attributes: attributesToArray(item.attributes) })) : [defaultVariant(props.product ?? {})]);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([{ name: "Color", values: ["Black", "White", "Red"] }, { name: "Size", values: ["S", "M", "L", "XL"] }]);
  const [variantQuantity, setVariantQuantity] = useState("3");
  const [images, setImages] = useState<ImageItem[]>(props.images?.map((url, index) => ({ url, alt: name, is_primary: index === 0 })) ?? []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [categoryResult, shopResult] = await Promise.all([
        supabase.from("categories").select("id,name").order("name"),
        productId ? Promise.resolve({ data: props.shops ?? [], error: null }) : supabase.from("shops").select("id,name").eq("status", "active").order("name"),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (shopResult.error) throw shopResult.error;
      setCategories((categoryResult.data ?? []) as Category[]);
      if (!productId && shopResult.data?.[0]) setShopId((current) => current || String(shopResult.data[0].id));
      if (!productId) return;
      const [productResult, categoryLinks, variantResult, imageResult] = await Promise.all([
        supabase.from("products").select("*").eq("id", productId).single(),
        supabase.from("product_categories").select("category_id").eq("product_id", productId),
        supabase.from("product_variants").select("id,name,sku,price,stock_quantity,attributes").eq("product_id", productId).order("created_at"),
        supabase.from("product_images").select("image_url,alt,is_primary,display_order").eq("product_id", productId).order("display_order"),
      ]);
      if (productResult.error) throw productResult.error;
      if (categoryLinks.error) throw categoryLinks.error;
      if (variantResult.error) throw variantResult.error;
      if (imageResult.error) throw imageResult.error;
      const product = productResult.data as ProductRow;
      setName(String(product.title ?? "")); setSlug(String(product.slug ?? "")); setSlugTouched(true); setSku(String(product.sku ?? "")); setPrice(String(product.price ?? "")); setStock(String(product.stock_quantity ?? product.stock ?? product.quantity ?? 0)); setCompareAtPrice(String(product.compare_at_price ?? "")); setDescription(String(product.description ?? "")); setIsActive(product.is_active !== false && product.status !== "draft"); setIsFeatured(product.is_featured === true); setFeaturedStatus(String(product.featured_status ?? (product.is_featured === true ? "approved" : "not_requested"))); setShopId(String(product.shop_id ?? ""));
      const categoryRows = (categoryLinks.data ?? []) as CategoryLinkRow[];
      const variantRows = (variantResult.data ?? []) as VariantRow[];
      const imageRows = (imageResult.data ?? []) as ImageRow[];
      setSelectedCategories(categoryRows.map((row) => String(row.category_id)));
      setVariants(variantRows.length ? variantRows.map((item) => ({ id: String(item.id), name: String(item.name ?? ""), sku: String(item.sku ?? ""), price: String(item.price ?? ""), stock: String(item.stock_quantity ?? ""), attributes: attributesToArray(item.attributes) })) : [defaultVariant(product)]);
      const orderedImages = [...imageRows].sort((a, b) => Number(b.is_primary === true) - Number(a.is_primary === true));
      setImages(orderedImages.map((item, index) => ({ url: String(item.image_url ?? ""), alt: String(item.alt ?? product.title ?? ""), is_primary: item.is_primary === true || index === 0 })));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load product data."); }
    finally { setLoading(false); }
  }, [productId, props.shops]);

  // The effect synchronizes the form with the remote product record on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadData(); }, [loadData]);

  const updateVariant = (index: number, patch: Partial<Variant>) => setVariants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateAttribute = (variantIndex: number, attributeIndex: number, patch: Partial<Attribute>) => setVariants((items) => items.map((variant, index) => index === variantIndex ? { ...variant, attributes: variant.attributes.map((item, attrIndex) => attrIndex === attributeIndex ? { ...item, ...patch } : item) } : variant));
  const addAttribute = (index: number, key: string) => updateVariant(index, { attributes: [...variants[index].attributes, { key, value: "" }] });
  const updateVariantOption = (index: number, patch: Partial<VariantOption>) => setVariantOptions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const generateVariants = () => {
    const activeOptions = variantOptions.filter((option) => option.name.trim() && option.values.filter(Boolean).length);
    if (!activeOptions.length) { toast.error("Add at least one option with a value."); return; }
    const combinations = activeOptions.reduce<string[][]>((result, option) => result.flatMap((current) => option.values.filter(Boolean).map((value) => [...current, value])), [[]]);
    const prefix = (slug || "PROD").slice(0, 4).toUpperCase();
    setVariants(combinations.map((combination, index) => {
      const attributes = activeOptions.map((option, optionIndex) => ({ key: option.name.trim(), value: combination[optionIndex] }));
      const existing = variants.find((item) => attributes.every((attribute) => item.attributes.some((current) => current.key === attribute.key && current.value === attribute.value)));
      return { id: existing?.id ?? crypto.randomUUID(), name: existing?.name || combination.join(" / "), sku: existing?.sku || `${prefix}-${index + 1}`, price: existing?.price || price, stock: existing?.stock || "0", attributes };
    }));
  };
  const quickAddSizes = generateVariants;
  const variantName = (variant: Variant) => variant.name.trim() || variant.attributes.map((item) => item.value.trim()).filter(Boolean).join(" / ") || "Standard";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !slug.trim() || !shopId || !Number.isFinite(Number(price))) { toast.error("Name, slug, shop, and a valid price are required."); return; }
    const id = productId ?? crypto.randomUUID();
    const preparedVariants = variants.map((item, index) => ({ ...item, sku: item.sku.trim() || `SKU-${id.slice(0, 8).toUpperCase()}-${index + 1}`, stock: item.stock.trim() || "0" }));
    const skuValues = preparedVariants.map((item) => item.sku.toLowerCase()).filter(Boolean);
    if (new Set(skuValues).size !== skuValues.length) { toast.error("Variant SKUs must be unique."); return; }
    setSaving(true); const toastId = toast.loading(productId ? "Updating product..." : "Creating product...");
    try {
      const duplicate = skuValues.length ? await supabase.from("product_variants").select("sku,product_id").in("sku", skuValues) : { data: [], error: null };
      if (duplicate.error) throw duplicate.error;
      if (((duplicate.data ?? []) as VariantSkuRow[]).some((row) => String(row.product_id) !== String(productId ?? ""))) throw new Error("A variant SKU is already in use.");
      const existingStatus = String(props.product?.status ?? "draft").toLowerCase();
      const status = existingStatus === "pending" ? "pending" : isActive ? "published" : "draft";
      const productPayload = { id, shop_id: shopId, title: name.trim(), slug: slug.trim(), brand: null, sku: sku.trim() || null, price: Number(price), compare_at_price: compareAtPrice.trim() ? Number(compareAtPrice) : null, description: description.trim(), is_active: isActive, is_featured: featuredStatus === "approved" && isActive, featured_status: featuredStatus, status };
      let productResult = productId ? await supabase.from("products").update(productPayload).eq("id", id) : await supabase.from("products").insert(productPayload);
      if (productResult.error && /brand|is_active|is_featured/i.test(productResult.error.message)) {
        const legacyPayload = { id, shop_id: shopId, title: name.trim(), slug: slug.trim(), sku: sku.trim() || null, price: Number(price), compare_at_price: compareAtPrice.trim() ? Number(compareAtPrice) : null, description: description.trim(), status };
        productResult = productId ? await supabase.from("products").update(legacyPayload).eq("id", id) : await supabase.from("products").insert(legacyPayload);
      }
      if (productResult.error) throw productResult.error;
      const existing = await supabase.from("product_variants").select("id").eq("product_id", id); if (existing.error) throw existing.error;
      const keepIds = preparedVariants.map((item) => item.id).filter(Boolean) as string[];
      const removed = ((existing.data ?? []) as Array<{ id: string }>).map((item) => String(item.id)).filter((item) => !keepIds.includes(item));
      if (removed.length) { const removeResult = await supabase.from("product_variants").delete().in("id", removed); if (removeResult.error) toast.warning("Product saved, but some old variants could not be deleted because they are referenced by orders."); }
      if (preparedVariants.length) { const variantResult = await supabase.from("product_variants").upsert(preparedVariants.map((item) => ({ id: item.id ?? crypto.randomUUID(), product_id: id, name: variantName(item), sku: item.sku, price: item.price.trim() ? Number(item.price) : Number(price), stock_quantity: Math.max(0, Number(item.stock) || 0), attributes: attributesToObject(item.attributes) })), { onConflict: "id" }); if (variantResult.error) throw variantResult.error; }
      const categoryDelete = await supabase.from("product_categories").delete().eq("product_id", id); if (categoryDelete.error) throw categoryDelete.error;
      if (selectedCategories.length) { const categoryInsert = await supabase.from("product_categories").insert(selectedCategories.map((categoryId) => ({ product_id: id, category_id: categoryId }))); if (categoryInsert.error) throw categoryInsert.error; }
      const imageDelete = await supabase.from("product_images").delete().eq("product_id", id); if (imageDelete.error) throw imageDelete.error;
      if (images.length) { let imageInsert = await supabase.from("product_images").insert(images.map((image, index) => ({ id: crypto.randomUUID(), product_id: id, image_url: image.url, alt: image.alt || name, is_primary: image.is_primary, display_order: index + 1 }))); if (imageInsert.error && /alt|is_primary/i.test(imageInsert.error.message)) imageInsert = await supabase.from("product_images").insert(images.map((image, index) => ({ id: crypto.randomUUID(), product_id: id, image_url: image.url, display_order: index + 1 }))); if (imageInsert.error) throw imageInsert.error; }
      toast.success("Product saved successfully.", { id: toastId }); router.push("/admin/products"); router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String((error as { message: unknown }).message) : "Could not save product.";
      toast.error(message, { id: toastId });
    }
    finally { setSaving(false); }
  }

  async function deleteProduct() {
    if (!productId) return; setDeleting(true); const toastId = toast.loading("Deleting product...");
    try {
      await supabase.from("product_images").delete().eq("product_id", productId);
      await supabase.from("product_categories").delete().eq("product_id", productId);
      const variantDelete = await supabase.from("product_variants").delete().eq("product_id", productId);
      if (variantDelete.error) toast.warning("Some variants are referenced by orders and could not be deleted.");
      const productDelete = await supabase.from("products").delete().eq("id", productId); if (productDelete.error) throw productDelete.error;
      toast.success("Product deleted.", { id: toastId }); router.push("/admin/products"); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete product.", { id: toastId }); }
    finally { setDeleting(false); setShowDelete(false); }
  }

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><LoaderCircle className="size-8 animate-spin text-orange-500" /></div>;
  return <form onSubmit={save} data-edit-mode={productId ? "true" : "false"} className="space-y-6">
    <section className="surface space-y-4 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Variant options</h2><p className="text-xs text-slate-500">Add option names and comma-separated values. Combinations are generated automatically.</p></div><button type="button" onClick={generateVariants} className="button-primary bg-orange-500">Generate combinations</button></div><div className="space-y-3">{variantOptions.map((option, index) => <div key={`${option.name}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)_auto]"><input value={option.name} onChange={(event) => updateVariantOption(index, { name: event.target.value })} placeholder="Option name, e.g. Color" className="field" /><input value={option.values.join(", ")} onChange={(event) => updateVariantOption(index, { values: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Black, White, Red" className="field" /><button type="button" onClick={() => setVariantOptions((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="button-secondary text-rose-600" aria-label={`Remove ${option.name || "option"}`}><Trash2 className="size-4" /></button></div>)}</div><button type="button" onClick={() => setVariantOptions((items) => [...items, { name: "", values: [] }])} className="button-secondary"><Plus className="size-4" /> Add option</button></section>
    <section className="surface flex flex-wrap items-end justify-between gap-3 p-6"><div><h2 className="text-lg font-black">Easy variant setup</h2><p className="text-xs text-slate-500">Create several variants at once, then edit their fields below.</p></div><div className="flex flex-wrap items-end gap-2"><label className="block"><span className="label">Quantity</span><input type="number" min="1" value={variantQuantity} onChange={(event) => setVariantQuantity(event.target.value)} className="field w-24" /></label><button type="button" onClick={generateVariants} className="button-primary bg-orange-500">Generate Variants</button><button type="button" onClick={() => setVariants((items) => [...items, emptyVariant()])} className="button-secondary"><Plus className="size-4" /> Add Variant</button><button type="button" onClick={() => setVariants((items) => items.length > 1 ? items.slice(0, -1) : items)} className="button-secondary text-rose-600"><Trash2 className="size-4" /> Delete last</button></div></section>
    <section className="surface space-y-5 p-6"><h2 className="text-lg font-black">Product details</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><input required value={name} onChange={(event) => { const value = event.target.value; setName(value); if (!slugTouched) setSlug(slugify(value)); }} className="field" /></Field><Field label="Slug"><input required value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} className="field" /></Field><Field label="SKU"><input value={sku} onChange={(event) => setSku(event.target.value)} className="field" /></Field>{!productId && <Field label="Shop"><select required value={shopId} onChange={(event) => setShopId(event.target.value)} className="field">{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></Field>}<Field label="Price"><input required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="field" /></Field><Field label="Compare-at price"><input type="number" min="0" step="0.01" value={compareAtPrice} onChange={(event) => setCompareAtPrice(event.target.value)} className="field" /></Field></div><Field label="Description"><textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className="field" /></Field><div className="flex flex-wrap items-center gap-5 text-sm font-bold"><Toggle label="Active" checked={isActive} onChange={setIsActive} /><label className="flex items-center gap-2"><span>Featured status</span><select value={featuredStatus} onChange={(event) => { setFeaturedStatus(event.target.value); setIsFeatured(event.target.value === "approved"); }} className="field w-auto py-2 text-xs"><option value="not_requested">Not requested</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label></div></section>
    <section className="surface p-6"><h2 className="text-lg font-black">Categories</h2><div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => { const selected = selectedCategories.includes(category.id); return <button type="button" key={category.id} onClick={() => setSelectedCategories((items) => selected ? items.filter((id) => id !== category.id) : [...items, category.id])} className={`rounded-full border px-3 py-2 text-sm font-bold ${selected ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-500"}`}>{selected ? "✓ " : ""}{category.name}</button>; })}</div></section>
    <section className="surface space-y-4 p-6"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-black">Variants</h2><p className="text-xs text-slate-500">Blank price uses base price; blank stock saves as zero.</p></div><div className="flex gap-2"><button type="button" onClick={quickAddSizes} className="button-secondary">Quick Add Sizes</button><button type="button" onClick={() => setVariants((items) => [...items, emptyVariant()])} className="button-primary bg-orange-500"><Plus className="size-4" /> Add Variant</button></div></div>{variants.map((variant, index) => <div key={variant.id ?? index} className="rounded-xl border border-slate-200 p-4 dark:border-white/10"><div className="grid gap-3 sm:grid-cols-4"><input placeholder="Name" value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} className="field" /><input placeholder="SKU" value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className="field" /><input placeholder="Price" type="number" min="0" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} className="field" /><input placeholder="Stock" type="number" min="0" value={variant.stock} onChange={(event) => updateVariant(index, { stock: event.target.value })} className="field" /></div><div className="mt-3 flex flex-wrap gap-2">{variant.attributes.map((attribute, attributeIndex) => <div key={`${attribute.key}-${attributeIndex}`} className="flex gap-1"><input placeholder="Key" value={attribute.key} onChange={(event) => updateAttribute(index, attributeIndex, { key: event.target.value })} className="field w-28" /><input placeholder="Value" value={attribute.value} onChange={(event) => updateAttribute(index, attributeIndex, { value: event.target.value })} className="field w-28" /><button type="button" onClick={() => updateVariant(index, { attributes: variant.attributes.filter((_, itemIndex) => itemIndex !== attributeIndex) })} className="text-rose-500" aria-label="Remove attribute"><X className="size-4" /></button></div>)}{["Size", "Color", "Material"].map((key) => <button type="button" key={key} onClick={() => addAttribute(index, key)} className="button-secondary text-xs">+ {key}</button>)}<button type="button" onClick={() => addAttribute(index, "Custom")} className="button-secondary text-xs">+ Custom Attribute</button></div><button type="button" onClick={() => setVariants((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="mt-3 text-xs font-bold text-rose-600"><Trash2 className="mr-1 inline size-3" />Remove variant</button></div>)}</section>
    <section className="surface p-6"><h2 className="text-lg font-black">Inventory</h2><p className="mt-1 text-xs text-slate-500">For a simple product, update its available stock here.</p><div className="mt-4 max-w-xs"><label className="block"><span className="label">Stock quantity</span><input required type="number" min="0" step="1" value={stock} onChange={(event) => { const value = event.target.value; setStock(value); if (variants.length === 1 && variants[0].name === "Standard" && variants[0].attributes.length === 0) updateVariant(0, { stock: value }); }} className="field" /></label></div></section>
    <ImageUploader images={images} onChange={setImages} />
    <div className="flex flex-wrap justify-end gap-3"><button type="submit" disabled={saving || deleting} className="button-primary bg-orange-500 disabled:opacity-60">{saving && <LoaderCircle className="size-4 animate-spin" />} {saving ? "Saving..." : "Save product"}</button>{productId && <button type="button" disabled={saving || deleting} onClick={() => setShowDelete(true)} className="button-secondary text-rose-600"><Trash2 className="size-4" /> Delete Product</button>}</div>
    {showDelete && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="surface max-w-sm p-6"><h2 className="text-lg font-black">Delete product?</h2><p className="mt-2 text-sm text-slate-500">This removes the product and its catalog data. Order-linked variants may be retained.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowDelete(false)} className="button-secondary">Cancel</button><button type="button" onClick={deleteProduct} disabled={deleting} className="button-primary bg-rose-600">{deleting ? "Deleting..." : "Confirm delete"}</button></div></div></div>}
  </form>;
}

export const AdminProductForm = ProductForm;

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label">{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }

function ImageUploader({ images, onChange }: { images: ImageItem[]; onChange: (images: ImageItem[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const addUrls = (urls: string[]) => onChange([...images, ...urls.map((item) => ({ url: item, alt: "", is_primary: images.length === 0 && item === urls[0] }))]);
  const addUrl = () => { const value = url.trim(); if (!/^https?:\/\//i.test(value)) { setMessage("Enter a valid image URL or choose image files."); return; } addUrls([value]); setUrl(""); setMessage(""); };
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true); setMessage("");
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const extension = file.name.split(".").pop() ?? "jpg";
        const path = `products/${crypto.randomUUID()}.${extension}`;
        const result = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
        if (result.error) throw result.error;
        const publicUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
        if (publicUrl) uploadedUrls.push(publicUrl);
      }
      if (uploadedUrls.length) addUrls(uploadedUrls); else setMessage("No valid image files were selected.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not upload image."); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };
  return <section className="surface p-6"><div className="flex items-center gap-2"><ImagePlus className="size-5 text-orange-500" /><h2 className="text-lg font-black">Images</h2></div><div className="mt-4 flex flex-wrap gap-2"><input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(event) => void addFiles(event.target.files)} className="sr-only" /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="button-primary bg-orange-500"><ImagePlus className="size-4" /> {uploading ? "Uploading..." : "Add images"}</button><input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addUrl(); } }} placeholder="Paste image URL" className="field min-w-60 flex-1" /><button type="button" onClick={addUrl} className="button-secondary"><Plus className="size-4" /> Add URL</button></div>{message && <p className="mt-2 text-xs font-bold text-rose-600">{message}</p>}<p className="mt-2 text-xs text-slate-500">You can select multiple images. The first image is primary by default.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{images.map((image, index) => <div key={`${image.url}-${index}`} className="relative overflow-hidden rounded-xl border p-2"><div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100"><Image src={image.url} alt={image.alt || "Product image"} fill unoptimized className="object-cover" /></div><input value={image.alt} onChange={(event) => onChange(images.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item))} placeholder="Alt text" className="field mt-2 text-xs" /><div className="mt-2 flex items-center justify-between text-xs"><button type="button" onClick={() => onChange(images.map((item, itemIndex) => ({ ...item, is_primary: itemIndex === index })))} className={image.is_primary ? "font-bold text-orange-600" : "text-slate-500"}><Star className="mr-1 inline size-3" /> {image.is_primary ? "Primary" : "Make primary"}</button><button type="button" onClick={() => { const next = images.filter((_, itemIndex) => itemIndex !== index); if (next.length && !next.some((item) => item.is_primary)) next[0].is_primary = true; onChange(next); }} className="text-rose-600"><Trash2 className="mr-1 inline size-3" />Remove</button></div></div>)}</div></section>;
}
