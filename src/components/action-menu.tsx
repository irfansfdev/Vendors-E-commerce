"use client";

import { MoreHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

export function ActionMenu({ label, children, disabled = false }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192;
    const menuHeight = menuRef.current?.offsetHeight ?? 220;
    setPosition({
      top: rect.bottom + menuHeight + 8 > window.innerHeight ? Math.max(8, rect.top - menuHeight - 8) : rect.bottom + 8,
      left: Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth)),
    });
    const closeOutside = (event: MouseEvent) => {
      if (!buttonRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  return <div className="relative flex justify-end"><button ref={buttonRef} type="button" disabled={disabled} onClick={() => setOpen((value) => !value)} className="icon-button border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-white/10" aria-label={label} title={label}><MoreHorizontal className="size-4" /></button>{open && createPortal(<div ref={menuRef} onClick={(event) => { if (!(event.target as HTMLElement).closest("form")) setOpen(false); }} style={{ top: position.top, left: position.left }} className="fixed z-100 w-48 rounded-xl border-0 bg-white p-1.5 text-left shadow-xl dark:bg-slate-900">{children}</div>, document.body)}</div>;
}
