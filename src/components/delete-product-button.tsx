"use client";

import { Trash2 } from "lucide-react";

export function DeleteProductButton() {
  function confirmDelete(event: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm("Delete this product permanently? This action cannot be undone.")) {
      event.preventDefault();
    }
  }

  return <button type="submit" onClick={confirmDelete} className="flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Delete product"><Trash2 className="size-4" /><span>Delete</span></button>;
}
