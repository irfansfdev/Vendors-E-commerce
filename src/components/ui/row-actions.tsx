"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { LoaderCircle, MoreHorizontal, type LucideIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ActionTone = "default" | "danger";

export type RowActionItem = {
  id: string;
  type: "link" | "button" | "form";
  label: string;
  icon: LucideIcon;
  href?: string;
  target?: string;
  onSelect?: () => void | Promise<void>;
  action?: (formData: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  tone?: ActionTone;
  disabled?: boolean;
  confirm?: {
    title: string;
    message: string;
    confirmLabel: string;
  };
};

const DANGER_ACTION_LABELS = [
  "delete",
  "remove",
  "remove featured",
  "cancel",
  "suspend",
  "deactivate",
  "disable",
  "block",
  "ban",
  "revoke",
  "reject",
  "reject return",
  "cancel order",
  "cancel return",
  "mark as failed",
  "void",
  "unpublish",
  "remove staff",
  "remove from shop",
] as const;

function getActionTone(label: string): ActionTone {
  const normalized = label.trim().toLowerCase();
  return DANGER_ACTION_LABELS.some((dangerLabel) =>
    normalized === dangerLabel || normalized.startsWith(`${dangerLabel} `),
  )
    ? "danger"
    : "default";
}

const ITEM_BASE_CLASSES =
  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13.5px] font-medium leading-none outline-none transition-colors";
const ITEM_TONE_CLASSES: Record<ActionTone, string> = {
  default:
    "text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10 dark:focus-visible:bg-white/10",
  danger:
    "text-rose-600 hover:bg-rose-50 focus-visible:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:focus-visible:bg-rose-500/10",
};

let openMenuId: string | null = null;
const openMenuListeners = new Set<() => void>();

function subscribeToOpenMenu(listener: () => void) {
  openMenuListeners.add(listener);
  return () => openMenuListeners.delete(listener);
}

function getOpenMenuId() {
  return openMenuId;
}

function setOpenMenuId(nextId: string | null) {
  if (openMenuId === nextId) return;
  openMenuId = nextId;
  openMenuListeners.forEach((listener) => listener());
}

