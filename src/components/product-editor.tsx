"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Check,
  GripVertical,
  ImagePlus,
  Link2,
  LoaderCircle,
  Palette,
  Plus,
  Ruler,
  Trash2,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { publishProductAction } from "@/app/seller/products/actions";

type CategoryOption = { id: string; name: string; slug: string };

type VariantItem = {
  key: string;
  color: string;
  size: string;
  sku: string;
  price: string;
  compareAtPrice: string; // Added Compare at Price for variants
  stock: string;
  customAttrKey: string;
  customAttrValue: string;
};

const COLOR_PRESETS = [
  { name: "Black", hex: "#0f172a" },
  { name: "White", hex: "#ffffff", border: true },
  { name: "Navy Blue", hex: "#1e3a8a" },
  { name: "Forest Green", hex: "#14532d" },
  { name: "Terracotta", hex: "#c2410c" },
  { name: "Oatmeal / Beige", hex: "#e5d5c5" },
  { name: "Sage", hex: "#84a98c" },
  { name: "Burgundy", hex: "#881337" },
  { name: "Charcoal", hex: "#475569" },
];

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "One Size"];

const SAMPLE_IMAGES = [
  { name: "Ceramic Mug", url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80" },
  { name: "Linen Shirt", url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80" },
  { name: "Pendant Lamp", url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80" },
  { name: "Leather Tote", url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80" },
];

export function ProductEditor({ shopId, categories = [] }: { shopId: string; categories?: CategoryOption[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  
  // Updated fields
  const [price, setPrice] = useState("35.00");
  const [compareAtPrice, setCompareAtPrice] = useState("");

  // Gallery
  const [files, setFiles] = useState<File[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [externalImageUrls, setExternalImageUrls] = useState<string[]>([]);

  // Attribute Presets Selection
  const [selectedColors, setSelectedColors] = useState<string[]>(["Black"]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["One Size"]);
  const [customColorInput, setCustomColorInput] = useState("");
  const [customSizeInput, setCustomSizeInput] = useState("");

  // Variants list
  const [variants, setVariants] = useState<VariantItem[]>([
    {
      key: crypto.randomUUID(),
      color: "Black",
      size: "One Size",
      sku: "SKU-001",
      price: "35.00",
      compareAtPrice: "",
      stock: "15",
      customAttrKey: "",
      customAttrValue: "",
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(value: string) {
    setName(value);
    const autoSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(autoSlug);
  }

  function toggleColorPreset(colorName: string) {
    setSelectedColors((curr) =>
      curr.includes(colorName) ? (curr.length > 1 ? curr.filter((c) => c !== colorName) : curr) : [...curr, colorName],
    );
  }

  function addCustomColor() {
    const val = customColorInput.trim();
    if (val && !selectedColors.includes(val)) {
      setSelectedColors((curr) => [...curr, val]);
      setCustomColorInput("");
      toast.success(`Added color: ${val}`);
    }
  }

  function toggleSizePreset(sizeName: string) {
    setSelectedSizes((curr) =>
      curr.includes(sizeName) ? (curr.length > 1 ? curr.filter((s) => s !== sizeName) : curr) : [...curr, sizeName],
    );
  }

  function addCustomSize() {
    const val = customSizeInput.trim();
    if (val && !selectedSizes.includes(val)) {
      setSelectedSizes((curr) => [...curr, val]);
      setCustomSizeInput("");
      toast.success(`Added size: ${val}`);
    }
  }

  // Auto generate variant combinations from selected Colors & Sizes
  function generateVariantMatrix() {
    const nextVariants: VariantItem[] = [];
    const prefix = (slug || "PROD").slice(0, 4).toUpperCase();

    let counter = 1;
    for (const color of selectedColors) {
      for (const size of selectedSizes) {
        const colorCode = color.slice(0, 3).toUpperCase();
        const sizeCode = size.replace(/\s+/g, "").toUpperCase();
        nextVariants.push({
          key: crypto.randomUUID(),
          color,
          size,
          sku: `${prefix}-${colorCode}-${sizeCode}`,
          price: price || "35.00",
          compareAtPrice: compareAtPrice || "",
          stock: "10",
          customAttrKey: "",
          customAttrValue: "",
        });
        counter++;
      }
    }

    setVariants(nextVariants);
    toast.success(`Generated ${nextVariants.length} variants based on your attributes!`);
  }

  function addBlankVariant() {
    const nextSku = `SKU-${Date.now().toString().slice(-4)}`;
    setVariants((curr) => [
      ...curr,
      {
        key: crypto.randomUUID(),
        color: selectedColors[0] || "Default",
        size: selectedSizes[0] || "Standard",
        sku: nextSku,
        price: price || "35.00",
        compareAtPrice: compareAtPrice || "",
        stock: "10",
        customAttrKey: "",
        customAttrValue: "",
      },
    ]);
  }

  function updateVariantField(key: string, field: keyof VariantItem, value: string) {
    setVariants((curr) =>
      curr.map((item) => {
        if (item.key !== key) return item;
        return { ...item, [field]: value };
      }),
    );
  }

  function removeVariant(key: string) {
    if (variants.length <= 1) {
      toast.error("You must have at least one product variant.");
      return;
    }
    setVariants((curr) => curr.filter((v) => v.key !== key));
  }

  function addFiles(next: FileList | File[]) {
    setFiles((current) => [
      ...current,
      ...Array.from(next)
        .filter((file) => file.type.startsWith("image/"))
        .slice(0, 8 - current.length),
    ]);
  }

  function addImageUrl(urlToAdd?: string) {
    const url = (urlToAdd || imageUrlInput).trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      toast.error("Please enter a valid https:// image URL");
      return;
    }
    setExternalImageUrls((current) => [...current, url]);
    if (!urlToAdd) setImageUrlInput("");
    toast.success("Image added to gallery");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const productName = name.trim();
    const productSlug = (slug.trim() || productName.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-+|-+$/g, "");
    const productDescription = description.trim();
    const selectedCat = categoryId || categories[0]?.id;

    if (productName.length < 2) {
      setError("Please provide a product title.");
      setSaving(false);
      return;
    }

    if (!productDescription) {
      setError("Please provide a product description.");
      setSaving(false);
      return;
    }

    // 1. Upload files to Supabase Storage if any
    const uploadedUrls: string[] = [];
    if (files.length > 0) {
      const supabase = createClient();
      for (const file of files) {
        let uploaded = false;
        try {
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `${shopId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
          if (!uploadErr) {
            const publicUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
            if (publicUrl) {
              uploadedUrls.push(publicUrl);
              uploaded = true;
            }
          }
        } catch {
          // fallback
        }

        // If storage upload fails (missing bucket or RLS), convert to optimized base64 Data URL so seller image is never lost
        if (!uploaded) {
          try {
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const img = new window.Image();
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  let width = img.width;
                  let height = img.height;
                  const maxDim = 1200;
                  if (width > maxDim || height > maxDim) {
                    if (width > height) {
                      height = Math.round((height * maxDim) / width);
                      width = maxDim;
                    } else {
                      width = Math.round((width * maxDim) / height);
                      height = maxDim;
                    }
                  }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext("2d");
                  if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/jpeg", 0.85));
                  } else {
                    resolve(e.target?.result as string);
                  }
                };
                img.onerror = () => resolve(e.target?.result as string);
                img.src = e.target?.result as string;
              };
              reader.onerror = () => resolve("");
              reader.readAsDataURL(file);
            });
            if (dataUrl) uploadedUrls.push(dataUrl);
          } catch {}
        }
      }
    }

    const allImages = [...uploadedUrls, ...externalImageUrls];
    if (allImages.length === 0) {
      allImages.push("https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80");
    }

    // 2. Prepare structured variants
    const parsedVariants = variants.map((v, index) => {
      const attributes: Record<string, string> = {};
      if (v.color) attributes.Color = v.color;
      if (v.size) attributes.Size = v.size;
      if (v.customAttrKey && v.customAttrValue) {
        attributes[v.customAttrKey] = v.customAttrValue;
      }
      if (Object.keys(attributes).length === 0) {
        attributes.Option = `Standard ${index + 1}`;
      }

      return {
        id: crypto.randomUUID(),
        sku: v.sku.trim() || `SKU-${productSlug.slice(0, 4).toUpperCase()}-${index + 1}`,
        price: Math.max(0, parseFloat(v.price) || parseFloat(price) || 25),
        compare_at_price: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null,
        stock: Math.max(0, parseInt(v.stock, 10) || 10),
        attributes,
      };
    });

    const lowestPrice = Math.min(...parsedVariants.map((v) => v.price));

    // 3. Call Server Action with updated price fields
    const result = await publishProductAction({
      shopId,
      name: productName,
      slug: productSlug,
      description: productDescription,
      categoryId: selectedCat,
      price: lowestPrice, // CHANGED: Sending 'price' instead of 'basePrice'
      compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : null, // ADDED
      variants: parsedVariants,
      images: allImages,
    });

    if (!result.success) {
      setError(result.error || "Could not publish this product.");
      setSaving(false);
      return;
    }

    toast.success("Product published successfully!", {
      description: `"${productName}" is now live on the marketplace.`,
    });

    router.push("/seller");
    router.refresh();
  }

  const combinationCount = useMemo(() => selectedColors.length * selectedSizes.length, [selectedColors, selectedSizes]);

  return (
    <form onSubmit={submit} className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-7">
        {/* Section 1: Basic Information */}
        <section className="surface p-5 sm:p-7">
          <h2 className="text-lg font-black tracking-tight">Basic information</h2>
          <p className="mt-1 text-xs text-slate-400">Title, category, slug, and general description.</p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Product name *</span>
              <input
                required
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                className="field"
                placeholder="e.g. Handmade Stoneware Coffee Mug"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Category *</span>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="field cursor-pointer font-medium"
                >
                  {categories.length ? (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Marketplace category</option>
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Price (Rs) *</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="field font-semibold text-emerald-600"
                  placeholder="3500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Compare at price (Rs)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compareAtPrice}
                  onChange={(event) => setCompareAtPrice(event.target.value)}
                  className="field font-semibold text-slate-500 line-through decoration-slate-400"
                  placeholder="5000"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">URL slug</span>
              <input
                required
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                pattern="[a-z0-9-]+"
                className="field font-mono text-xs text-slate-600 dark:text-slate-300"
                placeholder="handmade-stoneware-coffee-mug"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Description *</span>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="field min-h-[110px] resize-y py-3"
                placeholder="Describe your item, materials, dimensions, craftsmanship, and care instructions…"
              />
            </label>
          </div>
        </section>

        {/* Section 2: Visual Attributes Builder (Colors & Sizes) */}
        <section className="surface p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Attributes & Options</h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Click color & size presets below to easily generate and customize your product options.
              </p>
            </div>

            <button
              type="button"
              onClick={generateVariantMatrix}
              className="button-primary bg-orange-500 text-xs hover:bg-orange-600"
            >
              <Wand2 className="size-4" />
              Generate {combinationCount} Variant{combinationCount === 1 ? "" : "s"}
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {/* Color Presets */}
            <div>
              <div className="flex items-center gap-2">
                <Palette className="size-4 text-slate-500" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select Colors ({selectedColors.length})
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {COLOR_PRESETS.map((col) => {
                  const isSelected = selectedColors.includes(col.name);
                  return (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => toggleColorPreset(col.name)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        isSelected
                          ? "border-orange-500 bg-orange-50/80 text-orange-800 ring-2 ring-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      }`}
                    >
                      <span
                        className={`size-3.5 rounded-full ${col.border ? "border border-slate-300 shadow-inner" : ""}`}
                        style={{ backgroundColor: col.hex }}
                      />
                      <span>{col.name}</span>
                      {isSelected && <Check className="size-3 text-orange-600 dark:text-orange-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Adder */}
              <div className="mt-3 flex max-w-sm gap-2">
                <input
                  value={customColorInput}
                  onChange={(e) => setCustomColorInput(e.target.value)}
                  placeholder="Custom color (e.g. Lavender, Rose Gold)"
                  className="field min-h-9 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={addCustomColor}
                  className="button-secondary shrink-0 text-xs font-bold"
                >
                  <Plus className="size-3.5" /> Add Color
                </button>
              </div>
            </div>

            {/* Size Presets */}
            <div>
              <div className="flex items-center gap-2">
                <Ruler className="size-4 text-slate-500" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select Sizes ({selectedSizes.length})
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {SIZE_PRESETS.map((sz) => {
                  const isSelected = selectedSizes.includes(sz);
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => toggleSizePreset(sz)}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                        isSelected
                          ? "border-orange-500 bg-orange-50/80 text-orange-800 ring-2 ring-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>

              {/* Custom Size Adder */}
              <div className="mt-3 flex max-w-sm gap-2">
                <input
                  value={customSizeInput}
                  onChange={(e) => setCustomSizeInput(e.target.value)}
                  placeholder="Custom size (e.g. 12oz, Large, 50x50cm)"
                  className="field min-h-9 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={addCustomSize}
                  className="button-secondary shrink-0 text-xs font-bold"
                >
                  <Plus className="size-3.5" /> Add Size
                </button>
              </div>
            </div>
          </div>

          {/* Variants Table / Grid */}
          <div className="mt-8 border-t border-slate-100 pt-6 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm">Configured Variants ({variants.length})</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">Set individual price, stock, and SKU per option.</p>
              </div>
              <button
                type="button"
                onClick={addBlankVariant}
                className="button-secondary text-xs"
              >
                <Plus className="size-3.5" /> Add Single Variant
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {variants.map((variant, index) => (
                <div
                  key={variant.key}
                  className="grid items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[.02] sm:grid-cols-[20px_1fr_1fr_80px_70px_70px_70px_36px]"
                >
                  <GripVertical className="mb-3 hidden size-4 text-slate-300 sm:block" />

                  {/* Color Selector */}
                  <label>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Color</span>
                    <input
                      value={variant.color}
                      onChange={(e) => updateVariantField(variant.key, "color", e.target.value)}
                      className="field min-h-9 px-2.5 py-1 text-xs font-semibold"
                      placeholder="Color"
                    />
                  </label>

                  {/* Size Selector */}
                  <label>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Size</span>
                    <input
                      value={variant.size}
                      onChange={(e) => updateVariantField(variant.key, "size", e.target.value)}
                      className="field min-h-9 px-2.5 py-1 text-xs font-semibold"
                      placeholder="Size"
                    />
                  </label>

                  {/* SKU */}
                  <label>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU</span>
                    <input
                      value={variant.sku}
                      onChange={(e) => updateVariantField(variant.key, "sku", e.target.value)}
                      className="field min-h-9 px-2.5 py-1 font-mono text-[11px]"
                      placeholder={`SKU-00${index + 1}`}
                    />
                  </label>

                  {/* Price */}
                  <label>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Price</span>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.price}
                      onChange={(e) => updateVariantField(variant.key, "price", e.target.value)}
                      className="field min-h-9 px-2.5 py-1 text-xs font-bold text-emerald-600"
                    />
                  </label>

                  {/* Compare At Price */}
                  <label>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Cmp. At</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.compareAtPrice}
                      onChange={(e) => updateVariantField(variant.key, "compareAtPrice", e.target.value)}
                      className="field min-h-9 px-2.5 py-1 text-xs font-bold text-slate-400 line-through"
                    />
                  </label>

                  {/* Stock */}
                  <label>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock</span>
                    <input
                      required
                      type="number"
                      min="0"
                      value={variant.stock}
                      onChange={(e) => updateVariantField(variant.key, "stock", e.target.value)}
                      className="field min-h-9 px-2.5 py-1 text-xs font-bold"
                    />
                  </label>

                  {/* Delete button */}
                  <button
                    type="button"
                    disabled={variants.length === 1}
                    onClick={() => removeVariant(variant.key)}
                    className="mb-1 grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-20 dark:hover:bg-rose-500/10"
                    title="Remove variant"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Gallery & Photos */}
        <section className="surface p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight">Product Images</h2>
              <p className="mt-1 text-xs text-slate-400">Drag & drop files, paste image URLs, or click quick sample links.</p>
            </div>
            <ImagePlus className="size-5 text-orange-500" />
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className="mt-5 cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-orange-400 hover:bg-orange-50/30 dark:border-white/15 dark:hover:bg-orange-500/5"
          >
            <UploadCloud className="mx-auto size-8 text-orange-500" />
            <p className="mt-3 text-sm font-extrabold">Drag & drop images here or click to browse</p>
            <p className="mt-1 text-xs text-slate-400">JPG, PNG, WebP · High quality photos</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="sr-only"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* Quick Direct URL or Sample Image Adder */}
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Paste direct image link (https://...)"
                  className="field field-icon-left text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => addImageUrl()}
                className="button-secondary shrink-0 text-xs font-bold"
              >
                Add Image URL
              </button>
            </div>

            {/* Instant Demo Samples */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span className="text-[11px] font-semibold">Quick sample photos:</span>
              {SAMPLE_IMAGES.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => addImageUrl(sample.url)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-orange-400 hover:text-orange-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  + {sample.name}
                </button>
              ))}
            </div>
          </div>

          {/* Preview list */}
          {(files.length > 0 || externalImageUrls.length > 0) && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {files.map((file, index) => {
                const objectUrl = URL.createObjectURL(file);
                return (
                  <div
                    key={`file-${file.name}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5"
                  >
                    <Image src={objectUrl} alt={file.name} fill unoptimized sizes="140px" className="object-cover" />
                    <span className="absolute bottom-1 right-1 max-w-[80%] truncate rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((curr) => curr.filter((_, i) => i !== index))}
                      className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white text-rose-500 shadow hover:bg-rose-50 dark:bg-slate-800"
                      aria-label="Remove image"
                    >
                      <X className="size-3.5" />
                    </button>
                    {index === 0 && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-slate-950 px-2 py-0.5 text-[9px] font-bold text-white">
                        Cover
                      </span>
                    )}
                  </div>
                );
              })}
              {externalImageUrls.map((url, index) => (
                <div
                  key={`url-${index}`}
                  className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5"
                >
                  <Image src={url} alt={`Preview ${index + 1}`} fill unoptimized sizes="140px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => setExternalImageUrls((curr) => curr.filter((_, i) => i !== index))}
                    className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white text-rose-500 shadow hover:bg-rose-50 dark:bg-slate-800"
                    aria-label="Remove image"
                  >
                    <X className="size-3.5" />
                  </button>
                  {files.length === 0 && index === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-slate-950 px-2 py-0.5 text-[9px] font-bold text-white">
                      Cover
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Publish Card Sidebar */}
      <aside className="surface sticky top-36 p-5 sm:p-6">
        <h2 className="text-lg font-black tracking-tight">Ready to Publish?</h2>
        <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500 dark:bg-white/5">
          <p className="flex items-center gap-2">
            <Check className="size-4 text-emerald-500" /> Title & slug verified
          </p>
          <p className="flex items-center gap-2">
            <Check className="size-4 text-emerald-500" /> {variants.length} variant option{variants.length === 1 ? "" : "s"}
          </p>
          <p className="flex items-center gap-2">
            <Check className="size-4 text-emerald-500" /> {files.length + externalImageUrls.length} image{files.length + externalImageUrls.length === 1 ? "" : "s"}
          </p>
          <p className="flex items-center gap-2">
            <Check className="size-4 text-emerald-500" /> RLS protected seller insert
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3.5 text-xs leading-5 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        <button
          disabled={saving}
          type="submit"
          className="button-primary mt-6 w-full bg-orange-500 hover:bg-orange-600"
        >
          {saving && <LoaderCircle className="size-4 animate-spin" />}
          {saving ? "Publishing product…" : "Publish product now"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/seller")}
          className="mt-3 w-full py-2.5 text-center text-xs font-bold text-slate-400 transition hover:text-slate-700 dark:hover:text-white"
        >
          Cancel and return to dashboard
        </button>
      </aside>
    </form>
  );
}