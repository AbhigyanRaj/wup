"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/* --------------------------------------------------------------------------
   Shared overlay + motion helpers (also used by drawer.tsx and command.tsx)
   -------------------------------------------------------------------------- */

export const EASE_STANDARD = [0.2, 0, 0, 1] as const;

/** Kit mega-menu backdrop: black at 18% plus a 6px blur. */
export const overlayClass =
  "fixed inset-0 z-[100] bg-black/[0.18] backdrop-blur-[6px]";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", cb);
    return () => mql.removeEventListener("change", cb);
  };
}

/** SSR-safe media query hook (false on the server). */
export function useMediaQuery(query: string) {
  const subscribe = React.useMemo(() => subscribeMedia(query), [query]);
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Radix returns focus to Dialog.Trigger on close. These primitives are
 * controlled (no Trigger), so remember whatever opened the overlay and return
 * focus there. If it was a menu item (unmounted by then), use the menu trigger.
 */
const TABBABLE =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useReturnFocus(initialFocusRef?: React.RefObject<HTMLElement | null>) {
  const returnTo = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus(e: Event) {
      let el = document.activeElement as HTMLElement | null;
      const menu = el?.closest<HTMLElement>('[role="menu"]');
      if (menu?.id) {
        el = document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menu.id)}"]`) ?? el;
      }
      returnTo.current = el;
      // Defer initial focus by one task. Otherwise the key event that opened the
      // overlay (Enter on a menu item) lands on the newly focused button and
      // immediately activates it (e.g. Cancel closes a ConfirmDialog).
      e.preventDefault();
      const container = e.currentTarget as HTMLElement | null;
      window.setTimeout(() => {
        if (!container?.isConnected) return;
        const target =
          initialFocusRef?.current ??
          container.querySelector<HTMLElement>(TABBABLE) ??
          container;
        target.focus({ preventScroll: true });
      }, 0);
    },
    onCloseAutoFocus(e: Event) {
      const el = returnTo.current;
      if (el && el.isConnected && el !== document.body) {
        e.preventDefault();
        el.focus();
      }
    },
  };
}

/* --------------------------------------------------------------------------
   Button styles local to overlays (kept here so dialogs do not depend on the
   base button API). Kit: ink pill + soft pill, 40px min height, 15px/525.
   -------------------------------------------------------------------------- */

const pillBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 py-2 text-[15px] font-medium leading-6 transition-[background-color,box-shadow,transform,color] duration-[350ms] ease-standard active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 " +
  focusRing;

export const dialogButtonClass = {
  ink: cn(
    pillBase,
    "bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)] hover:bg-[#363944]",
  ),
  soft: cn(
    pillBase,
    "bg-sf-secondary text-tx shadow-[inset_0_2px_0_rgba(200,200,200,0.1),inset_0_-1px_0_rgba(0,0,0,0.05)] hover:bg-sf-white hover:shadow-[inset_0_0_0_1px_#e6e6e6]",
  ),
  danger: cn(
    pillBase,
    "bg-red-50 text-red-400 shadow-[inset_0_0_0_1px_rgba(235,161,143,0.5)] hover:bg-red-100",
  ),
};

/* --------------------------------------------------------------------------
   Dialog
   -------------------------------------------------------------------------- */

export type DialogSize = "sm" | "md" | "lg";

const sizeClass: Record<DialogSize, string> = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[720px]",
};

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: DialogSize;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Element to focus when the dialog opens (defaults to the first focusable). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Hide the top-right close button (Esc and overlay click still close). */
  hideClose?: boolean;
  /** ARIA role override, e.g. "alertdialog" for confirmations. */
  role?: "dialog" | "alertdialog";
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  children,
  footer,
  initialFocusRef,
  hideClose,
  role,
  className,
}: DialogProps) {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const focusHandlers = useReturnFocus(initialFocusRef);
  const reduce = useReducedMotion();
  const duration = reduce ? 0 : 0.2;

  const panelMotion = isMobile
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
    : {
        initial: { opacity: 0, scale: 0.97, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97, y: 8 },
      };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className={overlayClass}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration, ease: EASE_STANDARD }}
              />
            </DialogPrimitive.Overlay>
            <div className="pointer-events-none fixed inset-0 z-[101] flex items-end justify-center sm:items-center sm:p-6">
              <DialogPrimitive.Content
                asChild
                forceMount
                {...(role ? { role } : {})}
                {...focusHandlers}
                {...(description ? {} : { "aria-describedby": undefined })}
              >
                <motion.div
                  {...panelMotion}
                  transition={{ duration: reduce ? 0 : isMobile ? 0.3 : 0.2, ease: EASE_STANDARD }}
                  className={cn(
                    "pointer-events-auto relative flex max-h-[calc(100dvh-24px)] w-full flex-col bg-sf-white text-tx",
                    "rounded-t-3xl border border-b-0 border-st-secondary shadow-card",
                    "sm:max-h-[calc(100dvh-48px)] sm:rounded-2xl sm:border-b",
                    "pb-[env(safe-area-inset-bottom)] sm:pb-0",
                    "focus:outline-none",
                    sizeClass[size],
                    className,
                  )}
                >
                  {/* Grab handle on the mobile bottom sheet (decorative). */}
                  <span
                    aria-hidden="true"
                    className="mx-auto mt-2.5 block h-1 w-9 shrink-0 rounded-full bg-st sm:hidden"
                  />
                  <div className="flex shrink-0 items-start gap-4 px-6 pt-4 sm:pt-6">
                    <div className="min-w-0 flex-1">
                      <DialogPrimitive.Title className="text-[20px] font-medium leading-[1.3] tracking-[-0.015em] text-tx">
                        {title}
                      </DialogPrimitive.Title>
                      {description ? (
                        <DialogPrimitive.Description className="mt-1.5 text-[15px] leading-[1.6] text-tx-tertiary">
                          {description}
                        </DialogPrimitive.Description>
                      ) : null}
                    </div>
                    {hideClose ? null : (
                      <DialogPrimitive.Close
                        aria-label="Close"
                        className={cn(
                          "-mr-2 -mt-1.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-tx-tertiary transition-colors duration-200 ease-standard hover:bg-sf-secondary hover:text-tx",
                          focusRing,
                        )}
                      >
                        <X className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
                      </DialogPrimitive.Close>
                    )}
                  </div>
                  {children ? (
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-6 text-[15px] leading-[1.6] text-tx-secondary">
                      {children}
                    </div>
                  ) : footer ? null : (
                    <div className="h-6 shrink-0" />
                  )}
                  {footer ? (
                    <div
                      className={cn(
                        "flex shrink-0 flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end",
                        children ? "border-t border-st-secondary py-4" : "pt-6 pb-6",
                      )}
                    >
                      {footer}
                    </div>
                  ) : null}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/** Use inside a Dialog footer to render a close action that keeps Radix semantics. */
export const DialogClose = DialogPrimitive.Close;

/* --------------------------------------------------------------------------
   ConfirmDialog
   -------------------------------------------------------------------------- */

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** May return a promise; the dialog shows a pending state and closes when it resolves. */
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const [pending, setPending] = React.useState(false);

  async function handleConfirm() {
    try {
      setPending(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title={title}
      description={body}
      size="sm"
      role="alertdialog"
      hideClose
      initialFocusRef={cancelRef}
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            className={dialogButtonClass.soft}
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? dialogButtonClass.danger : dialogButtonClass.ink}
            onClick={handleConfirm}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