function MenuItem({
  item,
  close,
  requestConfirmation,
  standalone = false,
}: {
  item: RowActionItem;
  close: () => void;
  requestConfirmation: (item: RowActionItem, run: () => void | Promise<void>) => void;
  standalone?: boolean;
}) {
  const tone = item.tone ?? getActionTone(item.label);
  const className = `${ITEM_BASE_CLASSES} ${ITEM_TONE_CLASSES[tone]} ${item.disabled ? "pointer-events-none opacity-50" : ""}`;
  const Icon = item.icon;

  if (item.type === "link") {
    return (
      <a
        href={item.href}
        target={item.target}
        role={standalone ? undefined : "menuitem"}
        tabIndex={standalone ? undefined : -1}
        aria-disabled={item.disabled || undefined}
        className={className}
        onClick={() => close()}
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{item.label}</span>
      </a>
    );
  }

  if (item.type === "form") {
    return (
      <form
        action={item.action}
        className="m-0 block"
        onSubmit={(event) => {
          if (item.disabled) {
            event.preventDefault();
            return;
          }
          if (item.confirm) {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            requestConfirmation(item, () => item.action?.(formData));
            return;
          }
          window.setTimeout(close, 0);
        }}
      >
        {Object.entries(item.hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <FormSubmitItem item={item} className={className} standalone={standalone} />
      </form>
    );
  }

  return (
    <button
      type="button"
      role={standalone ? undefined : "menuitem"}
      tabIndex={standalone ? undefined : -1}
      disabled={item.disabled}
      className={className}
      onClick={() => {
        if (item.disabled) return;
        if (item.confirm) {
          requestConfirmation(item, () => item.onSelect?.());
          return;
        }
        close();
        void item.onSelect?.();
      }}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function FormSubmitItem({
  item,
  className,
  standalone = false,
}: {
  item: RowActionItem;
  className: string;
  standalone?: boolean;
}) {
  const { pending } = useFormStatus();
  const Icon = item.icon;
  return (
    <button
      type="submit"
      role={standalone ? undefined : "menuitem"}
      tabIndex={standalone ? undefined : -1}
      disabled={item.disabled || pending}
      className={`${className} ${pending ? "pointer-events-none opacity-50" : ""}`}
    >
      {pending ? (
        <LoaderCircle className="size-4 shrink-0 animate-spin" strokeWidth={1.75} />
      ) : (
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      )}
      <span className="truncate">{item.label}</span>
    </button>
  );
}

export function RowActions({
  label = "Row actions",
  items = [],
  disabled = false,
}: {
  label?: string;
  items: RowActionItem[];
  disabled?: boolean;
}) {
  const id = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const currentOpenId = useSyncExternalStore(subscribeToOpenMenu, getOpenMenuId, () => null);
  const open = currentOpenId === id;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 8, left: 8 });
  const [confirmRequest, setConfirmRequest] = useState<{
    item: RowActionItem;
    run: () => void | Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [, startTransition] = useTransition();

  const close = useCallback((restoreFocus = false) => {
    if (getOpenMenuId() === id) setOpenMenuId(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, [id]);

  const requestConfirmation = useCallback(
    (item: RowActionItem, run: () => void | Promise<void>) => {
      close();
      setConfirmRequest({ item, run });
    },
    [close],
  );

  const chooseOpenState = () => {
    setOpenMenuId(getOpenMenuId() === id ? null : id);
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const belowTop = trigger.bottom + gap;
    const top =
      belowTop + menu.height <= window.innerHeight - margin
        ? belowTop
        : Math.max(margin, trigger.top - menu.height - gap);
    const left = Math.min(
      window.innerWidth - menu.width - margin,
      Math.max(margin, trigger.right - menu.width),
    );
    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
      if (event.key === "Tab") close();
    };
    const onViewportChange = () => close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [close, open]);

  useEffect(() => {
    close();
  }, [close, routeKey]);

  const orderedItems = [...items].sort(
    (left, right) =>
      Number((left.tone ?? getActionTone(left.label)) === "danger") -
      Number((right.tone ?? getActionTone(right.label)) === "danger"),
  );

  if (!orderedItems.length) return null;

  const singleItem = orderedItems.length === 1 ? orderedItems[0] : null;
  const singleViewLink =
    singleItem?.type === "link" && /^view(?:\s|$)/i.test(singleItem.label.trim());
  if (singleViewLink) return null;

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      close();
      return;
    }
    const menu = event.currentTarget;
    const entries = Array.from(
      menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])'),
    );
    if (!entries.length) return;
    const currentIndex = entries.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % entries.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + entries.length) % entries.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = entries.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      entries[nextIndex]?.focus();
    }
  };

  const confirmationDialog = (
    <ConfirmDialog
      open={!!confirmRequest}
      title={confirmRequest?.item.confirm?.title ?? "Confirm action"}
      message={confirmRequest?.item.confirm?.message ?? "Are you sure you want to continue?"}
      confirmLabel={confirmRequest?.item.confirm?.confirmLabel ?? confirmRequest?.item.label}
      busy={confirmBusy}
      onCancel={() => setConfirmRequest(null)}
      onConfirm={() => {
        if (!confirmRequest) return;
        setConfirmBusy(true);
        startTransition(async () => {
          try {
            await confirmRequest.run();
            setConfirmRequest(null);
          } finally {
            setConfirmBusy(false);
          }
        });
      }}
    />
  );

  if (singleItem) {
    return (
      <>
        <MenuItem
          item={singleItem}
          close={close}
          requestConfirmation={requestConfirmation}
          standalone
        />
        {confirmationDialog}
      </>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        className="grid size-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10"
        onClick={chooseOpenState}
        onKeyDown={(event) => {
          if (["Enter", " ", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            if (getOpenMenuId() === id) {
              close();
              return;
            }
            setOpenMenuId(id);
            window.requestAnimationFrame(() =>
              menuRef.current
                ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])')
                ?.focus(),
            );
          }
        }}
      >
        <MoreHorizontal className="size-4" strokeWidth={1.75} />
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close row actions"
              className="fixed inset-0 z-[99] bg-slate-950/55 sm:hidden"
              onPointerDown={(event) => {
                event.preventDefault();
                close();
              }}
            />
            <div
              ref={menuRef}
              id={id}
              role="menu"
              aria-label={label}
              onKeyDown={handleMenuKeyDown}
              style={{ top: position.top, left: position.left }}
              className="row-actions-popover fixed z-[100] w-52 max-h-[calc(100dvh-16px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[85dvh] max-sm:w-full max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-b-0 max-sm:px-2 max-sm:pb-[calc(env(safe-area-inset-bottom)+0.5rem)] max-sm:pt-2"
            >
              <div className="flex flex-col gap-0.5 max-sm:gap-1">
                {orderedItems.map((item) => (
                  <MenuItem
                    key={item.id}
                    item={item}
                    close={close}
                    requestConfirmation={requestConfirmation}
                  />
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
      {confirmationDialog}
    </>
  );
}
