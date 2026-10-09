"use client";

import { useCallback, type MouseEvent, type KeyboardEvent, type ReactNode } from "react";

export function ClickableRow({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const navigate = useCallback((event?: MouseEvent<HTMLTableRowElement>) => {
    if (event && (event.defaultPrevented || (event.target as HTMLElement).closest("a,button,input,select,textarea,[role='menu']"))) return;
    window.location.assign(href);
  }, [href]);
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest("a,button,input,select,textarea,[role='menu']")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate();
    }
  };
  return <tr role="link" tabIndex={0} onClick={navigate} onKeyDown={onKeyDown} className={`cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--pagination-accent)] ${className}`}>{children}</tr>;
}

export function ClickableCard({
  href,
  children,
  className = "",
  enabled = true,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  enabled?: boolean;
}) {
  const navigate = useCallback((event?: MouseEvent<HTMLElement>) => {
    if (event && (event.defaultPrevented || (event.target as HTMLElement).closest("a,button,input,select,textarea,[role='menu']"))) return;
    window.location.assign(href);
  }, [href]);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a,button,input,select,textarea,[role='menu']")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate();
    }
  };
  return <article role={enabled ? "link" : undefined} tabIndex={enabled ? 0 : undefined} onClick={enabled ? navigate : undefined} onKeyDown={enabled ? onKeyDown : undefined} className={`${enabled ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--pagination-accent)]" : ""} ${className}`}>{children}</article>;
}
