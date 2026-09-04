"use client";

import { Trash2 } from "lucide-react";

export function DeleteProductButton() {
  function confirmDelete(event: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm("Delete this product permanently? This action cannot be undone.")) {
      event.preventDefault();
    }
  }

  return <button type="submit" onClick={confirmDelete} className="button-secondary text-rose-600" title="Delete product"><Trash2 className="size-4" /><span className="hidden sm:inline">Delete</span></button>;
}
