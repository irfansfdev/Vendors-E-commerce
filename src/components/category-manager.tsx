"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  FolderPlus,
  ImageIcon,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { deleteCategoryAction, saveCategoryAction } from "@/app/actions/admin";

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
  productCount?: number;
};

export function CategoryManager({
  initialCategories,
  error,
}: {
  initialCategories: Record<string, unknown>[];
  error: string | null;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryItem[]>(() =>
    initialCategories.map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ""),
      slug: String(c.slug ?? ""),
      image_url:
        String(
          c.image_url ||
            c.imageUrl ||
            c.image ||
            c.image_path ||
            c.cover_image ||
            c.thumbnail_url ||
            c.banner_url ||
            ""
        ) || null,
      productCount: typeof c.productCount === "number" ? c.productCount : undefined,
    })),
  );

  // Sync state if initialCategories prop updates from server revalidation
  useEffect(() => {
    setCategories(
      initialCategories.map((c) => ({
        id: String(c.id),
        name: String(c.name ?? ""),
        slug: String(c.slug ?? ""),
        image_url:
          String(
            c.image_url ||
              c.imageUrl ||
              c.image ||
              c.image_path ||
              c.cover_image ||
              c.thumbnail_url ||
              c.banner_url ||
              ""
          ) || null,
        productCount: typeof c.productCount === "number" ? c.productCount : undefined,
      })),
    );
  }, [initialCategories]);

  // Add category state
  const [addName, setAddName] = useState("");
  const [addSlug, setAddSlug] = useState("");
  const [addSlugEdited, setAddSlugEdited] = useState(false);
  const [addImageType, setAddImageType] = useState<"file" | "url">("file");
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [addImagePreview, setAddImagePreview] = useState<string>("");
  const [addImageUrl, setAddImageUrl] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);

  // Editing category state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editImageType, setEditImageType] = useState<"file" | "url">("file");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  // Deleting category state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAddNameChange(value: string) {
    setAddName(value);
    if (!addSlugEdited) {
      setAddSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      );
    }
  }

  function handleAddFileSelect(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5 MB.");
      return;
    }
    setAddImageFile(file);
    if (addImagePreview) URL.revokeObjectURL(addImagePreview);
    setAddImagePreview(URL.createObjectURL(file));
  }

  function handleEditFileSelect(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5 MB.");
      return;
    }
    setEditImageFile(file);
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImagePreview(URL.createObjectURL(file));
  }

  function startEditing(cat: CategoryItem) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditImageUrl(cat.image_url ?? "");
    setEditImageFile(null);
    setEditImagePreview("");
    setEditImageType(cat.image_url ? "url" : "file");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditSlug("");
    setEditImageUrl("");
    setEditImageFile(null);
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImagePreview("");
  }

  async function handleAddCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!addName.trim() || !addSlug.trim()) {
      toast.error("Name and slug are required.");
      return;
    }

    setAddingLoading(true);
    const formData = new FormData();
    formData.set("name", addName.trim());
    formData.set("slug", addSlug.trim());

    if (addImageType === "file" && addImageFile) {
      formData.set("image_file", addImageFile);
    } else if (addImageType === "url" && addImageUrl.trim()) {
      formData.set("image_url", addImageUrl.trim());
    }

    try {
      const result = await saveCategoryAction(formData);
      if (!result.success) {
        toast.error("Failed to add category", { description: result.error });
      } else {
        toast.success(`Category "${addName}" added successfully!`);
        const createdImage = result.imageUrl || (addImageType === "url" ? addImageUrl.trim() : addImagePreview) || null;
        const newCat: CategoryItem = {
          id: result.id || `cat-${Date.now()}`,
          name: addName.trim(),
          slug: addSlug.trim(),
          image_url: createdImage,
          productCount: 0,
        };
        setCategories((prev) => [newCat, ...prev]);
        setAddName("");
        setAddSlug("");
        setAddSlugEdited(false);
        setAddImageFile(null);
        if (addImagePreview) URL.revokeObjectURL(addImagePreview);
        setAddImagePreview("");
        setAddImageUrl("");
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred while creating category.");
    } finally {
      setAddingLoading(false);
    }
  }

  async function handleSaveEdit(catId: string, event: React.FormEvent) {
    event.preventDefault();
    if (!editName.trim() || !editSlug.trim()) {
      toast.error("Name and slug are required.");
      return;
    }

    setEditLoading(true);
    const formData = new FormData();
    formData.set("id", catId);
    formData.set("name", editName.trim());
    formData.set("slug", editSlug.trim());

    if (editImageType === "file" && editImageFile) {
      formData.set("image_file", editImageFile);
    } else if (editImageType === "url") {
      formData.set("image_url", editImageUrl.trim());
    }

    try {
      const result = await saveCategoryAction(formData);
      if (!result.success) {
        toast.error("Failed to update category", { description: result.error });
      } else {
        toast.success(`Category "${editName}" updated successfully!`);
        const updatedImage = result.imageUrl || (editImageType === "url" ? editImageUrl.trim() : editImagePreview) || undefined;
        setCategories((prev) =>
          prev.map((c) =>
            c.id === catId
              ? {
                  ...c,
                  name: editName.trim(),
                  slug: editSlug.trim(),
                  image_url: updatedImage !== undefined ? updatedImage : c.image_url,
                }
              : c
          )
        );
        cancelEditing();
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred while updating category.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteCategory(catId: string, catName: string) {
    if (!confirm(`Are you sure you want to delete category "${catName}"?`)) {
      return;
    }

    setDeletingId(catId);
    try {
      const result = await deleteCategoryAction(catId);
      if (!result.success) {
        toast.error("Failed to delete category", { description: result.error });
      } else {
        toast.success(`Category "${catName}" deleted.`);
        setCategories((prev) => prev.filter((c) => c.id !== catId));
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred while deleting category.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. Add Category Form Card */}
      <section className="surface p-6 sm:p-7">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black tracking-tight">
              <Plus className="size-5 text-orange-500" /> Add new category
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Create a new marketplace category with direct image upload or image URL.
            </p>
          </div>
          <FolderPlus className="size-5 text-slate-400" />
        </div>

        <form onSubmit={handleAddCategory} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">
                Category Name *
              </span>
              <input
                required
                value={addName}
                onChange={(e) => handleAddNameChange(e.target.value)}
                className="field"
                placeholder="e.g. Home & Living, Textiles, Ceramics"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">
                URL Slug *
              </span>
              <input
                required
                value={addSlug}
                onChange={(e) => {
                  setAddSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  setAddSlugEdited(true);
                }}
                className="field font-mono text-xs"
                placeholder="home-and-living"
              />
            </label>
          </div>

          {/* Image Selection Block */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Category Image
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddImageType("file")}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    addImageType === "file"
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  <UploadCloud className="size-3.5" /> Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setAddImageType("url")}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    addImageType === "url"
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  <Link2 className="size-3.5" /> Image URL
                </button>
              </div>
            </div>

            <div className="mt-3">
              {addImageType === "file" ? (
                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                  <div
                    onClick={() => addFileRef.current?.click()}
                    className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-orange-400 hover:bg-orange-50/30 dark:border-white/15 dark:hover:bg-orange-500/5"
                  >
                    <UploadCloud className="mx-auto size-7 text-orange-500" />
                    <p className="mt-2 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      {addImageFile ? addImageFile.name : "Click to select or drop an image file"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      PNG, JPG, WebP up to 5 MB
                    </p>
                    <input
                      ref={addFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => handleAddFileSelect(e.target.files?.[0])}
                    />
                  </div>

                  {addImagePreview ? (
                    <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                      <Image
                        src={addImagePreview}
                        alt="Category preview"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAddImageFile(null);
                          if (addImagePreview) URL.revokeObjectURL(addImagePreview);
                          setAddImagePreview("");
                        }}
                        className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-slate-950/70 text-white hover:bg-rose-600"
                        title="Remove image"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid aspect-square place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-center dark:border-white/10 dark:bg-white/5">
                      <ImageIcon className="size-6 text-slate-300" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-[1fr_120px] items-center">
                  <input
                    value={addImageUrl}
                    onChange={(e) => setAddImageUrl(e.target.value)}
                    className="field text-xs"
                    placeholder="https://images.unsplash.com/... or direct image link"
                  />
                  {addImageUrl ? (
                    <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                      <Image
                        src={addImageUrl}
                        alt="URL preview"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="grid aspect-square place-items-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                      <ImageIcon className="size-6 text-slate-300" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              disabled={addingLoading}
              type="submit"
              className="button-primary bg-orange-500 hover:bg-orange-600"
            >
              {addingLoading && <LoaderCircle className="size-4 animate-spin" />}
              {addingLoading ? "Creating category…" : "Add category"}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Existing Categories List with Rich Editing */}
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h2 className="font-extrabold text-base">Current Categories</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {categories.length} categories available in marketplace
            </p>
          </div>
        </div>

        {error ? (
          <p className="p-6 text-sm text-rose-600">Could not load categories: {error}</p>
        ) : categories.length === 0 ? (
          <p className="p-12 text-center text-slate-500">No categories found.</p>
        ) : (
          <div className="divide-y dark:divide-slate-800">
            {categories.map((category) => {
              const isEditing = editingId === category.id;
              const displayImage =
                category.image_url ||
                "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80";

              return (
                <div key={category.id} className="p-5 transition hover:bg-slate-50/50 dark:hover:bg-white/[.015]">
                  {isEditing ? (
                    /* Edit Mode Form */
                    <form
                      onSubmit={(e) => handleSaveEdit(category.id, e)}
                      className="rounded-2xl border border-orange-200 bg-orange-50/30 p-5 dark:border-orange-500/20 dark:bg-orange-500/5 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-orange-200 pb-3 dark:border-orange-500/20">
                        <p className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                          Editing: {category.name}
                        </p>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="icon-button size-8"
                          title="Cancel"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-bold">Category Name *</span>
                          <input
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="field"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-bold">Slug *</span>
                          <input
                            required
                            value={editSlug}
                            onChange={(e) =>
                              setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                            }
                            className="field font-mono text-xs"
                          />
                        </label>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">Category Image</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditImageType("file")}
                              className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold transition ${
                                editImageType === "file"
                                  ? "bg-orange-500 text-white"
                                  : "bg-white text-slate-600 dark:bg-white/10 dark:text-slate-300"
                              }`}
                            >
                              <UploadCloud className="size-3" /> Upload New File
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditImageType("url")}
                              className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold transition ${
                                editImageType === "url"
                                  ? "bg-orange-500 text-white"
                                  : "bg-white text-slate-600 dark:bg-white/10 dark:text-slate-300"
                              }`}
                            >
                              <Link2 className="size-3" /> Image URL
                            </button>
                          </div>
                        </div>

                        <div className="mt-2.5">
                          {editImageType === "file" ? (
                            <div className="grid gap-3 sm:grid-cols-[1fr_80px] items-center">
                              <div
                                onClick={() => editFileRef.current?.click()}
                                className="cursor-pointer rounded-xl border border-dashed border-slate-300 bg-white p-3 text-center transition hover:border-orange-400 dark:border-white/15 dark:bg-white/5"
                              >
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                  {editImageFile
                                    ? editImageFile.name
                                    : "Choose new image file from device"}
                                </span>
                                <input
                                  ref={editFileRef}
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="sr-only"
                                  onChange={(e) => handleEditFileSelect(e.target.files?.[0])}
                                />
                              </div>

                              <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
                                <Image
                                  src={editImagePreview || displayImage}
                                  alt="Preview"
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-[1fr_80px] items-center">
                              <input
                                value={editImageUrl}
                                onChange={(e) => setEditImageUrl(e.target.value)}
                                className="field text-xs"
                                placeholder="Image URL (https://...)"
                              />
                              <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
                                <Image
                                  src={editImageUrl || displayImage}
                                  alt="URL preview"
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="button-secondary text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={editLoading}
                          type="submit"
                          className="button-primary bg-orange-500 text-xs hover:bg-orange-600"
                        >
                          {editLoading && <LoaderCircle className="size-3.5 animate-spin" />}
                          {editLoading ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Normal View Mode */
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5">
                          <Image
                            src={displayImage}
                            alt={category.name}
                            fill
                            unoptimized
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {category.name}
                          </h3>
                          <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                            /{category.slug}
                          </p>
                          {category.image_url && (
                            <p className="mt-0.5 line-clamp-1 max-w-md text-[11px] text-slate-400">
                              {category.image_url}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditing(category)}
                          className="button-secondary text-xs"
                        >
                          <Pencil className="size-3.5" /> Edit
                        </button>
                        <button
                          disabled={deletingId === category.id}
                          onClick={() => handleDeleteCategory(category.id, category.name)}
                          className="button-secondary text-xs text-rose-600 hover:border-rose-300 hover:text-rose-700"
                        >
                          {deletingId === category.id ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
